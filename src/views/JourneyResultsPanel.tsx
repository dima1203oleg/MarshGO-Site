import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight, Bike, BusFront, CarFront, ChevronRight, Clock3, Coins, Footprints,
  Heart, Scale, Timer, TrainFront, TrainTrack, TramFront, Zap,
} from 'lucide-react';
import type { ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy } from '../services/productionApi';
import { journeyLegCaveat } from './journeyLegLabel';
import { formatTransferCount } from '../map/journeyRouteModel';
import {
  buildJourneyResultSegments, formatJourneyClock, formatJourneyDuration,
  formatJourneySegmentPrice, formatJourneyTotalPrice, type JourneyResultSegment,
} from './journeyResultPresentation';

const FAVORITES_KEY = 'marshgo.saved-route-results.v1';

const strategyConfig: Array<{ id: ApiJourneyStrategy; label: string; Icon: typeof Scale }> = [
  { id: 'BALANCED', label: 'Оптимальний', Icon: Scale },
  { id: 'FASTEST', label: 'Найшвидший', Icon: Timer },
  { id: 'CHEAPEST', label: 'Найдешевший', Icon: Coins },
];

function strategyJourneys(result: ApiJourneySearchResult, strategy: ApiJourneyStrategy): ApiJourney[] {
  return result.journeys
    .filter(journey => journey.strategyRanks
      ? typeof journey.strategyRanks[strategy] === 'number'
      : (journey.recommendedStrategies ?? [journey.strategy]).includes(strategy))
    .filter(journey => strategy !== 'CHEAPEST' || formatJourneyTotalPrice(journey) !== '—')
    .sort((a, b) => {
      const rankA = a.strategyRanks?.[strategy];
      const rankB = b.strategyRanks?.[strategy];
      if (typeof rankA === 'number' || typeof rankB === 'number') {
        return (rankA ?? Number.MAX_SAFE_INTEGER) - (rankB ?? Number.MAX_SAFE_INTEGER);
      }
      if (strategy === 'FASTEST') return a.totalDurationSeconds - b.totalDurationSeconds;
      if (strategy === 'CHEAPEST') {
        const priceA = a.confirmedPriceMinor ?? a.totalPriceMinor;
        const priceB = b.confirmedPriceMinor ?? b.totalPriceMinor;
        if (priceA === null) return priceB === null ? a.totalDurationSeconds - b.totalDurationSeconds : 1;
        if (priceB === null) return -1;
        return priceA - priceB || a.totalDurationSeconds - b.totalDurationSeconds;
      }
      return a.totalDurationSeconds - b.totalDurationSeconds
        || (a.confirmedPriceMinor ?? a.totalPriceMinor ?? Number.MAX_SAFE_INTEGER)
          - (b.confirmedPriceMinor ?? b.totalPriceMinor ?? Number.MAX_SAFE_INTEGER);
    });
}

function formatRouteCount(count: number): string {
  const plural = new Intl.PluralRules('uk-UA').select(count);
  const noun = plural === 'one' ? 'маршрут' : plural === 'few' ? 'маршрути' : 'маршрутів';
  return `${count} ${noun}`;
}

function SegmentIcon({ segment }: { segment: JourneyResultSegment }) {
  const mode = segment.mode;
  const Icon = mode === 'WALK' ? Footprints
    : mode === 'WAIT' ? Clock3
      : mode === 'TRAM' ? TramFront
        : mode === 'TROLLEYBUS' || mode === 'BUS' || mode === 'MINIBUS' || mode === 'URBAN_BUS' ? BusFront
          : mode === 'METRO' || mode === 'RAIL' ? mode === 'METRO' ? TrainTrack : TrainFront
            : mode === 'BIKE' ? Bike
              : mode === 'SCOOTER' ? Zap
                : mode === 'COMMUNITY' || mode === 'TAXI' || mode === 'TRANSFER' || mode === 'CARSHARING' ? CarFront
                  : BusFront;
  return <Icon size={15} strokeWidth={2.3} aria-hidden="true"/>;
}

function formatDistance(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters) || meters < 0) return 'відстань невідома';
  return meters >= 1000
    ? `${(meters / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км`
    : `${Math.round(meters)} м`;
}

function segmentItemWidth(segment: JourneyResultSegment, price: string): number {
  const contentWidth = Math.ceil(Math.max(segment.label.length * 4.8, `${formatJourneyDuration(segment.durationSeconds)} · ${price}`.length * 4.1) + 38);
  return Math.max(80, Math.min(176, contentWidth));
}

