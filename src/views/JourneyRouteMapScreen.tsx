import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Clock3, Layers, Navigation, Share2, Star,
} from 'lucide-react';
import { decodePolyline6 } from '../../shared/navigation/geometry';
import { MarshGoMap } from '../map/MarshGoMap';
import { buildJourneyRouteMapModel, journeyModeColor } from '../map/journeyRouteModel';
import type { LiveRideshareApproachRoute, MapAdapter, MapStatus, RouteFitPadding } from '../map/MapAdapter';
import { freshRideshareApproachRoute } from '../map/liveRideshareFeatures';
import { getMapLayer, mapLayers, setMapLayer, type MapLayer } from '../map/mapMode';
import { productionApi, type ApiJourney, type ApiJourneyLive, type ApiRendezvous } from '../services/productionApi';
import { journeyLegCanBeBooked } from '../domain/journeyBooking';
import { TransportIcon } from '../design-system/transport/TransportIcon';
import { CanonicalRouteLip } from '../design-system/journey/CanonicalRouteLip';
import type { JourneySegmentStripItem } from '../design-system/journey/JourneySegmentStrip';
import { routeBearingForHorizontalFit } from '../map/routeOrientation';
import { journeyLegCaveat, journeyLegLabel } from './journeyLegLabel';
import { formatJourneyLegPrice, formatJourneyTotalPrice } from './journeyResultPresentation';
import { routeSheetHeights, settleRouteSheetSnap, type RouteSheetSnap } from './routeSheet';
import { themeService } from '../services/theme';

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
  return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date(value));
};

type RendezvousSnapshot = { status: 'loading' | 'unavailable' } | { status: 'available'; session: ApiRendezvous };
type RideshareApproach = { status: 'calculating' | 'unavailable' } | { status: 'available'; route: LiveRideshareApproachRoute };
const terminalRendezvousStates = new Set(['CANCELLED', 'EXPIRED', 'COMPLETED']);

const formatDuration = (seconds: number) => {
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} год ${minutes % 60} хв` : `${minutes} хв`;
};

function formatRoadDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} км` : `${Math.round(meters / 50) * 50} м`;
}

function routeEndpointPresentation(value: string | undefined, fallback: string) {
  const full = value?.trim() || fallback;
  const parts = full.split(',').map(part => part.trim()).filter(Boolean);
  const streetIndex = parts.findIndex(part => /(вулиця|вул\.?|проспект|просп\.?|площа|пл\.?|провулок|пров\.?)/i.test(part));
  const street = streetIndex >= 0
    ? parts[streetIndex].replace(/\s+(?:вулиця|вул\.|проспект|просп\.|площа|пл\.|провулок|пров\.)$/i, '').trim()
    : '';
  const houseNumber = streetIndex >= 0
    ? [parts[streetIndex - 1], parts[streetIndex + 1]].find(part => Boolean(part && /^(?:№\s*)?\d+[а-яa-z]?(?:[-/]\d+[а-яa-z]?)?$/i.test(part)))
    : undefined;
  const administrative = /(район|област|громад|україна|\b\d{5}\b)/i;
  const context = parts.find((part, index) => index > Math.max(streetIndex, 0) && part !== houseNumber && !administrative.test(part));

  return {
    full,
    primary: street ? `${street}${houseNumber ? `, ${houseNumber.replace(/^№\s*/, '')}` : ''}` : parts[0] || fallback,
    context,
  };
}

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

function legPriceLabel(leg: JourneyLeg) {
  const fare = formatJourneyLegPrice(leg, leg.currency ?? 'UAH');
  return `${fare}${leg.mode === 'COMMUNITY' && fare !== '—' ? ' / місце' : ''}`;
}

function SegmentIcon({ leg }: { leg: JourneyLeg }) {
  return <TransportIcon mode={leg.mode} transportType={leg.transportType} size={20} strokeWidth={2.2}/>;
}

function stopTime(stop: NonNullable<JourneyLeg['stops']>[number], index: number, lastIndex: number) {
  return formatTime(index === 0 ? stop.departureAt : index === lastIndex ? stop.arrivalAt : stop.arrivalAt);
}

