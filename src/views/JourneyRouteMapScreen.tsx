import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowLeft, ArrowRight, ChevronDown, Clock3, Heart, Layers, Navigation, Play, Share2, X,
} from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import { buildJourneyRouteMapModel, formatTransferCount, journeyModeColor } from '../map/journeyRouteModel';
import { boundsOf, corridorFitPoints } from '../map/routeContextCorridor';
import { extentMeters, principalBearing } from '../map/routeCameraFocus';
import type { MapAdapter, MapStatus, RouteFitPadding } from '../map/MapAdapter';
import { getMapLayer, mapLayers, setMapLayer, type MapLayer } from '../map/mapMode';
import { productionApi, type ApiJourney, type ApiJourneyLive } from '../services/productionApi';
import { TransportIcon } from '../design-system/transport/TransportIcon';
import { journeyLegCaveat, journeyLegLabel } from './journeyLegLabel';
import {
  formatJourneyDuration as formatDuration,
  formatJourneyDurationTile,
  formatJourneyDistance,
  journeyRouteBadge,
} from './journeyResultPresentation';
import { journeyPriceDisplay, legPriceDisplay } from './cashFare';
import { routeSheetHeights, settleRouteSheetSnap, type RouteSheetSnap } from './routeSheet';
import { themeService } from '../services/theme';
import { buildRouteMapAnnotations, formatSegmentCount, formatStopCount, primaryTransitLeg } from './routeMapAnnotations';
import { priorityLevelOf } from '../map/transportVisualZones';

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
    if (waitSeconds >= 60) items.push({ id: `wait:${leg.id}`, targetLegId: leg.id, kind: 'WAIT', durationSeconds: waitSeconds, color: '#74879A' });
    const timestampDuration = Number.isFinite(departure) && Number.isFinite(arrival) ? Math.max(0, Math.round((arrival - departure) / 1000)) : 0;
    const durationSeconds = timestampDuration || Math.max(0, leg.durationSeconds);
    items.push({ id: `leg:${leg.id}`, targetLegId: leg.id, kind: 'LEG', durationSeconds, color: journeyModeColor(leg.mode, leg.transportType), leg });
    if (Number.isFinite(arrival)) cursor = arrival;
  }
  return items.filter(item => item.durationSeconds > 0);
}

function isScheduledRouteLeg(leg: JourneyLeg) {
  return ['BUS', 'MINIBUS', 'TROLLEYBUS', 'TRAM', 'METRO', 'RAIL', 'FERRY', 'FUNICULAR'].includes(leg.mode)
    || ['bus', 'marshrutka', 'intercity_bus', 'train', 'suburban_train', 'city_train', 'tram', 'trolleybus', 'metro'].includes(leg.transportType ?? '');
}

