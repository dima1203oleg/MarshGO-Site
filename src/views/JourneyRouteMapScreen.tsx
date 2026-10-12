import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowLeft, Bike, BusFront, CarFront, ChevronDown, ChevronUp, Clock3, Footprints,
  Layers, Navigation, Route as RouteIcon, Share2,
  Star, TramFront, TrainFront, TrainTrack, Zap,
} from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import { buildJourneyRouteMapModel, journeyModeColor } from '../map/journeyRouteModel';
import type { MapAdapter, MapStatus, RouteFitPadding } from '../map/MapAdapter';
import { getMapLayer, mapLayers, setMapLayer, type MapLayer } from '../map/mapMode';
import type { ApiJourney } from '../services/productionApi';
import { journeyLegCaveat, journeyLegLabel } from './journeyLegLabel';
import { themeService } from '../services/theme';

type SheetSnap = 'collapsed' | 'half' | 'expanded';
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

const formatDuration = (seconds: number) => {
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} год ${minutes % 60} хв` : `${minutes} хв`;
};

const formatMoney = (minor: number, currency = 'UAH') => new Intl.NumberFormat('uk-UA', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(minor / 100);

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
  if (leg.mode === 'WALK') return '0 грн';
  if (leg.fareIncludedByPreviousSegment) return 'У квитку';
  if (leg.priceMinor === null) return 'Ціна невідома';
  const approximate = leg.priceStatus !== 'LOCKED';
  return `${approximate ? '≈ ' : ''}${formatMoney(leg.priceMinor, leg.currency ?? 'UAH')}${leg.mode === 'COMMUNITY' ? ' / місце' : ''}`;
}

function SegmentIcon({ leg }: { leg: JourneyLeg }) {
  const common = { size: 20, strokeWidth: 2.2 };
  if (leg.mode === 'WALK') return <Footprints {...common}/>;
  if (leg.mode === 'BUS' || leg.mode === 'MINIBUS') return <BusFront {...common}/>;
  if (leg.mode === 'TROLLEYBUS') return <BusFront {...common}/>;
  if (leg.mode === 'TRAM') return <TramFront {...common}/>;
  if (leg.mode === 'METRO') return <TrainTrack {...common}/>;
  if (leg.mode === 'RAIL') return <TrainFront {...common}/>;
  if (leg.mode === 'COMMUNITY' || leg.mode === 'TAXI' || leg.mode === 'CARSHARING' || leg.mode === 'TRANSFER') return <CarFront {...common}/>;
  if (leg.mode === 'BIKE') return <Bike {...common}/>;
  if (leg.mode === 'SCOOTER') return <Zap {...common}/>;
  return <RouteIcon {...common}/>;
}

function stopTime(stop: NonNullable<JourneyLeg['stops']>[number], index: number, lastIndex: number) {
  return formatTime(index === 0 ? stop.departureAt : index === lastIndex ? stop.arrivalAt : stop.arrivalAt);
}

export function JourneyRouteMapScreen({
  journey,
  onBack,
  onBookOffer,
  onShowSaved,
  onNavigate,
  shareUrl,
}: {
  journey: ApiJourney;
  onBack: () => void;
  onBookOffer?: (offerId: string, journeyId: string, journeyLegId: string) => void;
  onShowSaved?: () => void;
  onNavigate?: (destination: { label: string; latitude: number; longitude: number }) => void;
  shareUrl?: string;
}) {
  const model = useMemo(() => buildJourneyRouteMapModel(journey.legs), [journey.legs]);
  const timeline = useMemo(() => timelineFor(journey), [journey]);
  const firstLeg = journey.legs[0];
  const lastLeg = journey.legs.at(-1);
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [isDark, setIsDark] = useState(themeService.isDark());
  const [mapLayer, setCurrentMapLayer] = useState<MapLayer>(getMapLayer);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('half');
  const [sheetHeight, setSheetHeight] = useState(() => typeof window === 'undefined' ? 480 : Math.round(window.innerHeight * 0.58));
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === 'undefined' ? 844 : window.innerHeight);
  const [dragging, setDragging] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(() => new Set());
  const [feedback, setFeedback] = useState('');
  const mapAdapter = useRef<MapAdapter | null>(null);
  const segmentCards = useRef(new Map<string, HTMLElement>());
  const dragStart = useRef<{ y: number; height: number; pointerId: number; moved: boolean } | null>(null);
  const suppressHandleClick = useRef(false);

  useEffect(() => themeService.subscribe((_theme, dark) => setIsDark(dark)), []);

  const snapHeight = useCallback((snap: SheetSnap, viewport = viewportHeight) => {
    const safeBottom = 8;
    if (snap === 'collapsed') return Math.min(viewport * 0.26, Math.max(170, viewport * 0.21)) + safeBottom;
    if (snap === 'expanded') return Math.min(viewport * 0.9, 820);
    return Math.min(viewport * 0.58, 560);
  }, [viewportHeight]);

  useEffect(() => {
    const updateViewport = () => {
      const next = window.innerHeight;
      setViewportHeight(next);
      setSheetHeight(snapHeight(sheetSnap, next));
    };
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [sheetSnap, snapHeight]);

  const mapPadding = useMemo<RouteFitPadding>(() => ({
    top: 92,
    left: 22,
    right: 22,
    bottom: Math.round(sheetHeight * 0.66),
  }), [sheetHeight]);

  const chooseSegment = useCallback((id: string, expandForDetails = true) => {
    const leg = journey.legs.find(item => item.id === id);
    if (!leg) return;
    setActiveSegmentId(id);
    if (sheetSnap === 'collapsed') {
      setSheetSnap('half');
      setSheetHeight(snapHeight('half'));
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

  const allDuration = journey.totalDurationSeconds;
  const hasMeasuredDistance = (leg: JourneyLeg): leg is JourneyLeg & { distanceMeters: number } => typeof leg.distanceMeters === 'number'
    && Number.isFinite(leg.distanceMeters) && leg.distanceMeters >= 0;
  const knownDistance = journey.legs.reduce((sum, leg) => sum + (hasMeasuredDistance(leg) ? leg.distanceMeters : 0), 0);
  const completeDistance = journey.legs.length > 0 && journey.legs.every(hasMeasuredDistance);
  const distanceSummary = completeDistance
    ? `${(knownDistance / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км`
    : knownDistance > 0 ? `Відомо ${(knownDistance / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км`
      : 'Відстань не вказана';
  const totalPrice = journey.confirmedPriceMinor ?? journey.totalPriceMinor;
  const priceSummary = totalPrice === null ? 'Ціна уточнюється'
    : `${journey.confirmedPriceMinor === null ? '≈ ' : ''}${formatMoney(totalPrice, journey.currency ?? 'UAH')}`;
  const timelineTotal = timeline.reduce((sum, segment) => sum + segment.durationSeconds, 0);
  const missingShapes = model.missingShapeCount;
  const mapStatusText = mapStatus === 'failed' ? 'Карта недоступна' : mapStatus === 'degraded' ? 'Карта завантажена частково'
    : mapStatus === 'unconfigured' ? 'Потрібне налаштування карти' : missingShapes > 0 ? 'Є сегменти без геометрії джерела' : 'Маршрут на карті';

  const heightForSnap = (snap: SheetSnap) => snapHeight(snap);
  const nearestSnap = (height: number): SheetSnap => {
    const choices: Array<[SheetSnap, number]> = [['collapsed', heightForSnap('collapsed')], ['half', heightForSnap('half')], ['expanded', heightForSnap('expanded')]];
    return choices.reduce((nearest, candidate) => Math.abs(candidate[1] - height) < Math.abs(nearest[1] - height) ? candidate : nearest)[0];
  };
  const cycleSheet = () => {
    if (suppressHandleClick.current) { suppressHandleClick.current = false; return; }
    const next: SheetSnap = sheetSnap === 'collapsed' ? 'half' : sheetSnap === 'half' ? 'expanded' : 'collapsed';
    setSheetSnap(next);
    setSheetHeight(heightForSnap(next));
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragStart.current = { y: event.clientY, height: sheetHeight, pointerId: event.pointerId, moved: false };
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
    const nextHeight = Math.min(heightForSnap('expanded'), Math.max(heightForSnap('collapsed'), start.height + delta));
    setSheetHeight(nextHeight);
  };
  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (start.moved) {
      const next = nearestSnap(sheetHeight);
      setSheetSnap(next);
      setSheetHeight(heightForSnap(next));
    }
    dragStart.current = null;
    setDragging(false);
  };

  const shareRoute = async () => {
    const url = shareUrl ?? window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: 'Маршрут MARSHGO', text: `${firstLeg?.origin.name ?? ''} → ${lastLeg?.destination.name ?? ''}`, url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setFeedback('Посилання на маршрут скопійовано.'); }
      else setFeedback('Поділитися можна з меню браузера.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFeedback('Не вдалося поділитися посиланням. Спробуйте ще раз.');
    }
  };

  const setCardRef = (id: string, node: HTMLElement | null) => {
    if (node) segmentCards.current.set(id, node); else segmentCards.current.delete(id);
  };
  const toggleExpanded = (id: string) => setExpandedSegments(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return <main className="route-map-screen fixed inset-0 z-[80] overflow-hidden text-[var(--route-ink)]" data-theme={isDark ? 'dark' : 'light'} aria-label="Побудований маршрут">
    <div className="absolute inset-0" data-testid="journey-route-map">
      <MarshGoMap
        route={[]}
        routeSegments={model.routeSegments}
        routeWaypoints={model.routeWaypoints}
        routeFitPadding={mapPadding}
        theme={isDark ? 'MARSHGO_DARK' : 'MARSHGO_LIGHT'}
        onStatus={setMapStatus}
        onAdapter={adapter => { mapAdapter.current = adapter; if (adapter) adapter.setActiveRouteSegment?.(activeSegmentId); }}
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
          const order: MapLayer[] = ['simple', 'threeD', 'satellite'];
          const next = order[(order.indexOf(mapLayer) + 1) % order.length];
          setCurrentMapLayer(next); setMapLayer(next);
        }} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--route-border)] bg-[var(--route-floating)] text-[var(--route-ink)] shadow-lg backdrop-blur"><Layers size={19}/></button>
      </div>
    </header>

    <section
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
        className="flex h-9 w-full shrink-0 touch-none items-center justify-center"
      >
        <span className="h-1.5 w-12 rounded-full bg-[var(--route-grabber)]"/>
      </button>

      <div className="shrink-0 px-4 pb-3">
        {sheetSnap !== 'collapsed' && <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Деталі маршруту</h1>
            <p className="text-[10px] font-bold uppercase tracking-[.11em] text-[#1687FF]">{journey.source === 'gtfs-static' ? 'Рейс за розкладом' : 'MARSHGO · ваш маршрут'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" aria-label="Зберегти маршрут, уже доданий до моїх поїздок" title="Маршрут збережено у Мої поїздки" onClick={onShowSaved} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--route-border)] text-[var(--route-ink)] hover:bg-[var(--route-hover)]"><Star size={17}/></button>
            <button type="button" aria-label="Поділитися маршрутом" title="Поділитися маршрутом" onClick={() => void shareRoute()} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--route-border)] text-[var(--route-ink)] hover:bg-[var(--route-hover)]"><Share2 size={17}/></button>
          </div>
        </div>}
        <div className="rounded-2xl border border-[var(--route-border)] bg-[var(--route-card)] p-3">
          <div className="flex items-center justify-between gap-2 text-sm font-extrabold">
            <span className="min-w-0 truncate">{firstLeg?.origin.name ?? 'Початок'}</span>
            <span className="shrink-0 text-[#1687FF]">→</span>
            <span className="min-w-0 truncate text-right">{lastLeg?.destination.name ?? 'Кінець'}</span>
          </div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <strong className="text-xl font-black tabular-nums">{formatDuration(allDuration)}</strong>
            <div className="text-right text-[11px] font-semibold text-[var(--route-muted)]">
              <span>{distanceSummary}</span><span className="mx-1.5 text-[var(--route-subtle)]">·</span><span>{priceSummary}</span>
            </div>
          </div>
          {(firstLeg || lastLeg) && <p className="mt-0.5 text-[10px] font-semibold tabular-nums text-[var(--route-muted)]">{firstLeg ? formatTime(firstLeg.departureAt) : '—'} → {lastLeg ? formatTime(lastLeg.arrivalAt) : '—'}</p>}
          {(mapStatus === 'failed' || mapStatus === 'degraded' || mapStatus === 'unconfigured' || missingShapes > 0) && <p role="status" className={`mt-1 text-[9px] font-semibold ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>{mapStatusText}</p>}
          {timeline.length > 0 ? <>
            <div className="mt-3 flex h-3.5 overflow-hidden rounded-full border border-[var(--route-border)] bg-[var(--route-track)]" role="group" aria-label="Часова шкала етапів маршруту">
              {timeline.map(item => <button
                key={item.id}
                type="button"
                aria-label={item.kind === 'WAIT' ? `Очікування, ${formatDuration(item.durationSeconds)}; перейти до наступного сегмента` : `${journeyLegLabel(item.leg!.mode, item.leg!.transportType)}${item.leg!.routeName ? ` ${item.leg!.routeName}` : ''}, ${formatDuration(item.durationSeconds)}`}
                title={item.kind === 'WAIT' ? `Очікування · ${formatDuration(item.durationSeconds)}` : `${journeyLegLabel(item.leg!.mode, item.leg!.transportType)} · ${formatDuration(item.durationSeconds)}`}
                onClick={() => chooseSegment(item.targetLegId)}
                className="h-full min-w-[3px] border-r border-[var(--route-timeline-divider)] transition-[filter,opacity] hover:brightness-150 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1687FF]"
                style={{ flex: `${item.durationSeconds} 1 0%`, backgroundColor: item.color, filter: activeSegmentId && activeSegmentId !== item.targetLegId ? 'brightness(.55) saturate(.65)' : activeSegmentId === item.targetLegId ? 'brightness(1.35) drop-shadow(0 0 5px currentColor)' : undefined }}
              />)}
            </div>
            <div className="mt-1 flex gap-1 overflow-x-auto no-scrollbar" aria-label="Тривалість сегментів маршруту">
              {timeline.map(item => <button key={`${item.id}:label`} type="button" onClick={() => chooseSegment(item.targetLegId)} className="min-h-8 shrink-0 px-1 text-[9px] font-extrabold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1687FF]" style={{ flex: `${item.durationSeconds} 1 0%`, color: item.color }}>
                {formatDuration(item.durationSeconds)}
              </button>)}
            </div>
            <p className="mt-0.5 text-[9px] leading-4 text-[var(--route-subtle)]">Шкала пропорційна часу етапів · {formatDuration(timelineTotal)} = 100% повного часу</p>
          </> : <p className="mt-2 text-xs text-[var(--route-muted)]">Дані сегментів цього маршруту не надійшли.</p>}
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
            const expanded = expandedSegments.has(leg.id);
            const caveat = journeyLegCaveat(leg.mode, leg.source);
            const canBook = Boolean(leg.offerId) && leg.availabilityStatus !== 'UNAVAILABLE';
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
              <div className="flex items-start gap-3 p-3">
                <button type="button" onClick={() => chooseSegment(leg.id)} aria-pressed={selected} aria-label={`Вибрати сегмент: ${journeyLegLabel(leg.mode, leg.transportType)}${leg.routeName ? ` ${leg.routeName}` : ''}`} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1687FF]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-[0_0_18px_color-mix(in_srgb,var(--segment-color)_48%,transparent)]" style={{ backgroundColor: color, ['--segment-color' as string]: color }}><SegmentIcon leg={leg}/></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <b className="text-sm font-extrabold">{leg.mode === 'COMMUNITY' ? 'Попутка · приватний автомобіль' : `${journeyLegLabel(leg.mode, leg.transportType)}${leg.routeName ? ` ${leg.routeName}` : ''}`}</b>
                      {leg.liveStatus && <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-extrabold ${leg.liveStatus === 'LIVE' ? (isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-800') : 'bg-[var(--route-card-alt)] text-[var(--route-muted)]'}`}>{leg.liveStatus === 'LIVE' ? 'LIVE' : leg.liveStatus === 'PREDICTED' ? 'ПРОГНОЗ' : leg.liveStatus === 'SCHEDULED' ? 'РОЗКЛАД' : leg.liveStatus === 'UNAVAILABLE' ? 'НЕДОСТУПНИЙ' : 'ДАНІ НЕ ПІДТВЕРДЖЕНІ'}</span>}
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
                      <span className={endpoint ? 'font-extrabold text-[var(--route-ink)]' : 'text-[var(--route-muted)]'}>{stop.name}{index === 0 ? <strong className="ml-1 text-[#1687FF]">· ПОСАДКА</strong> : index === stops.length - 1 ? <strong className="ml-1 text-[#1687FF]">· ВИСАДКА</strong> : null}</span>
                    </li>;
                  })}
                </ol> : <p className="text-[10px] text-[var(--route-muted)]">Перевізник не надав список зупинок для цього рейсу.</p>}
              </div>}

              {leg.mode === 'COMMUNITY' && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--route-border)] px-3 py-2.5">
                <span className="text-[10px] text-[var(--route-muted)]">{leg.availabilityStatus === 'AVAILABLE' ? 'Наявність перевірена під час пошуку' : 'Місця потрібно перевірити перед бронюванням'}</span>
                {canBook && leg.offerId && onBookOffer && <button type="button" onClick={() => onBookOffer(leg.offerId!, journey.id, leg.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#8845E8] px-4 text-xs font-extrabold text-white shadow-[0_0_18px_rgba(168,85,247,.28)] hover:bg-[#9958F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Забронювати <span aria-hidden="true">→</span></button>}
              </div>}
            </li>;
          })}
        </ol>

        {missingShapes > 0 && <p className={`mt-2 rounded-xl border px-3 py-2 text-[10px] leading-4 ${isDark ? 'border-amber-300/20 bg-amber-300/5 text-amber-100' : 'border-amber-700/20 bg-amber-50 text-amber-900'}`}>
          {missingShapes} сегм. без геометрії перевізника. Їх не з’єднуємо прямими лініями; карта показує лише підтверджені форми та точки з даних джерела.
        </p>}
        {mapStatus === 'unconfigured' && <p className={`mt-2 rounded-xl px-3 py-2 text-[10px] ${isDark ? 'bg-amber-300/10 text-amber-100' : 'bg-amber-50 text-amber-900'}`}>Для цієї карти не налаштовано базові тайли. Маршрутні геометрії залишаються доступними, якщо їх надав перевізник.</p>}
      </div>}

      {feedback && <p role="status" className="px-4 pb-1 text-center text-[10px] text-[var(--route-muted)]">{feedback}</p>}
      {sheetSnap === 'expanded' && <footer className="grid shrink-0 grid-cols-3 gap-2 border-t border-[var(--route-border)] bg-[var(--route-footer)] px-3 py-2">
        <button type="button" onClick={onShowSaved} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--route-border)] text-[10px] font-bold text-[var(--route-ink)] hover:bg-[var(--route-hover)]"><Star size={15}/>Зберегти</button>
        <button type="button" onClick={() => void shareRoute()} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--route-border)] text-[10px] font-bold text-[var(--route-ink)] hover:bg-[var(--route-hover)]"><Share2 size={15}/>Поділитися</button>
        <button type="button" disabled={!lastLeg || !onNavigate} onClick={() => lastLeg && onNavigate?.({ label: lastLeg.destination.name, latitude: lastLeg.destination.coordinates[1], longitude: lastLeg.destination.coordinates[0] })} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#0B6EF3] text-[10px] font-extrabold text-white disabled:opacity-45"><Navigation size={15}/>Навігація</button>
      </footer>}
    </section>
    <span className="sr-only" aria-live="polite">{feedback}</span>
  </main>;
}
