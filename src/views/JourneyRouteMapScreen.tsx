import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowLeft, ArrowRight, ChevronDown, Clock3, Heart, Map as MapIcon, Navigation, Play, Share2, Shuffle, X,
} from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import { MapLayersControl } from '../components/MapLayersControl';
import { MapBasemapControl, MapControlRail, MapPerspectiveControl, MapVoiceControl, MapZoomControls } from '../components/MapInteractionControls';
import { buildJourneyRouteMapModel, formatTransferCount, journeyModeColor } from '../map/journeyRouteModel';
import { corridorFitPoints } from '../map/routeContextCorridor';
import type { MapAdapter, MapStatus, RouteFitPadding } from '../map/MapAdapter';
import { mapStatusDetail, mapStatusNote } from '../map/mapStatusCopy';
import { productionApi, hasApiSession, ProductionApiError, type ApiJourney, type ApiJourneyLive } from '../services/productionApi';
import { TransportIcon } from '../design-system/transport/TransportIcon';
import { journeyLegCaveat, journeyLegLabel } from './journeyLegLabel';
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
  prefersReducedMotion,
  routeSheetExpandedFitHeight,
  ROUTE_SHEET_LOGICAL_LABELS,
  routeSheetHeights,
  routeSheetSafeAreaInset,
  routeSheetTransition,
  settleRouteSheetSnap,
  subscribeReducedMotion,
  type RouteSheetSnap,
} from './routeSheet';
import { themeService } from '../services/theme';
import { formatSegmentCount, formatStopCount, primaryTransitLeg } from './routeMapAnnotations';
import { priorityLevelOf } from '../map/transportVisualZones';
import { JourneyLegStops, isScheduledRouteLeg } from './JourneyLegStops';
import { nextStopsLegId, sheetNeedsRaiseForStops, stopsDetent } from './journeyStopsPanel';
import { calculateAdaptiveMapPadding } from '../map/mapViewportCoordinator';
import { floatingInfoForLeg, floatingInfoForStop, floatingInfoForTransfer } from '../map/floatingMapInfo';
import { useFloatingMapInfo } from '../map/useFloatingMapInfo';
import {
  RouteCameraController,
  calculateSegmentFocusTarget,
  initialRouteCameraState,
  shouldShowRecenterButton,
  type RouteCameraMode,
} from '../map/routeCameraController';
import {
  cleanStopName,
  interpolateLineProgress,
} from '../map/cinematicRouteEngine';
import { cameraEasing } from '../map/cameraMotion';
import { SEGMENT_REVEAL_TOKENS } from '../map/routeGeometryTokens';
import type { Coordinate } from '../../shared/navigation/contracts';

type JourneyLeg = ApiJourney['legs'][number];
export type JourneyNavigationStartResult = { started: true } | { started: false; message: string };
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

