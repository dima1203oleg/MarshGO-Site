import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowLeft, ArrowRight, Bookmark, ChevronDown, Clock3, Heart, Map as MapIcon, Navigation, Play, Share2, Shuffle, X,
} from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import { BrandMark } from '../components/BrandMark';
import { useMagneticDomino } from '../components/useMagneticDomino';
import { MapLayersControl } from '../components/MapLayersControl';
import { MapBasemapControl, MapControlRail, MapPerspectiveControl, MapVoiceControl, MapZoomControls } from '../components/MapInteractionControls';
import { buildJourneyRouteMapModel, confirmedJourneySegments, formatTransferCount, journeyModeColor } from '../map/journeyRouteModel';
import { isValidCoordinate } from '../map/lineGeometry';
import { corridorFitPoints } from '../map/routeContextCorridor';
import type { MapAdapter, MapStatus, RouteFitPadding } from '../map/MapAdapter';
import { mapStatusDetail, mapStatusNote } from '../map/mapStatusCopy';
import { productionApi, hasApiSession, ProductionApiError, type ApiJourney, type ApiJourneyLive } from '../services/productionApi';
import { TransportIcon } from '../design-system/transport/TransportIcon';
import { journeyLegCaveat, journeyLegLabel } from './journeyLegLabel';
import { legLabel, walkHintFor } from './journeyWalkHint';
import { diagnosticsRequested } from './resultsDiagnostics';
import {
  journeyArrivalDayNote,
  formatJourneyDuration as formatDuration,
  formatJourneyDurationTile,
  formatJourneyDistance,
  journeyRouteBadge,
} from './journeyResultPresentation';
import { journeyPriceDisplay, legPriceDisplay } from './cashFare';
import {
  createFrameWriter,
  fitCollapsedRouteSheetHeight,
  fitExpandedRouteSheetHeight,
  fitMediumRouteSheetHeight,
  prefersReducedMotion,
  recoverRouteSheetDrag,
  ROUTE_SHEET_LOGICAL_LABELS,
  routeSheetHeights,
  routeSheetTransition,
  settleRouteSheetSnap,
  subscribeReducedMotion,
  type RouteSheetSnap,
} from './routeSheet';
import { themeService } from '../services/theme';
import { buildRouteMapAnnotations, formatSegmentCount, formatStopCount, primaryTransitLeg } from './routeMapAnnotations';
import { focusedApproachVehicles, passengerContextLines, priorityLevelOf } from '../map/transportVisualZones';
import { JourneyLegStops, isScheduledRouteLeg } from './JourneyLegStops';
import { nextStopsLegId, sheetNeedsRaiseForStops, stopsDetent } from './journeyStopsPanel';
import { useFocusedFleetClock } from './useFocusedFleetClock';
import './routeSheetDensity.css';
import { calculateAdaptiveMapPadding } from '../map/mapViewportCoordinator';
import { measureGlobalBottomNavigationInset } from './globalBottomNavigationInset';
import { sensory } from '../sensory';
import {
  RouteCameraController,
  calculateSegmentFocusTarget,
  initialRouteCameraState,
  shouldShowRecenterButton,
  type RouteCameraMode,
} from '../map/routeCameraController';
import { cleanStopName } from '../map/cinematicRouteEngine';
import { cameraEasing } from '../map/cameraMotion';
import { SEGMENT_REVEAL_TOKENS } from '../map/routeGeometryTokens';
import type { Coordinate } from '../../shared/navigation/contracts';

type JourneyLeg = ApiJourney['legs'][number];
type TimelineItem = {
  id: string;
  targetLegId: string;
  kind: 'LEG' | 'WAIT';
  durationSeconds: number;
  color: string;
  leg?: JourneyLeg;
};

const formatTime = (value?: string) => {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  const minute = new Date(value);
  minute.setSeconds(0, 0);
  return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(minute);
};

function timelineFor(journey: ApiJourney): TimelineItem[] {
  const legs = journey.legs;
  const items: TimelineItem[] = [];
  let cursor = journey.requestedDepartureAt && Number.isFinite(Date.parse(journey.requestedDepartureAt))
    ? Date.parse(journey.requestedDepartureAt)
    : legs[0] ? Date.parse(legs[0].departureAt) : 0;
  for (const leg of legs) {
    const departure = Date.parse(leg.departureAt);
    const arrival = Date.parse(leg.arrivalAt);
    const waitSeconds = Number.isFinite(departure) && cursor > 0 ? Math.max(0, Math.round((departure - cursor) / 1000)) : 0;
    if (waitSeconds > 0) items.push({ id: `wait:${leg.id}`, targetLegId: leg.id, kind: 'WAIT', durationSeconds: waitSeconds, color: '#74879A' });
    const timestampDuration = Number.isFinite(departure) && Number.isFinite(arrival) ? Math.max(0, Math.round((arrival - departure) / 1000)) : 0;
    const durationSeconds = timestampDuration || Math.max(0, leg.durationSeconds);
    items.push({ id: `leg:${leg.id}`, targetLegId: leg.id, kind: 'LEG', durationSeconds, color: journeyModeColor(leg.mode, leg.transportType), leg });
    if (Number.isFinite(arrival)) cursor = arrival;
  }
  return items.filter(item => item.durationSeconds > 0);
}

function legTimeLabel(leg: JourneyLeg, durationSeconds: number) {
  const departure = formatTime(leg.departureAt);
  const arrival = formatTime(leg.arrivalAt);
  const duration = formatDuration(durationSeconds);
  return departure === arrival && durationSeconds < 60
    ? `${departure} · ${duration}`
    : `${departure}–${arrival} · ${duration}`;
}

type RibbonItem = {
  id: string;
  label: string;
  badge?: string | null;
  detail: string;
  color: string;
  durationSeconds: number;
  leg: JourneyLeg;
};

/**
 * A transfer is a property of the pair of legs it joins, so it belongs between
 * their two cards in the sheet — not in a floating map callout that can land on
 * top of either card. Walk legs already explain their own transfer, so only
 * transit→transit joins get a row here.
 */
type InlineTransferHint = {
  id: string;
  nextLeg: JourneyLeg;
  coordinate: Coordinate;
  contextPoints: Coordinate[];
  waitSeconds: number;
};

function inlineTransferHints(legs: JourneyLeg[]): Map<string, InlineTransferHint> {
  const hints = new Map<string, InlineTransferHint>();
  legs.forEach((leg, index) => {
    const next = legs[index + 1];
    if (!next || leg.mode === 'WALK' || next.mode === 'WALK') return;
    const rawCoordinate = next.origin?.coordinates ?? leg.destination?.coordinates;
    if (!rawCoordinate || rawCoordinate.length !== 2) return;
    const coordinate: Coordinate = [rawCoordinate[0], rawCoordinate[1]];
    const waitMs = Date.parse(next.departureAt) - Date.parse(leg.arrivalAt);
    hints.set(leg.id, {
      id: `transfer:${leg.id}:${next.id}`,
      nextLeg: next,
      coordinate,
      contextPoints: [leg.coordinates?.at(-1) ?? coordinate, next.coordinates?.[0] ?? coordinate],
      waitSeconds: Number.isFinite(waitMs) ? Math.max(0, Math.round(waitMs / 1000)) : 0,
    });
  });
  return hints;
}

