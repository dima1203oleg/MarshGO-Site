import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Clock3, Flag, Navigation } from 'lucide-react';
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
import { focusedApproachVehicles, passengerContextLines, priorityLevelOf } from '../map/transportVisualZones';
import { formatJourneyDistance, formatJourneyDurationTile } from './journeyResultPresentation';
import { legPriceDisplay } from './cashFare';
import { measureGlobalBottomNavigationInset } from './globalBottomNavigationInset';
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
  formatStageCount,
  shortPlace,
} from './journeyStageNavigation';

/**
 * The active stage of a selected itinerary. It is not the driver navigation
 * engine: a transit passenger follows the plan, so the camera, the stage card
 * and the «Далі» control all come from the itinerary's own legs and schedule.
 * No position is invented when the feed has no fresh vehicle.
 */
export function JourneyActiveNavigation({
  journey,
  notice,
  onExit,
  onFinish,
  initialLegIndex = null,
  onStageChange,
}: {
  journey: ApiJourney;
  notice?: string | null;
  onExit: () => void;
  onFinish?: () => void;
  initialLegIndex?: number | null;
  onStageChange?: (legIndex: number) => void;
}) {
  const showDiagnostics = typeof window !== 'undefined' && diagnosticsRequested(
    window.location.search,
    (() => { try { return window.localStorage.getItem('marshgo.results.diagnostics'); } catch { return null; } })(),
  );
  const legs = journey.legs;
  const model = useMemo(() => buildJourneyRouteMapModel(legs), [legs]);
  const confirmedSegments = useMemo(() => confirmedJourneySegments(model.routeSegments), [model.routeSegments]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [legIndex, setLegIndex] = useState(() => {
    const scheduledStart = activeNavigationStartIndex(legs, Date.now());
    if (initialLegIndex === null || legs.length === 0 || !Number.isInteger(initialLegIndex)) return scheduledStart;
    return Math.min(Math.max(initialLegIndex, 0), legs.length - 1);
  });
  const stageChange = useRef(onStageChange);
  stageChange.current = onStageChange;
  useEffect(() => { stageChange.current?.(legIndex); }, [legIndex]);

  const leg = legs[Math.min(legIndex, Math.max(0, legs.length - 1))];
  const liveLeg = leg && isTransitLeg(leg) ? leg : undefined;
  const liveLegId = liveLeg?.id ?? null;
  const [openStopsLegId, setOpenStopsLegId] = useState<string | null>(null);

  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [isDark, setIsDark] = useState(themeService.isDark());
  const [sheetSnap, setSheetSnap] = useState<RouteSheetSnap>('half');
  const [sheetHeight, setSheetHeight] = useState(() => typeof window === 'undefined' ? 340 : routeSheetHeights(window.innerHeight).half);
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
    heights.expanded = fitExpandedRouteSheetHeight(heights, expandedContentHeight);
    return heights;
  }, [bottomNavigationInset, expandedContentHeight, viewportHeight]);

  useEffect(() => themeService.subscribe((_mode, dark) => setIsDark(dark)), []);
  useEffect(() => subscribeReducedMotion(setReducedMotion), []);
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
    return { top: 118, left: 26, right: 26, bottom: sheetHeight + bottomNavigationInset + 24 };
  }, [bottomNavigationInset, isDesktop, sheetHeight]);

  const legSegment = useMemo(
    () => (leg ? confirmedSegments.find(segment => segment.id === leg.id) : undefined),
    [leg, confirmedSegments],
  );

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
    if (sheetSnap === 'expanded') return;
    if (focusData.points.length >= 2) {
      adapter.focusCoordinates?.(
        focusData.points,
        focusData.bearing === null ? { ...mapPadding, bearing: 0 } : { ...mapPadding, bearing: focusData.bearing },
        focusWhole ? 14.5 : 17,
      );
      return;
    }
    adapter.fitRoute(mapPadding);
  }, [focusData.bearing, focusData.key, focusData.points, focusWhole, leg, mapAdapterReady, mapPadding, sheetSnap]);

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
    moveToSnap(sheetSnap === 'collapsed' ? 'half' : sheetSnap === 'half' ? 'expanded' : 'collapsed');
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
    const nextHeight = Math.min(heights.expanded, Math.max(heights.collapsed, start.height + delta));
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

  const jumpToLeg = useCallback((index: number) => {
    setLegIndex(index);
    haptic(8);
  }, []);

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
  // The ribbon handles compact states; detailed stage cards handle half/expanded states.
  const showRibbon = sheetSnap === 'collapsed';
  const showAction = sheetSnap !== 'collapsed';
  const destination = activeNavigationDestination(legs);
  const mapWarning = mapStatus === 'failed' ? mapStatusNote(mapStatus) : null;
  const liveLabel = liveJourneyRequestState === 'failed' ? 'За розкладом' : null;

  const advance = () => {
    haptic([8, 24, 8]);
    if (isLast) { onFinish?.(); onExit(); return; }
    setLegIndex(index => Math.min(legs.length - 1, index + 1));
  };

  return <section
    className="route-map-screen fixed inset-0 z-[80] overflow-hidden text-[var(--route-ink)]"
    data-theme={isDark ? 'dark' : 'light'}
    data-sheet-snap={sheetSnap}
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
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[var(--route-muted)]">Навігація</p>
          <p className="max-w-full truncate text-[16px] font-black leading-6 tracking-[-.02em] text-[var(--route-brand-ink)]">{destination}</p>
        </div>
      </div>
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
          if (sheetSnap === 'expanded') moveToSnap('half');
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
        aria-expanded={sheetSnap !== 'collapsed'}
        onClick={cycleSheet}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onKeyDown={event => {
          if (event.key === 'ArrowUp') { event.preventDefault(); moveToSnap(sheetSnap === 'collapsed' ? 'half' : 'expanded'); }
          if (event.key === 'ArrowDown') { event.preventDefault(); moveToSnap(sheetSnap === 'expanded' ? 'half' : 'collapsed'); }
          if (event.key === 'Home') { event.preventDefault(); moveToSnap('collapsed'); }
          if (event.key === 'End') { event.preventDefault(); moveToSnap('expanded'); }
        }}
        className="route-sheet-grabber flex h-6 w-full shrink-0 touch-none items-center justify-center"
      >
        <span className="route-sheet-grabber__handle h-1.5 w-12 rounded-full bg-[var(--route-grabber)]"/>
      </button>

      {model.missingWalkingShapeCount > 0 || model.routeSegments.some(segment => segment.isWalk && segment.approximate) ? (
        <p role="status" aria-label="Для частини пішого маршруту немає перевіреної геометрії — лінію не домальовано." className="mx-3 mb-1 flex min-h-7 items-center truncate rounded-lg bg-[var(--route-card-alt)] px-2 py-1 text-[12px] font-semibold leading-4 text-[var(--route-muted)]">Частина пішої геометрії не підтверджена</p>
      ) : null}

      <div data-testid="active-navigation-content" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="shrink-0 px-5">
          <div className="flex items-center gap-2">
            <p aria-live="polite" aria-atomic="true" className="text-xs font-extrabold uppercase tracking-[.12em] text-[var(--route-muted)]">
              Етап {legIndex + 1} з {legs.length}{journey.transfers > 0 ? ` · ${formatTransferCount(journey.transfers)}` : ''}
            </p>
            {status && <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${status === 'LIVE' ? (isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-800') : 'bg-[var(--route-card-alt)] text-[var(--route-muted)]'}`}>
              {status === 'LIVE' && <i aria-hidden="true" className="mg-live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"/>}
              {ACTIVE_LEG_STATUS_LABEL[status]}
            </span>}
            {phase === 'past' && <span className="rounded-full bg-[var(--route-card-alt)] px-2 py-0.5 text-xs font-extrabold text-[var(--route-muted)]">ЗАВЕРШЕНО</span>}
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-[0_0_18px_color-mix(in_srgb,var(--segment-color)_45%,transparent)]" style={{ backgroundColor: journeyModeColor(leg.mode, leg.transportType), ['--segment-color' as string]: journeyModeColor(leg.mode, leg.transportType) }}>
              <TransportIcon mode={leg.mode} transportType={leg.transportType} size={20} strokeWidth={2.3}/>
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[19px] font-black leading-6 tracking-[-.03em]">{activeLegTitle(leg)}</h1>
              <p data-testid="active-nav-leg-destination" className="flex min-w-0 items-center gap-1 text-xs font-bold text-[var(--route-muted)]">
                <span className="min-w-0 flex-1 truncate">до «{shortPlace(leg.destination.name)}»</span>
                <span aria-hidden="true" className="shrink-0">·</span>
                <span data-testid="active-nav-leg-meta" className="shrink-0 font-semibold tabular-nums text-[var(--route-subtle)]">{activeLegMeta(leg)}</span>
              </p>
            </div>
          </div>
          {notice && <p role="status" data-testid="active-nav-notice" className="mt-1 rounded-xl border border-[var(--route-border)] bg-[var(--route-card-alt)] px-3 py-2 text-[12px] font-bold leading-4 text-[var(--route-ink)]">{notice}</p>}
        </div>

        {showRibbon && <div className="mg-route-ribbon mg-route-ribbon--compact no-scrollbar shrink-0 px-4" role="list" aria-label="Етапи навігації">
          {legs.map((item, index) => {
            const selected = index === legIndex;
            return <div key={item.id} role="listitem" className={`mg-route-ribbon__item${index !== legIndex ? ' is-muted' : ''}`}>
              <button
                type="button"
                onClick={() => jumpToLeg(index)}
                aria-pressed={selected}
                aria-label={`Етап ${index + 1}: ${activeLegTitle(item)}, ${activeLegTimes(item)}`}
                className={`mg-route-ribbon__pill${selected ? ' is-active' : ''}`}
                style={{ backgroundColor: item.mode === 'WALK' ? 'var(--route-ribbon-walk)' : journeyModeColor(item.mode, item.transportType) }}
              >
                <TransportIcon mode={item.mode} transportType={item.transportType} size={17} strokeWidth={2.4}/>
                <span className="mg-route-ribbon__copy"><span className="mg-route-ribbon__label">{activeLegTitle(item)}</span><span className="mg-route-ribbon__detail">{formatJourneyDurationTile(item.durationSeconds)}</span></span>
              </button>
            </div>;
          })}
        </div>}

        {showAction && <div className="mx-5 mt-2 shrink-0 rounded-2xl border border-[var(--route-border)] bg-[var(--route-card-alt)] p-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--mg-action)] text-white"><ArrowRight size={15} strokeWidth={2.6}/></span>
            <div className="min-w-0">
              <p data-testid="active-nav-instruction" className="text-[13px] font-extrabold leading-5">{instruction}</p>
              {nextHint && <p className="mt-0.5 text-xs font-semibold leading-4 text-[var(--route-muted)]">{nextHint}</p>}
            </div>
          </div>
        </div>}

        {sheetSnap !== 'collapsed' && <div className="mt-1 shrink-0 px-5 pb-0.5" data-testid="active-navigation-stages">
          <ol className="mg-route-segment-list" aria-label={`Усі етапи маршруту: ${formatStageCount(legs.length)}${journey.transfers > 0 ? `, ${formatTransferCount(journey.transfers)}` : ''}`}>
            {legs.map((item, index) => {
              const selected = index === legIndex;
              const price = legPriceDisplay(item);
              const scheduled = isScheduledRouteLeg(item);
              const stops = item.stops ?? [];
              const stopsOpen = openStopsLegId === item.id;
              const previousTime = index > 0 ? Date.parse(legs[index - 1].arrivalAt) : Date.parse(journey.requestedDepartureAt ?? item.departureAt);
              const departureTime = Date.parse(item.departureAt);
              const waitSeconds = Number.isFinite(previousTime) && Number.isFinite(departureTime) ? Math.max(0, Math.round((departureTime - previousTime) / 1000)) : 0;
              return <li key={item.id}>{waitSeconds > 0 && <div className="mb-0.5 rounded-xl border border-[var(--route-border)] bg-[var(--route-card-alt)] px-3 py-0.5 text-xs text-[var(--route-muted)]"><span className="inline-flex items-center gap-2"><Clock3 size={14} className="text-[var(--route-subtle)]"/>Очікування · {formatJourneyDurationTile(waitSeconds)}</span></div>}<div className={`mg-route-segment overflow-hidden rounded-xl border ${selected ? 'border-[var(--mg-blue)] bg-[var(--route-card-alt)]' : 'border-[var(--route-border)] bg-[var(--route-card)]'}`} style={{ borderLeftWidth: 3.5, borderLeftColor: item.mode === 'WALK' ? 'var(--route-ribbon-walk)' : journeyModeColor(item.mode, item.transportType) }}>
                <div className="mg-route-segment__body flex items-center gap-1.5">
                  <button type="button" onClick={() => jumpToLeg(index)} aria-pressed={selected} className="mg-press-subtle flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: item.mode === 'WALK' ? 'var(--route-ribbon-walk)' : journeyModeColor(item.mode, item.transportType) }}>
                      <TransportIcon mode={item.mode} transportType={item.transportType} size={16} strokeWidth={2.3}/>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><b className="text-xs font-black tracking-tight">{activeLegTitle(item)}</b><span className="text-xs font-semibold leading-4 tabular-nums text-[var(--route-muted)]">{activeLegTimes(item)} · {formatJourneyDurationTile(item.durationSeconds)}{typeof item.distanceMeters === 'number' && Number.isFinite(item.distanceMeters) ? ` · ${formatJourneyDistance(item.distanceMeters)}` : ''}{scheduled && stops.length ? ` · ${formatStopCount(stops.length)}` : ''}</span></span>
                      <span className="mg-route-endpoints mt-0.5 text-xs font-medium leading-4 text-[var(--route-subtle)]"><span className="mg-route-endpoints__name" title={item.origin.name}>{shortPlace(item.origin.name)}</span><ArrowRight size={12} aria-hidden="true"/><span className="mg-route-endpoints__name mg-route-endpoints__name--end" title={item.destination.name}>{shortPlace(item.destination.name)}</span></span>
                    </span>
                  </button>
                  {item.mode !== 'WALK' && <span className="route-segment-price flex flex-col items-end"><b className="text-xs font-black tabular-nums">{price.value}</b>{price.caption && <span className="text-xs font-semibold text-[var(--route-muted)]">{price.caption}</span>}</span>}
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
        <button type="button" onClick={advance} className="mg-route-cta flex w-full items-center justify-center gap-3">
          {isLast ? <Flag size={19} aria-hidden="true"/> : <ArrowRight size={20} aria-hidden="true"/>}
          <span>{isLast ? 'Завершити' : 'Далі'}</span>
        </button>
      </div>
    </section>
  </section>;
}