function RendezvousStatus({ snapshot, approach, isSelected, isDark }: { snapshot?: RendezvousSnapshot; approach?: RideshareApproach; isSelected: boolean; isDark: boolean }) {
  let message = 'Завантажуємо стан GPS бронювання…';
  let detail = 'Позиція доступна лише учасникам підтвердженої поїздки.';
  let stale = false;
  if (snapshot?.status === 'unavailable') {
    message = 'Онлайн-стан зустрічі тимчасово недоступний.';
    detail = 'Збережений маршрут і бронювання залишаються доступними.';
  } else if (snapshot?.status === 'available') {
    const session = snapshot.session;
    if (terminalRendezvousStates.has(session.state)) {
      message = session.state === 'CANCELLED' ? 'Обмін місцем завершено.' : session.state === 'EXPIRED' ? 'Час онлайн-зустрічі минув.' : 'Зустріч завершена.';
      detail = 'Поточне відстеження вимкнено.';
    } else if (!session.locationSharingEnabled) {
      message = 'Водій ще не ввімкнув короткочасний обмін місцем.';
      detail = 'Точні координати не показуються.';
    } else if (session.currentParticipant !== 'passenger') {
      message = 'Позиція водія доступна пасажиру цього бронювання.';
      detail = 'Ця сесія не показує власну позицію водія як окрему ціль.';
    } else if (!session.locations.driver) {
      message = 'Очікуємо перше GPS-оновлення водія.';
      detail = 'ETA за дорожнім маршрутом недоступний.';
    } else {
      const driver = session.locations.driver;
      stale = driver.freshness !== 'LIVE';
      message = stale ? 'Остання відома позиція водія застаріла.' : 'GPS водія оновлено ' + formatTime(driver.capturedAt) + '.';
      const currentApproach = approach?.status === 'available'
        && approach.route.vehicleCapturedAt === driver.capturedAt
        && driver.accuracyMeters <= 100
        && freshRideshareApproachRoute(approach.route);
      const routeDetail = stale || driver.accuracyMeters > 100
        ? 'ETA за дорожнім маршрутом недоступний.'
        : currentApproach
          ? `Орієнтовно ${formatDuration(currentApproach.durationSeconds)} · ${formatRoadDistance(currentApproach.distanceMeters)} (OSRM, без live-трафіку).`
          : approach?.status === 'calculating'
            ? 'Розраховуємо дорогу до точки посадки…'
            : 'ETA за дорожнім маршрутом недоступний.';
      detail = `Точність GPS ±${Math.round(driver.accuracyMeters)} м · ${routeDetail}${isSelected ? '' : ' Виберіть сегмент «Попутка», щоб показати позицію на карті.'}`;
    }
  }
  return <div data-testid="journey-rendezvous-status" role="status" className={`border-t border-[var(--route-border)] px-3 py-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
    <b className={`block text-[10px] ${stale ? (isDark ? 'text-amber-200' : 'text-amber-800') : ''}`}>{message}</b>
    <span className="mt-0.5 block text-[9px] leading-4 text-[var(--route-subtle)]">{detail}</span>
  </div>;
}

export function JourneyRouteMapScreen({
  journey,
  onBack,
  onBookOffer,
  onNavigate,
}: {
  journey: ApiJourney;
  onBack: () => void;
  onBookOffer?: (offerId: string, journeyId: string, journeyLegId: string) => void;
  onNavigate?: (destination: { label: string; latitude: number; longitude: number }) => void;
}) {
  const model = useMemo(() => buildJourneyRouteMapModel(journey.legs), [journey.legs]);
  const timeline = useMemo(() => timelineFor(journey), [journey]);
  const firstLeg = journey.legs[0];
  const lastLeg = journey.legs.at(-1);
  const originPresentation = routeEndpointPresentation(journey.origin?.name ?? firstLeg?.origin.name, 'Початок');
  const destinationPresentation = routeEndpointPresentation(journey.destination?.name ?? lastLeg?.destination.name, 'Кінець');
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [isDark, setIsDark] = useState(themeService.isDark());
  const [mapLayer, setCurrentMapLayer] = useState<MapLayer>(getMapLayer);
  const [sheetSnap, setSheetSnap] = useState<RouteSheetSnap>('half');
  const [sheetHeight, setSheetHeight] = useState(() => typeof window === 'undefined' ? 560 : routeSheetHeights(window.innerHeight).half);
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === 'undefined' ? 844 : window.innerHeight);
  const [dragging, setDragging] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [liveJourney, setLiveJourney] = useState<ApiJourneyLive | null>(null);
  const [rendezvousByLegId, setRendezvousByLegId] = useState<Record<string, RendezvousSnapshot>>({});
  const [approachByLegId, setApproachByLegId] = useState<Record<string, RideshareApproach>>({});
  const [mapAdapterReady, setMapAdapterReady] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(() => new Set());
  const [saved, setSaved] = useState(() => {
    try { return (JSON.parse(window.localStorage.getItem('marshgo.saved-route-results.v1') ?? '[]') as unknown[]).includes(journey.id); }
    catch { return false; }
  });
  const [feedback, setFeedback] = useState('');
  const sheetElement = useRef<HTMLElement | null>(null);
  const sheetHeightRef = useRef(sheetHeight);
  const mapAdapter = useRef<MapAdapter | null>(null);
  const lastRideshareFocusKey = useRef('');
  const lastApproachRequestAt = useRef(new Map<string, number>());
  const segmentCards = useRef(new Map<string, HTMLElement>());
  const dragStart = useRef<{ y: number; height: number; pointerId: number; moved: boolean; lastY: number; lastAt: number; velocity: number } | null>(null);
  const suppressHandleClick = useRef(false);

  useEffect(() => themeService.subscribe((_theme, dark) => setIsDark(dark)), []);

  useEffect(() => {
    if (!journey.legs.some(isScheduledRouteLeg)) { setLiveJourney(null); return; }
    let stopped = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    const poll = async () => {
      const now = Date.now();
      const transitLegs = journey.legs.filter(isScheduledRouteLeg);
      const inGpsWindow = transitLegs.some(leg => {
        const departure = Date.parse(leg.departureAt);
        const arrival = Date.parse(leg.arrivalAt);
        return Number.isFinite(departure) && Number.isFinite(arrival) && now >= departure - 5 * 60_000 && now <= arrival + 10 * 60_000;
      });
      if (!inGpsWindow && !['ACTIVE', 'TRANSFER'].includes(journey.state)) {
        setLiveJourney(null);
        if (!stopped) timer = window.setTimeout(() => void poll(), 60_000);
        return;
      }
      controller = new AbortController();
      try {
        const live = await productionApi.journeyLive(journey.id, controller.signal);
        if (!stopped) setLiveJourney(live);
      } catch {
        if (!stopped) setLiveJourney(null);
      } finally {
        if (!stopped) timer = window.setTimeout(() => void poll(), 15_000);
      }
    };
    void poll();
    return () => { stopped = true; controller?.abort(); if (timer !== undefined) window.clearTimeout(timer); };
  }, [journey.id, journey.legs, journey.state]);

  useEffect(() => {
    const bookedCommunityLegs = journey.legs.filter((leg) => leg.mode === 'COMMUNITY' && leg.bookingId);
    if (!bookedCommunityLegs.length) { setRendezvousByLegId({}); return; }
    let stopped = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    const poll = async () => {
      if (document.visibilityState === 'hidden') {
        if (!stopped) timer = window.setTimeout(() => void poll(), 60_000);
        return;
      }
      controller = new AbortController();
      const bookings = [...new Set(bookedCommunityLegs.flatMap((leg) => leg.bookingId ? [leg.bookingId] : []))];
      const snapshots: Array<[string, RendezvousSnapshot]> = await Promise.all(bookings.map(async (bookingId) => {
        try { return [bookingId, { status: 'available', session: await productionApi.bookingRendezvous(bookingId, controller?.signal) } as RendezvousSnapshot]; }
        catch { return [bookingId, { status: 'unavailable' } as RendezvousSnapshot]; }
      }));
      if (stopped) return;
      const byBooking = new Map(snapshots);
      const next = Object.fromEntries(bookedCommunityLegs.flatMap((leg) => {
        const snapshot = leg.bookingId ? byBooking.get(leg.bookingId) : undefined;
        return snapshot ? [[leg.id, snapshot]] : [];
      }));
      setRendezvousByLegId(next);
      const hasOpenSession = snapshots.some(([, snapshot]) => snapshot.status !== 'available' || !terminalRendezvousStates.has(snapshot.session.state));
      if (hasOpenSession && !stopped) timer = window.setTimeout(() => void poll(), 15_000);
    };
    void poll();
    return () => { stopped = true; controller?.abort(); if (timer !== undefined) window.clearTimeout(timer); };
  }, [journey.id, journey.legs]);

  useEffect(() => {
    if (!mapAdapterReady) return;
    const positions = (liveJourney?.segments.filter(segment => segment.status === 'LIVE' && segment.vehicle) ?? [])
      .flatMap((segment, index) => {
        const leg = journey.legs.find(item => item.id === segment.legId);
        if (!segment.vehicle || !leg) return [];
        return [{
          id: segment.legId,
          coordinates: segment.vehicle.coordinates,
          color: journeyModeColor(leg.mode, leg.transportType),
          label: segment.vehicle.route || journeyLegLabel(leg.mode, leg.transportType),
          updatedAt: segment.vehicle.updatedAt,
          selected: activeSegmentId ? activeSegmentId === segment.legId : index === 0,
        }];
      });
    if (mapAdapter.current?.setLiveTransitPositions) mapAdapter.current.setLiveTransitPositions(positions);
    else mapAdapter.current?.setLiveTransitPosition?.(positions[0] ?? null);
  }, [activeSegmentId, journey.legs, liveJourney, mapAdapterReady]);

  useEffect(() => {
    if (!mapAdapterReady) return;
    const selectedLeg = journey.legs.find((leg) => leg.id === activeSegmentId && leg.mode === 'COMMUNITY');
    if (!selectedLeg) {
      lastRideshareFocusKey.current = '';
      mapAdapter.current?.setLiveRidesharePositions?.([]);
      mapAdapter.current?.setLiveRideshareApproachRoute?.(null);
      return;
    }
    const snapshot = rendezvousByLegId[selectedLeg.id];
    if (snapshot?.status !== 'available') {
      mapAdapter.current?.setLiveRidesharePositions?.([]);
      mapAdapter.current?.setLiveRideshareApproachRoute?.(null);
      return;
    }
    const session = snapshot.session;
    if (!session.locationSharingEnabled || session.currentParticipant !== 'passenger' || terminalRendezvousStates.has(session.state)) {
      lastRideshareFocusKey.current = '';
      mapAdapter.current?.setLiveRidesharePositions?.([]);
      mapAdapter.current?.setLiveRideshareApproachRoute?.(null);
      return;
    }
    const driver = session.locations.driver;
    const positions = driver ? [{ id: session.id, coordinates: driver.coordinates, capturedAt: driver.capturedAt, freshness: driver.freshness }] : [];
    mapAdapter.current?.setLiveRidesharePositions?.(positions);
    const approach = driver?.freshness === 'LIVE' && driver.accuracyMeters <= 100 ? approachByLegId[selectedLeg.id] : null;
    mapAdapter.current?.setLiveRideshareApproachRoute?.(
      approach?.status === 'available' && approach.route.vehicleCapturedAt === driver?.capturedAt ? approach.route : null,
    );
    if (driver) {
      const focusKey = `${journey.id}:${selectedLeg.id}`;
      if (lastRideshareFocusKey.current !== focusKey) {
        lastRideshareFocusKey.current = focusKey;
        mapAdapter.current?.focusCoordinates?.([driver.coordinates, session.pickup.coordinates], {
          top: 84, right: 48, bottom: Math.max(180, sheetHeight + 28), left: 32,
        }, 15);
      }
    } else lastRideshareFocusKey.current = '';
  }, [activeSegmentId, approachByLegId, journey.id, journey.legs, mapAdapterReady, rendezvousByLegId, sheetHeight]);

  useEffect(() => {
    if (!mapAdapterReady) return;
    const selectedLeg = journey.legs.find((leg) => leg.id === activeSegmentId && leg.mode === 'COMMUNITY');
    if (!selectedLeg) return;
    const snapshot = rendezvousByLegId[selectedLeg.id];
    if (snapshot?.status !== 'available') return;
    const session = snapshot.session;
    if (!session.locationSharingEnabled || session.currentParticipant !== 'passenger' || terminalRendezvousStates.has(session.state)) return;
    const driver = session.locations.driver;
    if (!driver || driver.freshness !== 'LIVE' || driver.accuracyMeters > 100) return;
    const fixAge = Date.now() - Date.parse(driver.capturedAt);
    if (!Number.isFinite(fixAge) || fixAge < -30_000 || fixAge > 90_000) return;

    const legId = selectedLeg.id;
    const requestFix = `${session.id}:${driver.capturedAt}`;
    const now = Date.now();
    const lastRequestAt = lastApproachRequestAt.current.get(legId) ?? 0;
    if (now - lastRequestAt < 30_000) return;
    lastApproachRequestAt.current.set(legId, now);
    setApproachByLegId((current) => ({ ...current, [legId]: { status: 'calculating' } }));

    const controller = new AbortController();
    void productionApi.calculateRoute({
      requestId: `rendezvous:${requestFix}`,
      origin: driver.coordinates,
      destination: session.pickup.coordinates,
      profile: { mode: 'CAR' },
    }, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      const route = freshRideshareApproachRoute({
        id: session.id,
        coordinates: decodePolyline6(result.geometry.value),
        vehicleCapturedAt: driver.capturedAt,
        calculatedAt: result.calculatedAt,
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
        provider: result.provider,
      });
      setApproachByLegId((current) => ({ ...current, [legId]: route ? { status: 'available', route } : { status: 'unavailable' } }));
    }).catch(() => {
      if (!controller.signal.aborted) setApproachByLegId((current) => ({ ...current, [legId]: { status: 'unavailable' } }));
    });
    return () => controller.abort();
  }, [activeSegmentId, journey.legs, mapAdapterReady, rendezvousByLegId]);

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

  const routeBearing = useMemo(() => {
    if (sheetSnap !== 'expanded') return 0;
    if (activeSegmentId) {
      const selected = model.routeSegments.find(segment => segment.id === activeSegmentId);
      if (selected?.coordinates.length) return routeBearingForHorizontalFit(selected.coordinates);
      const leg = journey.legs.find(item => item.id === activeSegmentId);
      const coordinates = [leg?.origin.coordinates, ...(leg?.stops?.map(stop => stop.coordinates) ?? []), leg?.destination.coordinates]
        .filter((point): point is [number, number] => Boolean(point && point.length === 2 && point.every(Number.isFinite)));
      return routeBearingForHorizontalFit(coordinates);
    }
    return routeBearingForHorizontalFit(model.routeWaypoints.map(point => point.coordinate));
  }, [activeSegmentId, journey.legs, model.routeSegments, model.routeWaypoints, sheetSnap]);

  const mapPadding = useMemo<RouteFitPadding>(() => ({
    top: 72,
    left: 22,
    right: 22,
    // The sheet overlays a full-screen map. Reserve its complete height so
    // the route fits in the visible map area above it, including at half and
    // expanded snap points.
    bottom: sheetHeight + 8,
    bearing: routeBearing,
  }), [routeBearing, sheetHeight]);

  const chooseSegment = useCallback((id: string, expandForDetails = true) => {
    const leg = journey.legs.find(item => item.id === id);
    if (!leg) return;
    setActiveSegmentId(id);
    if (sheetSnap === 'collapsed') {
      setSheetSnap('half');
      const nextHeight = snapHeight('half');
      sheetHeightRef.current = nextHeight;
      setSheetHeight(nextHeight);
    }
    if (expandForDetails && isScheduledRouteLeg(leg)) {
      setExpandedSegments(current => new Set(current).add(id));
    }
    requestAnimationFrame(() => segmentCards.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }, [journey.legs, sheetSnap, snapHeight]);

  useEffect(() => {
    if (dragging) return;
    if (!activeSegmentId) {
      mapAdapter.current?.fitRoute(mapPadding);
      return;
    }
    mapAdapter.current?.setActiveRouteSegment?.(activeSegmentId);
    const focused = mapAdapter.current?.focusRouteSegment?.(activeSegmentId, mapPadding) ?? false;
    if (focused) return;
    const leg = journey.legs.find(item => item.id === activeSegmentId);
    const points = [leg?.origin.coordinates, ...(leg?.stops?.map(stop => stop.coordinates) ?? []), leg?.destination.coordinates]
      .filter((point): point is [number, number] => Boolean(point && point.length === 2 && point.every(Number.isFinite)));
    if (points.length) mapAdapter.current?.focusCoordinates?.(points, mapPadding, leg?.mode === 'RAIL' ? 10 : 14);
    else mapAdapter.current?.fitRoute(mapPadding);
  }, [activeSegmentId, dragging, journey.legs, mapPadding]);

  useEffect(() => {
    if (sheetSnap === 'expanded') setExpandedSegments(new Set(journey.legs.filter(isScheduledRouteLeg).map(leg => leg.id)));
  }, [sheetSnap, journey.legs]);

  const hasMeasuredDistance = (leg: JourneyLeg): leg is JourneyLeg & { distanceMeters: number } => typeof leg.distanceMeters === 'number'
    && Number.isFinite(leg.distanceMeters) && leg.distanceMeters >= 0;
  const knownDistance = journey.legs.reduce((sum, leg) => sum + (hasMeasuredDistance(leg) ? leg.distanceMeters : 0), 0);
  const completeDistance = journey.legs.length > 0 && journey.legs.every(hasMeasuredDistance);
  const distanceSummary = completeDistance
    ? `${(knownDistance / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км`
    : knownDistance > 0 ? `Відомо ${(knownDistance / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км`
      : 'Відстань не вказана';
  const stripItems: JourneySegmentStripItem[] = timeline.flatMap(item => {
    if (item.kind !== 'LEG' || !item.leg) return [];
    const leg = item.leg;
    return [{
      id: leg.id,
      mode: leg.mode,
      transportType: leg.transportType,
      label: leg.mode === 'COMMUNITY' ? 'Попутка' : journeyLegLabel(leg.mode, leg.transportType),
      selectionLabel: (leg.mode === 'COMMUNITY' ? 'Попутка' : journeyLegLabel(leg.mode, leg.transportType)) + (leg.routeName ? ' ' + leg.routeName : ''),
      accessibilityLabel: (leg.mode === 'COMMUNITY' ? 'Попутка' : journeyLegLabel(leg.mode, leg.transportType)) + (leg.routeName ? ', маршрут ' + leg.routeName : '') + ', ' + formatDuration(item.durationSeconds) + ', ' + legPriceLabel(leg),
      durationSeconds: item.durationSeconds,
      durationLabel: formatDuration(item.durationSeconds),
      priceLabel: legPriceLabel(leg),
      color: item.color,
    }];
  });
  const waitingSeconds = timeline.filter(item => item.kind === 'WAIT').reduce((sum, item) => sum + item.durationSeconds, 0);
  const missingShapes = model.missingShapeCount;
  const approximateWalkCount = model.approximateWalkCount;
  const mapStatusText = mapStatus === 'failed' ? 'Карта недоступна' : mapStatus === 'degraded' ? 'Карта завантажена частково'
    : mapStatus === 'unconfigured' ? 'Потрібне налаштування карти' : missingShapes > 0 ? 'Є сегменти без геометрії джерела'
      : approximateWalkCount > 0 ? 'Пунктиром позначені орієнтовні піші відрізки' : 'Маршрут на карті';

  const heightForSnap = (snap: RouteSheetSnap) => snapHeight(snap);
  const moveToSnap = (next: RouteSheetSnap) => {
    const nextHeight = heightForSnap(next);
    sheetHeightRef.current = nextHeight;
    setSheetSnap(next);
    setSheetHeight(nextHeight);
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
      // A new gesture may begin while the previous snap animation is running.
      // Start from the visible position so the sheet follows the finger without a jump.
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
      // Keep a React commit between pointer events from restoring the snap
      // transition while the finger is still moving. WebKit can otherwise
      // animate each intermediate height and visibly lag behind the gesture.
      sheetElement.current.style.transition = 'none';
      sheetElement.current.style.height = `${nextHeight}px`;
    }
  };
  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (start.moved) {
      const heights = routeSheetHeights(viewportHeight);
      const next = settleRouteSheetSnap(sheetHeightRef.current, start.velocity, heights);
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

  const toggleSaved = (nextSaved = !saved) => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem('marshgo.saved-route-results.v1') ?? '[]') as unknown;
      const ids = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
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

  return <main className="route-map-screen fixed inset-0 z-[80] overflow-hidden text-[var(--route-ink)]" data-theme={isDark ? 'dark' : 'light'} data-route-camera-bearing={routeBearing.toFixed(2)} aria-label="Побудований маршрут">
    <div className="absolute inset-0" data-testid="journey-route-map">
      <MarshGoMap
        route={[]}
        routeSegments={model.routeSegments}
        routeWaypoints={model.routeWaypoints}
        routeFitPadding={mapPadding}
        theme={isDark ? 'MARSHGO_DARK' : 'MARSHGO_LIGHT'}
        onStatus={setMapStatus}
        onAdapter={adapter => { mapAdapter.current = adapter; setMapAdapterReady(Boolean(adapter)); if (adapter) { adapter.setActiveRouteSegment?.(activeSegmentId); } }}
        activeRouteSegmentId={activeSegmentId}
        onRouteSegmentSelect={id => chooseSegment(id)}
      />
    </div>

    <header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-3xl items-start justify-between gap-3 px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))]">
      <button type="button" aria-label="Назад до результатів" onClick={onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--route-border)] bg-[var(--route-floating)] text-[var(--route-ink)] shadow-lg backdrop-blur">
        <ArrowLeft size={20}/>
      </button>
      <div className="flex shrink-0 gap-2">
        <button type="button" aria-label="Показати маршрут цілком" title="Показати маршрут цілком" onClick={() => mapAdapter.current?.fitRoute(mapPadding)} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--route-border)] bg-[var(--route-floating)] text-[#1687FF] shadow-lg backdrop-blur"><Navigation size={19}/></button>
        <button type="button" aria-label={`Шар карти: ${mapLayers[mapLayer].label}. Перемкнути`} title={`Шар карти: ${mapLayers[mapLayer].label}`} onClick={() => {
          const next: MapLayer = mapLayer === 'simple' ? 'satellite' : 'simple';
          setCurrentMapLayer(next); setMapLayer(next);
        }} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--route-border)] bg-[var(--route-floating)] text-[var(--route-ink)] shadow-lg backdrop-blur"><Layers size={19}/></button>
      </div>
    </header>

    <section
      ref={sheetElement}
      className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--route-border)] bg-[var(--route-sheet)] shadow-[var(--route-sheet-shadow)]"
      aria-label="Деталі маршруту"
      data-testid="route-bottom-sheet"
      data-sheet-state={sheetSnap}
      style={{ height: `${sheetHeight}px`, transition: dragging ? 'none' : 'height 280ms cubic-bezier(.2,.8,.2,1)', paddingBottom: 'env(safe-area-inset-bottom)', background: 'linear-gradient(155deg,var(--route-sheet-start),var(--route-sheet-end))' }}
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
          if (event.key === 'ArrowUp') { event.preventDefault(); setSheetSnap('expanded'); setSheetHeight(heightForSnap('expanded')); }
          if (event.key === 'ArrowDown') { event.preventDefault(); setSheetSnap('collapsed'); setSheetHeight(heightForSnap('collapsed')); }
          if (event.key === 'Home') { event.preventDefault(); setSheetSnap('collapsed'); setSheetHeight(heightForSnap('collapsed')); }
          if (event.key === 'End') { event.preventDefault(); setSheetSnap('expanded'); setSheetHeight(heightForSnap('expanded')); }
        }}
        aria-controls="route-segment-list"
        aria-keyshortcuts="ArrowUp ArrowDown Home End"
        className="route-sheet-grabber flex h-11 w-full shrink-0 touch-none items-center justify-center"
      >
        <span className="h-1.5 w-12 rounded-full bg-[var(--route-grabber)]"/>
      </button>

      <div className={`route-sheet-summary shrink-0 px-3 pb-2${sheetSnap === 'collapsed' ? ' route-sheet-summary--compact' : ''}`}>
        <div className="px-3 py-2">
          <p className="route-summary-eyebrow text-[9px] font-extrabold uppercase tracking-[.12em] text-[#1687FF]">Деталі маршруту</p>
          <div className="route-endpoints mt-2" role="group" aria-label={`Звідки: ${originPresentation.full}. Куди: ${destinationPresentation.full}.`}>
            <div className="route-endpoint" title={originPresentation.full}>
              <span className="route-endpoint-marker route-endpoint-marker--origin" aria-hidden="true"/>
              <span className="route-endpoint-copy">
                <span className="route-endpoint-kicker">ЗВІДКИ</span>
                <strong className="route-endpoint-name">{originPresentation.primary}</strong>
                {originPresentation.context && <span className="route-endpoint-context">{originPresentation.context}</span>}
              </span>
            </div>
            <ArrowRight className="route-endpoints-arrow" size={17} aria-hidden="true"/>
            <div className="route-endpoint route-endpoint--destination" title={destinationPresentation.full}>
              <span className="route-endpoint-marker route-endpoint-marker--destination" aria-hidden="true"/>
              <span className="route-endpoint-copy">
                <span className="route-endpoint-kicker">КУДИ</span>
                <strong className="route-endpoint-name">{destinationPresentation.primary}</strong>
                {destinationPresentation.context && <span className="route-endpoint-context">{destinationPresentation.context}</span>}
              </span>
            </div>
          </div>
          <CanonicalRouteLip
            journeyId={journey.id}
            totalDurationSeconds={journey.totalDurationSeconds}
            totalPriceMinor={journey.confirmedPriceMinor ?? journey.totalPriceMinor}
            currency={journey.currency}
            priceStatus={journey.confirmedPriceMinor !== null ? 'LOCKED' : journey.priceStatus}
            hasUnknownPrice={formatJourneyTotalPrice(journey) === '—'}
            transferCount={journey.transfers}
            strategy={journey.strategy}
            segments={stripItems}
            selectedSegmentId={activeSegmentId}
            favorite={saved}
            availabilityStatus={journey.state}
            actionLabel={sheetSnap === 'expanded' ? 'Згорнути панель до карти' : sheetSnap === 'half' ? 'Розгорнути панель повністю' : 'Показати деталі маршруту'}
            actionExpanded={sheetSnap !== 'collapsed'}
            onSegmentSelect={chooseSegment}
            onOpenDetails={cycleSheet}
            onFavoriteChange={toggleSaved}
          />
          <p className="mt-1 text-right text-[9px] font-semibold text-[var(--route-muted)]">{distanceSummary}{waitingSeconds > 0 ? ' · очікування ' + formatDuration(waitingSeconds) : ''}</p>
          {(mapStatus === 'failed' || mapStatus === 'degraded' || mapStatus === 'unconfigured' || missingShapes > 0 || approximateWalkCount > 0) && <p role="status" className={`mt-1 text-[9px] font-semibold ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>{mapStatusText}</p>}
          {!stripItems.length && <p className="mt-2 text-xs text-[var(--route-muted)]">Дані сегментів цього маршруту не надійшли.</p>}
          <span className="sr-only">Загальна відстань: {distanceSummary}. Виїзд {firstLeg ? formatTime(firstLeg.departureAt) : '—'}, прибуття {lastLeg ? formatTime(lastLeg.arrivalAt) : '—'}. Кольорова смуга пропорційна тривалості транспортних сегментів; очікування показане окремо.</span>
        </div>
      </div>

      {sheetSnap !== 'collapsed' && <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3" data-testid="route-segment-list">
        <ol className="space-y-2">
          {timeline.map(item => {
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
            const canBook = journeyLegCanBeBooked(leg);
            const stops = leg.stops ?? [];
            return <li
              key={leg.id}
              ref={node => setCardRef(leg.id, node)}
              data-testid="journey-route-segment"
              data-segment-id={leg.id}
              data-active={selected}
              className={`overflow-hidden rounded-[1rem] border bg-[var(--route-card)] transition-[border-color,box-shadow,opacity] duration-200 ${selected ? 'border-[#7CBFFF] shadow-[0_0_0_1px_rgba(22,135,255,.45),0_0_24px_rgba(22,135,255,.16)]' : 'border-[var(--route-border)]'}`}
              style={{ borderLeftWidth: 4, borderLeftColor: color, opacity: activeSegmentId && !selected ? 0.68 : 1, ...(leg.mode === 'COMMUNITY' ? { backgroundColor: 'var(--route-community-surface)' } : {}) }}
            >
              <div className="flex items-start gap-2 p-2">
                <button type="button" onClick={() => chooseSegment(leg.id)} aria-pressed={selected} aria-label={`Вибрати сегмент: ${journeyLegLabel(leg.mode, leg.transportType)}${leg.routeName ? ` ${leg.routeName}` : ''}`} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1687FF]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-[0_0_18px_color-mix(in_srgb,var(--segment-color)_48%,transparent)]" style={{ backgroundColor: color, ['--segment-color' as string]: color }}><SegmentIcon leg={leg}/></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <b className="text-sm font-extrabold">{leg.mode === 'COMMUNITY' ? 'Попутка · приватний автомобіль' : `${journeyLegLabel(leg.mode, leg.transportType)}${leg.routeName ? ` ${leg.routeName}` : ''}`}</b>
                      {liveStatus && <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-extrabold ${liveStatus === 'LIVE' ? (isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-800') : 'bg-[var(--route-card-alt)] text-[var(--route-muted)]'}`}>{liveStatus === 'LIVE' ? 'LIVE' : liveStatus === 'PREDICTED' ? 'ПРОГНОЗ' : liveStatus === 'SCHEDULED' && leg.scheduleSemantics === 'frequency_estimate' ? 'ІНТЕРВАЛ · ОЦІНКА' : liveStatus === 'SCHEDULED' ? 'РОЗКЛАД' : liveStatus === 'UNAVAILABLE' ? 'НЕДОСТУПНИЙ' : 'ДАНІ НЕ ПІДТВЕРДЖЕНІ'}</span>}
                    </span>
                    <span className="mt-1 block text-[11px] tabular-nums text-[var(--route-muted)]">{formatTime(leg.departureAt)}–{formatTime(leg.arrivalAt)} · {formatDuration(item.durationSeconds)}{hasMeasuredDistance(leg) ? ` · ${(leg.distanceMeters / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км` : ''}</span>
                    <span className="mt-1 block text-[10px] leading-4 text-[var(--route-subtle)]">{leg.mode === 'COMMUNITY' ? `Посадка: ${leg.origin.name} · висадка: ${leg.destination.name}` : `${leg.origin.name} → ${leg.destination.name}`}</span>
                    {caveat && <span className={`mt-1 block text-[9px] leading-4 ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>{caveat}</span>}
                    {scheduled && stops.length === 0 && <span className={`mt-1 block text-[9px] leading-4 ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>Перелік зупинок не надійшов від транспортного джерела.</span>}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <b className="text-xs tabular-nums" style={{ color: isDark ? color : '#14243B' }}>{legPriceLabel(leg)}</b>
                  {scheduled && <button type="button" aria-label={`${expanded ? 'Згорнути' : 'Розгорнути'} зупинки: ${journeyLegLabel(leg.mode, leg.transportType)}`} aria-expanded={expanded} onClick={() => toggleExpanded(leg.id)} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--route-muted)] hover:bg-[var(--route-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1687FF]">
                    {expanded ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
                  </button>}
                </div>
              </div>

              {scheduled && expanded && <div className="border-t border-[var(--route-border)] px-3 pb-3 pt-2">
                {stops.length ? <ol aria-label={`Зупинки сегмента ${leg.routeName ?? journeyLegLabel(leg.mode, leg.transportType)}`} className="ml-1 border-l-2 pl-3">
                  {stops.map((stop, index) => {
                    const endpoint = index === 0 || index === stops.length - 1;
                    return <li key={`${stop.id}:${index}`} className="relative grid min-h-7 grid-cols-[44px_minmax(0,1fr)] gap-2 py-1 text-[10px]">
                      <span className="absolute -left-[1.05rem] top-[.55rem] h-2.5 w-2.5 rounded-full border-2 border-[var(--route-card)]" style={{ backgroundColor: color }}/>
                      <time className="tabular-nums text-[var(--route-subtle)]">{stopTime(stop, index, stops.length - 1)}</time>
                      <span className={endpoint ? 'font-extrabold text-[var(--route-ink)]' : stop.skipped ? 'text-[var(--route-subtle)] line-through decoration-rose-500/70' : 'text-[var(--route-muted)]'}>{stop.name}{stop.skipped ? <strong className="ml-1 text-rose-600 no-underline dark:text-rose-300">· ПРОПУСКАЄТЬСЯ</strong> : index === 0 ? <strong className="ml-1 text-[#1687FF]">· ПОСАДКА</strong> : index === stops.length - 1 ? <strong className="ml-1 text-[#1687FF]">· ВИСАДКА</strong> : null}</span>
                    </li>;
                  })}
                </ol> : <p className="text-[10px] text-[var(--route-muted)]">Перевізник не надав список зупинок для цього рейсу.</p>}
              </div>}

              {leg.mode === 'COMMUNITY' && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--route-border)] px-3 py-2.5">
                <span className="text-[10px] text-[var(--route-muted)]">{leg.bookingId ? 'Бронювання прив’язане до цього маршруту' : leg.availabilityStatus === 'AVAILABLE' ? 'Наявність перевірена під час пошуку' : 'Місця потрібно перевірити перед бронюванням'}</span>
                {canBook && leg.offerId && onBookOffer && <button type="button" onClick={() => onBookOffer(leg.offerId!, journey.id, leg.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#8845E8] px-4 text-xs font-extrabold text-white shadow-[0_0_18px_rgba(168,85,247,.28)] hover:bg-[#9958F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Забронювати <span aria-hidden="true">→</span></button>}
              </div>}
              {leg.mode === 'COMMUNITY' && leg.bookingId && <RendezvousStatus snapshot={rendezvousByLegId[leg.id]} approach={approachByLegId[leg.id]} isSelected={selected} isDark={isDark}/>}
            </li>;
          })}
        </ol>

        {missingShapes > 0 && <p className={`mt-2 rounded-xl border px-3 py-2 text-[10px] leading-4 ${isDark ? 'border-amber-300/20 bg-amber-300/5 text-amber-100' : 'border-amber-700/20 bg-amber-50 text-amber-900'}`}>
          {missingShapes} сегм. без геометрії перевізника. Їх не з’єднуємо прямими лініями; карта показує лише підтверджені форми та точки з даних джерела.
        </p>}
        {mapStatus === 'unconfigured' && <p className={`mt-2 rounded-xl px-3 py-2 text-[10px] ${isDark ? 'bg-amber-300/10 text-amber-100' : 'bg-amber-50 text-amber-900'}`}>Для цієї карти не налаштовано базові тайли. Маршрутні геометрії залишаються доступними, якщо їх надав перевізник.</p>}
        {sheetSnap === 'expanded' && <div className="grid grid-cols-3 gap-2 border-t border-[var(--route-border)] px-1 pt-2">
          <button type="button" aria-pressed={saved} onClick={() => toggleSaved()} className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[var(--route-border)] text-[10px] font-bold"><Star size={15} fill={saved ? 'currentColor' : 'none'}/>{saved ? 'Збережено' : 'Зберегти'}</button>
          <button type="button" onClick={() => void shareRoute()} className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[var(--route-border)] text-[10px] font-bold"><Share2 size={15}/>Поділитися</button>
          <button type="button" disabled={!lastLeg || !onNavigate} onClick={() => lastLeg && onNavigate?.({ label: lastLeg.destination.name, latitude: lastLeg.destination.coordinates[1], longitude: lastLeg.destination.coordinates[0] })} className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[#0B6EF3] text-[10px] font-extrabold text-white disabled:opacity-45"><Navigation size={15}/>Навігація</button>
        </div>}
      </div>}

      {feedback && <p role="status" className="px-4 pb-1 text-center text-[10px] text-[var(--route-muted)]">{feedback}</p>}
    </section>
    <span className="sr-only" aria-live="polite">{feedback}</span>
  </main>;
}