function RouteResultCard({ journey, strategy, index, onOpen }: {
  journey: ApiJourney;
  strategy: ApiJourneyStrategy;
  index: number;
  onOpen: (journey: ApiJourney) => void;
}) {
  const segments = buildJourneyResultSegments(journey);
  const ribbonTotal = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0);
  const firstLeg = journey.legs[0];
  const lastLeg = journey.legs.at(-1);
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]').includes(journey.id); }
    catch { return false; }
  });
  const [announcement, setAnnouncement] = useState('');
  const segmentScroller = useRef<HTMLDivElement>(null);
  const [segmentScroll, setSegmentScroll] = useState({ overflow: false, atEnd: false });

  useEffect(() => {
    try {
      const ids = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]') as unknown;
      setSaved(Array.isArray(ids) && ids.includes(journey.id));
    } catch { setSaved(false); }
  }, [journey.id]);

  useEffect(() => {
    const element = segmentScroller.current;
    if (!element) return;
    const syncScrollState = () => {
      const next = {
        overflow: element.scrollWidth > element.clientWidth + 2,
        atEnd: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
      };
      setSegmentScroll(current => current.overflow === next.overflow && current.atEnd === next.atEnd ? current : next);
    };
    syncScrollState();
    element.addEventListener('scroll', syncScrollState, { passive: true });
    window.addEventListener('resize', syncScrollState, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncScrollState);
    observer?.observe(element);
    for (const child of element.children) observer?.observe(child);
    return () => {
      element.removeEventListener('scroll', syncScrollState);
      window.removeEventListener('resize', syncScrollState);
      observer?.disconnect();
    };
  }, [journey.id, segments.length]);

  if (!firstLeg || !lastLeg) return null;
  const strategyItem = strategyConfig.find(item => item.id === strategy) ?? strategyConfig[0];
  const StrategyIcon = strategyItem.Icon;
  const totalPrice = formatJourneyTotalPrice(journey);
  const startAt = journey.requestedDepartureAt ?? firstLeg.departureAt;
  const caveats = journey.legs.map(leg => journeyLegCaveat(leg.mode, leg.source)).filter(Boolean);
  const openLabel = `Відкрити маршрут: ${firstLeg.origin.name} — ${lastLeg.destination.name}, ${formatJourneyDuration(journey.totalDurationSeconds)}, ${totalPrice === '—' ? 'ціна уточнюється' : totalPrice}`;

  const toggleSaved = () => {
    let ids: string[] = [];
    try {
      const existing = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]') as unknown;
      if (Array.isArray(existing)) ids = existing.filter((id): id is string => typeof id === 'string');
    } catch { /* Start a clean local list when saved browser data is invalid. */ }
    const nextSaved = !saved;
    const next = nextSaved ? [...new Set([...ids, journey.id])] : ids.filter(id => id !== journey.id);
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setSaved(nextSaved);
      setAnnouncement(nextSaved ? 'Маршрут збережено на цьому пристрої' : 'Маршрут видалено зі збережених');
    } catch {
      setAnnouncement('Не вдалося зберегти маршрут на цьому пристрої');
    }
  };

  return <article
    data-testid="journey-result-card"
    data-journey-id={journey.id}
    className={`journey-result-card relative isolate overflow-hidden rounded-[20px] border bg-white shadow-[0_3px_14px_rgba(30,64,110,.07)] dark:bg-[#101923] dark:shadow-[0_4px_18px_rgba(0,0,0,.18)] ${index === 0 ? 'border-blue-400 ring-1 ring-blue-100 dark:border-blue-600 dark:ring-blue-950' : 'border-slate-200 dark:border-slate-700'}`}
  >
    <button type="button" aria-label={openLabel} onClick={() => onOpen(journey)} className="absolute inset-0 z-0 h-full w-full rounded-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <span className="sr-only">Переглянути карту й деталі маршруту</span>
    </button>
    <div className="pointer-events-none relative z-10 p-3">
      <div className="flex min-h-11 items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-[20px] font-black leading-6 tracking-tight tabular-nums text-slate-900 dark:text-white">{formatJourneyDuration(journey.totalDurationSeconds)}</p>
          <p className="mt-0.5 text-[10px] font-semibold leading-4 tabular-nums text-slate-500 dark:text-slate-400">{formatJourneyClock(startAt)}–{formatJourneyClock(lastLeg.arrivalAt)}</p>
        </div>
        <span aria-label={`Загальна вартість: ${totalPrice === '—' ? 'невідома' : totalPrice}`} className={`shrink-0 text-[18px] font-black leading-6 tabular-nums ${totalPrice === '—' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>{totalPrice}</span>
        <span aria-label={strategyItem.label} title={strategyItem.label} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${strategy === 'FASTEST' ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-300' : strategy === 'CHEAPEST' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300'}`}><StrategyIcon size={19} strokeWidth={2.2} aria-hidden="true"/></span>
        <span aria-label={formatTransferCount(journey.transfers)} title={formatTransferCount(journey.transfers)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 text-[11px] font-extrabold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200"><ArrowLeftRight size={14} aria-hidden="true"/>{journey.transfers}</span>
        <button type="button" aria-label={saved ? 'Видалити маршрут зі збережених' : 'Зберегти маршрут'} aria-pressed={saved} onClick={toggleSaved} onPointerDown={event => event.stopPropagation()} className="pointer-events-auto relative z-20 grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800" title={saved ? 'Збережено на цьому пристрої' : 'Зберегти маршрут'}>
          <Heart size={19} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-rose-500' : ''} aria-hidden="true"/>
        </button>
        <span className="grid h-6 w-3 shrink-0 place-items-center text-slate-500 dark:text-slate-400" aria-hidden="true"><ChevronRight size={18}/></span>
      </div>

      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="img" aria-label={`Часова шкала маршруту: ${segments.map(segment => `${segment.label} ${formatJourneyDuration(segment.durationSeconds)}`).join(', ')}`}>
        {segments.map(segment => <span key={segment.id} data-segment-mode={segment.mode} title={`${segment.label} · ${formatJourneyDuration(segment.durationSeconds)}`} style={{ flexGrow: segment.durationSeconds, flexBasis: 0, backgroundColor: segment.color }} className="h-full min-w-[2px] transition-[flex-grow]"/>)}
      </div>

      <div className="relative mt-2">
        <div ref={segmentScroller} id={`journey-segments-${journey.id}`} className="journey-result-segments no-scrollbar flex snap-x gap-0 overflow-x-auto scroll-smooth" role="list" aria-label={segmentScroll.overflow ? 'Послідовність етапів маршруту; доступна горизонтальна прокрутка' : 'Послідовність етапів маршруту'}>
        {segments.map(segment => {
          const price = formatJourneySegmentPrice(segment, journey.currency ?? 'UAH');
          const leg = segment.leg;
          const text = `${segment.label}, ${formatJourneyDuration(segment.durationSeconds)}, ${price}`;
          return <div key={segment.id} role="listitem" aria-label={text} className="shrink-0 snap-start border-r border-slate-200 px-1 first:pl-0 last:border-r-0 last:pr-0 dark:border-slate-700" style={{ width: `${segmentItemWidth(segment, price)}px` }} title={text}>
            <span className="flex items-center gap-1 text-[9px] font-bold leading-4 text-slate-800 dark:text-slate-100">
              <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: segment.color }}><SegmentIcon segment={segment}/></span>
              <span className="min-w-0 truncate">{segment.label}</span>
            </span>
            <span className="mt-0.5 block truncate pl-[22px] text-[8px] font-semibold leading-3 tabular-nums text-slate-500 dark:text-slate-400">{formatJourneyDuration(segment.durationSeconds)} · {price}</span>
            {leg && <span className="sr-only">{formatDistance(leg.distanceMeters)}</span>}
          </div>;
        })}
        </div>
        {segmentScroll.overflow && <button type="button" aria-label={segmentScroll.atEnd ? 'Повернутися до початку етапів маршруту' : 'Прокрутити до наступних етапів маршруту'} aria-controls={`journey-segments-${journey.id}`} onPointerDown={event => event.stopPropagation()} onClick={event => {
          event.stopPropagation();
          const element = segmentScroller.current;
          if (!element) return;
          element.scrollTo({ left: segmentScroll.atEnd ? 0 : element.scrollLeft + Math.max(120, element.clientWidth * 0.72), behavior: 'smooth' });
        }} className="pointer-events-auto absolute right-0 top-[-2px] z-20 grid h-11 w-11 place-items-center rounded-full text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200" title={segmentScroll.atEnd ? 'До початку етапів' : 'Є наступні етапи'}>
          <span data-testid="segment-scroll-cue-surface" className="grid h-6 w-6 place-items-center rounded-full border border-slate-200 bg-white/95 shadow-sm dark:border-slate-600 dark:bg-[#111820]"><ChevronRight size={16} className={segmentScroll.atEnd ? 'rotate-180' : ''} aria-hidden="true"/></span>
        </button>}
      </div>
      {caveats.length > 0 && <p className="mt-1 text-[10px] leading-4 text-amber-800 dark:text-amber-200">{[...new Set(caveats)].join(' ')}</p>}
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      <span className="sr-only">Шкала містить {segments.length} етапів і відповідає їхній тривалості{ribbonTotal > 0 ? `, разом ${formatJourneyDuration(ribbonTotal)}` : ''}.</span>
    </div>
  </article>;
}

