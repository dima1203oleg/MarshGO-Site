import { useEffect, useState } from 'react';
import { Coins, Scale, Timer } from 'lucide-react';
import type { ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy } from '../services/productionApi';
import { CanonicalRouteLip } from '../design-system/journey/CanonicalRouteLip';
import type { JourneySegmentStripItem } from '../design-system/journey/JourneySegmentStrip';
import { journeyLegCaveat } from './journeyLegLabel';
import { hasUnrankedJourney, journeysForStrategy, journeyForSelectedStrategy } from './journeyStrategies';
import { journeyPreferenceMessage } from './journeyPreferenceMessages';
import {
  buildJourneyResultSegments, formatJourneyClock, formatJourneyDuration,
  formatJourneySegmentPrice, formatJourneyTotalPrice,
} from './journeyResultPresentation';

const FAVORITES_KEY = 'marshgo.saved-route-results.v1';

const strategyConfig: Array<{ id: ApiJourneyStrategy; label: string; Icon: typeof Scale; tone: string }> = [
  { id: 'BALANCED', label: 'Оптимальний', Icon: Scale, tone: 'text-[#1687FF]' },
  { id: 'FASTEST', label: 'Найшвидший', Icon: Timer, tone: 'text-[#FF9A32]' },
  { id: 'CHEAPEST', label: 'Найдешевший', Icon: Coins, tone: 'text-[#1FCB78]' },
];

function formatRouteCount(count: number): string {
  const plural = new Intl.PluralRules('uk-UA').select(count);
  const noun = plural === 'one' ? 'маршрут' : plural === 'few' ? 'маршрути' : 'маршрутів';
  return `${count} ${noun}`;
}

