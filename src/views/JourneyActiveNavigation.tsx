import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ChevronDown, Clock3, Navigation } from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import { MapLayersControl } from '../components/MapLayersControl';
import { MapBasemapControl, MapControlRail, MapPerspectiveControl, MapVoiceControl, MapZoomControls } from '../components/MapInteractionControls';
import {
  buildJourneyRouteMapModel, confirmedJourneySegments, formatTransferCount, journeyModeColor,
} from '../map/journeyRouteModel';
import { boundsOf, corridorFitPoints } from '../map/routeContextCorridor';
import { extentMeters, principalBearing } from '../map/routeCameraFocus';
import type { MapAdapter, MapStatus, RouteFitPadding } from '../map/MapAdapter';
import { mapStatusDetail, mapStatusNote } from '../map/mapStatusCopy';
import { productionApi, hasApiSession, ProductionApiError, type ApiJourney, type ApiJourneyLive } from '../services/productionApi';
import { TransportIcon } from '../design-system/transport/TransportIcon';
import { buildRouteMapAnnotations, formatStopCount, isTransitLeg } from './routeMapAnnotations';
import { JourneyLegStops, isScheduledRouteLeg } from './JourneyLegStops';
import { nextStopsLegId } from './journeyStopsPanel';
import { useFocusedFleetClock } from './useFocusedFleetClock';
import './routeSheetDensity.css';
import { diagnosticsRequested } from './resultsDiagnostics';
import {
  createFrameWriter,
  ROUTE_SHEET_SNAPS,
  fitExpandedRouteSheetHeight,
  prefersReducedMotion,
  recoverRouteSheetDrag,
  routeSheetHeights,
  routeSheetTransition,
  settleRouteSheetSnap,
  subscribeReducedMotion,
  type RouteSheetSnap,
} from './routeSheet';
import { themeService } from '../services/theme';
import { getMapPerspective, subscribeMapPerspective } from '../map/mapMode';
import { distanceMeters } from '../map/cinematicRouteEngine';
import { focusedApproachVehicles, passengerContextLines, priorityLevelOf } from '../map/transportVisualZones';
import { formatJourneyDistance, formatJourneyDurationTile } from './journeyResultPresentation';
import { measureGlobalBottomNavigationInset } from './globalBottomNavigationInset';
import {
  ACTIVE_LEG_STATUS_LABEL,
  activeLegInstruction,
  activeLegMeta,
  activeLegNextHint,
  activeLegStatus,
  activeLegTimes,
  activeLegTitle,
  activeNavigationDestination,
  activeNavigationStageLabel,
  formatStageCount,
  shortPlace,
} from './journeyStageNavigation';
import {
  buildFlightPath,
  cinematicCameraFrame,
  dockCameraFrame,
  flightDurationMs,
  createFlightPlayback,
  lerpBearing,
  TRANSFER_CALLOUT_TIMING,
} from '../map/hyperFlightEngine';
import { calloutIconType, cleanStopName, type CinematicCallout } from '../map/cinematicRouteEngine';
import { GlassGuidanceCallouts } from './GlassGuidanceCallouts';
import { FlightTelemetry, type FlightTelemetryHandle } from './FlightTelemetry';
import { WebGeolocationProvider, isDuplicateLocationFix, validateLocationFix } from '../platform/LocationProvider';
import type { LocationFix } from '../../shared/navigation/contracts';
import { shouldFocusJourneyStage, type JourneyCameraOwner } from '../navigation/journeyCameraOwnership';

