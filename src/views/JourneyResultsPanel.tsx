import { useEffect, useState } from 'react';
import {
  ArrowLeftRight, ChevronRight, Coins, Heart, Scale, Timer,
} from 'lucide-react';
import type { ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy } from '../services/productionApi';
import { JourneySegmentStrip, type JourneySegmentStripItem } from '../design-system/journey/JourneySegmentStrip';
import { journeyLegCaveat } from './journeyLegLabel';
import { formatTransferCount } from '../map/journeyRouteModel';
import {
  buildJourneyResultSegments, formatJourneyClock, formatJourneyDistance, formatJourneyDuration,
  formatJourneySegmentPrice, formatJourneyTotalPrice,
} from './journeyResultPresentation';

const FAVORITES_KEY = 'marshgo.saved-route-results.v1';

const strategyConfig: Array<{ id: ApiJourneyStrategy; label: string; Icon: typeof Scale; tone: string }> = [
  { id: 'BALANCED', label: 'Оптимальний', Icon: Scale, tone: 'text-[#1687FF]' },
  { id: 'FASTEST', label: 'Найшвидший', Icon: Timer, tone: 'text-[#FF9A32]' },
  { id: 'CHEAPEST', label: 'Найдешевший', Icon: Coins, tone: 'text-[#1FCB78]' },
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
        const rankOrder = (rankA ?? Number.MAX_SAFE_INTEGER) - (rankB ?? Number.MAX_SAFE_INTEGER);
        if (rankOrder !== 0) return rankOrder;
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

function RouteResultCard({ journey, strategy, index, onOpen }: {
  journey: ApiJourney;
  strategy: ApiJourneyStrategy;
  index: number;
  onOpen: (journey: ApiJourney) => void;
}) {
  const allSegments = buildJourneyResultSegments(journey);
  // The reference ribbon describes actual travel modes. Waiting remains
  // visible as a small timing note instead of masquerading as a transport leg.
  const segments = allSegments.filter(segment => segment.kind === 'LEG');
  const waitingSeconds = allSegments
    .filter(segment => segment.kind === 'WAIT' && segment.label === 'Очікування')
    .reduce((sum, segment) => sum + segment.durationSeconds, 0);
  const firstLeg = journey.legs[0];
  const lastLeg = journey.legs.at(-1);
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]').includes(journey.id); }
    catch { return false; }
  });
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    try {
      const ids = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]') as unknown;
      setSaved(Array.isArray(ids) && ids.includes(journey.id));
    } catch { setSaved(false); }
  }, [journey.id]);



  if (!firstLeg || !lastLeg) return null;
  const rankedStrategy = strategyConfig.find(item => journey.strategyRanks?.[item.id] === 1)?.id;
  const strategyItem = strategyConfig.find(item => item.id === (rankedStrategy ?? strategy)) ?? strategyConfig[0];
  const StrategyIcon = strategyItem.Icon;
  const totalPrice = formatJourneyTotalPrice(journey);
  const stripItems: JourneySegmentStripItem[] = segments.map(segment => ({
    id: segment.id,
    mode: segment.mode,
    transportType: segment.leg?.transportType,
    label: segment.label,
    selectionLabel: segment.label + (segment.leg?.routeName ? ' ' + segment.leg.routeName : ''),
    accessibilityLabel: segment.label + (segment.leg?.routeName ? ', маршрут ' + segment.leg.routeName : '') + ', ' + formatJourneyDuration(segment.durationSeconds) + ', ' + formatJourneySegmentPrice(segment, journey.currency ?? 'UAH'),
    durationSeconds: segment.durationSeconds,
    durationLabel: formatJourneyDuration(segment.durationSeconds),
    priceLabel: formatJourneySegmentPrice(segment, journey.currency ?? 'UAH'),
    color: segment.color,
  }));
  const startAt = journey.requestedDepartureAt ?? firstLeg.departureAt;
  const caveats = [...new Set(journey.legs.map(leg => journeyLegCaveat(leg.mode, leg.source, leg.scheduleSemantics, leg.fareSource)).filter(Boolean))];
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
    className={`journey-result-card relative isolate overflow-hidden rounded-[16px] border bg-white shadow-[0_3px_14px_rgba(30,64,110,.07)] dark:bg-[#0B1A27] dark:shadow-[0_4px_18px_rgba(0,0,0,.18)] ${index === 0 ? 'border-blue-400 ring-1 ring-blue-100 dark:border-blue-600 dark:ring-blue-950' : 'border-slate-200 dark:border-[#20354A]'}`}
  >
    <button type="button" aria-label={openLabel} onClick={() => onOpen(journey)} className="absolute inset-0 z-0 h-full w-full rounded-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <span className="sr-only">Переглянути карту й деталі маршруту</span>
    </button>
    <div className="journey-result-card-content pointer-events-none relative z-10 p-2">
      <div className="journey-result-header flex min-h-9 items-center gap-1">
        <div className="journey-result-key-metrics flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0">
            <p data-testid="canonical-route-duration" title={`Виїзд ${formatJourneyClock(startAt)} · прибуття ${formatJourneyClock(lastLeg.arrivalAt)}`} className="journey-result-duration text-[22px] font-black leading-6 tracking-tight tabular-nums text-slate-900 dark:text-white">{formatJourneyDuration(journey.totalDurationSeconds)}</p>
            {waitingSeconds > 0 && <p data-testid="journey-result-wait" className="text-[9px] font-semibold leading-3 tabular-nums text-slate-500 dark:text-slate-400">Очікування · {formatJourneyDuration(waitingSeconds)}</p>}
          </div>
          <span aria-hidden="true" className="h-7 w-px shrink-0 bg-slate-200 dark:bg-[#294258]"/>
          <span aria-label={`Загальна вартість: ${totalPrice === '—' ? 'невідома' : totalPrice}`} className={`journey-result-total-price shrink-0 text-[20px] font-black leading-6 tabular-nums ${totalPrice === '—' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>{totalPrice}</span>
        </div>
        <div className="journey-result-actions flex shrink-0 items-center gap-1">
          <span data-strategy={strategyItem.id} aria-label={strategyItem.label} title={strategyItem.label} className={`journey-result-action-badge grid h-8 w-8 shrink-0 place-items-center rounded-full border ${strategyItem.id === 'FASTEST' ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-300' : strategyItem.id === 'CHEAPEST' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300'}`}><StrategyIcon size={18} strokeWidth={2.2} aria-hidden="true"/></span>
          <span aria-label={formatTransferCount(journey.transfers)} title={formatTransferCount(journey.transfers)} className="journey-result-transfer-badge inline-flex h-8 shrink-0 items-center gap-1 rounded-full border bg-slate-100 px-1.5 text-[10px] font-extrabold tabular-nums text-slate-700 dark:bg-[#15283A] dark:text-slate-200"><ArrowLeftRight size={13} aria-hidden="true"/>{journey.transfers}</span>
          <button type="button" aria-label={saved ? 'Видалити маршрут зі збережених' : 'Зберегти маршрут'} aria-pressed={saved} onClick={toggleSaved} onPointerDown={event => event.stopPropagation()} className="journey-result-save-button pointer-events-auto relative z-20 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-transparent text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800" title={saved ? 'Збережено на цьому пристрої' : 'Зберегти маршрут'}>
            <span className="journey-result-save-visual"><Heart size={19} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-rose-500' : ''} aria-hidden="true"/></span>
          </button>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300" aria-hidden="true"><ChevronRight size={18}/></span>
        </div>
      </div>

      <JourneySegmentStrip
        items={stripItems}
        ariaLabel="Послідовність етапів маршруту"
        className="mt-1.5 pointer-events-none"
      />
      {segments.map(segment => segment.leg && <span key={segment.id} className="sr-only">{formatJourneyDistance(segment.leg.distanceMeters)}</span>)}
      {caveats.length > 0 && <p title={[...new Set(caveats)].join(' ')} className="mt-1 truncate text-[9px] leading-3 text-amber-800 dark:text-amber-200">{[...new Set(caveats)].join(' ')}</p>}
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      <span className="sr-only">Виїзд {formatJourneyClock(startAt)}, прибуття {formatJourneyClock(lastLeg.arrivalAt)}{waitingSeconds > 0 ? `, очікування ${formatJourneyDuration(waitingSeconds)}` : ''}.</span>
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
    <div role="group" aria-label="Режим пошуку маршрутів" className="mb-2 grid grid-cols-3 gap-1.5">
      {strategyConfig.map(({ id, label, Icon, tone }) => {
        const count = strategyJourneys(result, id).length;
        const active = activeStrategy === id;
        return <button key={id} type="button" disabled={count === 0} aria-pressed={active} aria-label={`${label}${count ? `, ${formatRouteCount(count)}` : ', немає доступних маршрутів'}`} onClick={() => setActiveStrategy(id)} className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl border px-1 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-[#1687FF] bg-gradient-to-b from-[#1687FF] to-[#0868DF] text-white shadow-[0_5px_14px_rgba(22,135,255,.25)]' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-[#20354A] dark:bg-[#0D1B28] dark:text-slate-200'}`}>
          <Icon size={18} className={`shrink-0 ${active ? 'text-white' : tone}`} aria-hidden="true"/><span className="whitespace-nowrap text-[10px] font-extrabold leading-tight sm:text-[11px]">{label}</span>
        </button>;
      })}
    </div>

    {result.partial && !result.partialReasons?.length && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Пошук має обмеження. Розкладні рейси показано за розкладом; наявність місць і тариф стороннього перевізника потрібно підтвердити у нього.</p>}
    {result.partialReasons?.includes('walking_routing_unavailable') && <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Пішохідні підходи до зупинок показано приблизно: сервіс побудови точного пішого маршруту не налаштований.</p>}
    {result.unsupportedPreferences.length > 0 && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Не всі умови можна врахувати: {result.unsupportedPreferences.map(value => preferenceMessages[value] ?? value).join('; ')}.</p>}
    {result.providerErrors.length > 0 && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">Деякі розклади тимчасово недоступні: {result.providerErrors.join('; ')}.</p>}
    {result.resultsTruncated && <p className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">Показано до {result.alternativeLimitPerStrategy ?? 12} різних варіантів на режим із {result.paretoCount ?? result.candidateCount ?? 'знайдених'} Pareto-варіантів. Результати обмежені, щоб пошук залишався швидким.</p>}
    {result.candidateGenerationTruncated && <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Пошук досяг ліміту обробки джерел; частина маршрутів могла не потрапити до результатів. Уточніть час або види транспорту й повторіть пошук.</p>}

    {shownJourneys.length ? <div className="space-y-1.5" data-testid="journey-results-list">{shownJourneys.map((journey, index) => <RouteResultCard key={journey.id} journey={journey} strategy={activeStrategy} index={index} onOpen={onOpenMap}/>)}</div>
      : <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-[#111820]">
        <p className="font-bold text-slate-800 dark:text-white">{result.journeys.length ? 'У цьому режимі немає маршрутів із достатніми даними' : 'Актуальних маршрутів поки немає'}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{result.journeys.length ? 'Спробуйте інший режим або змініть умови пошуку.' : 'Змініть час або види транспорту й повторіть пошук. Ми не показуємо вигадані пропозиції.'}</p>
      </div>}
  </section>;
}