function formatDistance(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters) || meters < 0) return 'відстань невідома';
  return meters >= 1000
    ? `${(meters / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км`
    : `${Math.round(meters)} м`;
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
  const strategyItem = strategyConfig.find(item => item.id === strategy) ?? strategyConfig[0];
  const openSelectedJourney = () => onOpen(journeyForSelectedStrategy(journey, strategy));
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
  const openLabel = `Відкрити маршрут: ${journey.origin?.name ?? firstLeg.origin.name} — ${journey.destination?.name ?? lastLeg.destination.name}, ${formatJourneyDuration(journey.totalDurationSeconds)}, ${totalPrice === '—' ? 'ціна уточнюється' : totalPrice}`;

  const toggleSaved = (nextSaved = !saved) => {
    let ids: string[] = [];
    try {
      const existing = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]') as unknown;
      if (Array.isArray(existing)) ids = existing.filter((id): id is string => typeof id === 'string');
    } catch { /* Start a clean local list when saved browser data is invalid. */ }
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
    <button type="button" aria-hidden="true" tabIndex={-1} aria-label={openLabel} onClick={openSelectedJourney} className="absolute inset-0 z-0 h-full w-full rounded-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <span className="sr-only">Переглянути карту й деталі маршруту</span>
    </button>
    <div className="journey-result-card-content pointer-events-none relative z-10 p-2">
      <CanonicalRouteLip
        journeyId={journey.id}
        totalDurationSeconds={journey.totalDurationSeconds}
        totalPriceMinor={journey.confirmedPriceMinor ?? journey.totalPriceMinor}
        currency={journey.currency}
        priceStatus={journey.confirmedPriceMinor !== null ? 'LOCKED' : journey.priceStatus}
        hasUnknownPrice={totalPrice === '—'}
        transferCount={journey.transfers}
        strategy={strategyItem.id}
        segments={stripItems}
        favorite={saved}
        availabilityStatus={journey.state}
        actionLabel={openLabel}
        onOpenDetails={openSelectedJourney}
        onFavoriteChange={toggleSaved}
        className="pointer-events-none"
      />
      {waitingSeconds > 0 && <p data-testid="journey-result-wait" className="mt-1 text-right text-[9px] font-semibold leading-3 tabular-nums text-slate-500 dark:text-slate-400">Очікування · {formatJourneyDuration(waitingSeconds)}</p>}
      {segments.map(segment => segment.leg && <span key={segment.id} className="sr-only">{formatDistance(segment.leg.distanceMeters)}</span>)}
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
  const defaultStrategy = requestedStrategy && journeysForStrategy(result, requestedStrategy).length > 0
    ? requestedStrategy
    : journeysForStrategy(result, 'BALANCED').length > 0 ? 'BALANCED'
      : strategyConfig.find(strategy => journeysForStrategy(result, strategy.id).length > 0)?.id ?? 'BALANCED';
  const [activeStrategy, setActiveStrategy] = useState<ApiJourneyStrategy>(defaultStrategy);
  useEffect(() => setActiveStrategy(defaultStrategy), [result, defaultStrategy]);
  const shownJourneys = journeysForStrategy(result, activeStrategy);

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
        const count = journeysForStrategy(result, id).length;
        const active = activeStrategy === id;
        return <button key={id} type="button" disabled={count === 0} aria-pressed={active} aria-label={`${label}${count ? `, ${formatRouteCount(count)}` : ', немає доступних маршрутів'}`} onClick={() => setActiveStrategy(id)} className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl border px-1 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-[#1687FF] bg-gradient-to-b from-[#1687FF] to-[#0868DF] text-white shadow-[0_5px_14px_rgba(22,135,255,.25)]' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-[#20354A] dark:bg-[#0D1B28] dark:text-slate-200'}`}>
          <Icon size={18} className={`shrink-0 ${active ? 'text-white' : tone}`} aria-hidden="true"/><span className="whitespace-nowrap text-[10px] font-extrabold leading-tight sm:text-[11px]">{label}</span>
        </button>;
      })}
    </div>

    {result.partial && !result.partialReasons?.length && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Пошук має обмеження. Розкладні рейси показано за розкладом; наявність місць і тариф стороннього перевізника потрібно підтвердити у нього.</p>}
    {hasUnrankedJourney(result) && <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Для частини маршрутів сервер не надав рейтинг. Їх порядок сформовано локально за базовими показниками й він може не враховувати повну багатокритеріальну оцінку.</p>}
    {result.partialReasons?.includes('walking_routing_unavailable') && <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Пішохідні підходи до зупинок показано приблизно: сервіс побудови точного пішого маршруту не налаштований.</p>}
    {result.unsupportedPreferences.length > 0 && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Не всі умови можна врахувати: {result.unsupportedPreferences.map(value => preferenceMessages[value] ?? journeyPreferenceMessage(value) ?? value).join('; ')}.</p>}
    {result.providerErrors.length > 0 && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">Деякі розклади тимчасово недоступні: {result.providerErrors.join('; ')}.</p>}
    {result.resultsTruncated && <p className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">Показано до {result.alternativeLimitPerStrategy ?? 12} різних варіантів на режим із {result.paretoCount ?? result.candidateCount ?? 'знайдених'} Pareto-варіантів. {result.resultSamplingTruncated ? 'Частина альтернатив не увійшла до списку; це обмеження вибірки, а не помилка джерела.' : 'Результати обмежені, щоб пошук залишався швидким.'}</p>}
    {result.candidateGenerationTruncated && <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Пошук досяг ліміту обробки джерел; частина маршрутів могла не потрапити до результатів. Уточніть час або види транспорту й повторіть пошук.</p>}

    {shownJourneys.length ? <div className="space-y-1.5" data-testid="journey-results-list">{shownJourneys.map((journey, index) => <RouteResultCard key={journey.id} journey={journey} strategy={activeStrategy} index={index} onOpen={onOpenMap}/>)}</div>
      : <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-[#111820]">
        <p className="font-bold text-slate-800 dark:text-white">{result.journeys.length ? 'У цьому режимі немає маршрутів із достатніми даними' : 'Актуальних маршрутів поки немає'}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{result.journeys.length ? 'Спробуйте інший режим або змініть умови пошуку.' : 'Змініть час або види транспорту й повторіть пошук. Ми не показуємо вигадані пропозиції.'}</p>
      </div>}
  </section>;
}