export function JourneyResultsPanel({ result, onOpenMap }: {
  result: ApiJourneySearchResult;
  onOpenMap: (journey: ApiJourney) => void;
}) {
  const requestedStrategy = strategyConfig.some(strategy => strategy.id === result.requestedStrategy)
    ? result.requestedStrategy as ApiJourneyStrategy : undefined;
  const defaultStrategy = requestedStrategy && strategyJourneys(result, requestedStrategy).length > 0
    ? requestedStrategy
    : strategyJourneys(result, 'BALANCED').length > 0 ? 'BALANCED'
      : strategyConfig.find(strategy => strategyJourneys(result, strategy.id).length > 0)?.id ?? 'BALANCED';
  const [activeStrategy, setActiveStrategy] = useState<ApiJourneyStrategy>(defaultStrategy);
  useEffect(() => setActiveStrategy(defaultStrategy), [result, defaultStrategy]);
  const shownJourneys = strategyJourneys(result, activeStrategy);

  const preferenceMessages: Record<string, string> = {
    preferredVehicleClass: 'клас автомобіля не застосовується до розкладів громадського транспорту',
    'maxPriceMinor:public-transit-fare-unavailable': 'обмеження ціни не застосовується до рейсів без тарифів у джерелі',
    'CHEAPEST:public-transit-fares-unavailable': 'найдешевший варіант серед розкладів без оприлюднених тарифів визначити неможливо',
    'maxTransfers:limited-to-4': 'планувальник будує максимум чотири пересадки',
    'transportType:taxi:not-in-route-engine': 'маршрути таксі ще не входять до планувальника',
    'transportType:carsharing:not-in-route-engine': 'маршрути каршерингу ще не входять до планувальника',
    'transportType:car_rental:not-in-route-engine': 'оренда авто доступна окремо, але не додається до маршрутного ланцюжка',
    'transportType:transfer:not-in-route-engine': 'зовнішні трансфери ще не входять до планувальника',
    'transportType:bike:not-in-route-engine': 'велосипедні прокати ще не додаються до маршрутного ланцюжка',
    'transportType:scooter:not-in-route-engine': 'самокати ще не додаються до маршрутного ланцюжка',
    'transportType:moped:not-in-route-engine': 'прокат мопедів ще не додається до маршрутного ланцюжка',
    'transportType:plane:not-in-route-engine': 'авіарейси не входять до затвердженого списку MARSHGO',
    'transportType:walk:not-in-route-engine': 'пішки доступно лише як короткий підхід до зупинки, окремий маршрут не будується',
  };

  return <section aria-label="Результати мультимодального пошуку" className="mt-2">
    <div role="group" aria-label="Режим пошуку маршрутів" className="mb-3 grid grid-cols-3 gap-2">
      {strategyConfig.map(({ id, label, Icon }) => {
        const count = strategyJourneys(result, id).length;
        const active = activeStrategy === id;
        return <button key={id} type="button" disabled={count === 0} aria-pressed={active} aria-label={`${label}${count ? `, ${formatRouteCount(count)}` : ', немає доступних маршрутів'}`} onClick={() => setActiveStrategy(id)} className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-2xl border px-1.5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-[#111820] dark:text-slate-200'}`}>
          <Icon size={16} className="shrink-0" aria-hidden="true"/><span className="whitespace-nowrap text-[10px] font-extrabold leading-tight sm:text-[11px]">{label}</span>
        </button>;
      })}
    </div>

    {result.partial && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Це частковий результат: враховані джерела, що відповіли для цієї території та часу. Розклад, наявність місць і тариф стороннього перевізника потрібно підтвердити у нього.</p>}
    {result.unsupportedPreferences.length > 0 && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Не всі умови можна врахувати: {result.unsupportedPreferences.map(value => preferenceMessages[value] ?? value).join('; ')}.</p>}
    {result.providerErrors.length > 0 && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">Деякі розклади тимчасово недоступні: {result.providerErrors.join('; ')}.</p>}
    {result.resultsTruncated && <p className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">Показано до {result.alternativeLimitPerStrategy ?? 12} різних варіантів на режим із {result.paretoCount ?? result.candidateCount ?? 'знайдених'} Pareto-варіантів. Результати обмежені, щоб пошук залишався швидким.</p>}
    {result.candidateGenerationTruncated && <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Пошук досяг ліміту обробки джерел; частина маршрутів могла не потрапити до результатів. Уточніть час або види транспорту й повторіть пошук.</p>}

    {shownJourneys.length ? <div className="space-y-2.5" data-testid="journey-results-list">{shownJourneys.map((journey, index) => <RouteResultCard key={journey.id} journey={journey} strategy={activeStrategy} index={index} onOpen={onOpenMap}/>)}</div>
      : <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-[#111820]">
        <p className="font-bold text-slate-800 dark:text-white">{result.journeys.length ? 'У цьому режимі немає маршрутів із достатніми даними' : 'Актуальних маршрутів поки немає'}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{result.journeys.length ? 'Спробуйте інший режим або змініть умови пошуку.' : 'Змініть час або види транспорту й повторіть пошук. Ми не показуємо вигадані пропозиції.'}</p>
      </div>}
  </section>;
}