function stopTime(stop: NonNullable<JourneyLeg['stops']>[number], index: number, lastIndex: number) {
  return formatTime(index === 0 ? stop.departureAt : index === lastIndex ? stop.arrivalAt : stop.arrivalAt);
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

export function JourneyRouteMapScreen({
  journey,
  onBack,
  onBookOffer,
  onStartJourney,
}: {
  journey: ApiJourney;
  onBack: () => void;
  onBookOffer?: (offerId: string, journeyId: string, journeyLegId: string) => void;
  /** Opens the active stage map for this itinerary; the route is never re-entered. */
  onStartJourney?: () => void;
}) {
  const model = useMemo(() => buildJourneyRouteMapModel(journey.legs), [journey.legs]);
  const timeline = useMemo(() => timelineFor(journey), [journey]);
  const firstLeg = journey.legs[0];
  const lastLeg = journey.legs.at(-1);
  const primaryLeg = useMemo(() => primaryTransitLeg(journey.legs), [journey.legs]);
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [isDark, setIsDark] = useState(themeService.isDark());
  const [mapLayer, setCurrentMapLayer] = useState<MapLayer>(getMapLayer);
  // The sheet opens exactly on the approved composition: summary, segment
  // ribbon and one primary action; details stay one swipe away.
  const [sheetSnap, setSheetSnap] = useState<RouteSheetSnap>('half');
  const [sheetHeight, setSheetHeight] = useState(() => typeof window === 'undefined' ? 316 : routeSheetHeights(window.innerHeight).half);
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === 'undefined' ? 844 : window.innerHeight);
  const [dragging, setDragging] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [mapSegmentChoices, setMapSegmentChoices] = useState<{ ids: string[]; x: number; y: number } | null>(null);
  const [liveJourney, setLiveJourney] = useState<ApiJourneyLive | null>(null);
  const [liveJourneyRequestState, setLiveJourneyRequestState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [mapAdapterReady, setMapAdapterReady] = useState(false);
  // The details detent opens with the published stop sequence already visible,
  // like the approved mockup; legs without stops stay collapsed.
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(() => new Set(
    journey.legs.filter(leg => isScheduledRouteLeg(leg) && (leg.stops?.length ?? 0) > 0).map(leg => leg.id),
  ));
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

  useEffect(() => themeService.subscribe((_theme, dark) => setIsDark(dark)), []);

  // A confirmation the rider can actually see: the sheet covers the screen, so the
  // toast floats just above it and clears itself instead of needing a dismiss tap.
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(''), 2800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const haptic = (ms: number | number[]) => {
    // iOS Safari has no Vibration API; the call is a no-op there, not a promise.
    try { navigator.vibrate?.(ms); } catch { /* ignored */ }
  };

  const selectedLeg = activeSegmentId ? journey.legs.find(leg => leg.id === activeSegmentId) : undefined;
  const liveLeg = selectedLeg && isScheduledRouteLeg(selectedLeg) ? selectedLeg : primaryLeg ?? undefined;
  const liveLegId = liveLeg?.id ?? null;
  const liveSegment = liveJourney?.segments.find(segment => segment.legId === liveLegId);

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
        routeLabel: liveLeg.routeName ?? journeyLegLabel(liveLeg.mode, liveLeg.transportType),
        emphasized: vehicle.emphasized,
        priorityLevel: priorityLevelOf(vehicle),
        etaSeconds: vehicle.etaSeconds ?? null,
        etaConfidence: vehicle.etaConfidence ?? 'NONE',
      })),
    });
  }, [liveSegment, liveLeg, mapAdapterReady]);

  const routeLabels = useMemo(() => buildRouteMapAnnotations({ journey, live: liveJourney, preferredLegId: liveLegId }), [journey, liveJourney, liveLegId]);

  const snapHeight = useCallback((snap: RouteSheetSnap, viewport = viewportHeight) => routeSheetHeights(viewport)[snap], [viewportHeight]);

  useEffect(() => {
    const updateViewport = () => {
      const next = window.innerHeight;
      setViewportHeight(next);
      const nextHeight = snapHeight(sheetSnap, next);
      sheetHeightRef.current = nextHeight;
      setSheetHeight(nextHeight);
    };
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [sheetSnap, snapHeight]);

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const chipHeight = 54;
  const mapPadding = useMemo<RouteFitPadding>(() => {
    if (isDesktop) return { top: 100, left: 500, right: 40, bottom: 40 };
    return {
      top: 124,
      left: 26,
      right: 26,
      // Follow the sheet's resting height: pulling the sheet down uncovers more
      // map, so the route refits wider instead of staying pinned to the half
      // detent. The expanded detent is skipped when fitting (thin strip), so its
      // height never reaches this padding.
      bottom: sheetHeight + chipHeight + 12,
    };
  }, [isDesktop, sheetHeight]);

  const routeLinePoints = useMemo(() => {
    const itinerary = model.routeSegments.flatMap(segment => segment.coordinates);
    const lineRoutes = liveSegment?.lineRoutes ?? [];
    const contextLines = lineRoutes.flatMap(route => [
      route.coordinates,
      ...(route.zones?.beforeBoarding ? [route.zones.beforeBoarding] : []),
      ...(route.zones?.afterAlighting ? [route.zones.afterAlighting] : []),
    ]);
    // The camera frames the ride plus the nearby part of its line; the published
    // line can run tens of kilometres past it, and fitting that turns the
    // itinerary into a dot on a city-wide map with no readable streets.
    return corridorFitPoints(itinerary, contextLines);
  }, [liveSegment, model.routeSegments]);

  // A live poll replaces every object even when the geometry is identical, so
  // the fit is keyed on the coordinates themselves: otherwise the camera flies
  // a fresh fitBounds animation every 15 s while the rider reads the sheet.
  const routeFitKey = useMemo(() => {
    if (routeLinePoints.length < 2) return `points:${routeLinePoints.length}`;
    const bounds = boundsOf(routeLinePoints);
    return bounds
      ? `${routeLinePoints.length}:${bounds.map(value => value.toFixed(5)).join(',')}`
      : `points:${routeLinePoints.length}`;
  }, [routeLinePoints]);

  // A selected leg is framed on its own: the ride plus a short stretch of the
  // published line on both sides, rotated so the leg runs up the screen and the
  // taller viewport edge gives it the longest possible drawn length.
  const segmentFocus = useMemo(() => {
    const segment = activeSegmentId ? model.routeSegments.find(item => item.id === activeSegmentId) : undefined;
    if (!segment || segment.coordinates.length < 2) return null;
    const live = liveJourney?.segments.find(item => item.legId === segment.id);
    const contextLines = (live?.lineRoutes ?? []).flatMap(route => [
      route.coordinates,
      ...(route.zones?.beforeBoarding ? [route.zones.beforeBoarding] : []),
      ...(route.zones?.afterAlighting ? [route.zones.afterAlighting] : []),
    ]);
    const points = corridorFitPoints(segment.coordinates, contextLines, 0.5);
    const bounds = boundsOf(points);
    const bearing = extentMeters(segment.coordinates) > 120 ? principalBearing(segment.coordinates) : null;
    return {
      points,
      bearing,
      key: `${segment.id}:${points.length}:${bearing === null ? 'flat' : bearing.toFixed(1)}:${bounds?.map(value => value.toFixed(5)).join(',') ?? ''}`,
    };
  }, [activeSegmentId, liveJourney, model.routeSegments]);

  // Keyed on content so a live poll that repeats the same geometry does not
  // replay the camera animation while the rider is reading the sheet.
  const segmentFocusKey = segmentFocus?.key ?? null;

  const showWholeRoute = useCallback(() => {
    setActiveSegmentId(null);
    const padding = { ...mapPadding, bearing: 0 };
    if (routeLinePoints.length >= 2) mapAdapter.current?.focusCoordinates?.(routeLinePoints, padding, 15.2);
    else mapAdapter.current?.fitRoute(padding);
  }, [mapPadding, routeLinePoints]);

  useEffect(() => {
    if (dragging || !mapAdapterReady) return;
    const adapter = mapAdapter.current;
    if (!adapter) return;
    adapter.setActiveRouteSegment?.(activeSegmentId);
    // At the details detent only a thin map strip remains; refitting would
    // squeeze the whole itinerary into a few pixels.
    if (sheetSnap === 'expanded') return;
    if (segmentFocus) {
      adapter.focusCoordinates?.(
        segmentFocus.points,
        segmentFocus.bearing === null ? { ...mapPadding, bearing: 0 } : { ...mapPadding, bearing: segmentFocus.bearing },
        17,
      );
      return;
    }
    if (routeLinePoints.length >= 2) adapter.focusCoordinates?.(routeLinePoints, { ...mapPadding, bearing: 0 }, 15.2);
    else adapter.fitRoute(mapPadding);
  }, [activeSegmentId, dragging, mapAdapterReady, mapPadding, routeFitKey, segmentFocusKey, sheetSnap]);

  useEffect(() => {
    if (sheetSnap === 'expanded') return;
    const readScale = () => setScale(mapAdapter.current?.getScaleLabel?.(88) ?? null);
    const timer = window.setTimeout(readScale, 620);
    return () => window.clearTimeout(timer);
  }, [mapPadding, mapAdapterReady, sheetSnap]);

  const chooseSegment = useCallback((id: string) => {
    setMapSegmentChoices(null);
    setActiveSegmentId(current => current === id ? null : id);
    haptic(8);
    requestAnimationFrame(() => segmentCards.current.get(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }));
  }, []);

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
    const detail = isWalk
      ? formatJourneyDurationTile(item.durationSeconds)
      : `${formatJourneyDurationTile(item.durationSeconds)} · ${price.value !== '—' ? price.value : placedStop || 'ціна невідома'}`;
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
  const dataNote = mapStatus === 'failed' ? 'Карта недоступна'
    : mapStatus === 'degraded' ? 'Карта завантажена частково'
      : mapStatus === 'unconfigured' ? 'Базові тайли карти не налаштовані'
        : liveJourneyRequestState === 'failed' ? 'Не вдалося оновити рух; показано розклад'
          : liveJourneyRequestState === 'loading' ? 'Перевіряємо дані руху…'
            : liveJourney?.segments[0]?.reason === 'provider_unavailable' ? 'Джерело руху недоступне; лінію не домальовуємо'
              : liveJourney?.segments[0]?.reason === 'no_fresh_matching_vehicle' ? 'Немає свіжих позицій транспорту'
                : model.missingShapeCount > 0 ? 'Частину маршруту без лінії на карті'
                  : model.approximateWalkCount > 0 ? 'Частина піших відрізків — оцінка' : '';
  const mapStatusIsWarning = mapStatus === 'failed' || mapStatus === 'degraded' || mapStatus === 'unconfigured'
    || liveJourneyRequestState === 'failed' || liveJourney?.segments[0]?.reason === 'provider_unavailable'
    || liveJourney?.segments[0]?.reason === 'no_fresh_matching_vehicle' || model.missingShapeCount > 0 || model.approximateWalkCount > 0;

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
    const next: RouteSheetSnap = sheetSnap === 'collapsed' ? 'half' : sheetSnap === 'half' ? 'expanded' : 'collapsed';
    moveToSnap(next);
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
      const next = settleRouteSheetSnap(sheetHeightRef.current, start.velocity, heights, 0.45, start.height);
      moveToSnap(next);
    }
    dragStart.current = null;
    setDragging(false);
  };

  const setCardRef = (id: string, node: HTMLElement | null) => {
    if (node) segmentCards.current.set(id, node); else segmentCards.current.delete(id);
  };
  const toggleExpanded = (id: string) => setExpandedSegments(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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
  const showChrome = sheetSnap !== 'expanded';

  return <main
    className="route-map-screen fixed inset-0 z-[var(--mg-z-map-chip)] overflow-hidden text-[var(--route-ink)]"
    data-theme={isDark ? 'dark' : 'light'}
    data-sheet-snap={sheetSnap}
    style={{ ['--route-map-inset' as string]: `${sheetHeight + (sheetSnap === 'expanded' ? 10 : chipHeight + 12)}px` }}
    aria-label="Побудований маршрут"
  >
    <div className="absolute inset-0" data-testid="journey-route-map">
      <MarshGoMap
        route={[]}
        routeSegments={model.routeSegments}
        routeWaypoints={model.routeWaypoints}
        routeLabels={routeLabels}
        routeFitPadding={mapPadding}
        theme={isDark ? 'MARSHGO_DARK' : 'MARSHGO_LIGHT'}
        onStatus={setMapStatus}
        onAdapter={adapter => { mapAdapter.current = adapter; setMapAdapterReady(Boolean(adapter)); if (adapter) adapter.setActiveRouteSegment?.(activeSegmentId); }}
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

    {mapSegmentChoices && <div role="group" aria-label="Виберіть відрізок маршруту" className="absolute z-[30] w-[min(15rem,calc(100vw-1.5rem))] rounded-2xl border border-[var(--route-border)] bg-[var(--route-floating)] p-2 text-[var(--route-ink)] shadow-2xl backdrop-blur-xl" style={{ left: mapSegmentChoices.x, top: mapSegmentChoices.y }}>
      <div className="flex items-center justify-between gap-2 px-2 pb-1">
        <span className="text-xs font-extrabold">Кілька відрізків поруч</span>
        <button type="button" aria-label="Закрити вибір відрізка" onClick={() => setMapSegmentChoices(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-[var(--route-hover)]">×</button>
      </div>
      {mapSegmentChoices.ids.map(id => {
        const leg = journey.legs.find(item => item.id === id);
        if (!leg) return null;
        return <button key={id} type="button" onClick={() => chooseSegment(id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-bold hover:bg-[var(--route-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]">
          <span className="truncate">{legLabel(leg)}</span>
          <ArrowRight size={16} className="shrink-0 text-[var(--route-muted)]"/>
        </button>;
      })}
    </div>}

    {sheetSnap !== 'expanded' && <header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-3xl flex-col gap-2 px-4 pb-2 pt-[max(.75rem,env(safe-area-inset-top))]">
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_5.75rem] items-center gap-2">
        <button type="button" aria-label="Назад до результатів" onClick={onBack} className="route-header-back mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <ArrowLeft size={20}/>
        </button>
        <span className="truncate text-center text-[19px] font-black tracking-[-.04em] text-[var(--route-brand-ink)]">MARSH<span className="text-[var(--mg-blue)]">GO</span></span>
        <div className="flex shrink-0 justify-end gap-1">
          <button type="button" aria-label={saved ? 'Видалити маршрут зі збережених' : 'Зберегти маршрут'} aria-pressed={saved} onClick={toggleSaved} className="route-header-icon mg-press-subtle grid h-11 w-11 place-items-center rounded-full"><Heart size={21} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-rose-400' : ''}/></button>
          <button type="button" aria-label="Поділитися маршрутом" onClick={() => void shareRoute()} className="route-header-icon mg-press-subtle grid h-11 w-11 place-items-center rounded-full"><Share2 size={21}/></button>
        </div>
      </div>
      <div role="group" aria-label={`Звідки: ${firstLeg?.origin.name ?? 'Початок'}. Куди: ${lastLeg?.destination.name ?? 'Кінець'}`} className="route-address-summary flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2.5 text-[12.5px] font-extrabold shadow-lg">
        <span className="min-w-0 flex-1 truncate"><span aria-hidden="true" className="route-address-dot route-address-dot--origin"/>{firstLeg?.origin.name ?? 'Початок'}</span>
        <ArrowRight size={17} aria-hidden="true" className="shrink-0 text-[var(--route-muted)]"/>
        <span className="min-w-0 flex-1 truncate text-right"><span aria-hidden="true" className="route-address-dot route-address-dot--destination"/>{lastLeg?.destination.name ?? 'Кінець'}</span>
      </div>
      {mapStatusIsWarning && dataNote && <p role="status" className="route-map-note mx-auto w-fit max-w-full truncate rounded-full px-3 py-1 text-xs font-bold">{dataNote}</p>}
    </header>}

    <div className="absolute right-4 z-10 flex flex-col gap-2" style={{ top: 'calc(max(.75rem, env(safe-area-inset-top)) + 8.2rem)' }}>
      {(sheetSnap === 'half' || activeSegmentId) && <button type="button" aria-label="Показати маршрут цілком" title="Показати маршрут цілком" onClick={showWholeRoute} className={`route-map-control mg-press-subtle grid h-11 w-11 place-items-center rounded-full${activeSegmentId ? ' is-reset' : ''}`}><Navigation size={19}/></button>}
      <button type="button" aria-label={`Шар карти: ${mapLayers[mapLayer].label}. Перемкнути`} title={`Шар карти: ${mapLayers[mapLayer].label}`} onClick={() => {
        const next: MapLayer = mapLayer === 'simple' ? 'satellite' : 'simple';
        setCurrentMapLayer(next); setMapLayer(next);
      }} className="route-map-control mg-press-subtle grid h-11 w-11 place-items-center rounded-full"><Layers size={19}/></button>
    </div>

    {showChrome && scale && <div className="route-map-scale" style={{ left: 20, bottom: sheetHeight + chipHeight + 22 }} aria-hidden="true">
      <span>{scale.label}</span>
      <i style={{ width: scale.widthPx }}/>
    </div>}

    {showChrome && liveLeg && <div className="pointer-events-none absolute inset-x-0 z-10 mx-auto flex max-w-3xl justify-center px-4" style={{ bottom: sheetHeight + 10, transition: dragging ? 'none' : 'bottom var(--mg-dur-base) var(--mg-ease-entrance)' }}>
      <button type="button" onClick={() => chooseSegment(liveLeg.id)} aria-pressed={activeSegmentId === liveLeg.id} aria-label={activeSegmentId === liveLeg.id ? `${legLabel(liveLeg)} — натисніть, щоб показати весь маршрут` : `${legLabel(liveLeg)} — натисніть, щоб наблизити цей відрізок`} className="pointer-events-auto route-mode-chip mg-press-subtle flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left">
        <span className="route-mode-chip__icon grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: journeyModeColor(liveLeg.mode, liveLeg.transportType) }}>
          <TransportIcon mode={liveLeg.mode} transportType={liveLeg.transportType} size={19} strokeWidth={2.3}/>
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-black">{legLabel(liveLeg)}</span>
        {activeSegmentId === liveLeg.id
          ? <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--route-hover)] text-[var(--route-muted)]"><X size={15} strokeWidth={2.6}/></span>
          : liveSegment?.status === 'LIVE'
            ? <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-extrabold tabular-nums text-[var(--route-muted)]"><i aria-hidden="true" className="mg-live-dot mg-live-pulse inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"/>ЗА РУХОМ</span>
            : <span className="shrink-0 rounded-full px-2 py-1 text-xs font-extrabold tabular-nums text-[var(--route-muted)]">ЗА РОЗКЛАДОМ</span>}
      </button>
    </div>}

    <section
      ref={sheetElement}
      className="absolute inset-x-0 bottom-0 z-[var(--mg-z-sticky)] mx-auto flex max-w-3xl flex-col overflow-hidden rounded-t-[var(--mg-radius-3xl)] border border-[var(--route-border)] bg-[var(--route-sheet)] shadow-[var(--route-sheet-shadow)]"
      aria-label="Деталі маршруту"
      data-testid="route-bottom-sheet"
      data-sheet-state={sheetSnap}
      style={{ height: `${sheetHeight}px`, transition: dragging ? 'none' : `height var(--mg-dur-base) var(--mg-ease-entrance)`, paddingBottom: 'env(safe-area-inset-bottom)', background: 'linear-gradient(160deg,var(--route-sheet-start),var(--route-sheet-end))' }}
    >
      <button
        type="button"
        aria-label={sheetSnap === 'expanded' ? 'Згорнути деталі маршруту' : 'Розгорнути деталі маршруту'}
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
        aria-controls="route-sheet-content"
        aria-keyshortcuts="ArrowUp ArrowDown Home End"
        className="route-sheet-grabber flex h-11 w-full shrink-0 touch-none items-center justify-center"
      >
        <span className="route-sheet-grabber__handle h-1.5 w-12 rounded-full bg-[var(--route-grabber)]"/>
      </button>

      <div id="route-sheet-content" className="flex min-h-0 flex-1 flex-col">
        {sheetSnap === 'expanded' && <div className="route-details-head flex shrink-0 items-center gap-2 px-4 pb-1">
          <button type="button" aria-label="Назад до результатів" onClick={onBack} className="route-header-back mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-full">
            <ArrowLeft size={20}/>
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-[17px] font-black tracking-[-.02em]">Деталі маршруту</h2>
          <button type="button" aria-label="Поділитися маршрутом" onClick={shareRoute} className="route-header-icon mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-full">
            <Share2 size={19}/>
          </button>
          <button type="button" aria-label={saved ? 'Видалити маршрут зі збережених' : 'Зберегти маршрут'} aria-pressed={saved} onClick={toggleSaved} className="route-header-icon mg-press-subtle grid h-11 w-11 shrink-0 place-items-center rounded-full">
            <Heart size={21} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-rose-400' : ''}/>
          </button>
        </div>}
        {sheetSnap === 'expanded' && <p className="shrink-0 truncate px-5 pb-1 text-[13px] font-extrabold text-[var(--route-ink)]">
          {firstLeg?.origin.name ?? 'Початок'} <span aria-hidden="true" className="mx-0.5 text-[var(--route-muted)]">→</span> {lastLeg?.destination.name ?? 'Кінець'}
        </p>}
        <div className="route-sheet-summary flex shrink-0 items-center gap-3 px-5 py-2">
          <span className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
            <strong className="text-[24px] font-black leading-8 tracking-tight tabular-nums">{firstLeg ? formatTime(firstLeg.departureAt) : '—'} <span aria-hidden="true" className="text-[var(--route-muted)]">→</span> {lastLeg ? formatTime(lastLeg.arrivalAt) : '—'}</strong>
            <span data-testid="canonical-route-duration" className="truncate text-xs font-bold tabular-nums text-[var(--route-muted)]">{formatDuration(allDuration)} · {formatSegmentCount(journey.legs.length)}{journey.transfers > 0 ? ` · ${formatTransferCount(journey.transfers)}` : ''}</span>
          </span>
          <span data-testid="route-total-fare" className="flex shrink-0 flex-col items-end leading-tight">
            <strong aria-label={`Загальна вартість: ${totalPriceLabel === '—' ? 'невідома' : totalPriceLabel}`} className={`text-[17px] font-extrabold tabular-nums ${totalPriceLabel === '—' ? 'text-[var(--route-muted)]' : ''}`}>{priceSummary}</strong>
            {priceDisplay.cashOnly && totalPriceLabel !== '—' && <span className="text-xs font-bold text-[var(--route-muted)]">готівкою</span>}
          </span>
        </div>

        <div className="mg-route-ribbon shrink-0 px-4 pb-1" role="list" aria-label="Етапи маршруту">
          {ribbonItems.map(item => {
            const selected = activeSegmentId === item.id;
            const walk = item.leg.mode === 'WALK';
            return <div key={item.id} role="listitem" className={`mg-route-ribbon__item${activeSegmentId && !selected ? ' is-muted' : ''}`} style={{ flexGrow: Math.max(1, Math.round(item.durationSeconds / 60)) }}>
              <button type="button" onClick={() => chooseSegment(item.id)} aria-pressed={selected} aria-label={`Вибрати етап: ${item.label}, ${item.detail}`} className={`mg-route-ribbon__pill mg-press-subtle${selected ? ' is-active' : ''}`} style={{ backgroundColor: walk ? 'var(--route-ribbon-walk)' : item.color }}>
                <TransportIcon mode={item.leg.mode} transportType={item.leg.transportType} size={17} strokeWidth={2.4}/>
              </button>
              <span className="mg-route-ribbon__label">{item.label}</span>
              <span className="mg-route-ribbon__detail">{item.detail}</span>
            </div>;
          })}
        </div>

        {sheetSnap === 'expanded' && <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2" data-testid="route-segment-list">
          <ol className="space-y-2 pt-2">
            {timeline.map((item, index) => {
              if (item.kind === 'WAIT') return <li key={item.id} className="rounded-xl border border-[var(--route-border)] bg-[var(--route-card-alt)] px-3 py-2 text-xs text-[var(--route-muted)]">
                <span className="inline-flex items-center gap-2"><Clock3 size={14} className="text-[var(--route-subtle)]"/>Очікування · {formatDuration(item.durationSeconds)}</span>
              </li>;
              const leg = item.leg!;
              const color = item.color;
              const selected = activeSegmentId === leg.id;
              const scheduled = isScheduledRouteLeg(leg);
              const liveStatus = liveJourney?.segments.find(segment => segment.legId === leg.id)?.status === 'LIVE' ? 'LIVE' : leg.liveStatus;
              const expanded = expandedSegments.has(leg.id);
              const caveat = journeyLegCaveat(leg.mode, leg.source, leg.scheduleSemantics, leg.fareSource);
              const canBook = Boolean(leg.offerId) && leg.availabilityStatus !== 'UNAVAILABLE';
              const stops = leg.stops ?? [];
              const price = legPriceDisplay(leg);
              return <li
                key={leg.id}
                ref={node => setCardRef(leg.id, node)}
                data-testid="journey-route-segment"
                data-segment-id={leg.id}
                data-active={selected}
                className={`mg-rise mg-stagger mg-route-segment overflow-hidden rounded-[var(--mg-radius-lg)] border bg-[var(--route-card)] transition-[border-color,box-shadow,opacity] duration-[var(--mg-dur-fast)] ${selected ? 'border-[var(--mg-blue)] shadow-[0_0_0_1px_rgba(22,135,255,.45),0_0_24px_rgba(22,135,255,.16)]' : 'border-[var(--route-border)]'}`}
                style={{ borderLeftWidth: 4, borderLeftColor: color, opacity: activeSegmentId && !selected ? 0.68 : 1, ['--mg-stagger-i' as string]: index, ...(leg.mode === 'COMMUNITY' ? { backgroundColor: 'var(--route-community-surface)' } : {}) }}
              >
                <div className="flex items-start gap-2 p-2">
                  <button type="button" onClick={() => chooseSegment(leg.id)} aria-pressed={selected} aria-label={`Вибрати сегмент: ${legLabel(leg)}`} className="mg-press-subtle flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-[0_0_18px_color-mix(in_srgb,var(--segment-color)_48%,transparent)]" style={{ backgroundColor: color, ['--segment-color' as string]: color }}><TransportIcon mode={leg.mode} transportType={leg.transportType} size={19} strokeWidth={2.2}/></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <b className="text-sm font-extrabold">{leg.mode === 'COMMUNITY' ? 'Попутка · приватний автомобіль' : legLabel(leg)}</b>
                        {liveStatus && leg.mode !== 'WALK' && <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-extrabold ${liveStatus === 'LIVE' ? (isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-800') : 'bg-[var(--route-card-alt)] text-[var(--route-muted)]'}`}>{liveStatus === 'LIVE' && <span aria-hidden="true" className="mg-live-pulse inline-block h-2 w-2 rounded-full bg-emerald-400"/>}{liveStatus === 'LIVE' ? 'ЗА РУХОМ' : liveStatus === 'PREDICTED' ? 'ПРОГНОЗ' : liveStatus === 'SCHEDULED' && leg.scheduleSemantics === 'frequency_estimate' ? 'ІНТЕРВАЛ · ОЦІНКА' : liveStatus === 'SCHEDULED' ? 'РОЗКЛАД' : liveStatus === 'UNAVAILABLE' ? 'НЕДОСТУПНИЙ' : 'ДАНІ НЕ ПІДТВЕРДЖЕНІ'}</span>}
                      </span>
                      <span className="mt-1 block text-xs tabular-nums text-[var(--route-muted)]">{legTimeLabel(leg, item.durationSeconds)}{typeof leg.distanceMeters === 'number' && Number.isFinite(leg.distanceMeters) ? ` · ${formatJourneyDistance(leg.distanceMeters)}` : ''}{scheduled && stops.length ? ` · ${formatStopCount(stops.length)}` : ''}</span>
                      <span className="mt-1 block text-xs leading-4 text-[var(--route-subtle)]">{leg.mode === 'COMMUNITY' ? `Посадка: ${leg.origin.name} · висадка: ${leg.destination.name}` : `${leg.origin.name} → ${leg.destination.name}`}</span>
                      {caveat && <span className={`mt-1 block text-xs leading-4 ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>{caveat}</span>}
                      {scheduled && stops.length === 0 && <span className={`mt-1 block text-xs leading-4 ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>Перелік зупинок не надійшов від транспортного джерела.</span>}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <b className="text-xs tabular-nums" style={{ color: isDark ? color : 'var(--route-ink)' }}>{price.value}</b>
                    {price.caption && <span className="text-xs font-semibold text-[var(--route-muted)]">{price.caption}</span>}
                    {scheduled && <button type="button" aria-label={`${expanded ? 'Згорнути' : 'Розгорнути'} зупинки: ${journeyLegLabel(leg.mode, leg.transportType)}`} aria-expanded={expanded} onClick={() => toggleExpanded(leg.id)} className="mg-press-subtle grid h-11 w-11 place-items-center rounded-lg text-[var(--route-muted)] hover:bg-[var(--route-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]">
                      <ChevronDown size={17} className={`route-stops-chevron${expanded ? ' is-open' : ''}`}/>
                    </button>}
                  </div>
                </div>

                {scheduled && expanded && <div className="border-t border-[var(--route-border)] px-3 pb-3 pt-2">
                  {stops.length ? <ol aria-label={`Зупинки сегмента ${leg.routeName ?? journeyLegLabel(leg.mode, leg.transportType)}`} className="ml-1 border-l-2 pl-3">
                    {stops.map((stop, index) => {
                      const endpoint = index === 0 || index === stops.length - 1;
                      return <li key={`${stop.id}:${index}`} className="relative grid min-h-7 grid-cols-[44px_minmax(0,1fr)] gap-2 py-1 text-xs">
                        <span className="absolute -left-[1.05rem] top-[.55rem] h-2.5 w-2.5 rounded-full border-2 border-[var(--route-card)]" style={{ backgroundColor: color }}/>
                        <time className="tabular-nums text-[var(--route-subtle)]">{stopTime(stop, index, stops.length - 1)}</time>
                        <span className={endpoint ? 'font-extrabold text-[var(--route-ink)]' : stop.skipped ? 'text-[var(--route-subtle)] line-through decoration-rose-500/70' : 'text-[var(--route-muted)]'}>{stop.name}{stop.skipped ? <strong className="ml-1 text-rose-600 no-underline dark:text-rose-300">· ПРОПУСКАЄТЬСЯ</strong> : index === 0 ? <strong className="ml-1 text-[var(--mg-blue-ink)]">· ПОСАДКА</strong> : index === stops.length - 1 ? <strong className="ml-1 text-[var(--mg-blue-ink)]">· ВИСАДКА</strong> : null}</span>
                      </li>;
                    })}
                  </ol> : <p className="text-xs text-[var(--route-muted)]">Перевізник не надав список зупинок для цього рейсу.</p>}
                </div>}

                {leg.mode === 'COMMUNITY' && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--route-border)] px-3 py-2.5">
                  <span className="text-xs text-[var(--route-muted)]">{leg.availabilityStatus === 'AVAILABLE' ? 'Наявність перевірена під час пошуку' : 'Місця потрібно перевірити перед бронюванням'}</span>
                  {canBook && leg.offerId && onBookOffer && <button type="button" onClick={() => onBookOffer(leg.offerId!, journey.id, leg.id)} className="mg-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#8845E8] px-4 text-xs font-extrabold text-white shadow-[0_0_18px_rgba(168,85,247,.28)] hover:bg-[#9958F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Забронювати <span aria-hidden="true">→</span></button>}
                </div>}
              </li>;
            })}
          </ol>
        </div>}

        <div className="mt-auto shrink-0 px-4 pb-3 pt-2">
          {communityLeg?.offerId && onBookOffer && (() => {
            const communityPrice = legPriceDisplay(communityLeg).value;
            return <button type="button" onClick={() => onBookOffer(communityLeg.offerId!, journey.id, communityLeg.id)} className="mg-route-book mg-press-subtle mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-extrabold">
              Забронювати місце · {communityPrice}{communityPrice !== '—' && !communityPrice.includes('/ місце') ? ' / місце' : ''}
            </button>;
          })()}
          <button
            type="button"
            disabled={!canStartNavigation}
            onClick={() => onStartJourney?.()}
            className="mg-route-cta mg-press-subtle flex w-full items-center justify-center gap-3"
          >
            <Play size={20} fill="currentColor" aria-hidden="true"/>
            <span>{journey.legs.some(leg => leg.mode === 'COMMUNITY') ? 'Розпочати поїздку' : 'Розпочати'}</span>
          </button>
        </div>
      </div>
    </section>
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 z-40 flex justify-center px-6" style={{ bottom: 'calc(var(--route-map-inset) + 10px)', transition: dragging ? 'none' : 'bottom var(--mg-dur-base) var(--mg-ease-entrance)' }}>
      {feedback && <p key={feedback} role="status" className="route-toast max-w-full truncate rounded-full px-4 py-2.5 text-[12.5px] font-extrabold">{feedback}</p>}
    </div>
  </main>;
}
