import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Flag, Map as MapIcon, Navigation } from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import { MapLayersControl } from '../components/MapLayersControl';
import { MapBasemapControl, MapControlRail, MapPerspectiveControl, MapVoiceControl, MapZoomControls } from '../components/MapInteractionControls';
import {
  buildJourneyRouteMapModel, formatTransferCount, journeyModeColor,
} from '../map/journeyRouteModel';
import { boundsOf, corridorFitPoints } from '../map/routeContextCorridor';
import { extentMeters, principalBearing } from '../map/routeCameraFocus';
import type { MapAdapter, MapStatus, RouteFitPadding } from '../map/MapAdapter';
import { distanceBetweenCoordinates, prepareRoutePreviewPath, reverseRoutePreviewPath, routePreviewAnchorsMatch, routePreviewDurationMs } from '../map/routePreviewPath';
import { mapStatusDetail, mapStatusNote } from '../map/mapStatusCopy';
import { productionApi, hasApiSession, ProductionApiError, type ApiJourney, type ApiJourneyLive } from '../services/productionApi';
import { TransportIcon } from '../design-system/transport/TransportIcon';
import { buildRouteMapAnnotations, formatStopCount, isTransitLeg } from './routeMapAnnotations';
import { JourneyLegStops, isScheduledRouteLeg } from './JourneyLegStops';
import { nextStopsLegId } from './journeyStopsPanel';
import { diagnosticsRequested } from './resultsDiagnostics';
import {
  createFrameWriter,
  prefersReducedMotion,
  routeSheetHeights,
  routeSheetSafeAreaInset,
  routeSheetTransition,
  settleRouteSheetSnap,
  subscribeReducedMotion,
  type RouteSheetSnap,
} from './routeSheet';
import { themeService } from '../services/theme';
import { priorityLevelOf } from '../map/transportVisualZones';
import { floatingInfoForLeg } from '../map/floatingMapInfo';
import { useFloatingMapInfo } from '../map/useFloatingMapInfo';
import { formatJourneyDurationTile } from './journeyResultPresentation';
import { legPriceDisplay } from './cashFare';
import { WebGeolocationProvider } from '../platform/LocationProvider';
import type { Coordinate, LocationFix } from '../../shared/navigation/contracts';
import { passengerLocationStartMessage, validatePassengerLocationUpdate, validatePassengerStartFix } from '../navigation/passengerLocation';
import {
  ACTIVE_LEG_STATUS_LABEL,
  activeLegInstruction,
  activeLegMeta,
  activeLegNextHint,
  activeLegPhase,
  activeLegStatus,
  activeLegTimes,
  activeLegTitle,
  activeNavigationDestination,
  activeNavigationStartIndex,
  activeTime,
  formatStageCount,
  shortPlace,
} from './journeyStageNavigation';

const EMPTY_MAP_ROUTE: Coordinate[] = [];

/**
 * Passenger itinerary navigation. The selected leg is only a stage preview;
 * the actual journey lifecycle stays server-owned. User position is shown and
 * followed only from a fresh browser GPS fix.
 */
