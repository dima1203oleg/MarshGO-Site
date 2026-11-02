import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Flag, Layers, Navigation } from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import {
  buildJourneyRouteMapModel, formatTransferCount, journeyModeColor,
} from '../map/journeyRouteModel';
import { boundsOf, corridorFitPoints } from '../map/routeContextCorridor';
import { extentMeters, principalBearing } from '../map/routeCameraFocus';
import type { MapAdapter, MapStatus, RouteFitPadding } from '../map/MapAdapter';
import { getMapLayer, mapLayers, setMapLayer, type MapLayer } from '../map/mapMode';
import { productionApi, type ApiJourney, type ApiJourneyLive } from '../services/productionApi';
import { TransportIcon } from '../design-system/transport/TransportIcon';
import { buildRouteMapAnnotations, isTransitLeg } from './routeMapAnnotations';
import { routeSheetHeights, settleRouteSheetSnap, type RouteSheetSnap } from './routeSheet';
import { themeService } from '../services/theme';
import { priorityLevelOf } from '../map/transportVisualZones';
import { formatJourneyDurationTile } from './journeyResultPresentation';
import { legPriceDisplay } from './cashFare';
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

/**
 * The active stage of a selected itinerary. It is not the driver navigation
 * engine: a transit passenger follows the plan, so the camera, the stage card
 * and the «Далі» control all come from the itinerary's own legs and schedule.
 * No position is invented when the feed has no fresh vehicle.
 */