export function JourneyActiveNavigation({
  journey,
  notice,
  onExit,
  initialLegIndex = null,
  initialFix = null,
}: {
  journey: ApiJourney;
  notice?: string | null;
  onExit: () => void;
  onFinish?: () => void;
  initialLegIndex?: number | null;
  initialFix?: LocationFix | null;
  onStageChange?: (legIndex: number) => void;
}) {
  const showDiagnostics = typeof window !== 'undefined' && diagnosticsRequested(
    window.location.search,
    (() => { try { return window.localStorage.getItem('marshgo.results.diagnostics'); } catch { return null; } })(),
  );
  const legs = journey.legs;
  const model = useMemo(() => buildJourneyRouteMapModel(legs), [legs]);
  const missingWalkGeometry = model.missingWalkingShapeCount > 0 || model.routeSegments.some(segment => segment.isWalk && segment.approximate);
  const confirmedSegments = useMemo(() => confirmedJourneySegments(model.routeSegments), [model.routeSegments]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [legIndex, setLegIndex] = useState(() => {
    if (initialLegIndex === null || legs.length === 0 || !Number.isInteger(initialLegIndex)) return 0;
    return Math.min(Math.max(initialLegIndex, 0), legs.length - 1);
  });
  const navigationLegIndex = useRef(Math.min(Math.max(initialLegIndex ?? 0, 0), Math.max(0, legs.length - 1)));
  const [navigationFix, setNavigationFix] = useState<LocationFix | null>(initialFix);
  const lastNavigationFix = useRef<LocationFix | null>(initialFix);
  const [gpsMessage, setGpsMessage] = useState(initialFix ? '' : 'Очікуємо GPS-позицію…');
  const [following, setFollowing] = useState(Boolean(initialFix));
  const cameraOwner = useRef<JourneyCameraOwner>(initialFix ? 'follow' : 'stage');

  const leg = legs[Math.min(legIndex, Math.max(0, legs.length - 1))];
  const liveLeg = leg && isTransitLeg(leg) ? leg : undefined;
  const liveLegId = liveLeg?.id ?? null;
  const [openStopsLegId, setOpenStopsLegId] = useState<string | null>(null);

  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [isDark, setIsDark] = useState(themeService.isDark());
  const [sheetSnap, setSheetSnap] = useState<RouteSheetSnap>('collapsed');
  const [sheetHeight, setSheetHeight] = useState(220);
  const [expandedContentHeight, setExpandedContentHeight] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === 'undefined' ? 844 : window.innerHeight);
  const [bottomNavigationInset, setBottomNavigationInset] = useState(measureGlobalBottomNavigationInset);
  const draggingRef = useRef(false);
  const [mapAdapterReady, setMapAdapterReady] = useState(false);
  const [focusWhole, setFocusWhole] = useState(false);
  const [liveJourney, setLiveJourney] = useState<ApiJourneyLive | null>(null);
  const [liveJourneyRequestState, setLiveJourneyRequestState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const liveSegment = liveJourney?.segments.find(segment => segment.legId === liveLegId);
  const fleetClock = useFocusedFleetClock(liveSegment?.vehicles);
  const mapAdapter = useRef<MapAdapter | null>(null);
  const perspectiveRef = useRef(getMapPerspective());
  const flightRef = useRef<{ raf: number; cancelled: boolean; timers: number[]; pause(): void; play(): void; seek(fraction: number): void } | null>(null);
  const continueFlightRef = useRef<(index: number) => void>(() => undefined);
  const telemetryRef = useRef<FlightTelemetryHandle | null>(null);
  const [isFlying, setIsFlying] = useState(false);
  const [transferCallout, setTransferCallout] = useState<CinematicCallout | null>(null);
  const calloutTimer = useRef<number | null>(null);
  const sheetElement = useRef<HTMLElement | null>(null);
  const sheetHeightRef = useRef(sheetHeight);
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

  const getSheetHeights = useCallback((height = viewportHeight, navigationInset = bottomNavigationInset) => {
    const heights = routeSheetHeights(Math.max(320, height - navigationInset));
    heights.peek = 140;
    heights.collapsed = 220;
    heights.half = Math.min(heights.expanded - 24, Math.max(heights.collapsed + 24, Math.round((height - navigationInset) * 0.5)));
    heights.expanded = fitExpandedRouteSheetHeight(heights, expandedContentHeight);
    return heights;
  }, [bottomNavigationInset, expandedContentHeight, viewportHeight]);

  useEffect(() => themeService.subscribe((_mode, dark) => setIsDark(dark)), []);
  useEffect(() => subscribeReducedMotion(setReducedMotion), []);
  useEffect(() => subscribeMapPerspective(perspective => { perspectiveRef.current = perspective; }), []);
  useEffect(() => {
    const writer = dragWriter.current;
    return () => writer?.discard();
  }, []);

  useEffect(() => {
    const recoverInterruptedDrag = () => {
      if (!draggingRef.current) return;
      const sheet = sheetElement.current;
      const pointerId = dragStart.current?.pointerId;
      const heights = getSheetHeights();
      const recovered = recoverRouteSheetDrag(sheet?.getBoundingClientRect().height ?? sheetHeightRef.current, heights);
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
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const haptic = (ms: number | number[]) => {
    try { navigator.vibrate?.(ms); } catch { /* iOS Safari has no Vibration API */ }
  };

  useEffect(() => {
    if (!liveLegId) {
      setLiveJourney(null);
      setLiveJourneyRequestState('idle');
      return;
    }
    // Live vehicle position is an authenticated endpoint: without a session every poll would be
    // rejected, so stay quiet instead of firing a 401 every 15 seconds during the trip.
    if (!hasApiSession()) {
      setLiveJourney(null);
      setLiveJourneyRequestState('idle');
      return;
    }
    let stopped = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let reschedule = true;
    setLiveJourneyRequestState('loading');
    const poll = async () => {
      controller = new AbortController();
      reschedule = true;
      try {
        const live = await productionApi.journeyLive(journey.id, liveLegId, controller.signal);
        if (!stopped) {
          setLiveJourney(live);
          setLiveJourneyRequestState('ready');
        }
      } catch (error) {
        if (!stopped) {
          setLiveJourney(null);
          setLiveJourneyRequestState('failed');
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
        routeLabel: liveLeg.routeName ?? activeLegTitle(liveLeg),
        emphasized: vehicle.emphasized,
        priorityLevel: priorityLevelOf(vehicle),
        etaSeconds: vehicle.etaSeconds ?? null,
        etaConfidence: vehicle.etaConfidence ?? 'NONE',
      })),
    });
  }, [liveSegment, liveLeg, mapAdapterReady, fleetClock]);

  const routeLabels = useMemo(
    () => buildRouteMapAnnotations({ journey, live: liveJourney, preferredLegId: liveLegId, focusedOnly: true, now: fleetClock }),
    [journey, liveJourney, liveLegId, fleetClock],
  );

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const mapPadding = useMemo<RouteFitPadding>(() => {
    if (isDesktop) return { top: 100, left: 500, right: 40, bottom: 40 };
    return { top: 118, left: 26, right: 80, bottom: getSheetHeights().half + bottomNavigationInset + 24 };
  }, [bottomNavigationInset, getSheetHeights, isDesktop]);

  useEffect(() => {
    const provider = new WebGeolocationProvider();
    let stopped = false;
    const unsubscribeStatus = provider.subscribeStatus(status => {
      if (stopped || status === 'ACTIVE' || status === 'IDLE') return;
      setNavigationFix(null);
      setGpsMessage(status === 'PERMISSION_DENIED'
        ? 'Доступ до GPS вимкнено. Дозвольте геолокацію у браузері.'
        : 'GPS тимчасово недоступний. Позицію не домальовуємо.');
    });
    const unsubscribeFix = provider.subscribe(fix => {
      if (stopped || isDuplicateLocationFix(fix, lastNavigationFix.current ?? undefined)) return;
      const checked = validateLocationFix(fix, Date.now(), lastNavigationFix.current ?? undefined);
      if (!checked.accepted) {
        setNavigationFix(null);
        setGpsMessage(checked.code === 'GPS_LOW_ACCURACY'
          ? 'Слабкий сигнал GPS. Чекаємо точнішу позицію.'
          : checked.code === 'GPS_TELEPORT_DETECTED'
            ? 'Нестабільний сигнал GPS. Чекаємо узгоджену позицію.'
            : 'Чекаємо свіжий сигнал GPS.');
        return;
      }
      lastNavigationFix.current = checked.fix;
      setNavigationFix(checked.fix);
      setGpsMessage('');
    });
    void provider.start({ maximumAgeMs: 0, timeoutMs: 20_000 }).catch(() => {
      if (!stopped) setGpsMessage('Цей пристрій не надає GPS.');
    });
    return () => { stopped = true; unsubscribeFix(); unsubscribeStatus(); void provider.stop(); };
  }, [journey.id]);

  const freshNavigationFix = navigationFix && validateLocationFix(navigationFix, nowMs).accepted ? navigationFix : null;
  useEffect(() => {
    const adapter = mapAdapter.current;
    if (!adapter || !mapAdapterReady) return;
    if (!freshNavigationFix) { adapter.clearVehicle?.(); return; }
    const padding = isDesktop ? mapPadding : { ...mapPadding, bottom: Math.max(getSheetHeights().half, sheetHeight) + bottomNavigationInset + 24 };
    adapter.setFollowPadding?.(padding);
    adapter.setCameraMode(following && sheetSnap !== 'expanded' ? 'FOLLOW_HEADING' : 'FREE');
    adapter.setVehicle([freshNavigationFix.longitude, freshNavigationFix.latitude], freshNavigationFix.headingDegrees ?? null);
  }, [freshNavigationFix, following, mapAdapterReady, mapPadding, isDesktop, getSheetHeights, sheetHeight, sheetSnap, bottomNavigationInset]);

  const legSegment = useMemo(
    () => (leg ? confirmedSegments.find(segment => segment.id === leg.id) : undefined),
    [leg, confirmedSegments],
  );

  const legFlightPath = useMemo(() => buildFlightPath(legSegment?.coordinates ?? []), [legSegment]);

  const focusData = useMemo(() => {
    const contextLines = passengerContextLines(liveSegment?.lineRoutes ?? []);
    const points = focusWhole
      ? corridorFitPoints(confirmedSegments.flatMap(segment => segment.coordinates), contextLines)
      : legSegment
        ? corridorFitPoints(legSegment.coordinates, contextLines, 0.5)
        : [];
    const bearing = !focusWhole && legSegment && extentMeters(legSegment.coordinates) > 120
      ? principalBearing(legSegment.coordinates)
      : null;
    const bounds = boundsOf(points);
    const key = `${focusWhole}:${leg?.id ?? 'none'}:${points.length}:${bearing === null ? 'flat' : bearing.toFixed(1)}:${bounds?.map(value => value.toFixed(5)).join(',') ?? ''}`;
    return { points, bearing, key };
  }, [focusWhole, leg?.id, legSegment, liveSegment, confirmedSegments]);

  useEffect(() => {
    if (draggingRef.current || !mapAdapterReady || !leg) return;
    const adapter = mapAdapter.current;
    if (!adapter) return;
    adapter.setActiveRouteSegment?.(leg.id);
    // The expanded detent leaves a thin strip: refitting there squeezes the
    // stage into a few pixels, so the camera stays on the last readable frame.
    if (sheetSnap === 'expanded' || !shouldFocusJourneyStage(cameraOwner.current, Boolean(freshNavigationFix))) return;
    if (focusData.points.length >= 2) {
      adapter.focusCoordinates?.(
        focusData.points,
        focusData.bearing === null ? { ...mapPadding, bearing: 0 } : { ...mapPadding, bearing: focusData.bearing },
        focusWhole ? 14.5 : 17,
      );
      return;
    }
    adapter.fitRoute(mapPadding);
  }, [focusData.bearing, focusData.key, focusData.points, focusWhole, freshNavigationFix, leg, mapAdapterReady, mapPadding, sheetSnap]);

  useEffect(() => {
    const updateViewport = () => {
      const next = window.innerHeight;
      const nextNavigationInset = measureGlobalBottomNavigationInset();
      setViewportHeight(next);
      setBottomNavigationInset(nextNavigationInset);
      const nextHeight = getSheetHeights(next, nextNavigationInset)[sheetSnap];
      sheetHeightRef.current = nextHeight;
      setSheetHeight(nextHeight);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [getSheetHeights, sheetSnap]);

  useEffect(() => {
    if (sheetSnap !== 'expanded') return;
    const sheet = sheetElement.current;
    const content = sheet?.querySelector<HTMLElement>('[data-testid="active-navigation-content"]');
    if (!sheet || !content) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (draggingRef.current) return;
        const naturalHeight = Math.ceil(sheet.getBoundingClientRect().height - content.clientHeight + content.scrollHeight);
        setExpandedContentHeight(previous => previous !== null && Math.abs(previous - naturalHeight) < 2 ? previous : naturalHeight);
      });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(content);
    Array.from(content.children).forEach(child => observer?.observe(child));
    const stages = content.querySelector<HTMLElement>('[data-testid="active-navigation-stages"]');
    if (stages) Array.from(stages.querySelectorAll(':scope > ol > li')).forEach(child => observer?.observe(child));
    measure();
    return () => { observer?.disconnect(); cancelAnimationFrame(frame); };
  }, [legIndex, openStopsLegId, sheetSnap, viewportHeight]);

  useEffect(() => {
    if (sheetSnap !== 'expanded' || draggingRef.current) return;
    const nextHeight = getSheetHeights().expanded;
    sheetHeightRef.current = nextHeight;
    setSheetHeight(previous => Math.abs(previous - nextHeight) < 1 ? previous : nextHeight);
  }, [expandedContentHeight, getSheetHeights, sheetSnap]);

  const moveToSnap = (next: RouteSheetSnap) => {
    const nextHeight = getSheetHeights()[next];
    sheetHeightRef.current = nextHeight;
    setSheetSnap(next);
    setSheetHeight(nextHeight);
    haptic(6);
  };
  const cycleSheet = () => {
    if (suppressHandleClick.current) { suppressHandleClick.current = false; return; }
    moveToSnap(ROUTE_SHEET_SNAPS[(ROUTE_SHEET_SNAPS.indexOf(sheetSnap) + 1) % ROUTE_SHEET_SNAPS.length]!);
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    cancelFlight();
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
      moveToSnap(settleRouteSheetSnap(sheetHeightRef.current, start.velocity, heights, 0.45, start.height));
    }
    dragStart.current = null;
    draggingRef.current = false;
    if (sheetElement.current) {
      sheetElement.current.dataset.dragging = 'false';
      sheetElement.current.style.transition = routeSheetTransition(false, reducedMotion);
    }
  };

  const clearCallout = useCallback(() => {
    if (calloutTimer.current !== null) { window.clearTimeout(calloutTimer.current); calloutTimer.current = null; }
    setTransferCallout(null);
  }, []);

  const cancelFlight = useCallback(() => {
    cameraOwner.current = 'user';
    setFollowing(false);
    mapAdapter.current?.setCameraMode('FREE');
    clearCallout();
    const flight = flightRef.current;
    if (!flight) return;
    flight.cancelled = true;
    cancelAnimationFrame(flight.raf);
    flight.timers.forEach(timer => window.clearTimeout(timer));
    flightRef.current = null;
    const adapter = mapAdapter.current;
    adapter?.setCinematicFlightActive?.(false);
    adapter?.fadeSegmentReveal?.();
    telemetryRef.current?.update(0);
    setIsFlying(false);
  }, [clearCallout]);

  const jumpToLeg = useCallback((index: number) => {
    cancelFlight();
    cameraOwner.current = 'stage';
    setLegIndex(index);
    haptic(8);
  }, [cancelFlight]);

  const resumeNavigation = () => {
    cancelFlight();
    if (!freshNavigationFix) { setGpsMessage('Немає свіжої GPS-позиції. Чекаємо сигнал перед поверненням до навігації.'); return; }
    cameraOwner.current = 'follow';
    setLegIndex(navigationLegIndex.current);
    setFocusWhole(false);
    setFollowing(true);
  };

  const showTransferCallout = useCallback((targetLeg: ApiJourney['legs'][number], dockCoordinate: [number, number], connected: boolean) => {
    const screen = mapAdapter.current?.project?.(dockCoordinate) ?? null;
    const isWalk = targetLeg.mode === 'WALK';
    const subtitle = isWalk
      ? `Прямуйте до «${cleanStopName(targetLeg.destination?.name) || 'зупинки'}»`
      : `Сідайте на «${cleanStopName(targetLeg.origin?.name) || 'зупинці'}»`;
    setTransferCallout({
      id: `transfer-${targetLeg.id}`,
      type: 'TRANSFER',
      coordinates: dockCoordinate,
      title: !connected ? 'Кінець геометрії' : isWalk ? 'Піший перехід' : 'Посадка',
      subtitle: connected ? subtitle : 'Наступна ділянка не з’єднана підтвердженою геометрією.',
      time: activeLegTimes(targetLeg),
      accentColor: journeyModeColor(targetLeg.mode, targetLeg.transportType),
      iconType: isWalk ? 'walk' : calloutIconType(targetLeg),
      stage: 'enter',
      screenPos: screen ? { x: screen.x, y: screen.y } : undefined,
    });
    if (calloutTimer.current !== null) window.clearTimeout(calloutTimer.current);
    calloutTimer.current = window.setTimeout(() => {
      setTransferCallout(previous => previous ? { ...previous, stage: 'hold' } : previous);
      calloutTimer.current = window.setTimeout(() => {
        setTransferCallout(previous => previous ? { ...previous, stage: 'exit' } : previous);
        calloutTimer.current = window.setTimeout(() => {
          calloutTimer.current = null;
          setTransferCallout(null);
        }, TRANSFER_CALLOUT_TIMING.exit);
      }, TRANSFER_CALLOUT_TIMING.hold);
    }, TRANSFER_CALLOUT_TIMING.enter);
  }, []);

  const startFlight = useCallback((index: number, fraction = 0, autoplay = true) => {
    const adapter = mapAdapter.current;
    const flyLeg = legs[index];
    const path = buildFlightPath(confirmedSegments.find(segment => segment.id === flyLeg?.id)?.coordinates ?? []);
    if (!adapter || !path || !flyLeg) return;
    const kind = flyLeg.mode === 'WALK' ? 'walk' : 'transit';
    const clock = createFlightPlayback(flightDurationMs(path.totalMeters, kind), fraction);
    const color = journeyModeColor(flyLeg.mode, flyLeg.transportType);
    const nextLeg = legs[index + 1];
    const nextPath = buildFlightPath(confirmedSegments.find(segment => segment.id === nextLeg?.id)?.coordinates ?? []);
    const connected = Boolean(nextPath && distanceMeters(path.fractionPoint(1), nextPath.fractionPoint(0)) <= 5);
    const startZoom = adapter.getCameraZoom?.();
    const responseMs = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mg-dur-fast'));
    const transitionMs = reducedMotion ? 0 : Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mg-dur-slow'));
    const padding = isDesktop ? mapPadding : {
      ...mapPadding,
      bottom: Math.min(sheetHeightRef.current + bottomNavigationInset + 24, viewportHeight - (mapPadding.top ?? 0) - 80),
    };
    const points = [...path.points];
    cancelFlight();
    cameraOwner.current = 'preview';
    setLegIndex(index);
    adapter.setActiveRouteSegment?.(flyLeg.id);
    adapter.setCinematicFlightActive?.(true);
    adapter.clearSegmentReveal?.();
    adapter.setRouteFlow?.(null);
    telemetryRef.current?.begin(path.totalMeters, `Перегляд · ${activeLegTitle(flyLeg)}`);
    let lastBearing: number | null = null;
    let lastFrameAt = performance.now();
    let playing = false;
    const render = (now: number, transition = 0) => {
      const sample = clock.sample(now);
      const frame = cinematicCameraFrame(path, sample.fraction, { kind, startZoom, perspective: perspectiveRef.current });
      if (!transition && lastBearing !== null) {
        const delta = ((frame.bearing - lastBearing + 540) % 360) - 180;
        const response = Math.min(1 - Math.exp(-(now - lastFrameAt) / responseMs), Math.abs(delta) > 0 ? 60 * (now - lastFrameAt) / 1000 / Math.abs(delta) : 1);
        frame.bearing = lerpBearing(lastBearing, frame.bearing, response);
      }
      lastBearing = frame.bearing;
      lastFrameAt = now;
      adapter.setCinematicCamera?.(frame, padding, transition);
      adapter.revealSegmentProgress?.(points, color, sample.fraction);
      telemetryRef.current?.update(sample.fraction);
      return sample;
    };
    const pause = () => {
      playing = false;
      clock.pause(performance.now());
      cancelAnimationFrame(flight.raf);
      adapter.setCinematicFlightActive?.(false);
      flight.timers.forEach(timer => window.clearTimeout(timer));
      flight.timers.length = 0;
      setIsFlying(false);
    };
    const tick = (now: number) => {
      if (flight.cancelled || !playing) return;
      const sample = render(now);
      if (!sample.complete) { flight.raf = requestAnimationFrame(tick); return; }
      pause();
      const dock = dockCameraFrame(path, nextPath, kind, perspectiveRef.current);
      adapter.pingDock?.(dock.marker, color);
      if (connected && nextLeg) {
        showTransferCallout(nextLeg, dock.marker, true);
        flight.timers.push(window.setTimeout(() => {
          if (!flight.cancelled) continueFlightRef.current(index + 1);
        }, TRANSFER_CALLOUT_TIMING.enter));
      }
    };
    const play = () => {
      if (flight.cancelled || playing || reducedMotion) return;
      flight.timers.forEach(timer => window.clearTimeout(timer));
      flight.timers.length = 0;
      if (clock.sample(performance.now()).complete) clock.seek(0, performance.now());
      cameraOwner.current = 'preview';
      adapter.setCinematicFlightActive?.(true);
      render(performance.now(), transitionMs);
      playing = true;
      setIsFlying(true);
      flight.timers.push(window.setTimeout(() => {
        if (flight.cancelled || !playing) return;
        lastFrameAt = performance.now();
        clock.play(lastFrameAt);
        flight.raf = requestAnimationFrame(tick);
      }, transitionMs));
    };
    const flight = {
      cancelled: false, raf: 0, timers: [] as number[], pause, play,
      seek(value: number) {
        pause();
        cameraOwner.current = 'preview';
        adapter.setCinematicFlightActive?.(true);
        clock.seek(value, performance.now());
        render(performance.now(), transitionMs);
      },
    };
    flightRef.current = flight;
    if (autoplay) play();
    else flight.seek(fraction);
  }, [legs, confirmedSegments, mapPadding, isDesktop, bottomNavigationInset, viewportHeight, reducedMotion, cancelFlight, showTransferCallout]);
  useEffect(() => { continueFlightRef.current = index => startFlight(index); }, [startFlight]);

  const pauseFlight = useCallback(() => {
    flightRef.current?.pause();
    cameraOwner.current = 'user';
    setFollowing(false);
    mapAdapter.current?.setCinematicFlightActive?.(false);
    mapAdapter.current?.setCameraMode('FREE');
  }, []);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) pauseFlight(); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, [pauseFlight]);

  useEffect(() => {
    if (flightRef.current || !leg) return;
    const path = buildFlightPath(legSegment?.coordinates ?? []);
    if (path) telemetryRef.current?.begin(path.totalMeters, `Перегляд · ${activeLegTitle(leg)}`);
  }, [leg, legSegment, mapAdapterReady]);

  useEffect(() => () => { cancelFlight(); clearCallout(); }, [cancelFlight, clearCallout]);
  useEffect(() => { if (reducedMotion && flightRef.current) pauseFlight(); }, [reducedMotion, pauseFlight]);

  // Passed / active / next separation + the Living Route Ribbon pulse on the active stage.
  useEffect(() => {
    if (!mapAdapterReady || !leg) return;
    const adapter = mapAdapter.current;
    if (!adapter) return;
    const phases: Record<string, 'passed' | 'active' | 'next'> = {};
    legs.forEach((item, index) => { phases[item.id] = index === legIndex ? 'active' : 'next'; });
    adapter.setSegmentPhases?.(phases);
    const activeSegment = confirmedSegments.find(segment => segment.id === leg.id);
    if (activeSegment && !flightRef.current) {
      adapter.setRouteFlow?.({ coordinates: activeSegment.coordinates, color: journeyModeColor(leg.mode, leg.transportType), kind: leg.mode === 'WALK' ? 'walk' : 'transit' });
    }
  }, [leg, legs, legIndex, confirmedSegments, mapAdapterReady, isFlying]);

  if (!leg) {
    return <section aria-label="Активна навігація" className="route-map-screen fixed inset-0 z-[var(--mg-z-sticky)] grid place-items-center p-6 text-[var(--route-ink)]" data-theme={isDark ? 'dark' : 'light'}>
      <h1 className="sr-only">Активна навігація</h1>
      <div className="text-center">
        <p className="text-[15px] font-extrabold">У цьому маршруті немає етапів.</p>
        <button type="button" onClick={onExit} className="mg-route-cta mt-4 px-6">До маршруту</button>
      </div>
    </section>;
  }

  const status = activeLegStatus(leg, liveSegment?.status === 'LIVE' ? 'LIVE' : undefined);
  const instruction = activeLegInstruction(leg, nowMs);
  const nextHint = activeLegNextHint(legs[legIndex + 1]);
  const isLast = legIndex >= legs.length - 1;
  // The ribbon handles compact states; detailed stage cards handle half/expanded states.
  const showTimeline = sheetSnap === 'half' || sheetSnap === 'expanded';
  const showAction = sheetSnap === 'collapsed';
  const destination = activeNavigationDestination(legs);
  const mapWarning = mapStatus === 'failed' ? mapStatusNote(mapStatus) : null;
  const liveLabel = liveJourneyRequestState === 'failed' ? 'За розкладом' : null;

  const advance = () => jumpToLeg(isLast ? 0 : legIndex + 1);
  const goBack = () => { if (legIndex > 0) jumpToLeg(legIndex - 1); };
  const togglePlayback = () => {
    if (isFlying) { flightRef.current?.pause(); return; }
    if (flightRef.current) flightRef.current.play();
    else startFlight(legIndex);
  };
  const seekPlayback = (fraction: number) => {
    if (flightRef.current) flightRef.current.seek(fraction);
    else startFlight(legIndex, fraction, false);
  };

  return <section
    className="route-map-screen fixed inset-0 z-[var(--mg-z-sticky)] overflow-hidden text-[var(--route-ink)]"
    data-theme={isDark ? 'dark' : 'light'}
    data-sheet-snap={sheetSnap}
    data-navigation-stage={navigationLegIndex.current}
    data-camera-owner={cameraOwner.current}
    data-gps-state={freshNavigationFix ? 'fresh' : 'unavailable'}
    data-testid="active-journey-navigation"
    style={{ ['--route-map-inset' as string]: `${sheetHeight + bottomNavigationInset + 12}px` }}
    aria-label={`Навігація до ${destination}`}
  >
    <div className="absolute inset-0">
      <MarshGoMap
        route={[]}
        routeSegments={confirmedSegments}
        routeWaypoints={model.routeWaypoints}
        routeLabels={routeLabels}
        routeFitPadding={mapPadding}
        autoFit={false}
        overlays
        theme={isDark ? 'MARSHGO_DARK' : 'MARSHGO_LIGHT'}
        onStatus={setMapStatus}
        onAdapter={adapter => { mapAdapter.current = adapter; setMapAdapterReady(Boolean(adapter)); if (adapter) { adapter.setActiveRouteSegment?.(leg.id); adapter.onCinematicInterrupt = pauseFlight; } }}
        activeRouteSegmentId={leg.id}
        onRouteSegmentSelect={id => {
          const index = legs.findIndex(item => item.id === id);
          if (index >= 0) jumpToLeg(index);
        }}
      />
    </div>

    {transferCallout && <GlassGuidanceCallouts callouts={[transferCallout]} onDismiss={clearCallout} visibleRect={{ left: 16, top: 128, right: window.innerWidth - 84, bottom: viewportHeight - sheetHeight - bottomNavigationInset - 16 }} />}

    <header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-3xl flex-col gap-2 px-4 pb-2 pt-[max(.75rem,env(safe-area-inset-top))]">
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2">
        <button type="button" aria-label="Вийти з навігації до маршруту" onClick={onExit} className="route-header-back grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <ArrowLeft size={20}/>
        </button>
        <div data-testid="active-nav-header-pill" className="mx-auto flex min-w-0 max-w-full flex-col items-center rounded-full border border-[var(--route-border)] px-3 py-1 text-center shadow-[var(--route-sheet-shadow)] backdrop-blur-md" style={{ backgroundColor: 'color-mix(in srgb, var(--route-sheet) 88%, transparent)' }}>
          {following && freshNavigationFix && <p className="text-xs font-semibold text-[var(--route-muted)]">GPS-навігація</p>}
          <p className="max-w-full truncate text-[16px] font-black leading-6 tracking-[-.02em] text-[var(--route-brand-ink)]">{destination}</p>
        </div>
      </div>
      {!following && freshNavigationFix && <button type="button" data-testid="journey-resume-navigation" onClick={resumeNavigation} className="mx-auto flex min-h-11 items-center gap-2 rounded-full border border-[var(--route-border)] bg-[var(--route-card)] px-4 text-xs font-extrabold text-[var(--route-ink)] disabled:opacity-50"><Navigation size={16}/>До навігації</button>}
      {(mapWarning || liveLabel) && <p role="status" className="mx-auto w-fit max-w-full truncate rounded-full bg-[var(--route-card)] px-3 py-1 text-xs font-semibold text-[var(--route-muted)]">{mapWarning || liveLabel}</p>}
      {showDiagnostics && mapStatus !== 'available' && <p data-testid="active-map-status-details" className="mx-auto mt-1 w-fit max-w-full text-center text-xs text-[var(--route-muted)]">{mapStatusDetail(mapStatus, 'journey')}</p>}
    </header>

    <MapControlRail className={`absolute right-4 z-10${sheetSnap === 'expanded' ? ' opacity-45' : ''}`} label="Керування картою активної поїздки" inert={sheetSnap === 'expanded'} style={{ top: 'calc(max(.75rem, env(safe-area-inset-top)) + 5rem)' }}>
      <MapZoomControls map={mapAdapter.current} enabled={mapAdapterReady}/>
      <MapVoiceControl />
      <button
        type="button"
        aria-label={focusWhole ? 'Наблизити поточний етап' : 'Показати весь маршрут'}
        aria-pressed={focusWhole}
        title={focusWhole ? 'Наблизити поточний етап' : 'Показати весь маршрут'}
        onClick={() => {
          // The expanded detent hides the map, so reveal the whole route by
          // returning to the half sheet before the camera refits.
          cancelFlight();
          if (sheetSnap === 'expanded') moveToSnap('half');
          cameraOwner.current = 'stage';
          clearCallout();
          setFocusWhole(value => !value);
          haptic(8);
        }}
        className={`map-interaction-control mg-press-subtle grid h-12 w-12 place-items-center rounded-full${focusWhole ? ' is-reset' : ''}`}
      >
        <Navigation size={19}/>
      </button>
      <MapPerspectiveControl />
      <MapBasemapControl />
      <MapLayersControl overlays />
    </MapControlRail>

    <section
      ref={sheetElement}
      className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--route-border)] bg-[var(--route-sheet)] shadow-[var(--route-sheet-shadow)]"
      aria-label="Поточний етап маршруту"
      data-testid="active-navigation-sheet"
      data-sheet-state={sheetSnap}
      data-dragging={draggingRef.current ? 'true' : 'false'}
      style={{
        height: `${draggingRef.current ? sheetHeightRef.current : sheetHeight}px`,
        bottom: `${bottomNavigationInset}px`,
        transition: routeSheetTransition(draggingRef.current, reducedMotion),
        // Match route details: reserve the home indicator/tab-bar clearance once.
        paddingBottom: bottomNavigationInset > 0 ? '8px' : 'max(8px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(160deg,var(--route-sheet-start),var(--route-sheet-end))',
      }}
    >
      <button
        type="button"
        aria-label={sheetSnap === 'expanded' ? 'Згорнути етап' : 'Розгорнути етап'}
        aria-expanded={sheetSnap === 'half' || sheetSnap === 'expanded'}
        onClick={cycleSheet}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onKeyDown={event => {
          if (event.key === 'ArrowUp') { event.preventDefault(); moveToSnap(ROUTE_SHEET_SNAPS[Math.min(3, ROUTE_SHEET_SNAPS.indexOf(sheetSnap) + 1)]!); }
          if (event.key === 'ArrowDown') { event.preventDefault(); moveToSnap(ROUTE_SHEET_SNAPS[Math.max(0, ROUTE_SHEET_SNAPS.indexOf(sheetSnap) - 1)]!); }
          if (event.key === 'Home') { event.preventDefault(); moveToSnap('peek'); }
          if (event.key === 'End') { event.preventDefault(); moveToSnap('expanded'); }
        }}
        className="route-sheet-grabber flex h-6 w-full shrink-0 touch-none items-center justify-center"
      >
        <span className="route-sheet-grabber__handle h-1.5 w-12 rounded-full bg-[var(--route-grabber)]"/>
      </button>

      {missingWalkGeometry ? (
        <p role="status" aria-label="Для частини пішого маршруту немає перевіреної геометрії — лінію не домальовано." className={sheetSnap === 'peek' ? 'sr-only' : 'mx-3 mb-1 flex min-h-7 items-center truncate rounded-lg bg-[var(--route-card-alt)] px-2 py-1 text-[12px] font-semibold leading-4 text-[var(--route-muted)]'}>Частина пішої геометрії не підтверджена</p>
      ) : null}

      <div data-testid="active-navigation-content" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="shrink-0 px-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p aria-live="polite" aria-atomic="true" className="sr-only">
              {activeNavigationStageLabel(following, Boolean(freshNavigationFix), legIndex, legs.length, journey.transfers)}
            </p>
            {status && sheetSnap !== 'peek' && <span className="rounded-full bg-[var(--route-card-alt)] px-2 py-0.5 text-xs font-semibold text-[var(--route-muted)]">{ACTIVE_LEG_STATUS_LABEL[status]}</span>}
          </div>
          {sheetSnap === 'collapsed' && legs.length > 1 && <div className="mg-leg-rail" role="group" aria-label={`Перегляд маршруту: етап ${legIndex + 1} з ${legs.length}`}>
            {legs.map((item, index) => <span key={item.id} className={`mg-leg-rail__seg${index === legIndex ? ' is-active' : ''}${index === legIndex && isFlying ? ' is-flying' : ''}`} style={{ ['--seg-color' as string]: item.mode === 'WALK' ? 'var(--route-ribbon-walk)' : journeyModeColor(item.mode, item.transportType) }}/>) }
          </div>}
          {!showTimeline && <div className="mt-1 flex items-center gap-2">
            {sheetSnap !== 'peek' && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--route-ink)]" style={{ backgroundColor: `color-mix(in srgb, ${journeyModeColor(leg.mode, leg.transportType)} 20%, var(--route-card))` }}><TransportIcon mode={leg.mode} transportType={leg.transportType} size={24}/></span>}
            <div className="min-w-0 flex-1">
              <h1 data-testid="active-nav-leg-title" className="truncate text-[17px] font-extrabold leading-6">{sheetSnap === 'peek' ? shortPlace(leg.destination.name) : activeLegTitle(leg)}</h1>
              {sheetSnap !== 'peek' && <p data-testid="active-nav-leg-destination" className="text-xs font-semibold text-[var(--route-muted)]">до «{shortPlace(leg.destination.name)}» <span data-testid="active-nav-leg-meta" className="tabular-nums">· {activeLegMeta(leg)}</span></p>}
            </div>
            {sheetSnap === 'peek' && ((following && !freshNavigationFix) || missingWalkGeometry) && <span className="shrink-0 text-xs font-semibold text-[var(--route-muted)]">{following && !freshNavigationFix ? 'GPS недоступний' : 'Геометрія неповна'}</span>}
          </div>}
          {showTimeline && <h1 className="sr-only">Маршрут до {destination}</h1>}
          {notice && sheetSnap !== 'peek' && <p role="status" data-testid="active-nav-notice" className="mt-1 text-[12px] font-semibold leading-4 text-[var(--route-muted)]">{notice}</p>}
          {following && (gpsMessage || !freshNavigationFix) && <p role="status" data-testid="journey-gps-status" className={sheetSnap === 'peek' ? 'sr-only' : 'mt-1 text-[12px] font-semibold leading-4 text-[var(--route-muted)]'}>Позиція недоступна</p>}
        </div>

        {showAction && <div className="mt-1 shrink-0 px-4">
          <p data-testid="active-nav-instruction" className="sr-only">{instruction}</p>
          {nextHint && <p data-testid="active-nav-next-hint" className="text-xs font-semibold leading-4 text-[var(--route-muted)]">{nextHint}</p>}
        </div>}

        {showTimeline && <div className="mt-2 shrink-0 px-4 pb-2" data-testid="active-navigation-stages">
          <ol className="mg-route-segment-list" aria-label={`Усі етапи маршруту: ${formatStageCount(legs.length)}${journey.transfers > 0 ? `, ${formatTransferCount(journey.transfers)}` : ''}`}>
            {legs.map((item, index) => {
              const selected = index === legIndex;
              const scheduled = isScheduledRouteLeg(item);
              const stops = item.stops ?? [];
              const stopsOpen = openStopsLegId === item.id;
              const previousTime = index > 0 ? Date.parse(legs[index - 1].arrivalAt) : Date.parse(journey.requestedDepartureAt ?? item.departureAt);
              const departureTime = Date.parse(item.departureAt);
              const waitSeconds = Number.isFinite(previousTime) && Number.isFinite(departureTime) ? Math.max(0, Math.round((departureTime - previousTime) / 1000)) : 0;
              return <li key={item.id}>{waitSeconds > 0 && <div className="flex min-h-7 items-center px-3 py-1 text-xs text-[var(--route-muted)]"><span className="inline-flex items-center gap-2"><Clock3 size={14} className="text-[var(--route-subtle)]"/>Очікування · {formatJourneyDurationTile(waitSeconds)}</span></div>}<div className={`mg-route-segment overflow-hidden rounded-xl border ${selected ? 'border-[var(--mg-blue)] bg-[var(--route-card-alt)]' : 'border-[var(--route-border)] bg-[var(--route-card)]'}`} style={{ borderLeftWidth: 3.5, borderLeftColor: item.mode === 'WALK' ? 'var(--route-ribbon-walk)' : journeyModeColor(item.mode, item.transportType) }}>
                <div className="mg-route-segment__body flex items-center gap-1.5">
                  <button type="button" onClick={() => jumpToLeg(index)} aria-pressed={selected} aria-label={`Етап ${index + 1}: ${activeLegTitle(item)}, ${activeLegTimes(item)}`} className="mg-press-subtle flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--route-ink)]" style={{ backgroundColor: `color-mix(in srgb, ${journeyModeColor(item.mode, item.transportType)} 20%, var(--route-card))` }}>
                      <TransportIcon mode={item.mode} transportType={item.transportType} size={24} strokeWidth={2.3}/>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="mg-journey-leg-heading"><b className="text-[13px] font-extrabold">{activeLegTitle(item)}</b><span className="text-xs font-semibold tabular-nums text-[var(--route-muted)]">{activeLegTimes(item)}</span></span>
                      <span className="block text-xs font-medium leading-4 text-[var(--route-muted)]">{formatJourneyDurationTile(item.durationSeconds)}{typeof item.distanceMeters === 'number' && Number.isFinite(item.distanceMeters) ? ` · ${formatJourneyDistance(item.distanceMeters)}` : ''}{scheduled && stops.length ? ` · ${formatStopCount(stops.length)}` : ''}</span>
                      <span className="block text-xs font-medium leading-4 text-[var(--route-subtle)]">{shortPlace(item.origin.name)} — {shortPlace(item.destination.name)}</span>
                    </span>
                  </button>
                  {scheduled && stops.length > 0 && <button type="button" aria-label={`${stopsOpen ? 'Згорнути' : 'Розгорнути'} зупинки: ${activeLegTitle(item)}`} aria-expanded={stopsOpen} aria-controls={`active-navigation-stops-${item.id}`} onClick={() => setOpenStopsLegId(nextStopsLegId(openStopsLegId, item.id))} className="mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[var(--route-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]"><ChevronDown size={16} aria-hidden="true" className={`route-stops-chevron${stopsOpen ? ' is-open' : ''}`}/></button>}
                </div>
                {scheduled && stopsOpen && <div id={`active-navigation-stops-${item.id}`} className="mg-route-stops border-t border-[var(--route-border)] px-3 pb-3 pt-2"><JourneyLegStops leg={item} color={item.mode === 'WALK' ? 'var(--route-ribbon-walk)' : journeyModeColor(item.mode, item.transportType)}/></div>}
                {scheduled && stops.length === 0 && <p className="border-t border-[var(--route-border)] px-3 py-1.5 text-xs text-[var(--route-muted)]">Перевізник не надав список зупинок для цього рейсу.</p>}
              </div></li>;
            })}
          </ol>
        </div>}
      </div>

      <div className="shrink-0 px-4">
        <FlightTelemetry ref={telemetryRef} playing={isFlying} enabled={mapAdapterReady && Boolean(legFlightPath)} reducedMotion={reducedMotion} first={legIndex === 0} last={isLast} onToggle={togglePlayback} onSeek={seekPlayback} onPrevious={goBack} onNext={advance}/>
      </div>
    </section>
  </section>;
}