export function JourneyRouteMapScreen({
  journey,
  alternativeDepartures = [],
  onSelectAlternative,
  recommendation,
  notice,
  onBack,
  backLabel = 'Назад до результатів',
  onBookOffer,
  onStartJourney,
  starting = false,
}: {
  journey: ApiJourney;
  /** Same-shape departures grouped under the result card, available from the detail sheet. */
  alternativeDepartures?: ApiJourney[];
  onSelectAlternative?: (journey: ApiJourney) => void;
  recommendation?: string;
  notice?: string | null;
  onBack: () => void;
  backLabel?: string;
  onBookOffer?: (offerId: string, journeyId: string, journeyLegId: string) => void;
  /** Opens the active stage map for this itinerary; the route is never re-entered. */
  onStartJourney?: () => void;
  starting?: boolean;
}) {
  const showDiagnostics = typeof window !== 'undefined' && diagnosticsRequested(
    window.location.search,
    (() => { try { return window.localStorage.getItem('marshgo.results.diagnostics'); } catch { return null; } })(),
  );
  const model = useMemo(() => buildJourneyRouteMapModel(journey.legs), [journey.legs]);
  const confirmedSegments = useMemo(() => confirmedJourneySegments(model.routeSegments), [model.routeSegments]);
  const timeline = useMemo(() => timelineFor(journey), [journey]);
  const firstLeg = journey.legs[0];
  const lastLeg = journey.legs.at(-1);
  const primaryLeg = useMemo(() => primaryTransitLeg(journey.legs), [journey.legs]);
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [isDark, setIsDark] = useState(themeService.isDark());

  // The reference route-details screen opens with its itinerary in view while
  // leaving a usable map band above the sheet. Keep the other three detents
  // available for passengers who want more map space.
  const [sheetSnap, setSheetSnap] = useState<RouteSheetSnap>('expanded');
  const [sheetHeight, setSheetHeight] = useState(() => {
    if (typeof window === 'undefined') return 316;
    const availableHeight = Math.max(320, window.innerHeight - measureGlobalBottomNavigationInset());
    return routeSheetHeights(availableHeight).expanded;
  });
  const [collapsedContentHeight, setCollapsedContentHeight] = useState<number | null>(null);
  const [mediumContentHeight, setMediumContentHeight] = useState<number | null>(null);
  const [expandedContentHeight, setExpandedContentHeight] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === 'undefined' ? 844 : window.innerHeight);
  const [bottomNavigationInset, setBottomNavigationInset] = useState(measureGlobalBottomNavigationInset);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 390 : window.innerWidth);
  const draggingRef = useRef(false);

  // Centralized RouteCameraController
  const [cameraMode, setCameraMode] = useState<RouteCameraMode>('ROUTE_OVERVIEW');
  // Open the itinerary focused on its primary real transit leg. This gives
  // the passenger the same immediate map context as the route-details design:
  // a visible route ribbon and the matching selected card, without changing
  // journey progress or inventing geometry.
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(() => primaryLeg?.id ?? null);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const cameraController = useRef<RouteCameraController | null>(null);
  if (cameraController.current === null) {
    cameraController.current = new RouteCameraController({
      onStateChange: (state) => {
        setCameraMode(state.mode);
        setActiveSegmentId(state.activeSegmentId);
        setActiveStopId(state.activeStopId);
        setActiveTransferId(state.activeTransferId);
      },
    });
  }

  const [mapSegmentChoices, setMapSegmentChoices] = useState<{ ids: string[]; x: number; y: number } | null>(null);
  const [liveJourney, setLiveJourney] = useState<ApiJourneyLive | null>(null);
  const [mapAdapterReady, setMapAdapterReady] = useState(false);

  const initialExpandedStopsLeg = journey.legs.find(leg =>
    isScheduledRouteLeg(leg) && (leg.stops?.length ?? 0) > 0 && (leg.stops?.length ?? 0) <= 8,
  );
  const [stopsLegId, setStopsLegId] = useState<string | null>(() => initialExpandedStopsLeg?.id ?? null);
  const transferHints = useMemo(() => inlineTransferHints(journey.legs), [journey.legs]);
  const revealAnimRef = useRef<number | null>(null);
  const revealTimersRef = useRef<number[]>([]);
  const activeRevealLegId = useRef<string | null>(null);
  const [scale, setScale] = useState<{ label: string; widthPx: number } | null>(null);
  const [saved, setSaved] = useState(() => {
    try { return (JSON.parse(window.localStorage.getItem('marshgo.saved-route-results.v1') ?? '[]') as unknown[]).includes(journey.id); }
    catch { return false; }
  });
  const [feedback, setFeedback] = useState('');
  const sheetElement = useRef<HTMLElement | null>(null);
  const sheetHeightRef = useRef(sheetHeight);
  const mapAdapter = useRef<MapAdapter | null>(null);
  const segmentCards = useRef(new Map<string, HTMLElement>());
  const dragStart = useRef<{ y: number; height: number; pointerId: number; moved: boolean; lastY: number; lastAt: number; velocity: number } | null>(null);
  const suppressHandleClick = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const dragWriter = useRef<ReturnType<typeof createFrameWriter> | null>(null);
  if (dragWriter.current === null) {
    dragWriter.current = createFrameWriter((height) => {
      const sheet = sheetElement.current;
      if (!sheet) return;
      sheet.style.transition = 'none';
      sheet.style.height = `${height}px`;
    });
  }

  useEffect(() => themeService.subscribe((_theme, dark) => setIsDark(dark)), []);
  useEffect(() => subscribeReducedMotion(setReducedMotion), []);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);
  useEffect(() => {
    const writer = dragWriter.current;
    return () => writer?.discard();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(''), 2800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const selectedLeg = activeSegmentId ? journey.legs.find(leg => leg.id === activeSegmentId) : undefined;
  const liveLeg = selectedLeg && isScheduledRouteLeg(selectedLeg) ? selectedLeg : primaryLeg ?? undefined;
  const liveLegId = liveLeg?.id ?? null;
  const liveSegment = liveJourney?.segments.find(segment => segment.legId === liveLegId);
  const fleetClock = useFocusedFleetClock(liveSegment?.vehicles);

  useEffect(() => {
    if (!liveLegId) {
      setLiveJourney(null);
      return;
    }
    if (!hasApiSession()) {
      setLiveJourney(null);
      return;
    }
    let stopped = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let reschedule = true;
    const poll = async () => {
      controller = new AbortController();
      reschedule = true;
      try {
        const live = await productionApi.journeyLive(journey.id, liveLegId, controller.signal);
        if (!stopped) {
          setLiveJourney(live);
        }
      } catch (error) {
        if (!stopped) {
          setLiveJourney(null);
          if (error instanceof ProductionApiError && error.status === 401) reschedule = false;
        }
      }
      if (!stopped && reschedule) timer = window.setTimeout(() => void poll(), 15_000);
    };
    void poll();
    return () => { stopped = true; controller?.abort(); if (timer !== undefined) window.clearTimeout(timer); };
  }, [journey.id, liveLegId]);

  useEffect(() => {
    if (!mapAdapterReady) return;
    if (!liveSegment || !liveLeg) {
      mapAdapter.current?.setFocusedTransitOverlay?.(null);
      mapAdapter.current?.setLiveTransitPosition?.(null);
      return;
    }
    mapAdapter.current?.setLiveTransitPosition?.(null);
    mapAdapter.current?.setFocusedTransitOverlay?.({
      color: journeyModeColor(liveLeg.mode, liveLeg.transportType),
      transportType: liveLeg.transportType ?? liveLeg.mode,
      lineRoutes: (liveSegment.lineRoutes ?? []).map(route => ({
        id: route.id,
        direction: route.direction,
        directionId: route.directionId,
        coordinates: route.coordinates,
        geometryScope: route.geometryScope,
        zones: route.zones ?? null,
      })),
      vehicles: focusedApproachVehicles(liveSegment.vehicles ?? [], fleetClock).map(vehicle => ({
        id: vehicle.id,
        coordinates: vehicle.coordinates,
        updatedAt: vehicle.updatedAt,
        routeLabel: liveLeg.routeName ?? journeyLegLabel(liveLeg.mode, liveLeg.transportType),
        emphasized: vehicle.emphasized,
        priorityLevel: priorityLevelOf(vehicle),
        etaSeconds: vehicle.etaSeconds ?? null,
        etaConfidence: vehicle.etaConfidence ?? 'NONE',
      })),
    });
  }, [liveSegment, liveLeg, mapAdapterReady, fleetClock]);

  const getSheetHeights = useCallback((viewport = viewportHeight) => {
    const heights = routeSheetHeights(Math.max(320, viewport - bottomNavigationInset));
    heights.collapsed = fitCollapsedRouteSheetHeight(heights, collapsedContentHeight);
    heights.half = fitMediumRouteSheetHeight(heights, mediumContentHeight);
    heights.expanded = fitExpandedRouteSheetHeight(heights, expandedContentHeight);
    return heights;
  }, [bottomNavigationInset, collapsedContentHeight, expandedContentHeight, mediumContentHeight, viewportHeight]);
  const snapHeight = useCallback((snap: RouteSheetSnap, viewport = viewportHeight) => getSheetHeights(viewport)[snap], [getSheetHeights, viewportHeight]);

  // Content measurement can arrive after the initial FULL detent is rendered.
  // Apply the measured fit to the visible sheet too; otherwise the snap model
  // is compact while the sheet itself keeps the viewport-sized initial height.
  useEffect(() => {
    if (draggingRef.current) return;
    const nextHeight = snapHeight(sheetSnap);
    if (Math.abs(sheetHeightRef.current - nextHeight) < 2) return;
    sheetHeightRef.current = nextHeight;
    setSheetHeight(nextHeight);
  }, [sheetSnap, snapHeight]);

  useEffect(() => {
    const recoverInterruptedDrag = () => {
      if (!draggingRef.current) return;
      const sheet = sheetElement.current;
      const pointerId = dragStart.current?.pointerId;
      const recovered = recoverRouteSheetDrag(
        sheet?.getBoundingClientRect().height ?? sheetHeightRef.current,
        getSheetHeights(),
      );
      dragWriter.current?.discard();
      dragStart.current = null;
      suppressHandleClick.current = false;
      draggingRef.current = false;
      sheetHeightRef.current = recovered.height;
      setSheetSnap(recovered.snap);
      setSheetHeight(recovered.height);
      if (sheet) {
        const handle = sheet.querySelector<HTMLElement>('.route-sheet-grabber');
        if (pointerId !== undefined && handle?.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        sheet.dataset.dragging = 'false';
        sheet.style.height = `${recovered.height}px`;
        sheet.style.transition = routeSheetTransition(false, reducedMotion);
      }
    };
    const recoverWhenHidden = () => {
      if (document.visibilityState === 'hidden') recoverInterruptedDrag();
    };
    window.addEventListener('blur', recoverInterruptedDrag);
    document.addEventListener('visibilitychange', recoverWhenHidden);
    return () => {
      window.removeEventListener('blur', recoverInterruptedDrag);
      document.removeEventListener('visibilitychange', recoverWhenHidden);
    };
  }, [getSheetHeights, reducedMotion]);

  useEffect(() => {
    if (sheetSnap !== 'collapsed' && sheetSnap !== 'half') return;
    const sheet = sheetElement.current;
    const list = sheet?.querySelector<HTMLElement>('[data-testid=route-segment-list]');
    const cta = sheet?.querySelector<HTMLElement>('.mg-route-cta')?.parentElement ?? null;
    if (!sheet || !cta) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (draggingRef.current) return;
        const currentSheetHeight = sheet.getBoundingClientRect().height;
        if (sheetSnap === 'half' && list) {
          const last = list.lastElementChild as HTMLElement | null;
          if (!last) return;
          const listRect = list.getBoundingClientRect();
          const listContentHeight = last.getBoundingClientRect().bottom - listRect.top + list.scrollTop + (parseFloat(getComputedStyle(list).paddingBottom) || 0);
          const naturalHeight = Math.ceil(currentSheetHeight - listRect.height + listContentHeight);
          setMediumContentHeight(previous => previous !== null && Math.abs(previous - naturalHeight) < 2 ? previous : naturalHeight);
          return;
        }
        const previousContent = cta.previousElementSibling;
        if (!previousContent) return;
        const freeGap = Math.max(0, cta.getBoundingClientRect().top - previousContent.getBoundingClientRect().bottom);
        const naturalHeight = Math.ceil(currentSheetHeight - freeGap);
        setCollapsedContentHeight(previous => previous !== null && Math.abs(previous - naturalHeight) < 2 ? previous : naturalHeight);
      });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(cta);
    if (sheetSnap === 'half' && list) Array.from(list.children).forEach(child => observer?.observe(child));
    else if (cta.previousElementSibling) observer?.observe(cta.previousElementSibling);
    measure();
    return () => { observer?.disconnect(); cancelAnimationFrame(frame); };
  }, [sheetSnap, sheetHeight, timeline, viewportWidth, stopsLegId, alternativeDepartures.length]);

  useEffect(() => {
    if (sheetSnap !== 'expanded') return;
    const sheet = sheetElement.current;
    const list = sheet?.querySelector<HTMLElement>('[data-testid=route-segment-list]');
    if (!sheet || !list) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (draggingRef.current || !list.lastElementChild) return;
        const last = list.lastElementChild as HTMLElement;
        const listContentHeight = last.getBoundingClientRect().bottom - list.getBoundingClientRect().top + list.scrollTop + (parseFloat(getComputedStyle(list).paddingBottom) || 0);
        const desired = Math.ceil(sheet.getBoundingClientRect().height - list.getBoundingClientRect().height + listContentHeight);
        setExpandedContentHeight(previous => previous !== null && Math.abs(previous - desired) < 2 ? previous : desired);
      });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    Array.from(list.children).forEach(child => observer?.observe(child));
    measure();
    return () => { observer?.disconnect(); cancelAnimationFrame(frame); };
  }, [sheetSnap, stopsLegId, timeline, viewportWidth, alternativeDepartures.length]);

  useEffect(() => {
    const updateViewport = () => {
      const nextH = window.innerHeight;
      const nextW = window.innerWidth;
      const nextNavigationInset = measureGlobalBottomNavigationInset();
      setViewportHeight(nextH);
      setViewportWidth(nextW);
      setBottomNavigationInset(nextNavigationInset);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const mapUnavailable = mapStatus === 'failed';

  const isDesktop = viewportWidth >= 1024;
  const settledHeight = snapHeight(sheetSnap);
  // The live chip floats just above the sheet in MEDIUM/COMPACT, inside the
  // band a camera fit would otherwise use for the last focus point.
  const floatingChipVisible = Boolean(liveLeg) && sheetSnap !== 'peek' && sheetSnap !== 'expanded';

  // Dynamic visible map padding calculation
  const mapPadding = useMemo<RouteFitPadding>(() => calculateAdaptiveMapPadding({
    viewportWidth,
    viewportHeight,
    sheetHeight: settledHeight,
    sheetSnap,
    // 102 px is the measured compact header (top 8 + row 44 + gap 6 + address 36 + bottom 8).
    topBarHeight: 100,
    isDesktop,
    hasWarningNote: mapUnavailable,
    extraBottomInset: bottomNavigationInset + (floatingChipVisible ? 58 : 0),
  }), [bottomNavigationInset, floatingChipVisible, isDesktop, mapUnavailable, settledHeight, sheetSnap, viewportHeight, viewportWidth]);

  // Segment orientation follows the real camera band after route and sheet insets.
  const visibleMapArea = useMemo(() => ({
    width: Math.max(1, viewportWidth - (mapPadding.left ?? 0) - (mapPadding.right ?? 0)),
    height: Math.max(1, viewportHeight - (mapPadding.top ?? 0) - (mapPadding.bottom ?? 0)),
  }), [mapPadding, viewportHeight, viewportWidth]);

  const routeLinePoints = useMemo(() => {
    const itinerary = confirmedSegments.flatMap(segment => segment.coordinates);
    const lineRoutes = liveSegment?.lineRoutes ?? [];
    const contextLines = passengerContextLines(lineRoutes);
    return corridorFitPoints(itinerary, contextLines);
  }, [liveSegment, confirmedSegments]);

  const routeFitKey = useMemo(() => {
    if (routeLinePoints.length < 2) return `points:${routeLinePoints.length}`;
    const first = routeLinePoints[0]!;
    const last = routeLinePoints.at(-1)!;
    return `${routeLinePoints.length}:${first[0].toFixed(4)},${first[1].toFixed(4)}:${last[0].toFixed(4)},${last[1].toFixed(4)}`;
  }, [routeLinePoints]);

  const segmentFocus = useMemo(() => {
    const segment = activeSegmentId ? confirmedSegments.find(item => item.id === activeSegmentId) : undefined;
    if (!segment || segment.coordinates.length < 2) return null;
    const live = liveJourney?.segments.find(item => item.legId === segment.id);
    const contextLines = passengerContextLines(live?.lineRoutes ?? []);
    const firstJourneyLeg = journey.legs[0];
    const verifiedWalkToBoarding = segment.id === primaryLeg?.id && firstJourneyLeg?.mode === 'WALK'
      ? confirmedSegments.find(item => item.id === firstJourneyLeg.id)?.coordinates
      : undefined;
    if (verifiedWalkToBoarding?.length) contextLines.push(verifiedWalkToBoarding);
    const target = calculateSegmentFocusTarget(segment.coordinates, contextLines, segment.id, visibleMapArea);
    // A verified origin coordinate can widen the camera fit without drawing a
    // synthetic connector when the walking leg itself has only estimated shape.
    const origin = firstJourneyLeg?.origin.coordinates;
    if (target && segment.id === primaryLeg?.id && firstJourneyLeg?.mode === 'WALK' && isValidCoordinate(origin)) {
      return {
        ...target,
        points: [...target.points, origin],
        key: `${target.key}:journey-origin:${origin[0].toFixed(5)},${origin[1].toFixed(5)}`,
      };
    }
    return target;
  }, [activeSegmentId, liveJourney, confirmedSegments, visibleMapArea, journey.legs, primaryLeg?.id]);

  const segmentFocusKey = segmentFocus?.key ?? null;

  // Keep the map's key route anchors visible like the reference detail screen.
  // Route labels use only provider-backed coordinates; walking hints remain in
  // the sheet so map callouts do not duplicate its compact guidance rows.
  const routeLabels = useMemo(() => {
    const keyStops = buildRouteMapAnnotations({
      journey,
      live: liveJourney,
      preferredLegId: activeSegmentId ?? primaryLeg?.id,
      focusedOnly: true,
      now: fleetClock,
    }).filter(annotation => annotation.kind === 'BOARDING' || annotation.kind === 'ALIGHTING')
      .map(annotation => ({ ...annotation, tone: 'blue' as const }));
    const reportedOrigin = firstLeg?.origin.coordinates;
    const verifiedWalkOrigin = firstLeg?.mode === 'WALK'
      ? confirmedSegments.find(segment => segment.id === firstLeg.id)?.coordinates[0]
      : undefined;
    const origin = isValidCoordinate(reportedOrigin) ? reportedOrigin : verifiedWalkOrigin;
    const start = isValidCoordinate(origin) ? [{
      id: `journey-start:${journey.id}`,
      kind: 'ROUTE' as const,
      coordinates: origin,
      title: 'Старт',
      tone: 'blue' as const,
    }] : [];
    return [...start, ...keyStops];
  }, [activeSegmentId, confirmedSegments, firstLeg, fleetClock, journey, liveJourney, primaryLeg?.id]);

  // Sync camera controller with adapter and padding
  useEffect(() => {
    const controller = cameraController.current;
    if (!controller) return;
    controller.setAdapter(mapAdapter.current);
    controller.setPadding(mapPadding);
  }, [mapAdapterReady, mapPadding]);

  // Handle snap change camera re-fitting
  useEffect(() => {
    // MapLibre can attach its adapter before the style/route layers have
    // finished loading. Refit once the map reports ready, otherwise a freshly
    // opened detail sheet can leave the route at the national default zoom.
    if (draggingRef.current || !mapAdapterReady || mapStatus !== 'available') return;
    const controller = cameraController.current;
    if (!controller) return;
    controller.setPadding(mapPadding);
    // The initial selected leg is seeded before the map adapter is ready. Once
    // geometry and the map are both available, enter the same focused camera
    // state used by an intentional card tap instead of leaving a tiny overview
    // route behind a visually selected card.
    if (controller.getState().mode === 'ROUTE_OVERVIEW' && activeSegmentId && segmentFocus) {
      controller.focusSegment(activeSegmentId, segmentFocus, routeLinePoints);
      return;
    }
    controller.syncOnSnapSettled({
      routePoints: routeLinePoints,
      segmentTarget: segmentFocus,
    });
  }, [activeSegmentId, mapAdapterReady, mapPadding, mapStatus, routeFitKey, segmentFocus, segmentFocusKey, sheetSnap]);

  useEffect(() => {
    if (sheetSnap === 'expanded') return;
    const readScale = () => setScale(mapAdapter.current?.getScaleLabel?.(88) ?? null);
    const t1 = window.setTimeout(readScale, 350);
    const t2 = window.setTimeout(readScale, 750);
    const t3 = window.setTimeout(readScale, 1300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [mapPadding, mapAdapterReady, routeFitKey, segmentFocusKey, sheetSnap]);

  const cameraFeedbackPending = useRef(false);
  const showWholeRoute = useCallback(() => {
    if (mapAdapter.current && routeLinePoints.length >= 2) {
      cameraFeedbackPending.current = true;
      sensory.stopAll();
      sensory.emit({ type: 'CAMERA_FLIGHT_STARTED', effort: 1 });
    }
    setActiveSegmentId(null);
    setActiveTransferId(null);
    if (revealAnimRef.current) {
      cancelAnimationFrame(revealAnimRef.current);
      revealAnimRef.current = null;
    }
    revealTimersRef.current.forEach(timer => window.clearTimeout(timer));
    revealTimersRef.current = [];
    mapAdapter.current?.clearSegmentReveal?.();
    cameraController.current?.showOverview(routeLinePoints);
  }, [routeLinePoints]);

  const chooseSegment = useCallback((id: string) => {
    setMapSegmentChoices(null);
    if (activeSegmentId === id) {
      showWholeRoute();
    } else {
      sensory.emit({ type: 'SEGMENT_SELECTED', segmentId: id });
      const leg = journey.legs.find(item => item.id === id);
      const seg = confirmedSegments.find(s => s.id === id);
      const target = seg ? calculateSegmentFocusTarget(seg.coordinates, [], id, visibleMapArea) : null;
      cameraController.current?.focusSegment(id, target, routeLinePoints);

      if (leg) {
        if (revealAnimRef.current) {
          cancelAnimationFrame(revealAnimRef.current);
          revealAnimRef.current = null;
        }
        revealTimersRef.current.forEach(timer => window.clearTimeout(timer));
        revealTimersRef.current = [];
        if (!reducedMotion && seg && seg.coordinates.length >= 2) {
          const fullCoords = seg.coordinates;
          const color = journeyModeColor(leg.mode, leg.transportType);
          const startTime = performance.now();
          const ease = cameraEasing();
          activeRevealLegId.current = id;

          const animateReveal = (now: number) => {
            if (activeRevealLegId.current !== id) return;
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / SEGMENT_REVEAL_TOKENS.durationMs);
            mapAdapter.current?.revealSegmentProgress?.(fullCoords, color, ease(progress));

            if (progress < 1) {
              revealAnimRef.current = requestAnimationFrame(animateReveal);
            } else {
              revealAnimRef.current = null;
              revealTimersRef.current.push(window.setTimeout(() => {
                if (activeRevealLegId.current !== id) return;
                mapAdapter.current?.fadeSegmentReveal?.();
                revealTimersRef.current.push(window.setTimeout(() => {
                  if (activeRevealLegId.current === id) {
                    mapAdapter.current?.clearSegmentReveal?.();
                  }
                }, SEGMENT_REVEAL_TOKENS.fadeMs));
              }, SEGMENT_REVEAL_TOKENS.holdMs));
            }
          };

          revealAnimRef.current = requestAnimationFrame(animateReveal);
        } else {
          mapAdapter.current?.clearSegmentReveal?.();
        }
      }
    }
    requestAnimationFrame(() => segmentCards.current.get(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
    }));
  }, [activeSegmentId, journey.legs, liveJourney?.segments, confirmedSegments, reducedMotion, routeLinePoints, showWholeRoute, visibleMapArea]);

  const chooseTransfer = useCallback((hint: InlineTransferHint) => {
    if (activeTransferId === hint.id) {
      showWholeRoute();
      return;
    }
    sensory.emit({ type: 'SEGMENT_SELECTED', segmentId: hint.id });
    cameraController.current?.focusTransfer(hint.id, hint.coordinate, hint.contextPoints);
  }, [activeTransferId, showWholeRoute]);

  useEffect(() => {
    return () => {
      if (revealAnimRef.current) {
        cancelAnimationFrame(revealAnimRef.current);
      }
      revealTimersRef.current.forEach(timer => window.clearTimeout(timer));
      mapAdapter.current?.clearSegmentReveal?.();
    };
  }, []);

  const handleStopSelect = useCallback((stop: { id: string; name: string; coordinates?: [number, number] }, coordinate?: [number, number]) => {
    const coords = coordinate ?? stop.coordinates;
    if (coords && coords.length === 2) {
      sensory.emit({ type: 'STOP_SELECTED', stopId: stop.id });
      cameraController.current?.focusStop(stop.id, coords);
    }
  }, []);

  const allDuration = journey.totalDurationSeconds;
  const priceDisplay = journeyPriceDisplay(journey);
  const totalPriceLabel = priceDisplay.label;
  const priceSummary = totalPriceLabel === '—' ? 'Ціна уточнюється' : totalPriceLabel;

  const ribbonItems: RibbonItem[] = useMemo(() => timeline.flatMap(item => {
    if (item.kind !== 'LEG' || !item.leg) return [];
    const leg = item.leg;
    const isWalk = leg.mode === 'WALK';
    const detail = formatJourneyDurationTile(item.durationSeconds);
    return [{
      id: leg.id,
      label: leg.mode === 'COMMUNITY' ? 'Попутка' : journeyLegLabel(leg.mode, leg.transportType),
      badge: journeyRouteBadge(leg.routeName),
      detail,
      color: isWalk ? '#8E9CB3' : item.color,
      durationSeconds: item.durationSeconds,
      leg,
    }];
  }), [timeline]);

  const peekDominoRef = useMagneticDomino(ribbonItems.length, sheetSnap === 'peek');
  const compactDominoRef = useMagneticDomino(ribbonItems.length, sheetSnap !== 'peek');
  const communityLeg = journey.legs.find(leg => leg.mode === 'COMMUNITY' && leg.offerId && leg.availabilityStatus !== 'UNAVAILABLE');

  const heightForSnap = (snap: RouteSheetSnap) => snapHeight(snap);
  const moveToSnap = (next: RouteSheetSnap, silent = false) => {
    const nextHeight = heightForSnap(next);
    sheetHeightRef.current = nextHeight;
    setSheetSnap(next);
    setSheetHeight(nextHeight);
    if (!silent) sensory.emit({ type: 'SHEET_SNAPPED', detent: next === 'collapsed' ? 'compact' : next });
  };

  const cycleSheet = () => {
    if (suppressHandleClick.current) { suppressHandleClick.current = false; return; }
    const next: RouteSheetSnap = sheetSnap === 'peek'
      ? 'collapsed'
      : sheetSnap === 'collapsed'
        ? 'half'
        : sheetSnap === 'half'
          ? 'expanded'
          : 'peek';
    moveToSnap(next);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const now = performance.now();
    const renderedHeight = sheetElement.current?.getBoundingClientRect().height ?? sheetHeightRef.current;
    sheetHeightRef.current = renderedHeight;
    draggingRef.current = true;
    if (sheetElement.current) {
      sheetElement.current.dataset.dragging = 'true';
      sheetElement.current.style.transition = 'none';
      sheetElement.current.style.height = `${renderedHeight}px`;
    }
    dragStart.current = { y: event.clientY, height: renderedHeight, pointerId: event.pointerId, moved: false, lastY: event.clientY, lastAt: now, velocity: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const delta = start.y - event.clientY;
    if (Math.abs(delta) > 5) start.moved = true;
    if (!start.moved) return;
    suppressHandleClick.current = true;
    const now = performance.now();
    const elapsed = Math.max(1, now - start.lastAt);
    start.velocity = (start.lastY - event.clientY) / elapsed;
    start.lastY = event.clientY;
    start.lastAt = now;
    const heights = getSheetHeights();
    const nextHeight = Math.min(heights.expanded, Math.max(heights.peek, start.height + delta));
    sheetHeightRef.current = nextHeight;
    dragWriter.current?.schedule(nextHeight);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    dragWriter.current?.flush();
    if (start.moved) {
      const heights = getSheetHeights();
      const next = settleRouteSheetSnap(sheetHeightRef.current, start.velocity, heights, 0.45, start.height);
      moveToSnap(next);
    }
    dragStart.current = null;
    draggingRef.current = false;
    if (sheetElement.current) {
      sheetElement.current.dataset.dragging = 'false';
      sheetElement.current.style.transition = routeSheetTransition(false, reducedMotion);
    }
  };

  const setCardRef = (id: string, node: HTMLElement | null) => {
    if (node) segmentCards.current.set(id, node); else segmentCards.current.delete(id);
  };

  const toggleStops = (legId: string) => {
    const next = nextStopsLegId(stopsLegId, legId);
    setStopsLegId(next);
    sensory.emit(next ? { type: 'STOPS_EXPANDED' } : { type: 'STOPS_COLLAPSED' });
    if (!next) return;
    const list = sheetElement.current?.querySelector<HTMLElement>('[data-testid=route-segment-list]');
    const card = segmentCards.current.get(legId);
    const listRect = list?.getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();
    const cardAlreadyInView = sheetSnap === stopsDetent()
      && Boolean(listRect && cardRect && cardRect.top >= listRect.top && cardRect.top < listRect.bottom);
    // The block has to end up where the passenger can read it: below the FULL
    // detent the segment list is a sliver, so raise the sheet, then bring the
    // card into that window. If the card is already visible at the full
    // detent, preserve the user's route context; expanding its stops below the
    // header should not scroll away the preceding legs or summary.
    const mustRaiseSheet = sheetNeedsRaiseForStops(sheetSnap);
    if (mustRaiseSheet) moveToSnap(stopsDetent(), true);
    if (mustRaiseSheet || !cardAlreadyInView) {
      requestAnimationFrame(() => segmentCards.current.get(next)?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'nearest',
      }));
    }
  };

  const toggleSaved = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem('marshgo.saved-route-results.v1') ?? '[]') as unknown;
      const ids = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
      const nextSaved = !saved;
      const nextIds = nextSaved ? [...new Set([...ids, journey.id])] : ids.filter(id => id !== journey.id);
      window.localStorage.setItem('marshgo.saved-route-results.v1', JSON.stringify(nextIds));
      setSaved(nextSaved);
      setFeedback(nextSaved ? 'Маршрут збережено на цьому пристрої.' : 'Маршрут видалено зі збережених.');
      sensory.emit({ type: 'FAVORITE_TOGGLED', saved: nextSaved });
    } catch {
      setFeedback('Не вдалося зберегти маршрут на цьому пристрої.');
      sensory.emit({ type: 'ERROR_SOFT' });
    }
  };

  const shareRoute = async () => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Маршрут MARSHGO', text: `${firstLeg?.origin.name ?? ''} → ${lastLeg?.destination.name ?? ''}`, url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setFeedback('Посилання на маршрут скопійовано.'); }
      else setFeedback('Поділитися можна з меню браузера.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFeedback('Не вдалося поділитися посиланням. Спробуйте ще раз.');
    }
  };

  const canStartNavigation = Boolean(lastLeg && onStartJourney);
  const showChrome = sheetSnap !== 'expanded';
  const showRecenter = shouldShowRecenterButton(cameraController.current?.getState() ?? {
    ...initialRouteCameraState(),
    mode: cameraMode,
    activeSegmentId,
    activeStopId,
  });

  const renderSegmentCards = () => timeline.flatMap((item, index) => {
    if (item.kind === 'WAIT') {
      return [(
        <li key={item.id} className="mg-route-wait mg-fade rounded-xl border border-[var(--route-border)] bg-[var(--route-card-alt)] px-3 py-0.5 text-xs text-[var(--route-muted)]">
          <span className="inline-flex items-center gap-2"><Clock3 size={14} className="text-[var(--route-subtle)]"/>Очікування · {formatDuration(item.durationSeconds)}</span>
        </li>
      )];
    }
    const leg = item.leg!;
    const color = item.color;
    const selected = activeSegmentId === leg.id;
    const scheduled = isScheduledRouteLeg(leg);
    const currentLiveStatus = liveJourney?.segments.find(segment => segment.legId === leg.id)?.status;
    const liveStatus = currentLiveStatus === 'LIVE'
      ? 'LIVE'
      : leg.liveStatus === 'LIVE'
        ? currentLiveStatus === 'SCHEDULED' ? 'SCHEDULED' : 'UNKNOWN'
        : currentLiveStatus ?? leg.liveStatus;
    const liveStatusLabel = liveStatus === 'LIVE'
      ? 'GPS ОНЛАЙН'
      : liveStatus === 'PREDICTED'
        ? 'ПРОГНОЗ'
        : liveStatus === 'SCHEDULED' && leg.scheduleSemantics === 'frequency_estimate'
          ? 'ІНТЕРВАЛ'
          : liveStatus === 'SCHEDULED'
            ? 'РОЗКЛАД'
            : liveStatus === 'UNAVAILABLE'
              ? 'НЕДОСТУПНО'
              : 'ОРІЄНТОВНО';
    const liveStatusShort = liveStatus === 'LIVE'
      ? 'GPS'
      : liveStatus === 'PREDICTED'
        ? 'ПРОГНОЗ'
        : liveStatus === 'SCHEDULED' && leg.scheduleSemantics === 'frequency_estimate'
          ? 'ІНТ.'
          : liveStatus === 'SCHEDULED'
            ? 'ПЛАН'
            : liveStatus === 'UNAVAILABLE'
              ? 'НЕДОСТ.'
              : 'ОРІЄНТ.';
    const stopsOpen = stopsLegId === leg.id;
    const canBook = Boolean(leg.offerId) && leg.availabilityStatus !== 'UNAVAILABLE';
    const stops = leg.stops ?? [];
    const dataCaveat = journeyLegCaveat(leg.mode, leg.source, leg.scheduleSemantics, leg.fareSource);
    const legIndex = journey.legs.findIndex(entry => entry.id === leg.id);
    const walkHint = walkHintFor(journey.legs, legIndex);
    const transferHint = transferHints.get(leg.id);
    const originLabel = cleanStopName(leg.origin.name) || 'Початок';
    const destinationLabel = cleanStopName(leg.destination.name) || 'Кінець';

    return [
      (
      <li
        key={leg.id}
        ref={node => setCardRef(leg.id, node)}
        data-testid="journey-route-segment"
        data-segment-id={leg.id}
        data-active={selected}
        className={`mg-rise mg-stagger mg-route-segment rounded-xl border bg-[var(--route-card)] transition-[border-color,box-shadow,opacity] duration-[var(--mg-dur-fast)] ${selected ? 'border-[var(--mg-blue)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--mg-blue)_45%,transparent),0_0_24px_color-mix(in_srgb,var(--mg-blue)_16%,transparent)]' : 'border-[var(--route-border)]'}`}
        style={{
          opacity: activeSegmentId && !selected ? 0.72 : 1,
          ['--mg-stagger-i' as string]: index,
          ...(leg.mode === 'COMMUNITY' ? { backgroundColor: 'var(--route-community-surface)' } : {}),
        }}
      >
        <div className="mg-route-segment__body flex items-start gap-1.5">
          <button
            type="button"
            onClick={() => chooseSegment(leg.id)}
            aria-pressed={selected}
            aria-label={`Вибрати сегмент: ${legLabel(leg)}; ${originLabel} до ${destinationLabel}${liveStatusLabel ? `; ${liveStatusLabel}` : ''}${walkHint ? `; ${walkHint.title}${walkHint.detail ? `, ${walkHint.detail}` : ''}` : ''}`}
            className="mg-press-subtle flex min-w-0 flex-1 items-start gap-1.5 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)]"
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--route-card-alt)] text-[var(--route-ink)] shadow-[inset_0_0_0_1px_var(--route-border)]"
              aria-hidden="true"
            >
              <TransportIcon mode={leg.mode} transportType={leg.transportType} size={20} strokeWidth={2.3}/>
            </span>
            <span className="min-w-0 flex-1">
              <span className="mg-route-leg-heading">
                <span className="mg-route-leg-title">
                  <b className="text-xs font-black tracking-tight">{leg.mode === 'COMMUNITY' ? 'Попутка · приватний автомобіль' : legLabel(leg)}</b>
                  {liveStatus && leg.mode !== 'WALK' && (
                    <span data-live-status={liveStatus} aria-label={liveStatusLabel} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-black ${liveStatus === 'LIVE' ? (isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-800') : 'bg-[var(--route-card-alt)] text-[var(--route-muted)]'}`}>
                      {liveStatus === 'LIVE' && <span aria-hidden="true" className="mg-live-pulse inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"/>}
                      <span className="route-status-full">{liveStatusLabel}</span>
                      <span className="route-status-short" aria-hidden="true">{liveStatusShort}</span>
                    </span>
                  )}
                </span>
                <span className="mg-route-leg-meta text-xs font-semibold leading-4 tabular-nums text-[var(--route-muted)]">
                  <span className="sr-only">{legTimeLabel(leg, item.durationSeconds)} · </span>
                  {formatJourneyDurationTile(item.durationSeconds)}
                  {leg.mode === 'WALK' && typeof leg.distanceMeters === 'number' && Number.isFinite(leg.distanceMeters) ? ` · ${formatJourneyDistance(leg.distanceMeters)}` : ''}
                  {scheduled && stops.length ? <span className="mg-route-leg-stop-count"> · <span className="mg-route-leg-stop-count-full">{formatStopCount(stops.length)}</span><span className="mg-route-leg-stop-count-short" aria-hidden="true">{stops.length} зуп.</span></span> : ''}
                </span>
              </span>
              <span
                className="mg-route-endpoints mt-0.5 text-xs font-medium leading-4 text-[var(--route-subtle)]"
                aria-label={leg.mode === 'COMMUNITY' ? `Посадка: ${originLabel}; висадка: ${destinationLabel}` : `${originLabel} до ${destinationLabel}`}
              >
                <span className="mg-route-endpoints__name" title={originLabel}>{originLabel}</span>
                <span aria-hidden="true" className="shrink-0 text-[var(--route-muted)]">—</span>
                <span className="mg-route-endpoints__name mg-route-endpoints__name--end" title={destinationLabel}>{destinationLabel}</span>
              </span>
              {showDiagnostics && <span data-testid="journey-route-segment-source" title={leg.source} className="mt-0.5 block truncate text-xs leading-4 text-[var(--route-muted)]">Джерело: {leg.providerName || leg.source}</span>}
              {showDiagnostics && dataCaveat && <span data-testid="journey-route-segment-caveat" className="mt-1 block text-xs leading-4 text-[var(--route-muted)]">{dataCaveat}</span>}
            </span>
          </button>
          <div className="flex shrink-0 items-center">
            {scheduled && stops.length > 0 && (
              <button
                type="button"
                aria-label={`${stopsOpen ? 'Згорнути' : 'Розгорнути'} зупинки: ${journeyLegLabel(leg.mode, leg.transportType)}`}
                aria-expanded={stopsOpen}
                aria-controls={`route-stops-${leg.id}`}
                onClick={() => toggleStops(leg.id)}
                className="mg-press-subtle grid h-11 w-11 place-items-center rounded-lg text-[var(--route-muted)] hover:bg-[var(--route-hover)] hover:text-[var(--route-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]"
              >
                <ChevronDown size={16} className={`route-stops-chevron transition-transform duration-[var(--mg-dur-fast)]${stopsOpen ? ' is-open' : ''}`}/>
              </button>
            )}
            {showDiagnostics && scheduled && stops.length === 0 && <span className="mt-0.5 block text-right text-xs leading-4 text-[var(--route-muted)]">Перелік зупинок не надійшов від транспортного джерела.</span>}
          </div>
        </div>

        {scheduled && stopsOpen && (
          <div id={`route-stops-${leg.id}`} className="mg-route-stops border-t border-[var(--route-border)] px-3 pb-3 pt-2">
            <JourneyLegStops leg={leg} color={color} activeStopId={activeStopId} onStopSelect={handleStopSelect}/>
          </div>
        )}

        {leg.mode === 'COMMUNITY' && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--route-border)] px-3 py-2.5">
            <span className="text-xs font-semibold text-[var(--route-muted)]">{leg.availabilityStatus === 'AVAILABLE' ? 'Місця є' : 'Перевірити місця'}</span>
            {canBook && leg.offerId && onBookOffer && (
              <button
                type="button"
                onClick={() => onBookOffer(leg.offerId!, journey.id, leg.id)}
                className="mg-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--mg-action)] px-4 text-xs font-extrabold text-white shadow-[var(--mg-card-shadow)] hover:bg-[var(--mg-action-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)]"
              >
                Забронювати <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        )}
      </li>
      ),
      ...(transferHint ? [(
        <li key={transferHint.id} className="mg-route-transfer mg-fade" data-testid="route-inline-transfer" data-transfer-id={transferHint.id} data-active={activeTransferId === transferHint.id}>
          <button
            type="button"
            onClick={() => chooseTransfer(transferHint)}
            aria-pressed={activeTransferId === transferHint.id}
            aria-label={`Показати пересадку на ${legLabel(transferHint.nextLeg)} на карті`}
            className={`mg-press-subtle flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed px-2.5 py-1 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)] ${activeTransferId === transferHint.id ? 'border-[var(--mg-blue)] bg-[var(--route-hover)]' : 'border-[var(--route-border)] bg-[var(--route-card-alt)] hover:bg-[var(--route-hover)]'}`}
          >
            <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--route-card)] text-[var(--mg-blue)]"><Shuffle size={13}/></span>
            <span className="shrink-0 font-black">Пересадка</span>
            <span className="min-w-0 flex-1 truncate font-bold text-[var(--route-muted)]">{legLabel(transferHint.nextLeg)}</span>
            {transferHint.waitSeconds >= 60 && <span className="shrink-0 font-semibold tabular-nums text-[var(--route-muted)]">{formatDuration(transferHint.waitSeconds)}</span>}
            <ArrowRight size={13} className="shrink-0 text-[var(--route-muted)]" aria-hidden="true"/>
          </button>
        </li>
      )] : []),
    ];
  });

  return (
    <section
      className="route-map-screen fixed inset-0 z-[var(--mg-z-sticky)] overflow-hidden text-[var(--route-ink)]"
      data-theme={isDark ? 'dark' : 'light'}
      data-sheet-snap={sheetSnap}
      style={{ ['--route-map-inset' as string]: `${sheetHeight + bottomNavigationInset + (sheetSnap === 'expanded' ? 10 : 58)}px` }}
      aria-labelledby="journey-route-map-title"
    >
      <h1 id="journey-route-map-title" className="sr-only">{cleanStopName(firstLeg?.origin.name) || 'Початок'} — {cleanStopName(lastLeg?.destination.name) || 'Кінець'}</h1>
      <div className="absolute inset-0" data-testid="journey-route-map">
        <MarshGoMap
          route={[]}
          overlays
          routeSegments={confirmedSegments}
          routeWaypoints={model.routeWaypoints}
          routeLabels={routeLabels}
          theme={isDark ? 'MARSHGO_DARK' : 'MARSHGO_LIGHT'}
          onStatus={setMapStatus}
          onAdapter={adapter => {
            mapAdapter.current = adapter;
            setMapAdapterReady(Boolean(adapter));
            if (adapter) {
              adapter.setActiveRouteSegment?.(activeSegmentId);
              // Listen for manual camera panning/gestures to avoid jarring recenters
              adapter.onCameraModeChange = (mode) => {
                if (mode === 'FREE') {
                  cameraFeedbackPending.current = false;
                  sensory.stopAll();
                  cameraController.current?.onUserMapInteraction();
                }
              };
              adapter.onCameraSettled = () => {
                if (!cameraFeedbackPending.current) return;
                cameraFeedbackPending.current = false;
                sensory.emit({ type: 'CAMERA_FLIGHT_ARRIVED' });
              };
            }
          }}
          activeRouteSegmentId={activeSegmentId}
          onRouteSegmentSelect={id => chooseSegment(id)}
          onRouteSegmentAmbiguous={(ids, point) => {
            const validIds = ids.filter(id => journey.legs.some(leg => leg.id === id));
            if (validIds.length < 2) {
              if (validIds[0]) chooseSegment(validIds[0]);
              return;
            }
            setMapSegmentChoices({
              ids: validIds,
              x: Math.max(12, Math.min(window.innerWidth - 248, point.x + 8)),
              y: Math.max(72, Math.min(window.innerHeight - 210, point.y + 8)),
            });
          }}
        />
      </div>

      {mapSegmentChoices && (
        <div role="group" aria-label="Виберіть відрізок маршруту" className="absolute z-[30] w-[min(15rem,calc(100vw-1.5rem))] rounded-2xl border border-[var(--route-border)] bg-[var(--route-floating)] p-2 text-[var(--route-ink)] shadow-2xl backdrop-blur-xl" style={{ left: mapSegmentChoices.x, top: mapSegmentChoices.y }}>
          <div className="flex items-center justify-between gap-2 px-2 pb-1">
            <span className="text-xs font-extrabold">Кілька відрізків поруч</span>
            <button type="button" aria-label="Закрити вибір відрізка" onClick={() => setMapSegmentChoices(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-[var(--route-hover)]">×</button>
          </div>
          {mapSegmentChoices.ids.map(id => {
            const leg = journey.legs.find(item => item.id === id);
            if (!leg) return null;
            return (
              <button key={id} type="button" onClick={() => chooseSegment(id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-bold hover:bg-[var(--route-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]">
                <span className="truncate">{legLabel(leg)}</span>
                <ArrowRight size={16} className="shrink-0 text-[var(--route-muted)]"/>
              </button>
            );
          })}
        </div>
      )}

      {/* Streamlined adaptive top bar: compact vertical footprint */}
      {sheetSnap !== 'expanded' && (
        <header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-3xl flex-col gap-1.5 px-3 pb-2 pt-[max(.5rem,env(safe-area-inset-top))]">
          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_5.75rem] items-center gap-2">
            <button
              type="button"
              aria-label={backLabel}
              onClick={onBack}
              className="route-header-back mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-full"
            >
              <ArrowLeft size={20}/>
            </button>
            <span className="truncate text-center text-[18px] font-black tracking-[-.04em] text-[var(--route-brand-ink)]">
              MARSH<span className="text-[var(--mg-blue)]">GO</span>
            </span>
            <div className="flex shrink-0 justify-end gap-1">
              <button
                type="button"
                aria-label={saved ? 'Видалити маршрут зі збережених' : 'Зберегти маршрут'}
                aria-pressed={saved}
                onClick={toggleSaved}
                className="route-header-icon mg-press-subtle grid h-11 w-11 place-items-center rounded-full"
              >
                <Heart size={20} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-rose-400' : ''}/>
              </button>
              <button
                type="button"
                aria-label="Поділитися маршрутом"
                onClick={() => void shareRoute()}
                className="route-header-icon mg-press-subtle grid h-11 w-11 place-items-center rounded-full"
              >
                <Share2 size={20}/>
              </button>
            </div>
          </div>
          <div
            role="group"
            aria-label={`Звідки: ${firstLeg?.origin.name ?? 'Початок'}. Куди: ${lastLeg?.destination.name ?? 'Кінець'}`}
            className="route-address-summary flex min-h-9 items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-black shadow-md"
          >
            <span className="min-w-0 flex-1 truncate">
              <span aria-hidden="true" className="route-address-dot route-address-dot--origin"/>
              {cleanStopName(firstLeg?.origin.name) || 'Початок'}
            </span>
            <ArrowRight size={15} aria-hidden="true" className="shrink-0 text-[var(--route-muted)]"/>
            <span className="min-w-0 flex-1 truncate text-right">
              <span aria-hidden="true" className="route-address-dot route-address-dot--destination"/>
              {cleanStopName(lastLeg?.destination.name) || 'Кінець'}
            </span>
          </div>
          {mapUnavailable && (
            <p role="status" className="mx-auto w-fit max-w-full truncate rounded-full bg-[var(--route-card)] px-2.5 py-1 text-xs font-semibold text-[var(--route-muted)]">
              {mapStatusNote(mapStatus)}
            </p>
          )}
          {showDiagnostics && mapStatus !== 'available' && (
            <p data-testid="map-status-details" className="mx-auto mt-1 w-fit max-w-full text-center text-xs text-[var(--route-muted)]">
              {mapStatusDetail(mapStatus, 'journey')}
            </p>
          )}
        </header>
      )}

      {sheetSnap === 'expanded' && (
        <header
          data-testid="route-map-expanded-toolbar"
          aria-label="Керування картою маршруту"
          className="route-map-expanded-toolbar absolute inset-x-0 top-0 z-20 mx-auto flex max-w-3xl flex-col gap-1 px-3 pt-[max(.5rem,env(safe-area-inset-top))]"
        >
          <div className="route-map-expanded-brand flex h-7 shrink-0 items-center justify-center gap-2 text-sm font-black tracking-tight text-white">
            <BrandMark size="sm" className="!h-7 !w-7 !rounded-lg"/>
            <span>MARSH<span className="text-[var(--mg-blue)]">GO</span></span>
          </div>
          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
            <button
              type="button"
              aria-label={backLabel}
              onClick={onBack}
              className="route-header-back mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-full"
            >
              <ArrowLeft size={20}/>
            </button>
            <div className="flex min-w-0 items-center justify-center gap-2">
              <span
                className="route-map-context-pill flex min-w-0 items-center justify-center gap-2 rounded-full px-3 font-semibold"
                title={`${cleanStopName(firstLeg?.origin.name) || 'Початок'} — ${cleanStopName(lastLeg?.destination.name) || 'Кінець'}`}
                aria-label={`Маршрут: ${cleanStopName(firstLeg?.origin.name) || 'Початок'} — ${cleanStopName(lastLeg?.destination.name) || 'Кінець'}`}
              >
                <Navigation size={16} aria-hidden="true" className="shrink-0 text-[var(--mg-blue)]"/>
                <span className="truncate">Маршрут · {cleanStopName(lastLeg?.destination.name) || 'Деталі'}</span>
              </span>
            </div>
            <div className="relative z-30 grid h-11 w-11 place-items-center">
              <MapLayersControl overlays/>
            </div>
          </div>
        </header>
      )}

      {/* Keep the route canvas clean in the reference's expanded composition.
          The header still exposes map layers and the pinned “На карті” action
          returns to MEDIUM, where the full floating control rail is available. */}
      {sheetSnap !== 'expanded' && (
        <MapControlRail
          className="absolute right-3 z-10"
          label="Керування картою маршруту"
          style={{ top: 'calc(max(.5rem, env(safe-area-inset-top)) + 5.75rem)' }}
        >
          <MapZoomControls map={mapAdapter.current} enabled={mapAdapterReady}/>
          <MapVoiceControl />
          {showRecenter && (
            <button
              type="button"
              aria-label="Показати маршрут цілком"
              title="Показати маршрут цілком"
              onClick={showWholeRoute}
              className="route-map-control is-reset mg-press-subtle grid h-11 w-11 place-items-center rounded-full shadow-lg"
            >
              <Navigation size={19}/>
            </button>
          )}
          <MapPerspectiveControl />
          <MapBasemapControl />
          <MapLayersControl overlays />
        </MapControlRail>
      )}

      {showChrome && scale && (
        <div className="route-map-scale" style={{ left: 16, bottom: bottomNavigationInset + sheetHeight + (sheetSnap === 'peek' ? 14 : 64) }} aria-hidden="true">
          <span>{scale.label}</span>
          <i style={{ width: scale.widthPx }}/>
        </div>
      )}

      {showChrome && sheetSnap !== 'peek' && liveLeg && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 mx-auto flex max-w-3xl justify-center px-4"
          style={{ bottom: bottomNavigationInset + sheetHeight + 8, transition: routeSheetTransition(draggingRef.current, reducedMotion, 'bottom') }}
        >
          <button
            type="button"
            onClick={() => chooseSegment(liveLeg.id)}
            aria-pressed={activeSegmentId === liveLeg.id}
            aria-label={activeSegmentId === liveLeg.id ? `${legLabel(liveLeg)} — натисніть, щоб показати весь маршрут` : `${legLabel(liveLeg)} — натисніть, щоб наблизити цей відрізок`}
            className="pointer-events-auto route-mode-chip mg-press-subtle flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-1.5 text-left"
          >
            <span className="route-mode-chip__icon grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: journeyModeColor(liveLeg.mode, liveLeg.transportType) }}>
              <TransportIcon mode={liveLeg.mode} transportType={liveLeg.transportType} size={19} strokeWidth={2.3}/>
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-black">{legLabel(liveLeg)}</span>
            {activeSegmentId === liveLeg.id ? (
              <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--route-hover)] text-[var(--route-muted)]"><X size={15} strokeWidth={2.6}/></span>
            ) : liveSegment?.status === 'LIVE' ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums text-[var(--route-muted)]"><i aria-hidden="true" className="mg-live-dot mg-live-pulse inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"/>GPS ОНЛАЙН</span>
            ) : (
              <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums text-[var(--route-muted)]">ЗА РОЗКЛАДОМ</span>
            )}
          </button>
        </div>
      )}

      {/* Smart Bottom Sheet */}
      <section
        ref={sheetElement}
        className="absolute inset-x-0 bottom-0 z-[var(--mg-z-sticky)] mx-auto flex max-w-3xl flex-col overflow-hidden rounded-t-[var(--mg-radius-3xl)] border border-[var(--route-border)] bg-[var(--route-sheet)] shadow-[var(--route-sheet-shadow)]"
        aria-label="Деталі маршруту"
        data-testid="route-bottom-sheet"
        data-sheet-state={sheetSnap}
        data-sheet-logical-state={ROUTE_SHEET_LOGICAL_LABELS[sheetSnap]}
        data-dragging={draggingRef.current ? 'true' : 'false'}
        style={{
          height: `${draggingRef.current ? sheetHeightRef.current : sheetHeight}px`,
          bottom: `${bottomNavigationInset}px`,
          transition: routeSheetTransition(draggingRef.current, reducedMotion),
          // Reserve the bottom system area once. When the global tab bar is
          // visible, this sheet already ends above it; otherwise respect the
          // device safe area with a compact 8 px minimum.
          paddingBottom: bottomNavigationInset > 0 ? '8px' : 'max(8px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(160deg,var(--route-sheet-start),var(--route-sheet-end))',
        }}
      >
        <button
          type="button"
          aria-label={sheetSnap === 'expanded' ? 'Згорнути деталі маршруту' : 'Розгорнути деталі маршруту'}
          aria-expanded={sheetSnap !== 'peek'}
          onClick={cycleSheet}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
          onKeyDown={event => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              moveToSnap(sheetSnap === 'peek' ? 'collapsed' : sheetSnap === 'collapsed' ? 'half' : 'expanded');
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              moveToSnap(sheetSnap === 'expanded' ? 'half' : sheetSnap === 'half' ? 'collapsed' : 'peek');
            }
            if (event.key === 'Home') { event.preventDefault(); moveToSnap('peek'); }
            if (event.key === 'End') { event.preventDefault(); moveToSnap('expanded'); }
          }}
          aria-controls="route-sheet-content"
          aria-keyshortcuts="ArrowUp ArrowDown Home End"
          className={`route-sheet-grabber flex w-full shrink-0 touch-none items-center justify-center ${sheetSnap === 'peek' ? 'h-5' : 'h-6'}`}
        >
          <span className="route-sheet-grabber__handle"/>
        </button>

        {sheetSnap !== 'peek' && (model.missingWalkingShapeCount > 0 || model.routeSegments.some(segment => segment.isWalk && segment.approximate)) && (
          <p
            role="status"
            aria-live="polite"
            aria-label="Для частини пішого маршруту немає перевіреної геометрії — лінію не домальовано."
            data-testid="route-walking-geometry-note"
            className="mx-3 mb-1 flex min-h-7 items-center truncate rounded-lg bg-[var(--route-card-alt)] px-2 py-1 text-[12px] font-semibold leading-4 text-[var(--route-muted)]"
          >Частина пішої геометрії не підтверджена</p>
        )}

        <div id="route-sheet-content" className="flex min-h-0 flex-1 flex-col">
          {sheetSnap === 'peek' ? (
            <div className="flex shrink-0 flex-col gap-0.5 px-4 pb-0.5" data-testid="route-peek-summary">
              <div className="flex items-center justify-between gap-3">
                <strong data-testid="canonical-route-duration" className="text-[19px] font-black leading-tight tracking-tight tabular-nums">{formatDuration(allDuration)}</strong>
                <span data-testid="route-peek-summary-divider" aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-[var(--route-border)]"/>
                <strong data-testid="route-total-fare" aria-label={`Загальна вартість: ${totalPriceLabel === '—' ? 'невідома' : `${totalPriceLabel}${priceDisplay.caption ? ` ${priceDisplay.caption}` : ''}`}`} className={`text-[16px] font-black tabular-nums ${totalPriceLabel === '—' ? 'text-[var(--route-muted)]' : ''}`}>{priceSummary}</strong>
              </div>
              <div ref={peekDominoRef} className="route-peek-ribbon mg-domino no-scrollbar" data-domino-pattern="ribbon" tabIndex={0} data-testid="route-peek-ribbon" role="list" aria-label="Етапи маршруту — гортайте вбік">
                {ribbonItems.map(item => {
                  const selected = activeSegmentId === item.id;
                  const walk = item.leg.mode === 'WALK';
                  const stageLabel = `${item.label}${item.badge ? ` ${item.badge}` : ''}`;
                  return (
                    <div key={item.id} role="listitem" className={`route-peek-ribbon__item${activeSegmentId && !selected ? ' is-muted' : ''}`}>
                      <button type="button" onClick={() => chooseSegment(item.id)} aria-pressed={selected} aria-label={`Вибрати етап: ${stageLabel}, ${formatJourneyDurationTile(item.durationSeconds)}`} className={`route-peek-ribbon__stage mg-press-subtle${selected ? ' is-active' : ''}`}>
                        <span className="route-peek-ribbon__icon" style={{ backgroundColor: walk ? 'var(--route-ribbon-walk)' : item.color }} aria-hidden="true">
                          <TransportIcon mode={item.leg.mode} transportType={item.leg.transportType} size={14} strokeWidth={2.4}/>
                        </span>
                        <span className="route-peek-ribbon__copy">
                          <span className="route-peek-ribbon__label">{stageLabel}</span>
                          <span className="route-peek-ribbon__detail">{formatJourneyDurationTile(item.durationSeconds)}</span>
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {sheetSnap === 'expanded' && (
                <div className="route-details-head flex shrink-0 items-center gap-2 px-4 pb-0.5">
                  <h2 className="route-details-title min-w-0 flex-1 truncate text-left font-black tracking-tight">Деталі маршруту</h2>
                  <button type="button" aria-label="Поділитися маршрутом" onClick={shareRoute} className="route-header-icon mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-full">
                    <Share2 size={19}/>
                  </button>
                  <button type="button" aria-label={saved ? 'Видалити маршрут зі збережених' : 'Зберегти маршрут'} aria-pressed={saved} onClick={toggleSaved} className="route-header-icon route-save-toggle mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-full">
                    <Bookmark size={20} fill={saved ? 'currentColor' : 'none'}/>
                  </button>
                </div>
              )}
              {sheetSnap === 'expanded' && (
                <div
                  className="route-sheet-endpoints shrink-0"
                  data-testid="route-sheet-endpoints"
                  role="group"
                  aria-label={`Маршрут: ${cleanStopName(firstLeg?.origin.name) || 'Початок'} до ${cleanStopName(lastLeg?.destination.name) || 'Кінець'}`}
                >
                  <span className="route-sheet-endpoints__name" title={cleanStopName(firstLeg?.origin.name) || 'Початок'}>{cleanStopName(firstLeg?.origin.name) || 'Початок'}</span>
                  <ArrowRight size={13} aria-hidden="true" className="shrink-0 text-[var(--route-muted)]"/>
                  <span className="route-sheet-endpoints__name route-sheet-endpoints__name--end" title={cleanStopName(lastLeg?.destination.name) || 'Кінець'}>{cleanStopName(lastLeg?.destination.name) || 'Кінець'}</span>
                </div>
              )}
              <div
                className="route-sheet-summary shrink-0"
                data-testid="route-sheet-summary"
                role="group"
                aria-label={`${firstLeg ? formatTime(firstLeg.departureAt) : 'Час невідомий'} — ${lastLeg ? formatTime(lastLeg.arrivalAt) : 'час невідомий'}, ${formatDuration(allDuration)}, ${formatSegmentCount(journey.legs.length)}, ${journey.transfers > 0 ? formatTransferCount(journey.transfers) : 'без пересадок'}, ціна ${totalPriceLabel === '—' ? 'невідома' : totalPriceLabel}`}
              >
                <span className="route-sheet-summary__metrics mg-pop mg-stagger" style={{ ['--mg-stagger-i' as string]: 0 }}>
                  <strong className="route-sheet-summary__times tabular-nums">
                    <span>{firstLeg ? formatTime(firstLeg.departureAt) : '—'}</span>
                    <ArrowRight size={12} aria-hidden="true" className="shrink-0 text-[var(--route-muted)]"/>
                    <span>{lastLeg ? formatTime(lastLeg.arrivalAt) : '—'}</span>
                  </strong>
                  <span data-testid="canonical-route-duration" className="route-sheet-summary__detail">{formatDuration(allDuration)}</span>
                  <span className="route-sheet-summary__detail route-sheet-summary__transfers">
                    <span className="route-sheet-summary__transfer-full">{journey.transfers > 0 ? formatTransferCount(journey.transfers) : 'Без пересадок'}</span>
                    <span className="route-sheet-summary__transfer-short" aria-hidden="true">{journey.transfers > 0 ? `${journey.transfers} пер.` : '0 пер.'}</span>
                  </span>
                </span>
                <span data-testid="route-total-fare" className="route-sheet-summary__fare mg-pop mg-stagger" style={{ ['--mg-stagger-i' as string]: 1 }}>
                  <strong aria-label={`Загальна вартість: ${totalPriceLabel === '—' ? 'невідома' : `${totalPriceLabel}${priceDisplay.caption ? ` ${priceDisplay.caption}` : ''}`}`} className={`text-[16px] font-black tabular-nums ${totalPriceLabel === '—' ? 'text-[var(--route-muted)]' : ''}`}>{priceSummary}</strong>
                  {priceDisplay.caption && totalPriceLabel !== '—' && <span data-testid="route-total-fare-caption" className="route-sheet-summary__caption">{priceDisplay.caption}</span>}
                </span>
              </div>

              {(
                <div ref={compactDominoRef} data-testid="route-stage-ribbon" data-domino-pattern="ribbon" tabIndex={0} className="mg-route-ribbon mg-route-ribbon--compact mg-domino no-scrollbar shrink-0 px-4" role="list" aria-label="Етапи маршруту">
                  {ribbonItems.map(item => {
                    const selected = activeSegmentId === item.id;
                    const walk = item.leg.mode === 'WALK';
                    return (
                      <div key={item.id} role="listitem" className={`mg-route-ribbon__item${activeSegmentId && !selected ? ' is-muted' : ''}`}>
                        <button type="button" onClick={() => chooseSegment(item.id)} aria-pressed={selected} aria-label={`Вибрати етап: ${item.label}, ${item.detail}`} className={`mg-route-ribbon__pill mg-press-subtle${selected ? ' is-active' : ''}`} style={{ backgroundColor: 'var(--route-card)', borderColor: walk ? 'var(--route-ribbon-walk)' : item.color }}>
                          <span className="shrink-0" style={{ color: walk ? 'var(--route-ribbon-walk)' : item.color }}><TransportIcon mode={item.leg.mode} transportType={item.leg.transportType} size={16} strokeWidth={2.4}/></span>
                          <span className="mg-route-ribbon__copy">
                            <span className="mg-route-ribbon__label">{item.label}</span>
                            <span className="mg-route-ribbon__detail">{item.detail}</span>
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Independent scrolling for details in medium and expanded modes */}
          {(sheetSnap === 'half' || sheetSnap === 'expanded') && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-0.5" data-testid="route-segment-list">
              <ol className="mg-route-segment-list">
                {renderSegmentCards()}
              </ol>
              {recommendation && <p data-testid="journey-route-recommendation" className="mb-1 text-xs font-semibold leading-4 text-[var(--route-muted)]">Рекомендація: {recommendation}</p>}
              {alternativeDepartures.length > 0 && <details data-testid="journey-alternative-departures" className="mt-2 overflow-hidden rounded-xl border border-[var(--route-border)] bg-[var(--route-card)]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-extrabold text-[var(--route-ink)]">
                  <span>Інші відправлення</span>
                  <span className="rounded-full bg-[var(--route-card-alt)] px-2 py-1 tabular-nums text-[var(--route-muted)]">{alternativeDepartures.length}</span>
                </summary>
                <ul className="divide-y divide-[var(--route-border)] border-t border-[var(--route-border)] px-2">
                  {alternativeDepartures.map(alternative => {
                    const altFirst = alternative.legs[0];
                    const altLast = alternative.legs.at(-1);
                    if (!altFirst || !altLast) return null;
                    const altPrice = journeyPriceDisplay(alternative);
                    const alternativeDepartureAt = altFirst.departureAt;
                    const altArrivalDay = journeyArrivalDayNote(altLast.arrivalAt, alternativeDepartureAt);
                    return <li key={alternative.id}>
                      <button type="button" onClick={() => onSelectAlternative?.(alternative)} aria-label={`Відкрити відправлення ${formatTime(alternativeDepartureAt)} — ${formatTime(altLast.arrivalAt)}${altArrivalDay ? `, ${altArrivalDay}` : ''}; ${formatDuration(alternative.totalDurationSeconds)}; ${altPrice.label === '—' ? 'ціна невідома' : altPrice.label}`} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-1 text-left text-xs font-semibold tabular-nums text-[var(--route-ink)] hover:bg-[var(--route-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]">
                        <span className="min-w-0 flex-1 truncate">{formatTime(alternativeDepartureAt)} → {formatTime(altLast.arrivalAt)}{altArrivalDay ? ` · ${altArrivalDay}` : ''} · {formatDuration(alternative.totalDurationSeconds)}</span>
                        <span className="shrink-0 font-extrabold">{altPrice.label}</span>
                      </button>
                    </li>;
                  })}
                </ul>
              </details>}
            </div>
          )}

          {/* Pinned CTA in all four snap states */}
          <div className={`route-sheet-actions shrink-0 px-4 ${sheetSnap === 'peek' ? '' : 'mt-auto'}`}>
            {notice && <p role="status" data-testid="journey-gps-notice" className="mb-1 text-[12px] font-semibold leading-4 text-[var(--route-muted)]">{notice}</p>}
            {sheetSnap !== 'peek' && communityLeg?.offerId && onBookOffer && (() => {
              const communityPrice = legPriceDisplay(communityLeg).value;
              return (
                <button
                  type="button"
                  onClick={() => onBookOffer(communityLeg.offerId!, journey.id, communityLeg.id)}
                  className="mg-route-book mg-press-subtle mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-extrabold"
                >
                  Забронювати місце · {communityPrice}{communityPrice !== '—' && !communityPrice.includes('/ місце') ? ' / місце' : ''}
                </button>
              );
            })()}
            <div className={`route-sheet-action-row${sheetSnap === 'peek' ? ' is-peek' : ''}`}>
              <button
                type="button"
                disabled={!canStartNavigation || starting}
                aria-busy={starting}
                onClick={() => onStartJourney?.()}
                className={`mg-route-cta mg-press-subtle flex min-w-0 items-center justify-center gap-2.5${sheetSnap === 'peek' ? ' route-sheet-peek-cta w-full' : ' flex-1'}`}
              >
                {sheetSnap === 'expanded'
                  ? <Navigation size={20} fill="currentColor" aria-hidden="true" className="shrink-0"/>
                  : <Play size={18} fill="currentColor" aria-hidden="true" className="shrink-0"/>}
                <span className="route-sheet-start-label font-black tracking-tight">{starting ? 'Очікуємо GPS…' : journey.legs.some(leg => leg.mode === 'COMMUNITY') ? 'Розпочати поїздку' : sheetSnap === 'peek' ? 'Розпочати' : 'Розпочати навігацію'}</span>
              </button>
              {sheetSnap !== 'peek' && (
                <button
                  type="button"
                  aria-label="Показати маршрут на карті"
                  onClick={() => { showWholeRoute(); moveToSnap('half'); }}
                  className="route-sheet-map-cta mg-press-subtle flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[var(--route-border)] bg-[var(--route-card-alt)] px-3 font-bold text-[var(--route-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]"
                >
                  <MapIcon size={20} aria-hidden="true"/>
                  <span>На карті</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 z-40 flex justify-center px-6" style={{ bottom: 'calc(var(--route-map-inset) + 10px)', transition: routeSheetTransition(draggingRef.current, reducedMotion, 'bottom') }}>
        {feedback && <p key={feedback} role="status" className="route-toast max-w-full truncate rounded-full px-4 py-2.5 text-xs font-extrabold">{feedback}</p>}
      </div>
    </section>
  );
}