export function JourneyActiveNavigation({ journey, onExit }: { journey: ApiJourney; onExit: () => void }) {
  const legs = journey.legs;
  const model = useMemo(() => buildJourneyRouteMapModel(legs), [legs]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [legIndex, setLegIndex] = useState(() => activeNavigationStartIndex(legs, Date.now()));
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [isDark, setIsDark] = useState(themeService.isDark());
  const [mapLayer, setCurrentMapLayer] = useState<MapLayer>(getMapLayer);
  const [sheetSnap, setSheetSnap] = useState<RouteSheetSnap>('half');
  const [sheetHeight, setSheetHeight] = useState(() => typeof window === 'undefined' ? 340 : routeSheetHeights(window.innerHeight).half);
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === 'undefined' ? 844 : window.innerHeight);
  const [dragging, setDragging] = useState(false);
  const [mapAdapterReady, setMapAdapterReady] = useState(false);
  const [focusWhole, setFocusWhole] = useState(false);
  const [liveJourney, setLiveJourney] = useState<ApiJourneyLive | null>(null);
  const [liveJourneyRequestState, setLiveJourneyRequestState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const mapAdapter = useRef<MapAdapter | null>(null);
  const sheetElement = useRef<HTMLElement | null>(null);
  const sheetHeightRef = useRef(sheetHeight);
  const dragStart = useRef<{ y: number; height: number; pointerId: number; moved: boolean; lastY: number; lastAt: number; velocity: number } | null>(null);
  const suppressHandleClick = useRef(false);

  const leg = legs[Math.min(legIndex, Math.max(0, legs.length - 1))];
  const liveLeg = leg && isTransitLeg(leg) ? leg : undefined;
  const liveLegId = liveLeg?.id ?? null;
  const liveSegment = liveJourney?.segments.find(segment => segment.legId === liveLegId);

  useEffect(() => themeService.subscribe((_mode, dark) => setIsDark(dark)), []);

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
    let stopped = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    setLiveJourneyRequestState('loading');
    const poll = async () => {
      controller = new AbortController();
      try {
        const live = await productionApi.journeyLive(journey.id, liveLegId, controller.signal);
        if (!stopped) {
          setLiveJourney(live);
          setLiveJourneyRequestState('ready');
        }
      } catch {
        if (!stopped) {
          setLiveJourney(null);
          setLiveJourneyRequestState('failed');
        }
      } finally {
        if (!stopped) timer = window.setTimeout(() => void poll(), 15_000);
      }
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
    const points = focusWhole
      ? corridorFitPoints(model.routeSegments.flatMap(segment => segment.coordinates), contextLines)
      : legSegment
        ? corridorFitPoints(legSegment.coordinates, contextLines, 0.5)
        : [];
    const bearing = !focusWhole && legSegment && extentMeters(legSegment.coordinates) > 120
      ? principalBearing(legSegment.coordinates)
      : null;
    const bounds = boundsOf(points);
    const key = `${focusWhole}:${leg?.id ?? 'none'}:${points.length}:${bearing === null ? 'flat' : bearing.toFixed(1)}:${bounds?.map(value => value.toFixed(5)).join(',') ?? ''}`;
    return { points, bearing, key };
  }, [focusWhole, leg?.id, legSegment, liveSegment, model.routeSegments]);

  useEffect(() => {
    if (dragging || !mapAdapterReady || !leg) return;
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
  }, [dragging, focusData.key, leg, mapAdapterReady, mapPadding, sheetSnap, focusWhole]);

  useEffect(() => {
    const updateViewport = () => {
      const next = window.innerHeight;
      setViewportHeight(next);
      const nextHeight = routeSheetHeights(next)[sheetSnap];
      sheetHeightRef.current = nextHeight;
      setSheetHeight(nextHeight);
    };
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [sheetSnap]);

  const moveToSnap = (next: RouteSheetSnap) => {
    const nextHeight = routeSheetHeights(viewportHeight)[next];
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
    setSheetHeight(renderedHeight);
    if (sheetElement.current) {
      sheetElement.current.style.transition = 'none';
      sheetElement.current.style.height = `${renderedHeight}px`;
    }
    dragStart.current = { y: event.clientY, height: renderedHeight, pointerId: event.pointerId, moved: false, lastY: event.clientY, lastAt: now, velocity: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
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
    const heights = routeSheetHeights(viewportHeight);
    const nextHeight = Math.min(heights.expanded, Math.max(heights.collapsed, start.height + delta));
    sheetHeightRef.current = nextHeight;
    if (sheetElement.current) {
      sheetElement.current.style.transition = 'none';
      sheetElement.current.style.height = `${nextHeight}px`;
    }
  };
  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (start.moved) {
      const heights = routeSheetHeights(viewportHeight);
      moveToSnap(settleRouteSheetSnap(sheetHeightRef.current, start.velocity, heights, 0.45, start.height));
    }
    dragStart.current = null;
    setDragging(false);
  };

  const jumpToLeg = useCallback((index: number) => {
    setLegIndex(index);
    haptic(8);
  }, []);

  if (!leg) {
    return <main className="route-map-screen fixed inset-0 z-[80] grid place-items-center p-6 text-[var(--route-ink)]" data-theme={isDark ? 'dark' : 'light'}>
      <div className="text-center">
        <p className="text-[15px] font-extrabold">У цьому маршруті немає етапів.</p>
        <button type="button" onClick={onExit} className="mg-route-cta mt-4 px-6">До маршруту</button>
      </div>
    </main>;
  }

  const phase = activeLegPhase(leg, nowMs);
  const status = activeLegStatus(leg, liveSegment?.status === 'LIVE' ? 'LIVE' : undefined);
  const instruction = activeLegInstruction(leg, nowMs);
  const nextHint = activeLegNextHint(legs[legIndex + 1]);
  const isLast = legIndex >= legs.length - 1;
  const showRibbon = sheetSnap === 'expanded' || (sheetSnap === 'half' && viewportHeight >= 700);
  const showAction = sheetSnap !== 'collapsed';
  const destination = activeNavigationDestination(legs);
  const mapWarning = mapStatus === 'failed' ? 'Карта недоступна'
    : mapStatus === 'unconfigured' ? 'Базові тайли карти недоступні'
      : mapStatus === 'degraded' ? 'Карта завантажена частково' : '';
  const liveLabel = liveJourneyRequestState === 'failed' ? 'Рух недоступний · за розкладом' : null;

  const advance = () => {
    haptic([8, 24, 8]);
    if (isLast) { onExit(); return; }
    setLegIndex(index => Math.min(legs.length - 1, index + 1));
  };

  return <main
    className="route-map-screen fixed inset-0 z-[80] overflow-hidden text-[var(--route-ink)]"
    data-theme={isDark ? 'dark' : 'light'}
    data-sheet-snap={sheetSnap}
    data-testid="active-journey-navigation"
    style={{ ['--route-map-inset' as string]: `${sheetHeight + 12}px` }}
    aria-label={`Навігація до ${destination}`}
  >
    <div className="absolute inset-0">
      <MarshGoMap
        route={[]}
        routeSegments={model.routeSegments}
        routeWaypoints={model.routeWaypoints}
        routeLabels={routeLabels}
        routeFitPadding={mapPadding}
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
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
        <button type="button" aria-label="Вийти з навігації до маршруту" onClick={onExit} className="route-header-back grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <ArrowLeft size={20}/>
        </button>
        <div data-testid="active-nav-header-pill" className="mx-auto flex min-w-0 max-w-full flex-col items-center rounded-full border border-[var(--route-border)] px-3 py-1 text-center shadow-[var(--route-sheet-shadow)] backdrop-blur-md" style={{ backgroundColor: 'color-mix(in srgb, var(--route-sheet) 88%, transparent)' }}>
          <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--route-muted)]">Навігація</p>
          <p className="max-w-full truncate text-[16px] font-black leading-6 tracking-[-.02em] text-[var(--route-brand-ink)]">{destination}</p>
        </div>
        <button type="button" aria-label={`Шар карти: ${mapLayers[mapLayer].label}. Перемкнути`} title={`Шар карти: ${mapLayers[mapLayer].label}`} onClick={() => {
          const next: MapLayer = mapLayer === 'simple' ? 'satellite' : 'simple';
          setCurrentMapLayer(next);
          setMapLayer(next);
        }} className="route-header-icon grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <Layers size={20}/>
        </button>
      </div>
      {(mapWarning || liveLabel) && <p role="status" className="route-map-note mx-auto w-fit max-w-full truncate rounded-full px-3 py-1 text-[10.5px] font-bold">{mapWarning || liveLabel}</p>}
    </header>

    <div className="absolute right-4 z-10" style={{ top: 'calc(max(.75rem, env(safe-area-inset-top)) + 5rem)' }}>
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
        className={`route-map-control grid h-11 w-11 place-items-center rounded-full${focusWhole ? ' is-reset' : ''}`}
      >
        <Navigation size={19}/>
      </button>
    </div>

    <section
      ref={sheetElement}
      className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--route-border)] bg-[var(--route-sheet)] shadow-[var(--route-sheet-shadow)]"
      aria-label="Поточний етап маршруту"
      data-testid="active-navigation-sheet"
      data-sheet-state={sheetSnap}
      style={{ height: `${sheetHeight}px`, transition: dragging ? 'none' : 'height var(--mg-dur-base) var(--mg-ease-entrance)', paddingBottom: 'env(safe-area-inset-bottom)', background: 'linear-gradient(160deg,var(--route-sheet-start),var(--route-sheet-end))' }}
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
        className="route-sheet-grabber flex h-11 w-full shrink-0 touch-none items-center justify-center"
      >
        <span className="route-sheet-grabber__handle h-1.5 w-12 rounded-full bg-[var(--route-grabber)]"/>
      </button>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="shrink-0 px-5">
          <div className="flex items-center gap-2">
            <p aria-live="polite" aria-atomic="true" className="text-[10.5px] font-extrabold uppercase tracking-[.12em] text-[var(--route-muted)]">
              Етап {legIndex + 1} з {legs.length}
            </p>
            {status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${status === 'LIVE' ? (isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-800') : 'bg-[var(--route-card-alt)] text-[var(--route-muted)]'}`}>
              {status === 'LIVE' && <i aria-hidden="true" className="mg-live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"/>}
              {ACTIVE_LEG_STATUS_LABEL[status]}
            </span>}
            {phase === 'past' && <span className="rounded-full bg-[var(--route-card-alt)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--route-muted)]">ЗАВЕРШЕНО</span>}
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-[0_0_18px_color-mix(in_srgb,var(--segment-color)_45%,transparent)]" style={{ backgroundColor: journeyModeColor(leg.mode, leg.transportType), ['--segment-color' as string]: journeyModeColor(leg.mode, leg.transportType) }}>
              <TransportIcon mode={leg.mode} transportType={leg.transportType} size={20} strokeWidth={2.3}/>
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[21px] font-black leading-7 tracking-[-.03em]">{activeLegTitle(leg)}</h1>
              <p data-testid="active-nav-leg-destination" className="truncate text-[12px] font-bold text-[var(--route-muted)]">до «{shortPlace(leg.destination.name)}»</p>
            </div>
          </div>
          <p className="mt-1 text-[11px] font-semibold tabular-nums text-[var(--route-subtle)]">{activeLegMeta(leg)}</p>
        </div>

        {showRibbon && <div className="mg-route-ribbon mt-3 shrink-0 px-5" role="list" aria-label="Етапи навігації">
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

        {showAction && <div className="mx-5 mt-3 shrink-0 rounded-2xl border border-[var(--route-border)] bg-[var(--route-card-alt)] p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--mg-action)] text-white"><ArrowRight size={15} strokeWidth={2.6}/></span>
            <div className="min-w-0">
              <p data-testid="active-nav-instruction" className="text-[13px] font-extrabold leading-5">{instruction}</p>
              {nextHint && <p className="mt-0.5 text-[10.5px] font-semibold leading-4 text-[var(--route-muted)]">{nextHint}</p>}
            </div>
          </div>
        </div>}

        {sheetSnap === 'expanded' && <div className="mt-3 shrink-0 px-5 pb-2" data-testid="active-navigation-stages">
          <p className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[.12em] text-[var(--route-muted)]">Увесь маршрут · {formatStageCount(legs.length)}{journey.transfers > 0 ? ` · ${formatTransferCount(journey.transfers)}` : ''}</p>
          <ol className="space-y-2">
            {legs.map((item, index) => {
              const selected = index === legIndex;
              const price = legPriceDisplay(item);
              return <li key={item.id}>
                <button
                  type="button"
                  onClick={() => jumpToLeg(index)}
                  aria-pressed={selected}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${selected ? 'border-[var(--mg-blue)] bg-[var(--route-card-alt)]' : 'border-[var(--route-border)] bg-[var(--route-card)]'}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: item.mode === 'WALK' ? 'var(--route-ribbon-walk)' : journeyModeColor(item.mode, item.transportType) }}>
                    <TransportIcon mode={item.mode} transportType={item.transportType} size={18} strokeWidth={2.2}/>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <b className="truncate text-[13px] font-extrabold">{activeLegTitle(item)}</b>
                      <span className="ml-auto shrink-0 text-[10px] font-bold text-[var(--route-muted)]">Етап {index + 1}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[10.5px] font-semibold tabular-nums text-[var(--route-muted)]">{activeLegTimes(item)} · {formatJourneyDurationTile(item.durationSeconds)}{price.value !== '—' ? ` · ${price.value}` : ''}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-[var(--route-subtle)]">{shortPlace(item.origin.name)} → {shortPlace(item.destination.name)}</span>
                  </span>
                </button>
              </li>;
            })}
          </ol>
        </div>}
      </div>

      <div className="shrink-0 px-4 pb-3 pt-2">
        <button type="button" onClick={advance} className="mg-route-cta flex w-full items-center justify-center gap-3">
          {isLast ? <Flag size={19} aria-hidden="true"/> : <ArrowRight size={20} aria-hidden="true"/>}
          <span>{isLast ? 'Завершити' : 'Далі'}</span>
        </button>
      </div>
    </section>
  </main>;
}