export function JourneyActiveNavigation({
  journey,
  notice,
  onExit,
  onFinish,
  initialPreviewLegIndex = null,
  initialLocationFix = null,
  onPreviewStageChange,
}: {
  journey: ApiJourney;
  notice?: string | null;
  onExit: () => void;
  onFinish?: () => void;
  /** A fresh fix collected from the explicit Start button; never persisted. */
  initialLocationFix?: LocationFix | null;
  initialPreviewLegIndex?: number | null;
  onPreviewStageChange?: (legIndex: number) => void;
}) {
  const showDiagnostics = typeof window !== 'undefined' && diagnosticsRequested(
    window.location.search,
    (() => { try { return window.localStorage.getItem('marshgo.results.diagnostics'); } catch { return null; } })(),
  );
  const legs = journey.legs;
  const model = useMemo(() => buildJourneyRouteMapModel(legs), [legs]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [legIndex, setLegIndex] = useState(() => {
    const scheduledStart = activeNavigationStartIndex(legs, Date.now());
    if (initialPreviewLegIndex === null || legs.length === 0 || !Number.isInteger(initialPreviewLegIndex)) return scheduledStart;
    return Math.min(Math.max(initialPreviewLegIndex, 0), legs.length - 1);
  });
  const legIndexRef = useRef(legIndex);
  legIndexRef.current = legIndex;
  const previewFlightCancel = useRef<((reason?: 'user' | 'programmatic') => void) | null>(null);
  const previewTargetLegIndex = useRef<number | null>(null);
  const skipFocusAfterPreviewDock = useRef(false);
  const [isPreviewFlying, setIsPreviewFlying] = useState(false);
  const previewStageChange = useRef(onPreviewStageChange);
  previewStageChange.current = onPreviewStageChange;
  useEffect(() => { previewStageChange.current?.(legIndex); }, [legIndex]);

  const leg = legs[Math.min(legIndex, Math.max(0, legs.length - 1))];
  const liveLeg = leg && isTransitLeg(leg) ? leg : undefined;
  const liveLegId = liveLeg?.id ?? null;
  const [openStopsLegId, setOpenStopsLegId] = useState<string | null>(() => {
    const startingLeg = legs[legIndex];
    return startingLeg && isScheduledRouteLeg(startingLeg) ? startingLeg.id : null;
  });

  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [isDark, setIsDark] = useState(themeService.isDark());
  const [sheetSnap, setSheetSnap] = useState<RouteSheetSnap>('collapsed');
  const [sheetHeight, setSheetHeight] = useState(() => routeSheetHeights(typeof window === 'undefined' ? 844 : window.innerHeight, routeSheetSafeAreaInset()).collapsed);
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === 'undefined' ? 844 : window.innerHeight);
  const draggingRef = useRef(false);
  const [mapAdapterReady, setMapAdapterReady] = useState(false);
  const [cameraFocusMode, setCameraFocusMode] = useState<'gps' | 'preview' | 'overview' | 'free'>(() => initialLocationFix ? 'gps' : 'preview');
  const [locationFix, setLocationFix] = useState<LocationFix | null>(initialLocationFix);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'active' | 'stale' | 'unavailable' | 'permission-denied'>(initialLocationFix ? 'active' : 'idle');
  const [locationMessage, setLocationMessage] = useState('');
  const [liveJourney, setLiveJourney] = useState<ApiJourneyLive | null>(null);
  const [liveJourneyRequestState, setLiveJourneyRequestState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const liveSegment = liveJourney?.segments.find(segment => segment.legId === liveLegId);
  const mapAdapter = useRef<MapAdapter | null>(null);
  const cancelPreviewFlight = useCallback((reason: 'user' | 'programmatic' = 'programmatic') => {
    const cancel = previewFlightCancel.current;
    previewFlightCancel.current = null;
    previewTargetLegIndex.current = null;
    if (cancel) cancel(reason);
    else mapAdapter.current?.cancelRoutePreviewFlight?.(reason);
    setIsPreviewFlying(false);
  }, []);
  const locationProvider = useRef<WebGeolocationProvider | null>(null);
  if (locationProvider.current === null) locationProvider.current = new WebGeolocationProvider();
  const locationUnsubscribe = useRef<(() => void) | null>(null);
  const latestLocationFix = useRef<LocationFix | null>(initialLocationFix);
  const hasCenteredOnGps = useRef(false);
  const sheetElement = useRef<HTMLElement | null>(null);
  const sheetHeightRef = useRef(sheetHeight);
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

  useEffect(() => themeService.subscribe((_mode, dark) => setIsDark(dark)), []);
  useEffect(() => subscribeReducedMotion(setReducedMotion), []);
  useEffect(() => {
    if (reducedMotion && previewFlightCancel.current) cancelPreviewFlight('user');
  }, [cancelPreviewFlight, reducedMotion]);
  useEffect(() => {
    const writer = dragWriter.current;
    return () => writer?.discard();
  }, []);

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
      vehicles: (liveSegment.vehicles ?? []).map(vehicle => ({
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
  }, [liveSegment, liveLeg, mapAdapterReady]);

  const routeLabels = useMemo(
    () => buildRouteMapAnnotations({ journey, live: liveJourney, preferredLegId: liveLegId }),
    [journey, liveJourney, liveLegId],
  );

  useEffect(() => {
    if (!mapAdapterReady || !leg) return;
    // Walking stages already have a persistent route label with the same
    // duration and distance; a second floating card only duplicates it.
    const info = leg.mode === 'WALK' ? null : floatingInfoForLeg(leg);
    if (info) floatingMapInfo.show(info);
    else floatingMapInfo.clear();
    return () => floatingMapInfo.clear();
  }, [floatingMapInfo.clear, floatingMapInfo.show, leg, mapAdapterReady]);

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const mapPadding = useMemo<RouteFitPadding>(() => {
    if (isDesktop) return { top: 100, left: 500, right: 40, bottom: 40 };
    return { top: 118, left: 26, right: 26, bottom: sheetHeight + 24 };
  }, [isDesktop, sheetHeight]);

  const legSegment = useMemo(
    () => (leg ? model.routeSegments.find(segment => segment.id === leg.id) : undefined),
    [leg, model.routeSegments],
  );

  const focusData = useMemo(() => {
    const contextLines = (liveSegment?.lineRoutes ?? []).flatMap(route => [
      route.coordinates,
      ...(route.zones?.beforeBoarding ? [route.zones.beforeBoarding] : []),
      ...(route.zones?.afterAlighting ? [route.zones.afterAlighting] : []),
    ]);
    const points = cameraFocusMode === 'overview'
      ? corridorFitPoints(model.routeSegments.flatMap(segment => segment.coordinates), contextLines)
      : cameraFocusMode === 'preview' && legSegment
        ? corridorFitPoints(legSegment.coordinates, contextLines, 0.5)
        : [];
    const bearing = cameraFocusMode === 'preview' && legSegment && extentMeters(legSegment.coordinates) > 120
      ? principalBearing(legSegment.coordinates)
      : null;
    const bounds = boundsOf(points);
    const key = `${cameraFocusMode}:${leg?.id ?? 'none'}:${points.length}:${bearing === null ? 'flat' : bearing.toFixed(1)}:${bounds?.map(value => value.toFixed(5)).join(',') ?? ''}`;
    return { points, bearing, key };
  }, [cameraFocusMode, leg?.id, legSegment, liveSegment, model.routeSegments]);

  useEffect(() => {
    if (draggingRef.current || isPreviewFlying || !mapAdapterReady || mapStatus === 'loading' || !leg) return;
    const adapter = mapAdapter.current;
    if (!adapter) return;
    adapter.setActiveRouteSegment?.(leg.id);
    if (skipFocusAfterPreviewDock.current) {
      skipFocusAfterPreviewDock.current = false;
      return;
    }
    if (cameraFocusMode === 'gps' || cameraFocusMode === 'free') return;
    // The expanded detent leaves a thin strip: refitting there squeezes the
    // stage into a few pixels, so the camera stays on the last readable frame.
    if (sheetSnap === 'expanded') return;
    if (focusData.points.length >= 2) {
      adapter.focusCoordinates?.(
        focusData.points,
        focusData.bearing === null ? { ...mapPadding, bearing: 0 } : { ...mapPadding, bearing: focusData.bearing },
        cameraFocusMode === 'overview' ? 14.5 : 17,
      );
      return;
    }
    adapter.fitRoute(mapPadding);
  }, [cameraFocusMode, focusData.bearing, focusData.key, focusData.points, isPreviewFlying, leg, mapAdapterReady, mapPadding, mapStatus, sheetSnap]);

  const receiveLocationFix = useCallback((fix: LocationFix) => {
    const previous = latestLocationFix.current;
    const previousIsFresh = previous && Date.now() - Date.parse(previous.capturedAtClient) <= 60_000 ? previous : undefined;
    const result = validatePassengerLocationUpdate(fix, Date.now(), previousIsFresh ?? undefined);
    if ('duplicate' in result) return;
    if (!result.accepted) {
      setLocationStatus(result.code === 'GPS_PERMISSION_DENIED' ? 'permission-denied' : 'stale');
      return;
    }
    latestLocationFix.current = result.fix;
    setLocationFix(result.fix);
    setLocationStatus('active');
    setLocationMessage('');
  }, []);

  const startLocationWatch = useCallback(async () => {
    const provider = locationProvider.current;
    if (!provider) return false;
    if (!locationUnsubscribe.current) locationUnsubscribe.current = provider.subscribe(receiveLocationFix);
    try {
      await provider.start({ enableHighAccuracy: true, maximumAgeMs: 5000, timeoutMs: 20_000 });
      return true;
    } catch {
      setLocationStatus('unavailable');
      setLocationMessage(passengerLocationStartMessage('GPS_UNAVAILABLE'));
      return false;
    }
  }, [receiveLocationFix]);

  const returnToGpsNavigation = useCallback(async () => {
    cancelPreviewFlight();
    const previous = latestLocationFix.current;
    const ageMs = previous ? Date.now() - Date.parse(previous.capturedAtClient) : Infinity;
    let fix = previous && ageMs >= 0 && ageMs <= 60_000 ? previous : null;
    if (!fix) {
      setLocationStatus('requesting');
      setLocationMessage('');
      const provider = locationProvider.current;
      try {
        const rawFix = await provider?.getCurrentFix({ enableHighAccuracy: true, maximumAgeMs: 0, timeoutMs: 15_000 });
        if (!rawFix) throw new Error('GPS_UNAVAILABLE');
        const validation = validatePassengerStartFix(rawFix, Date.now());
        if (!validation.accepted) {
          setLocationStatus(validation.code === 'GPS_PERMISSION_DENIED' ? 'permission-denied' : 'stale');
          setLocationMessage(passengerLocationStartMessage(validation.code));
          return;
        }
        fix = validation.fix;
        receiveLocationFix(fix);
        if (!await startLocationWatch()) return;
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        setLocationStatus(code === 'GPS_PERMISSION_DENIED' ? 'permission-denied' : 'unavailable');
        setLocationMessage(passengerLocationStartMessage(code));
        return;
      }
    }
    const coordinate: [number, number] = [fix.longitude, fix.latitude];
    mapAdapter.current?.setVehicle(coordinate, fix.headingDegrees);
    mapAdapter.current?.recenter(coordinate);
    hasCenteredOnGps.current = true;
    setCameraFocusMode('gps');
    setLocationStatus('active');
  }, [cancelPreviewFlight, receiveLocationFix, startLocationWatch]);

  useEffect(() => {
    if (!initialLocationFix) return;
    latestLocationFix.current = initialLocationFix;
    void startLocationWatch();
  }, [initialLocationFix, startLocationWatch]);

  useEffect(() => () => {
    locationUnsubscribe.current?.();
    locationUnsubscribe.current = null;
    void locationProvider.current?.stop();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const providerState = locationProvider.current?.status();
      if (providerState === 'PERMISSION_DENIED') { setLocationStatus('permission-denied'); return; }
      if (providerState === 'UNAVAILABLE' && latestLocationFix.current) { setLocationStatus('unavailable'); return; }
      const fix = latestLocationFix.current;
      if (fix && Date.now() - Date.parse(fix.capturedAtClient) > 60_000) setLocationStatus('stale');
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mapAdapterReady || !locationFix) return;
    const coordinate: [number, number] = [locationFix.longitude, locationFix.latitude];
    mapAdapter.current?.setVehicle(coordinate, locationFix.headingDegrees);
    if (cameraFocusMode === 'gps' && !hasCenteredOnGps.current) {
      mapAdapter.current?.recenter(coordinate);
      hasCenteredOnGps.current = true;
    }
  }, [cameraFocusMode, locationFix, mapAdapterReady]);

  useEffect(() => {
    const updateViewport = () => {
      const next = window.innerHeight;
      setViewportHeight(next);
      const nextHeight = routeSheetHeights(next, routeSheetSafeAreaInset())[sheetSnap];
      sheetHeightRef.current = nextHeight;
      setSheetHeight(nextHeight);
    };
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [sheetSnap]);

  const moveToSnap = (next: RouteSheetSnap) => {
    if (previewFlightCancel.current) cancelPreviewFlight('user');
    const nextHeight = routeSheetHeights(viewportHeight, routeSheetSafeAreaInset())[next];
    sheetHeightRef.current = nextHeight;
    setSheetSnap(next);
    setSheetHeight(nextHeight);
    haptic(6);
  };
  const cycleSheet = () => {
    if (suppressHandleClick.current) { suppressHandleClick.current = false; return; }
    moveToSnap(sheetSnap === 'collapsed' ? 'half' : sheetSnap === 'half' ? 'expanded' : 'collapsed');
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (previewFlightCancel.current) cancelPreviewFlight('user');
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
    const nextHeight = Math.min(heights.expanded, Math.max(heights.collapsed, start.height + delta));
    sheetHeightRef.current = nextHeight;
    dragWriter.current?.schedule(nextHeight);
  };
  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    dragWriter.current?.flush();
    if (start.moved) {
      const heights = routeSheetHeights(viewportHeight, routeSheetSafeAreaInset());
      moveToSnap(settleRouteSheetSnap(sheetHeightRef.current, start.velocity, heights, 0.45, start.height));
    }
    dragStart.current = null;
    draggingRef.current = false;
    if (sheetElement.current) {
      sheetElement.current.dataset.dragging = 'false';
      sheetElement.current.style.transition = routeSheetTransition(false, reducedMotion);
    }
  };

  const jumpToLeg = useCallback((index: number) => {
    cancelPreviewFlight();
    legIndexRef.current = index;
    setLegIndex(index);
    setCameraFocusMode('preview');
    haptic(8);
  }, [cancelPreviewFlight]);

  const moveToAdjacentLeg = useCallback((targetIndex: number, direction: 'forward' | 'backward') => {
    const currentIndex = legIndexRef.current;
    const wasFlying = previewFlightCancel.current !== null;
    if (targetIndex < 0 || targetIndex >= legs.length || (!wasFlying && targetIndex === currentIndex)) return;
    cancelPreviewFlight();
    if (wasFlying || Math.abs(targetIndex - currentIndex) !== 1 || !mapAdapter.current) {
      previewTargetLegIndex.current = null;
      legIndexRef.current = targetIndex;
      setLegIndex(targetIndex);
      setCameraFocusMode('preview');
      return;
    }

    const geometryLegIndex = direction === 'forward' ? currentIndex : targetIndex;
    const geometryLeg = legs[geometryLegIndex];
    const targetLeg = legs[targetIndex];
    const mapGeometry = model.legs.find(item => item.id === geometryLeg?.id);
    const sourcePath = mapGeometry && !mapGeometry.approximate ? prepareRoutePreviewPath(mapGeometry.coordinates) : null;
    const coordinates = (point: unknown): point is [number, number] => Array.isArray(point)
      && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);
    const sourceStart = geometryLeg?.origin.coordinates;
    const sourceEnd = geometryLeg?.destination.coordinates;
    const anchorsMatch = Boolean(sourcePath && coordinates(sourceStart) && coordinates(sourceEnd)
      && routePreviewAnchorsMatch(sourcePath, sourceStart, sourceEnd));
    const flightPath = direction === 'backward' && sourcePath ? reverseRoutePreviewPath(sourcePath) : sourcePath;
    const dockingAnchor = direction === 'forward' ? targetLeg?.origin.coordinates : legs[currentIndex]?.origin.coordinates;
    if (!flightPath || !anchorsMatch || !coordinates(dockingAnchor)
      || distanceBetweenCoordinates(flightPath.coordinates.at(-1)!, dockingAnchor) > 15) {
      legIndexRef.current = targetIndex;
      setLegIndex(targetIndex);
      setCameraFocusMode('preview');
      return;
    }

    const targetGeometry = model.legs.find(item => item.id === targetLeg?.id);
    const candidateTargetPath = targetGeometry && !targetGeometry.approximate ? prepareRoutePreviewPath(targetGeometry.coordinates) : null;
    const targetPath = candidateTargetPath && targetLeg && routePreviewAnchorsMatch(candidateTargetPath, targetLeg.origin.coordinates, targetLeg.destination.coordinates)
      ? candidateTargetPath
      : null;
    const finishZoom = !targetPath ? 16.1
      : targetPath.totalMeters < 160 ? 16.8
        : targetPath.totalMeters < 700 ? 16.5
          : targetPath.totalMeters < 2_500 ? 16.1
            : targetPath.totalMeters < 8_000 ? 15.6
              : 15.1;
    const durationMs = routePreviewDurationMs(flightPath, reducedMotion);
    if (durationMs === 0) {
      legIndexRef.current = targetIndex;
      setLegIndex(targetIndex);
      setCameraFocusMode('preview');
      mapAdapter.current.focusRouteSegment?.(targetLeg!.id, mapPadding);
      return;
    }

    setIsPreviewFlying(true);
    let flightSettledSynchronously = false;
    const complete = () => {
      flightSettledSynchronously = true;
      previewFlightCancel.current = null;
      previewTargetLegIndex.current = null;
      setIsPreviewFlying(false);
      skipFocusAfterPreviewDock.current = true;
      legIndexRef.current = targetIndex;
      setLegIndex(targetIndex);
      setCameraFocusMode('preview');
    };
    const cancelled = (reason: 'user' | 'programmatic') => {
      flightSettledSynchronously = true;
      previewFlightCancel.current = null;
      previewTargetLegIndex.current = null;
      setIsPreviewFlying(false);
      // A direct touch/zoom/rotation wins over the automatic camera. Preserve its frame.
      if (reason === 'user') setCameraFocusMode('free');
    };
    const cancel = mapAdapter.current.playRoutePreviewFlight?.(flightPath, {
      durationMs,
      padding: mapPadding,
      startFromNearestVisiblePoint: true,
      finishView: {
        center: dockingAnchor,
        ...(targetPath ? { bearing: targetPath.bearings[0] } : {}),
        zoom: finishZoom,
      },
      onComplete: complete,
      onCancel: cancelled,
    });
    if (cancel && !flightSettledSynchronously) {
      previewFlightCancel.current = cancel;
      previewTargetLegIndex.current = targetIndex;
    }
    else {
      previewTargetLegIndex.current = null;
      setIsPreviewFlying(false);
      legIndexRef.current = targetIndex;
      setLegIndex(targetIndex);
      setCameraFocusMode('preview');
    }
  }, [cancelPreviewFlight, legs, mapPadding, model.legs, reducedMotion]);

  if (!leg) {
    return <section aria-label="Активна навігація" className="route-map-screen fixed inset-0 z-[80] grid place-items-center p-6 text-[var(--route-ink)]" data-theme={isDark ? 'dark' : 'light'}>
      <h1 className="sr-only">Активна навігація</h1>
      <div className="text-center">
        <p className="text-[15px] font-extrabold">У цьому маршруті немає етапів.</p>
        <button type="button" onClick={onExit} className="mg-route-cta mt-4 px-6">До маршруту</button>
      </div>
    </section>;
  }

  const phase = activeLegPhase(leg, nowMs);
  const status = activeLegStatus(leg, liveSegment?.status === 'LIVE' ? 'LIVE' : undefined);
  const instruction = activeLegInstruction(leg, nowMs);
  const nextHint = activeLegNextHint(legs[legIndex + 1]);
  const isLast = legIndex >= legs.length - 1;
  const showRibbon = sheetSnap === 'expanded' || (sheetSnap === 'half' && viewportHeight >= 700);
  const showAction = true;
  const destination = activeNavigationDestination(legs);
  const mapWarning = mapStatus === 'failed' ? mapStatusNote(mapStatus) : null;
  const liveLabel = liveJourneyRequestState === 'failed' ? 'За розкладом' : null;
  const locationStatusLabel = locationStatus === 'active' && locationFix
    ? `Місце визначено · ±${Math.round(locationFix.accuracyMeters)} м`
    : locationStatus === 'requesting' ? 'Визначаємо місце…'
      : locationStatus === 'stale' ? 'Місце не оновлюється'
        : locationStatus === 'permission-denied' ? 'Дозвольте доступ до місцезнаходження'
          : locationStatus === 'unavailable' ? 'Місцезнаходження недоступне'
            : 'Навігація без визначеного місця';

  const advance = () => {
    haptic([8, 24, 8]);
    if (isLast) { cancelPreviewFlight(); onFinish?.(); onExit(); return; }
    const baseIndex = previewFlightCancel.current ? previewTargetLegIndex.current ?? legIndexRef.current : legIndexRef.current;
    if (baseIndex >= legs.length - 1) {
      cancelPreviewFlight();
      legIndexRef.current = baseIndex;
      setLegIndex(baseIndex);
      setCameraFocusMode('preview');
      return;
    }
    moveToAdjacentLeg(baseIndex + 1, 'forward');
  };

  const goBack = () => {
    const baseIndex = previewFlightCancel.current ? previewTargetLegIndex.current ?? legIndexRef.current : legIndexRef.current;
    if (baseIndex <= 0) return;
    haptic(8);
    moveToAdjacentLeg(baseIndex - 1, 'backward');
  };

  return <section
    className="route-map-screen fixed inset-0 z-[80] overflow-hidden text-[var(--route-ink)]"
    data-theme={isDark ? 'dark' : 'light'}
    data-sheet-snap={sheetSnap}
    data-preview-flight-state={isPreviewFlying ? 'running' : 'idle'}
    data-preview-leg-index={legIndex}
    data-testid="active-journey-navigation"
    style={{ ['--route-map-inset' as string]: `${sheetHeight + 12}px` }}
    aria-label={`Навігація до ${destination}`}
  >
    <div className="absolute inset-0">
      <MarshGoMap
        route={EMPTY_MAP_ROUTE}
        routeSegments={model.routeSegments}
        routeWaypoints={model.routeWaypoints}
        routeLabels={routeLabels}
        routeFitPadding={mapPadding}
        autoFocusRouteSegment={false}
        vehicle={locationFix ? [locationFix.longitude, locationFix.latitude] : null}
        heading={locationFix?.headingDegrees ?? null}
        overlays
        theme={isDark ? 'MARSHGO_DARK' : 'MARSHGO_LIGHT'}
        onStatus={setMapStatus}
        onAdapter={adapter => { mapAdapter.current = adapter; setMapAdapterReady(Boolean(adapter)); if (adapter) adapter.setActiveRouteSegment?.(leg.id); }}
        activeRouteSegmentId={leg.id}
        onRouteSegmentSelect={id => {
          const index = legs.findIndex(item => item.id === id);
          if (index >= 0) jumpToLeg(index);
        }}
      />
    </div>

    <header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-3xl flex-col gap-2 px-4 pb-2 pt-[max(.75rem,env(safe-area-inset-top))]">
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2">
        <button type="button" aria-label="Вийти з навігації до маршруту" onClick={onExit} className="route-header-back grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <ArrowLeft size={20}/>
        </button>
        <div data-testid="active-nav-header-pill" className="mx-auto flex min-w-0 max-w-full flex-col items-center rounded-full border border-[var(--route-border)] px-3 py-1 text-center shadow-[var(--route-sheet-shadow)] backdrop-blur-md" style={{ backgroundColor: 'color-mix(in srgb, var(--route-sheet) 88%, transparent)' }}>
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[var(--route-muted)]">{isPreviewFlying ? 'Перегляд маршруту' : 'Навігація'}</p>
          <p className="max-w-full truncate text-[16px] font-black leading-6 tracking-[-.02em] text-[var(--route-brand-ink)]">{destination}</p>
        </div>
      </div>
      {(mapWarning || liveLabel || locationStatus !== 'active' || cameraFocusMode !== 'gps' || Boolean(locationFix)) && <p role="status" data-testid="active-nav-location-status" className="mx-auto w-fit max-w-full truncate rounded-full bg-[var(--route-card)] px-3 py-1 text-xs font-semibold text-[var(--route-muted)]">{mapWarning || liveLabel || locationMessage || locationStatusLabel}</p>}
      {showDiagnostics && mapStatus !== 'available' && <p data-testid="active-map-status-details" className="mx-auto mt-1 w-fit max-w-full text-center text-xs text-[var(--route-muted)]">{mapStatusDetail(mapStatus, 'journey')}</p>}
    </header>

    <MapControlRail className={`absolute right-4 z-10${sheetSnap === 'expanded' ? ' opacity-45' : ''}`} label="Керування картою активної поїздки" inert={sheetSnap === 'expanded'} style={{ top: 'calc(max(.75rem, env(safe-area-inset-top)) + 5rem)' }}>
      <MapZoomControls map={mapAdapter.current} enabled={mapAdapterReady}/>
      <MapVoiceControl />
      <div className="flex items-center gap-1.5" role="group" aria-label="Режими огляду маршруту">
        <button
          type="button"
          aria-label="Показати весь маршрут"
          aria-pressed={cameraFocusMode === 'overview'}
          title="Весь маршрут"
          onClick={() => {
            cancelPreviewFlight();
            if (sheetSnap === 'expanded') moveToSnap('half');
            setCameraFocusMode('overview');
            haptic(8);
          }}
          className={`map-interaction-control mg-press-subtle grid h-11 w-11 place-items-center rounded-full${cameraFocusMode === 'overview' ? ' is-reset' : ''}`}
        >
          <MapIcon size={18}/>
        </button>
        <button
          type="button"
          aria-label="До навігації"
          aria-pressed={cameraFocusMode === 'gps'}
          title="До навігації"
          onClick={() => { void returnToGpsNavigation(); haptic(8); }}
          className={`map-interaction-control mg-press-subtle grid h-11 w-11 place-items-center rounded-full${cameraFocusMode === 'gps' ? ' is-reset' : ''}`}
        >
          <Navigation size={18}/>
        </button>
      </div>
      <MapPerspectiveControl />
      <MapBasemapControl />
      <MapLayersControl overlays />
    </MapControlRail>

    <section
      ref={sheetElement}
      className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-t-[var(--mg-radius-3xl)] border border-[var(--route-border)] bg-[var(--route-sheet)] shadow-[var(--route-sheet-shadow)]"
      aria-label="Поточний етап маршруту"
      data-testid="active-navigation-sheet"
      data-sheet-state={sheetSnap}
      data-dragging={draggingRef.current ? 'true' : 'false'}
      style={{ height: `${draggingRef.current ? sheetHeightRef.current : sheetHeight}px`, transition: routeSheetTransition(draggingRef.current, reducedMotion), paddingBottom: 'env(safe-area-inset-bottom)', background: 'linear-gradient(160deg,var(--route-sheet-start),var(--route-sheet-end))' }}
    >
      <button
        type="button"
        aria-label={sheetSnap === 'expanded' ? 'Згорнути етап' : 'Розгорнути етап'}
        aria-expanded={sheetSnap !== 'collapsed'}
        onClick={cycleSheet}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={event => {
          if (event.key === 'ArrowUp') { event.preventDefault(); moveToSnap(sheetSnap === 'collapsed' ? 'half' : 'expanded'); }
          if (event.key === 'ArrowDown') { event.preventDefault(); moveToSnap(sheetSnap === 'expanded' ? 'half' : 'collapsed'); }
          if (event.key === 'Home') { event.preventDefault(); moveToSnap('collapsed'); }
          if (event.key === 'End') { event.preventDefault(); moveToSnap('expanded'); }
        }}
        className="route-sheet-grabber flex w-full h-11 shrink-0 touch-none items-center justify-center"
      >
        <span className="route-sheet-grabber__handle h-1.5 w-12 rounded-full bg-[var(--route-grabber)]"/>
      </button>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="shrink-0 px-4">
          {sheetSnap !== 'collapsed' && <div className="flex items-center gap-2">
            <p aria-live="polite" aria-atomic="true" className="text-xs font-extrabold uppercase tracking-[.12em] text-[var(--route-muted)]">
              Етап {legIndex + 1} з {legs.length}
            </p>
            {status && <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${status === 'LIVE' ? (isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-800') : 'bg-[var(--route-card-alt)] text-[var(--route-muted)]'}`}>
              {status === 'LIVE' && <i aria-hidden="true" className="mg-live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"/>}
              {ACTIVE_LEG_STATUS_LABEL[status]}
            </span>}
            {phase === 'past' && <span className="rounded-full bg-[var(--route-card-alt)] px-2 py-0.5 text-xs font-extrabold text-[var(--route-muted)]">ЗАВЕРШЕНО</span>}
          </div>}
          <div className="mt-0.5 flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white shadow-[0_0_14px_color-mix(in_srgb,var(--segment-color)_38%,transparent)]" style={{ backgroundColor: journeyModeColor(leg.mode, leg.transportType), ['--segment-color' as string]: journeyModeColor(leg.mode, leg.transportType) }}>
              <TransportIcon mode={leg.mode} transportType={leg.transportType} size={17} strokeWidth={2.3}/>
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[19px] font-black leading-6 tracking-[-.03em]">{activeLegTitle(leg)}</h1>
              <p data-testid="active-nav-leg-destination" className="truncate text-xs font-bold text-[var(--route-muted)]">до «{shortPlace(leg.destination.name)}»</p>
            </div>
          </div>
          {sheetSnap !== 'collapsed' && <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--route-subtle)]">{activeLegMeta(leg)}</p>}
          {sheetSnap !== 'collapsed' && <p data-testid="active-nav-location-detail" className="mt-0.5 truncate text-xs font-semibold text-[var(--route-subtle)]">{locationMessage || locationStatusLabel}</p>}
          {notice && <p role="status" data-testid="active-nav-notice" className="mt-1.5 rounded-xl border border-[var(--route-border)] bg-[var(--route-card-alt)] px-2.5 py-2 text-[12px] font-bold leading-[16px] text-[var(--route-ink)]">{notice}</p>}
        </div>

        {showRibbon && <div className="mg-route-ribbon mt-2 shrink-0 px-4" role="list" aria-label="Етапи навігації">
          {legs.map((item, index) => {
            const selected = index === legIndex;
            return <div key={item.id} role="listitem" className={`mg-route-ribbon__item${index < legIndex ? ' is-muted' : ''}`} style={{ flexGrow: Math.max(1, Math.round(item.durationSeconds / 60)) }}>
              <button
                type="button"
                onClick={() => jumpToLeg(index)}
                aria-pressed={selected}
                aria-label={`Етап ${index + 1}: ${activeLegTitle(item)}, ${activeLegTimes(item)}`}
                className={`mg-route-ribbon__pill${selected ? ' is-active' : ''}`}
                style={{ backgroundColor: item.mode === 'WALK' ? 'var(--route-ribbon-walk)' : journeyModeColor(item.mode, item.transportType) }}
              >
                <TransportIcon mode={item.mode} transportType={item.transportType} size={17} strokeWidth={2.4}/>
              </button>
              <span className="mg-route-ribbon__label tabular-nums">{activeTime(item.departureAt)}</span>
            </div>;
          })}
        </div>}

        {showAction && (sheetSnap === 'collapsed' ? (
          <p data-testid="active-nav-instruction" className="mx-4 mt-1 flex min-w-0 shrink-0 items-center gap-1.5 text-[12px] font-extrabold leading-4">
            <ArrowRight size={13} className="shrink-0 text-[var(--mg-blue)]" aria-hidden="true"/>
            <span className="min-w-0 truncate">{instruction}</span>
          </p>
        ) : (
          <div className="mx-4 mt-2 shrink-0 rounded-xl border border-[var(--route-border)] bg-[var(--route-card-alt)] px-2.5 py-2">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--mg-action)] text-white"><ArrowRight size={13} strokeWidth={2.6}/></span>
              <div className="min-w-0">
                <p data-testid="active-nav-instruction" className="text-[13px] font-extrabold leading-[18px]">{instruction}</p>
                {nextHint && <p className="mt-0.5 text-xs font-semibold leading-[14px] text-[var(--route-muted)]">{nextHint}</p>}
              </div>
            </div>
          </div>
        ))}

        {sheetSnap === 'expanded' && <div className="mt-2 shrink-0 px-4 pb-1" data-testid="active-navigation-stages">
          <p className="mb-1 text-xs font-extrabold text-[var(--route-muted)]">Увесь маршрут · {formatStageCount(legs.length)}{journey.transfers > 0 ? ` · ${formatTransferCount(journey.transfers)}` : ''}</p>
          <ol className="space-y-1">
            {legs.map((item, index) => {
              const selected = index === legIndex;
              const price = legPriceDisplay(item);
              const priceText = item.mode === 'WALK' ? '' : price.value !== '—' ? ` · ${price.value}` : '';
              const scheduled = isScheduledRouteLeg(item);
              const stops = item.stops ?? [];
              const stopsOpen = openStopsLegId === item.id;
              return <li key={item.id}>
                <div className={`overflow-hidden rounded-2xl border transition-colors ${selected ? 'border-[var(--mg-blue)] bg-[var(--route-card-alt)]' : 'border-[var(--route-border)] bg-[var(--route-card)]'}`}>
                  <div className="flex items-center gap-1 px-1 py-1">
                    <button
                      type="button"
                      onClick={() => jumpToLeg(index)}
                      aria-pressed={selected}
                      aria-label={`${activeLegTitle(item)}. Етап ${index + 1}. ${activeLegTimes(item)} · ${formatJourneyDurationTile(item.durationSeconds)}${priceText}. ${shortPlace(item.origin.name)} → ${shortPlace(item.destination.name)}`}
                      title={`${shortPlace(item.origin.name)} → ${shortPlace(item.destination.name)}`}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: item.mode === 'WALK' ? 'var(--route-ribbon-walk)' : journeyModeColor(item.mode, item.transportType) }}>
                        <TransportIcon mode={item.mode} transportType={item.transportType} size={15} strokeWidth={2.2}/>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-4">
                        <span className="flex min-w-0 items-center gap-2">
                          <b className="min-w-0 flex-1 truncate text-[13px] font-extrabold">{activeLegTitle(item)}</b>
                          <span className="shrink-0 text-xs font-bold text-[var(--route-muted)]">{formatJourneyDurationTile(item.durationSeconds)}{priceText}</span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1 text-xs leading-[14px] text-[var(--route-muted)]">
                          <span className="shrink-0 tabular-nums">{activeLegTimes(item)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="min-w-0 flex-1 truncate text-[var(--route-subtle)]">{shortPlace(item.origin.name)} → {shortPlace(item.destination.name)}</span>
                        </span>
                      </span>
                    </button>
                    {scheduled && stops.length > 0 && <button
                      type="button"
                      aria-label={`${stopsOpen ? 'Згорнути' : 'Розгорнути'} ${formatStopCount(stops.length)} для ${activeLegTitle(item)}`}
                      aria-expanded={stopsOpen}
                      aria-controls={`active-navigation-stops-${item.id}`}
                      onClick={() => setOpenStopsLegId(nextStopsLegId(openStopsLegId, item.id))}
                      className="mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[var(--route-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]"
                    >
                      <ChevronDown size={15} aria-hidden="true" className={`route-stops-chevron${stopsOpen ? ' is-open' : ''}`}/>
                    </button>}
                  </div>
                  {scheduled && stops.length > 0 && <div id={`active-navigation-stops-${item.id}`} hidden={!stopsOpen} className="mg-route-stops border-t border-[var(--route-border)] px-2 pb-1.5 pt-1">
                    {stopsOpen && <JourneyLegStops leg={item} color={item.mode === 'WALK' ? 'var(--route-ribbon-walk)' : journeyModeColor(item.mode, item.transportType)}/>}
                  </div>}
                  {scheduled && stops.length === 0 && <p className="px-3 pb-2 text-xs text-[var(--route-muted)]">Перевізник не надав список зупинок для цього рейсу.</p>}
                </div>
              </li>;
            })}
          </ol>
        </div>}
      </div>

      <div className={`shrink-0 px-4 ${sheetSnap === 'collapsed' ? 'pb-1 pt-0.5' : 'pb-2 pt-1'}`}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={goBack} disabled={legIndex === 0} aria-label="Попередній етап маршруту" title="Назад" className="map-interaction-control mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-xl disabled:opacity-40">
            <ArrowLeft size={18} aria-hidden="true"/>
          </button>
          <button type="button" onClick={advance} className={`mg-route-cta flex min-w-0 flex-1 items-center justify-center gap-3${sheetSnap === 'collapsed' ? ' route-sheet-compact-cta' : ''}`}>
            {isLast ? <Flag size={19} aria-hidden="true"/> : <ArrowRight size={20} aria-hidden="true"/>}
            <span>{isLast ? 'Завершити' : 'Далі'}</span>
          </button>
        </div>
      </div>
    </section>
    {floatingMapInfo.accessibility}
  </section>;
}