function legLabel(leg: JourneyLeg) {
  return `${journeyLegLabel(leg.mode, leg.transportType)}${leg.routeName ? ` ${leg.routeName}` : ''}`;
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

function walkHintFor(legs: JourneyLeg[], index: number): { title: string; detail: string } | null {
  if (legs[index]?.mode !== 'WALK') return null;
  const next = legs[index + 1];
  if (index === 0) return { title: 'Почніть пішки', detail: next && next.mode !== 'WALK' ? `до ${legLabel(next)}` : '' };
  if (next && next.mode !== 'WALK') return { title: 'Пересадка пішки', detail: `до ${legLabel(next)}` };
  if (!next) return { title: 'Пройдіть пішки до фінішу', detail: '' };
  return { title: 'Пішки', detail: '' };
}

export function JourneyRouteMapScreen({
  journey,
  alternativeDepartures = [],
  onSelectAlternative,
  recommendation,
  onBack,
  onBookOffer,
  onStartJourney,
}: {
  journey: ApiJourney;
  /** Same-shape departures grouped under the result card, available from the detail sheet. */
  alternativeDepartures?: ApiJourney[];
  onSelectAlternative?: (journey: ApiJourney) => void;
  recommendation?: string;
  onBack: () => void;
  onBookOffer?: (offerId: string, journeyId: string, journeyLegId: string) => void;
  /** Opens the active stage map for this itinerary; the route is never re-entered. */
  onStartJourney?: () => Promise<JourneyNavigationStartResult> | JourneyNavigationStartResult;
}) {
  const showDiagnostics = typeof window !== 'undefined' && diagnosticsRequested(
    window.location.search,
    (() => { try { return window.localStorage.getItem('marshgo.results.diagnostics'); } catch { return null; } })(),
  );
  const model = useMemo(() => buildJourneyRouteMapModel(journey.legs), [journey.legs]);
  const timeline = useMemo(() => timelineFor(journey), [journey]);
  const firstLeg = journey.legs[0];
  const lastLeg = journey.legs.at(-1);
  const primaryLeg = useMemo(() => primaryTransitLeg(journey.legs), [journey.legs]);
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [isDark, setIsDark] = useState(themeService.isDark());

  const [sheetSnap, setSheetSnap] = useState<RouteSheetSnap>('collapsed');
  const [sheetHeight, setSheetHeight] = useState(() => routeSheetHeights(typeof window === 'undefined' ? 844 : window.innerHeight, routeSheetSafeAreaInset()).collapsed);
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === 'undefined' ? 844 : window.innerHeight);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 390 : window.innerWidth);
  const draggingRef = useRef(false);

  // Centralized RouteCameraController
  const [cameraMode, setCameraMode] = useState<RouteCameraMode>('ROUTE_OVERVIEW');
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
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

  const [stopsLegId, setStopsLegId] = useState<string | null>(null);
  const transferHints = useMemo(() => inlineTransferHints(journey.legs), [journey.legs]);
  const activeTransfer = useMemo(
    () => [...transferHints.values()].find(hint => hint.id === activeTransferId) ?? null,
    [activeTransferId, transferHints],
  );
  const revealAnimRef = useRef<number | null>(null);
  const revealTimersRef = useRef<number[]>([]);
  const activeRevealLegId = useRef<string | null>(null);
  const [scale, setScale] = useState<{ label: string; widthPx: number } | null>(null);
  const [saved, setSaved] = useState(() => {
    try { return (JSON.parse(window.localStorage.getItem('marshgo.saved-route-results.v1') ?? '[]') as unknown[]).includes(journey.id); }
    catch { return false; }
  });
  const [feedback, setFeedback] = useState('');
  const [startingNavigation, setStartingNavigation] = useState(false);
  const [startError, setStartError] = useState('');
  const sheetElement = useRef<HTMLElement | null>(null);
  const sheetHeightRef = useRef(sheetHeight);
  const mapAdapter = useRef<MapAdapter | null>(null);
  const segmentCards = useRef(new Map<string, HTMLElement>());
  const dragStart = useRef<{ y: number; height: number; pointerId: number; moved: boolean; lastY: number; lastAt: number; velocity: number } | null>(null);
  const suppressHandleClick = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const floatingMapInfo = useFloatingMapInfo(mapAdapter, reducedMotion);
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

  const haptic = (ms: number | number[]) => {
    try { navigator.vibrate?.(ms); } catch { /* ignored */ }
  };

  const selectedLeg = activeSegmentId ? journey.legs.find(leg => leg.id === activeSegmentId) : undefined;
  const liveLeg = selectedLeg && isScheduledRouteLeg(selectedLeg) ? selectedLeg : primaryLeg ?? undefined;
  const liveLegId = liveLeg?.id ?? null;
  const liveSegment = liveJourney?.segments.find(segment => segment.legId === liveLegId);

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
      vehicles: (liveSegment.vehicles ?? []).map(vehicle => ({
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
  }, [liveSegment, liveLeg, mapAdapterReady]);

  const snapHeight = useCallback((snap: RouteSheetSnap, viewport = viewportHeight) => routeSheetHeights(viewport, routeSheetSafeAreaInset())[snap], [viewportHeight]);

  const fitExpandedSheetToContent = useCallback(() => {
    const sheet = sheetElement.current;
    const content = sheet?.querySelector<HTMLElement>('#route-sheet-content');
    const list = content?.querySelector<HTMLElement>('[data-testid="route-segment-list"]');
    const handle = sheet?.querySelector<HTMLElement>('.route-sheet-grabber');
    if (!sheet || !content || !list || !handle) return;

    const boxHeight = (element: Element) => {
      const style = window.getComputedStyle(element);
      return element.getBoundingClientRect().height
        + (Number.parseFloat(style.marginTop) || 0)
        + (Number.parseFloat(style.marginBottom) || 0);
    };
    const fixedContentHeight = [...content.children]
      .filter(element => element !== list)
      .reduce((total, element) => total + boxHeight(element), 0);
    const naturalListHeight = [...list.children]
      .reduce((total, element) => total + boxHeight(element), 0)
      + (Number.parseFloat(window.getComputedStyle(list).paddingTop) || 0)
      + (Number.parseFloat(window.getComputedStyle(list).paddingBottom) || 0);
    const outerStyle = window.getComputedStyle(sheet);
    const outerExtras = [...sheet.children]
      .filter(element => element !== handle && element !== content)
      .reduce((total, element) => total + boxHeight(element), 0)
      + (Number.parseFloat(outerStyle.paddingTop) || 0)
      + (Number.parseFloat(outerStyle.paddingBottom) || 0)
      + (Number.parseFloat(outerStyle.borderTopWidth) || 0)
      + (Number.parseFloat(outerStyle.borderBottomWidth) || 0);
    const requiredHeight = handle.getBoundingClientRect().height + outerExtras + fixedContentHeight + naturalListHeight;
    const nextHeight = routeSheetExpandedFitHeight(viewportHeight, routeSheetSafeAreaInset(), requiredHeight);
    if (Math.abs(sheetHeightRef.current - nextHeight) <= 1) return;
    sheetHeightRef.current = nextHeight;
    setSheetHeight(nextHeight);
  }, [viewportHeight]);

  useLayoutEffect(() => {
    if (sheetSnap !== 'expanded') return;
    const sheet = sheetElement.current;
    const content = sheet?.querySelector<HTMLElement>('#route-sheet-content');
    const list = content?.querySelector<HTMLElement>('[data-testid="route-segment-list"]');
    if (!sheet || !content || !list) return;

    fitExpandedSheetToContent();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fitExpandedSheetToContent);
    for (const element of [...content.children].filter(child => child !== list)) observer.observe(element);
    for (const element of list.children) observer.observe(element);
    return () => observer.disconnect();
  }, [alternativeDepartures.length, fitExpandedSheetToContent, journey.legs, recommendation, sheetSnap, stopsLegId, viewportWidth]);

  useEffect(() => {
    const updateViewport = () => {
      const nextH = window.innerHeight;
      const nextW = window.innerWidth;
      setViewportHeight(nextH);
      setViewportWidth(nextW);
      const nextHeight = snapHeight(sheetSnap, nextH);
      sheetHeightRef.current = nextHeight;
      setSheetHeight(nextHeight);
    };
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [sheetSnap, snapHeight]);

  const mapUnavailable = mapStatus === 'failed';

  const isDesktop = viewportWidth >= 1024;
  const settledHeight = sheetSnap === 'expanded' ? sheetHeight : snapHeight(sheetSnap);
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
    extraBottomInset: floatingChipVisible ? 58 : 0,
  }), [floatingChipVisible, isDesktop, mapUnavailable, settledHeight, sheetHeight, sheetSnap, viewportHeight, viewportWidth]);

  // Segment orientation follows the real camera band after route and sheet insets.
  const visibleMapArea = useMemo(() => ({
    width: Math.max(1, viewportWidth - (mapPadding.left ?? 0) - (mapPadding.right ?? 0)),
    height: Math.max(1, viewportHeight - (mapPadding.top ?? 0) - (mapPadding.bottom ?? 0)),
  }), [mapPadding, viewportHeight, viewportWidth]);

  const routeLinePoints = useMemo(() => {
    const itinerary = model.routeSegments.flatMap(segment => segment.coordinates);
    const lineRoutes = liveSegment?.lineRoutes ?? [];
    const contextLines = lineRoutes.flatMap(route => [
      route.coordinates,
      ...(route.zones?.beforeBoarding ? [route.zones.beforeBoarding] : []),
      ...(route.zones?.afterAlighting ? [route.zones.afterAlighting] : []),
    ]);
    return corridorFitPoints(itinerary, contextLines);
  }, [liveSegment, model.routeSegments]);

  const routeFitKey = useMemo(() => {
    if (routeLinePoints.length < 2) return `points:${routeLinePoints.length}`;
    const first = routeLinePoints[0]!;
    const last = routeLinePoints.at(-1)!;
    return `${routeLinePoints.length}:${first[0].toFixed(4)},${first[1].toFixed(4)}:${last[0].toFixed(4)},${last[1].toFixed(4)}`;
  }, [routeLinePoints]);

  const segmentFocus = useMemo(() => {
    const segment = activeSegmentId ? model.routeSegments.find(item => item.id === activeSegmentId) : undefined;
    if (!segment || segment.coordinates.length < 2) return null;
    const live = liveJourney?.segments.find(item => item.legId === segment.id);
    const contextLines = (live?.lineRoutes ?? []).flatMap(route => [
      route.coordinates,
      ...(route.zones?.beforeBoarding ? [route.zones.beforeBoarding] : []),
      ...(route.zones?.afterAlighting ? [route.zones.afterAlighting] : []),
    ]);
    return calculateSegmentFocusTarget(segment.coordinates, contextLines, segment.id, visibleMapArea);
  }, [activeSegmentId, liveJourney, model.routeSegments, visibleMapArea]);

  const segmentFocusKey = segmentFocus?.key ?? null;

  // Sync camera controller with adapter and padding
  useEffect(() => {
    const controller = cameraController.current;
    if (!controller) return;
    controller.setAdapter(mapAdapter.current);
    controller.setPadding(mapPadding);
  }, [mapAdapterReady, mapPadding]);

  // Handle snap change camera re-fitting
  useEffect(() => {
    if (draggingRef.current || !mapAdapterReady) return;
    const controller = cameraController.current;
    if (!controller) return;
    controller.setPadding(mapPadding);
    controller.syncOnSnapSettled({
      routePoints: routeLinePoints,
      segmentTarget: segmentFocus,
    });
  }, [mapAdapterReady, mapPadding, routeFitKey, segmentFocusKey, sheetSnap]);

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

  const showWholeRoute = useCallback(() => {
    haptic(6);
    floatingMapInfo.clear();
    if (revealAnimRef.current) {
      cancelAnimationFrame(revealAnimRef.current);
      revealAnimRef.current = null;
    }
    revealTimersRef.current.forEach(timer => window.clearTimeout(timer));
    revealTimersRef.current = [];
    mapAdapter.current?.clearSegmentReveal?.();
    cameraController.current?.showOverview(routeLinePoints);
  }, [floatingMapInfo.clear, routeLinePoints]);

  const chooseSegment = useCallback((id: string) => {
    setMapSegmentChoices(null);
    haptic(8);
    if (activeSegmentId === id) {
      showWholeRoute();
    } else {
      const leg = journey.legs.find(item => item.id === id);
      const seg = model.routeSegments.find(s => s.id === id);
      const target = seg ? calculateSegmentFocusTarget(seg.coordinates, [], id, visibleMapArea) : null;
      cameraController.current?.focusSegment(id, target, routeLinePoints);

      if (leg) {
        const info = floatingInfoForLeg(leg);
        if (info) floatingMapInfo.show(info);
        if (revealAnimRef.current) {
          cancelAnimationFrame(revealAnimRef.current);
          revealAnimRef.current = null;
        }
        revealTimersRef.current.forEach(timer => window.clearTimeout(timer));
        revealTimersRef.current = [];
        if (!reducedMotion && leg.coordinates && leg.coordinates.length >= 2) {
          const fullCoords = leg.coordinates;
          const color = journeyModeColor(leg.mode, leg.transportType);
          const startTime = performance.now();
          const ease = cameraEasing();
          activeRevealLegId.current = id;

          const animateReveal = (now: number) => {
            if (activeRevealLegId.current !== id) return;
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / SEGMENT_REVEAL_TOKENS.durationMs);
            const subCoords = interpolateLineProgress(fullCoords, ease(progress));
            mapAdapter.current?.revealSegmentProgress?.(subCoords, color);

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
  }, [activeSegmentId, floatingMapInfo.show, journey.legs, liveJourney?.segments, model.routeSegments, reducedMotion, routeLinePoints, showWholeRoute, visibleMapArea]);

  const chooseTransfer = useCallback((hint: InlineTransferHint) => {
    haptic(8);
    if (activeTransferId === hint.id) {
      showWholeRoute();
      return;
    }
    const info = floatingInfoForTransfer(hint.id, hint.coordinate, hint.waitSeconds);
    if (info) floatingMapInfo.show(info);
    cameraController.current?.focusTransfer(hint.id, hint.coordinate, hint.contextPoints);
  }, [activeTransferId, floatingMapInfo.show, showWholeRoute]);

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
      haptic(6);
      const focusedLeg = activeSegmentId ? journey.legs.find(item => item.id === activeSegmentId) : undefined;
      const matchesEndpoint = (endpoint: JourneyLeg['origin'] | JourneyLeg['destination']) =>
        cleanStopName(endpoint.name) === cleanStopName(stop.name)
        && Math.hypot((endpoint.coordinates[0] - coords[0]) * Math.cos(coords[1] * Math.PI / 180), endpoint.coordinates[1] - coords[1]) < 0.0008;
      const stopKind = focusedLeg && matchesEndpoint(focusedLeg.origin) ? 'Посадка'
        : focusedLeg && matchesEndpoint(focusedLeg.destination) ? 'Висадка' : 'Зупинка';
      const info = floatingInfoForStop(stop.id, stopKind, stop.name, coords);
      if (info) floatingMapInfo.show(info, 120);
      cameraController.current?.focusStop(stop.id, coords);
    }
  }, [activeSegmentId, floatingMapInfo.show, journey.legs]);

  const allDuration = journey.totalDurationSeconds;
  const priceDisplay = journeyPriceDisplay(journey);
  const totalPriceLabel = priceDisplay.label;
  const priceSummary = totalPriceLabel === '—' ? 'Ціна уточнюється' : totalPriceLabel;

  const ribbonItems: RibbonItem[] = useMemo(() => timeline.flatMap(item => {
    if (item.kind !== 'LEG' || !item.leg) return [];
    const leg = item.leg;
    const isWalk = leg.mode === 'WALK';
    const stopCount = leg.stops?.length ?? 0;
    const price = legPriceDisplay(leg);
    const placedStop = stopCount > 0 ? formatStopCount(stopCount) : '';
    const isNonMotorized = leg.mode === 'WALK' || leg.mode === 'BICYCLE' || leg.mode === 'SCOOTER';
    const detail = isWalk
      ? formatJourneyDurationTile(item.durationSeconds)
      : `${formatJourneyDurationTile(item.durationSeconds)} · ${price.value !== '—' ? price.value : placedStop || (isNonMotorized ? '0 ₴' : 'За тарифом')}`;
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

  const communityLeg = journey.legs.find(leg => leg.mode === 'COMMUNITY' && leg.offerId && leg.availabilityStatus !== 'UNAVAILABLE');

  const heightForSnap = (snap: RouteSheetSnap) => snapHeight(snap);
  const moveToSnap = (next: RouteSheetSnap) => {
    const nextHeight = heightForSnap(next);
    sheetHeightRef.current = nextHeight;
    setSheetSnap(next);
    setSheetHeight(nextHeight);
    haptic(6);
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
    const heights = routeSheetHeights(viewportHeight, routeSheetSafeAreaInset());
    const nextHeight = Math.min(heights.expanded, Math.max(heights.peek, start.height + delta));
    sheetHeightRef.current = nextHeight;
    dragWriter.current?.schedule(nextHeight);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    dragWriter.current?.flush();
    if (start.moved) {
      const heights = routeSheetHeights(viewportHeight, routeSheetSafeAreaInset());
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
    if (!next) return;
    // The block has to end up where the passenger can read it: below the FULL
    // detent the segment list is a sliver, so raise the sheet, then bring the
    // card into that window.
    if (sheetNeedsRaiseForStops(sheetSnap)) moveToSnap(stopsDetent());
    requestAnimationFrame(() => segmentCards.current.get(next)?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
    }));
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
    } catch {
      setFeedback('Не вдалося зберегти маршрут на цьому пристрої.');
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
  const startNavigation = async () => {
    if (!onStartJourney || startingNavigation) return;
    setStartingNavigation(true);
    setStartError('');
    try {
      const result = await onStartJourney();
      if (!result.started) setStartError(result.message);
    } catch {
      setStartError('Не вдалося розпочати навігацію. Спробуйте ще раз.');
    } finally {
      setStartingNavigation(false);
    }
  };
  const showChrome = sheetSnap !== 'expanded';
  const showRecenter = shouldShowRecenterButton(cameraController.current?.getState() ?? {
    ...initialRouteCameraState(),
    mode: cameraMode,
    activeSegmentId,
    activeStopId,
  });
  // The FULL state keeps a living map strip; say what the camera is showing so
  // the passenger can collapse back to it without guessing.
  const focusLabel = cameraMode === 'SEGMENT_FOCUS' && selectedLeg ? legLabel(selectedLeg)
    : cameraMode === 'TRANSFER_FOCUS' && activeTransfer ? `Пересадка до ${legLabel(activeTransfer.nextLeg)}`
      : cameraMode === 'STOP_FOCUS' ? 'Зупинка на карті'
        : cameraMode === 'MANUAL_CAMERA' ? 'Вільна карта'
          : 'Весь маршрут';

  const renderSegmentCards = () => timeline.flatMap((item, index) => {
    if (item.kind === 'WAIT') {
      return [(
        <li key={item.id} className="flex min-h-7 items-center rounded-lg border border-[var(--route-border)] bg-[var(--route-card-alt)] px-3 py-1 text-xs text-[var(--route-muted)]">
          <span className="inline-flex items-center gap-1.5"><Clock3 size={13} className="text-[var(--route-subtle)]"/>Очікування · {formatDuration(item.durationSeconds)}</span>
        </li>
      )];
    }
    const leg = item.leg!;
    const color = item.color;
    const selected = activeSegmentId === leg.id;
    const scheduled = isScheduledRouteLeg(leg);
    const liveStatus = liveJourney?.segments.find(segment => segment.legId === leg.id)?.status === 'LIVE' ? 'LIVE' : leg.liveStatus;
    const stopsOpen = stopsLegId === leg.id;
    const canBook = Boolean(leg.offerId) && leg.availabilityStatus !== 'UNAVAILABLE';
    const stops = leg.stops ?? [];
    const price = legPriceDisplay(leg);
    const dataCaveat = journeyLegCaveat(leg.mode, leg.source, leg.scheduleSemantics, leg.fareSource);
    const legIndex = journey.legs.findIndex(entry => entry.id === leg.id);
    const walkHint = walkHintFor(journey.legs, legIndex);
    const transferHint = transferHints.get(leg.id);
    const statusLabel = liveStatus === 'LIVE' ? 'ЗА РУХОМ'
      : liveStatus === 'PREDICTED' ? 'ПРОГНОЗ'
        : liveStatus === 'SCHEDULED' && leg.scheduleSemantics === 'frequency_estimate' ? 'ІНТЕРВАЛ'
          : liveStatus === 'UNAVAILABLE' ? 'НЕДОСТУПНО'
            : liveStatus && liveStatus !== 'SCHEDULED' ? 'ОРІЄНТОВНО' : null;
    const segmentAccessibleLabel = [
      `Сегмент: ${legLabel(leg)}`,
      legTimeLabel(leg, item.durationSeconds),
      leg.mode === 'WALK' && typeof leg.distanceMeters === 'number' && Number.isFinite(leg.distanceMeters) ? formatJourneyDistance(leg.distanceMeters) : null,
      `${cleanStopName(leg.origin.name)} → ${cleanStopName(leg.destination.name)}`,
      leg.mode !== 'WALK' ? `вартість ${price.value}${price.caption ? ` ${price.caption}` : ''}` : null,
      scheduled && stops.length ? formatStopCount(stops.length) : null,
      statusLabel,
      walkHint ? [walkHint.title, walkHint.detail].filter(Boolean).join(' · ') : null,
    ].filter(Boolean).join('; ');

    return [
      (
      <li
        key={leg.id}
        ref={node => setCardRef(leg.id, node)}
        data-testid="journey-route-segment"
        data-segment-id={leg.id}
        data-active={selected}
        className={`mg-rise mg-stagger mg-route-segment mg-route-segment--dense overflow-hidden rounded-xl border bg-[var(--route-card)] transition-[border-color,box-shadow,opacity] duration-[var(--mg-dur-fast)] ${selected ? 'border-[var(--mg-blue)] shadow-[0_0_0_1px_rgba(22,135,255,.45),0_0_24px_rgba(22,135,255,.16)]' : 'border-[var(--route-border)]'}`}
        style={{
          borderLeftWidth: 3.5,
          borderLeftColor: color,
          opacity: activeSegmentId && !selected ? 0.72 : 1,
          ['--mg-stagger-i' as string]: index,
          ...(leg.mode === 'COMMUNITY' ? { backgroundColor: 'var(--route-community-surface)' } : {}),
        }}
      >
        <div className="flex min-h-11 items-center gap-1.5 px-1.5 py-1">
          <button
            type="button"
            onClick={() => chooseSegment(leg.id)}
            aria-pressed={selected}
            aria-label={`Вибрати сегмент. ${segmentAccessibleLabel}`}
            title={segmentAccessibleLabel}
            className="mg-press-subtle flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)]"
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white shadow-[0_2px_8px_color-mix(in_srgb,var(--segment-color)_36%,transparent)]"
              style={{ backgroundColor: color, ['--segment-color' as string]: color }}
            >
              <TransportIcon mode={leg.mode} transportType={leg.transportType} size={15} strokeWidth={2.3}/>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-4">
              <span className="flex min-w-0 items-center gap-1.5">
                <b className="min-w-0 flex-1 truncate text-[13px] font-black tracking-tight">{leg.mode === 'COMMUNITY' ? 'Попутка' : legLabel(leg)}</b>
                <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--route-muted)]">
                  {formatDuration(item.durationSeconds)}{leg.mode === 'WALK' && typeof leg.distanceMeters === 'number' && Number.isFinite(leg.distanceMeters) ? ` · ${formatJourneyDistance(leg.distanceMeters)}` : ''}
                </span>
                {leg.mode !== 'WALK' && <b className={`shrink-0 text-xs font-black tabular-nums ${price.value === '—' ? 'text-[var(--route-muted)]' : ''}`} style={{ color: price.value === '—' ? undefined : isDark ? color : 'var(--route-ink)' }}>{price.value}</b>}
                {statusLabel && leg.mode !== 'WALK' && <span className={`shrink-0 rounded-full px-1 py-px text-xs font-black leading-3 ${liveStatus === 'LIVE' ? (isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-800') : 'bg-[var(--route-card-alt)] text-[var(--route-muted)]'}`}>
                  {liveStatus === 'LIVE' && <span aria-hidden="true" className="mg-live-pulse mr-0.5 inline-block h-1 w-1 rounded-full bg-emerald-400"/>}{statusLabel}
                </span>}
              </span>
              <span className="flex min-w-0 items-center gap-1 text-xs font-semibold leading-[14px] text-[var(--route-muted)]">
                <time className="shrink-0 tabular-nums">{formatTime(leg.departureAt)}–{formatTime(leg.arrivalAt)}</time>
                <span aria-hidden="true">·</span>
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--route-subtle)]">{cleanStopName(leg.origin.name)} → {cleanStopName(leg.destination.name)}</span>
              </span>
              {walkHint && <span className="sr-only" data-testid="route-walk-hint">{walkHint.title}{walkHint.detail ? ` · ${walkHint.detail}` : ''}</span>}
              {showDiagnostics && <span data-testid="journey-route-segment-source" title={leg.source} className="mt-0.5 block truncate text-xs leading-4 text-[var(--route-muted)]">Джерело: {leg.providerName || leg.source}</span>}
              {showDiagnostics && dataCaveat && <span data-testid="journey-route-segment-caveat" className="mt-1 block text-xs leading-4 text-[var(--route-muted)]">{dataCaveat}</span>}
            </span>
          </button>
          <div className="flex shrink-0 items-center">
            {scheduled && stops.length > 0 && (
              <button
                type="button"
                aria-label={`${stopsOpen ? 'Згорнути' : 'Розгорнути'} ${formatStopCount(stops.length)}: ${journeyLegLabel(leg.mode, leg.transportType)}`}
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
        <li key={transferHint.id} data-testid="route-inline-transfer" data-transfer-id={transferHint.id} data-active={activeTransferId === transferHint.id}>
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
      className="route-map-screen fixed inset-0 z-[var(--mg-z-map-chip)] overflow-hidden text-[var(--route-ink)]"
      data-theme={isDark ? 'dark' : 'light'}
      data-sheet-snap={sheetSnap}
      style={{ ['--route-map-inset' as string]: `${sheetHeight + (sheetSnap === 'expanded' ? 10 : 58)}px` }}
      aria-labelledby="journey-route-map-title"
    >
      <h1 id="journey-route-map-title" className="sr-only">{cleanStopName(firstLeg?.origin.name) || 'Початок'} — {cleanStopName(lastLeg?.destination.name) || 'Кінець'}</h1>
      <div className="absolute inset-0" data-testid="journey-route-map">
        <MarshGoMap
          route={[]}
          overlays
          routeSegments={model.routeSegments}
          routeWaypoints={model.routeWaypoints}
          routeLabels={[]}
          theme={isDark ? 'MARSHGO_DARK' : 'MARSHGO_LIGHT'}
          onStatus={setMapStatus}
          onAdapter={adapter => {
            mapAdapter.current = adapter;
            setMapAdapterReady(Boolean(adapter));
            if (adapter) {
              adapter.setActiveRouteSegment?.(activeSegmentId);
              // Listen for manual camera panning/gestures to avoid jarring recenters
              adapter.onCameraModeChange = (mode) => {
                if (mode === 'FREE') cameraController.current?.onUserMapInteraction();
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
              aria-label="Назад до результатів"
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

      {/* Floating map controls. The expanded sheet's grabber spans the full width right
          over this band, so taps there dragged the sheet instead of reaching a control:
          the column is inert (and visibly inactive) while the sheet is expanded. */}
      <MapControlRail
        className={`absolute right-3 z-10${sheetSnap === 'expanded' ? ' opacity-45' : ''}`}
        label="Керування картою маршруту"
        inert={sheetSnap === 'expanded'}
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

      {/* FULL keeps a live map strip; this returns the sheet to MEDIUM so the
          focused target is visible again instead of hidden behind the details.
          It lives in the strip's top padding: the camera fits focus below it. */}
      {sheetSnap === 'expanded' && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 mx-auto flex max-w-3xl justify-center px-4"
          style={{ top: 'max(.5rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            data-testid="route-show-on-map"
            onClick={() => moveToSnap('half')}
            aria-label={`${focusLabel}. Показати на карті`}
            className="pointer-events-auto route-show-on-map mg-press-subtle inline-flex min-h-11 max-w-full items-center gap-2 rounded-full px-3.5 text-xs font-extrabold"
          >
            <MapIcon size={15} className="shrink-0" aria-hidden="true"/>
            <span className="truncate">{focusLabel}</span>
            <span aria-hidden="true" className="shrink-0 text-[var(--route-muted)]">·</span>
            <span className="shrink-0">Показати на карті</span>
          </button>
        </div>
      )}

      {showChrome && scale && (
        <div className="route-map-scale" style={{ left: 16, bottom: sheetHeight + (sheetSnap === 'peek' ? 14 : 64) }} aria-hidden="true">
          <span>{scale.label}</span>
          <i style={{ width: scale.widthPx }}/>
        </div>
      )}

      {showChrome && sheetSnap !== 'peek' && liveLeg && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 mx-auto flex max-w-3xl justify-center px-4"
          style={{ bottom: sheetHeight + 8, transition: routeSheetTransition(draggingRef.current, reducedMotion, 'bottom') }}
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
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums text-[var(--route-muted)]"><i aria-hidden="true" className="mg-live-dot mg-live-pulse inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"/>ЗА РУХОМ</span>
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
          transition: routeSheetTransition(draggingRef.current, reducedMotion),
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'linear-gradient(160deg,var(--route-sheet-start),var(--route-sheet-end))',
        }}
      >
        <button
          type="button"
          aria-label={sheetSnap === 'expanded' ? 'Згорнути деталі маршруту' : 'Розгорнути деталі маршруту'}
          aria-expanded={sheetSnap === 'half' || sheetSnap === 'expanded'}
          onClick={cycleSheet}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
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
          className="route-sheet-grabber flex w-full h-11 shrink-0 touch-none items-center justify-center"
        >
          <span className="route-sheet-grabber__handle"/>
        </button>

        {sheetSnap !== 'peek' && model.missingWalkingShapeCount > 0 && (
          <p
            role="status"
            aria-live="polite"
            data-testid="route-walking-geometry-note"
            className="mx-3 mb-1 rounded-xl bg-[var(--route-card-alt)] px-3 py-2 text-xs font-semibold text-[var(--route-muted)]"
          >Для частини пішого маршруту немає перевіреної геометрії — лінію не домальовано.</p>
        )}

        <div id="route-sheet-content" className={`flex min-h-0 flex-col ${sheetSnap === 'peek' || sheetSnap === 'collapsed' ? 'shrink-0' : 'flex-1'}`}>
          {sheetSnap === 'peek' ? (
            <div className="flex shrink-0 flex-col gap-0.5 px-4 pb-0.5" data-testid="route-peek-summary">
              <div className="flex items-center justify-between gap-3">
                <strong data-testid="canonical-route-duration" className="text-[19px] font-black leading-tight tracking-tight tabular-nums">{formatDuration(allDuration)}</strong>
                <span data-testid="route-peek-summary-divider" aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-[var(--route-border)]"/>
                <strong data-testid="route-total-fare" aria-label={`Загальна вартість: ${totalPriceLabel === '—' ? 'невідома' : `${totalPriceLabel}${priceDisplay.caption ? ` ${priceDisplay.caption}` : ''}`}`} className={`text-[16px] font-black tabular-nums ${totalPriceLabel === '—' ? 'text-[var(--route-muted)]' : ''}`}>{priceSummary}</strong>
              </div>
              <p data-testid="route-peek-chain" className="truncate text-xs font-bold tabular-nums text-[var(--route-muted)]">
                {ribbonItems.map(item => `${item.label}${item.badge ? ` ${item.badge}` : ''} ${formatJourneyDurationTile(item.durationSeconds)}`).join(' → ')}
              </p>
              <div data-testid="route-peek-scale" className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--route-card-alt)] gap-1">
                {ribbonItems.map(item => (
                  <span
                    key={item.id}
                    className="h-full rounded-full"
                    style={{
                      flexGrow: Math.max(1, Math.round(item.durationSeconds / 60)),
                      backgroundColor: item.leg.mode === 'WALK' ? 'var(--route-ribbon-walk)' : item.color,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {sheetSnap === 'expanded' && (
                <div className="route-details-head flex shrink-0 items-center gap-2 px-4 pb-0.5">
                  <button type="button" aria-label="Назад до результатів" onClick={onBack} className="route-header-back mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-full">
                    <ArrowLeft size={20}/>
                  </button>
                  <h2 className="min-w-0 flex-1 truncate text-center text-base font-black tracking-tight">Деталі маршруту</h2>
                  <button type="button" aria-label="Поділитися маршрутом" onClick={shareRoute} className="route-header-icon mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-full">
                    <Share2 size={19}/>
                  </button>
                  <button type="button" aria-label={saved ? 'Видалити маршрут зі збережених' : 'Зберегти маршрут'} aria-pressed={saved} onClick={toggleSaved} className="route-header-icon mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-full">
                    <Heart size={21} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-rose-400' : ''}/>
                  </button>
                </div>
              )}
              {sheetSnap === 'expanded' && (
                <p className="shrink-0 truncate px-4 pb-1 text-xs font-bold text-[var(--route-ink)]">
                  {cleanStopName(firstLeg?.origin.name) || 'Початок'} <span aria-hidden="true" className="mx-0.5 text-[var(--route-muted)]">→</span> {cleanStopName(lastLeg?.destination.name) || 'Кінець'}
                </p>
              )}
              <div className={`route-sheet-summary flex shrink-0 items-center justify-between gap-3 px-4 py-0.5${sheetSnap === 'collapsed' ? ' route-sheet-summary--dense' : ''}`}>
                {sheetSnap === 'collapsed' ? <>
                  <strong data-testid="canonical-route-duration" className="min-w-0 truncate text-[19px] font-black leading-tight tracking-tight tabular-nums">{formatDuration(allDuration)}</strong>
                  <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[var(--route-border)]"/>
                  <strong data-testid="route-total-fare" aria-label={`Загальна вартість: ${totalPriceLabel === '—' ? 'невідома' : `${totalPriceLabel}${priceDisplay.caption ? ` ${priceDisplay.caption}` : ''}`}`} className={`shrink-0 text-[17px] font-black tabular-nums ${totalPriceLabel === '—' ? 'text-[var(--route-muted)]' : ''}`}>{priceSummary}</strong>
                  <span className="shrink-0 text-xs font-bold text-[var(--route-muted)]">{journey.transfers === 0 ? 'Без пересадок' : formatTransferCount(journey.transfers)}</span>
                </> : <>
                <span className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
                  <strong className="text-[20px] font-black leading-tight tracking-tight tabular-nums">{firstLeg ? formatTime(firstLeg.departureAt) : '—'} <span aria-hidden="true" className="text-[var(--route-muted)]">→</span> {lastLeg ? formatTime(lastLeg.arrivalAt) : '—'}</strong>
                  <span data-testid="canonical-route-duration" className="mt-0.5 truncate text-xs font-bold tabular-nums text-[var(--route-muted)]">{formatDuration(allDuration)} · {formatSegmentCount(journey.legs.length)}{journey.transfers > 0 ? ` · ${formatTransferCount(journey.transfers)}` : ''}</span>
                </span>
                <span data-testid="route-total-fare" className="flex shrink-0 flex-col items-end leading-tight">
                  <strong aria-label={`Загальна вартість: ${totalPriceLabel === '—' ? 'невідома' : `${totalPriceLabel}${priceDisplay.caption ? ` ${priceDisplay.caption}` : ''}`}`} className={`text-[17px] font-black tabular-nums ${totalPriceLabel === '—' ? 'text-[var(--route-muted)]' : ''}`}>{priceSummary}</strong>
                  {priceDisplay.caption && totalPriceLabel !== '—' && <span data-testid="route-total-fare-caption" className="mt-0.5 rounded-md bg-[var(--route-card-alt)] px-1.5 py-0.5 text-xs font-semibold text-[var(--route-muted)]">{priceDisplay.caption}</span>}
                </span>
                </>}
              </div>

              <div className="mg-route-ribbon shrink-0 px-4 pb-1 pt-0.5" role="list" aria-label="Етапи маршруту">
                {ribbonItems.map(item => {
                  const selected = activeSegmentId === item.id;
                  const walk = item.leg.mode === 'WALK';
                  return (
                    <div key={item.id} role="listitem" className={`mg-route-ribbon__item${activeSegmentId && !selected ? ' is-muted' : ''}`} style={{ flexGrow: Math.max(1, Math.round(item.durationSeconds / 60)) }}>
                      <button type="button" onClick={() => chooseSegment(item.id)} aria-pressed={selected} aria-label={`Вибрати етап: ${item.label}, ${item.detail}`} className={`mg-route-ribbon__pill mg-press-subtle${selected ? ' is-active' : ''}`} style={{ backgroundColor: walk ? 'var(--route-ribbon-walk)' : item.color }}>
                        <TransportIcon mode={item.leg.mode} transportType={item.leg.transportType} size={16} strokeWidth={2.4}/>
                      </button>
                      <span className="mg-route-ribbon__label">{item.label}</span>
                      <span className="mg-route-ribbon__detail">{item.detail}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Independent scrolling for details in medium and expanded modes */}
          {(sheetSnap === 'half' || sheetSnap === 'expanded') && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-1.5" data-testid="route-segment-list">
              <ol className="space-y-1 pt-0.5">
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
          <div className={`shrink-0 px-4 ${sheetSnap === 'peek' ? 'pb-1 pt-0.5' : 'pb-2 pt-1'}`}>
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
            {startError && <p role="status" className="mb-2 rounded-xl border border-[var(--route-border)] bg-[var(--route-card)] px-3 py-2 text-center text-xs font-semibold leading-4 text-[var(--route-muted)]">{startError}</p>}
            <button
              type="button"
              disabled={!canStartNavigation || startingNavigation}
              aria-busy={startingNavigation}
              onClick={() => void startNavigation()}
              className={`mg-route-cta mg-press-subtle flex w-full items-center justify-center gap-2.5${sheetSnap === 'peek' ? ' route-sheet-peek-cta' : ''}`}
            >
              <Play size={18} fill="currentColor" aria-hidden="true"/>
              <span className="font-black tracking-tight">{startingNavigation ? 'Визначаємо місце…' : journey.legs.some(leg => leg.mode === 'COMMUNITY') ? 'Розпочати поїздку' : 'Розпочати'}</span>
            </button>
          </div>
        </div>
      </section>

      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 z-40 flex justify-center px-6" style={{ bottom: 'calc(var(--route-map-inset) + 10px)', transition: routeSheetTransition(draggingRef.current, reducedMotion, 'bottom') }}>
        {feedback && <p key={feedback} role="status" className="route-toast max-w-full truncate rounded-full px-4 py-2.5 text-xs font-extrabold">{feedback}</p>}
      </div>
      {floatingMapInfo.accessibility}
    </section>
  );
}
