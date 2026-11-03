import { useEffect, useState } from 'react';
import {
  ArrowLeftRight, ChevronRight, Clock, Coins, Heart, Info, Scale, Star, Timer,
} from 'lucide-react';
import type { ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy } from '../services/productionApi';
import { CanonicalRouteLip } from '../design-system/journey/CanonicalRouteLip';
import type { JourneySegmentStripItem } from '../design-system/journey/JourneySegmentStrip';
import { journeyLegCaveat } from './journeyLegLabel';
import { formatTransferCount } from '../map/journeyRouteModel';
import {
  buildJourneyResultSegments, formatJourneyClock, formatJourneyDistance, formatJourneyDuration,
  formatJourneyDurationTile, journeyBoardingNote,
  searchPendingCopy, providerErrorNotices, stopWalkReachNotice, unavailableTransportNotices,
} from './journeyResultPresentation';
import { journeyPriceDisplay, legPriceDisplay } from './cashFare';
import { strategyJourneys } from './journeyStrategySelection';
import { diagnosticsRequested, funnelLines, splitResultNotices } from './resultsDiagnostics';

const FAVORITES_KEY = 'marshgo.saved-route-results.v1';

const strategyConfig: Array<{ id: ApiJourneyStrategy; label: string; Icon: typeof Scale; tone: string }> = [
  { id: 'BALANCED', label: 'Оптимальний', Icon: Scale, tone: 'text-[var(--mg-blue)]' },
  { id: 'FASTEST', label: 'Найшвидший', Icon: Timer, tone: 'text-[#FF9A32]' },
  { id: 'CHEAPEST', label: 'Найдешевший', Icon: Coins, tone: 'text-[#1FCB78]' },
];

/** Amber = a caveat about the data; rose = something failed; slate = something is simply unavailable here. */
const noticeTone = {
  rose: { dot: 'bg-rose-500', text: 'text-rose-800 dark:text-rose-100', softBg: 'bg-rose-50 dark:bg-rose-950/50' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-900 dark:text-amber-100', softBg: 'bg-amber-50 dark:bg-amber-950/40' },
  blue: { dot: 'bg-blue-500', text: 'text-blue-900 dark:text-blue-100', softBg: 'bg-blue-50 dark:bg-blue-950/40' },
  slate: { dot: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-300', softBg: 'bg-slate-100 dark:bg-slate-800/60' },
} as const;

function formatRouteCount(count: number): string {
  const plural = new Intl.PluralRules('uk-UA').select(count);
  const noun = plural === 'one' ? 'маршрут' : plural === 'few' ? 'маршрути' : 'маршрутів';
  return `${count} ${noun}`;
}

function journeyCaveats(journey: ApiJourney): string[] {
  return [...new Set(journey.legs.map(leg => journeyLegCaveat(leg.mode, leg.source, leg.scheduleSemantics, leg.fareSource)).filter((text): text is string => Boolean(text)))];
}

function RouteResultCard({ journey, strategy, index, caveats, onOpen }: {
  journey: ApiJourney;
  strategy: ApiJourneyStrategy;
  index: number;
  caveats: string[];
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
  const totalPrice = journeyPriceDisplay(journey).label;
  const legPrice = (leg: ApiJourney['legs'][number] | undefined) => (leg ? legPriceDisplay(leg).value : '—');
  const stripItems: JourneySegmentStripItem[] = segments.map(segment => ({
    id: segment.id,
    mode: segment.mode,
    transportType: segment.leg?.transportType,
    label: segment.label,
    selectionLabel: segment.label + (segment.leg?.routeName ? ' ' + segment.leg.routeName : ''),
    accessibilityLabel: segment.label + (segment.leg?.routeName ? ', маршрут ' + segment.leg.routeName : '') + ', ' + formatJourneyDuration(segment.durationSeconds) + ', ' + legPrice(segment.leg),
    durationSeconds: segment.durationSeconds,
    durationLabel: formatJourneyDurationTile(segment.durationSeconds),
    priceLabel: legPrice(segment.leg),
    color: segment.color,
  }));
  const startAt = journey.requestedDepartureAt ?? firstLeg.departureAt;
  const boardingLabel = journeyBoardingNote(journey);
  const openLabel = `Відкрити маршрут: ${firstLeg.origin.name} — ${lastLeg.destination.name}, ${formatJourneyDuration(journey.totalDurationSeconds)}, ${totalPrice === '—' ? 'ціна уточнюється' : totalPrice}${boardingLabel ? `, ${boardingLabel}` : ''}`;

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
    data-top-pick={index === 0 ? 'true' : undefined}
    className={`journey-result-card relative isolate overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_3px_14px_rgba(30,64,110,.07)] dark:bg-[#0B1A27] dark:shadow-[0_4px_18px_rgba(0,0,0,.18)]`}
  >
    <button type="button" aria-label={openLabel} onClick={() => onOpen(journey)} className="absolute inset-0 z-0 h-full w-full rounded-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <span className="sr-only">Переглянути карту й деталі маршруту</span>
    </button>
    <div className="journey-result-card-content pointer-events-none relative z-10 p-2">
      <CanonicalRouteLip
        durationLabel={formatJourneyDuration(journey.totalDurationSeconds)}
        durationTitle={`Виїзд ${formatJourneyClock(startAt)} · прибуття ${formatJourneyClock(lastLeg.arrivalAt)}`}
        durationClassName="journey-result-duration"
        priceLabel={totalPrice}
        priceAccessibleLabel={`Загальна вартість: ${totalPrice === '—' ? 'невідома' : totalPrice}`}
        priceClassName="journey-result-total-price"
        priceUnavailable={totalPrice === '—'}
        priceCaption={totalPrice === '—' ? <span data-testid="journey-result-price-caption" className="block max-w-[7.5rem] truncate text-[10px] font-semibold leading-4 text-slate-500 dark:text-slate-400">тариф невідомий</span> : undefined}
        summaryNote={index === 0 ? <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[var(--mg-blue-tint)] px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[.07em] text-[var(--mg-blue-ink)]"><Star size={10} className="shrink-0 fill-current" aria-hidden="true"/>Рекомендований</span> : undefined}
        actionsClassName="journey-result-actions flex shrink-0 items-center gap-1"
        summaryRowClassName="journey-result-header"
        actions={<>
          <span data-strategy={strategyItem.id} aria-label={strategyItem.label} title={strategyItem.label} className={`journey-result-action-badge grid h-8 w-8 shrink-0 place-items-center rounded-full border ${strategyItem.id === 'FASTEST' ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-300' : strategyItem.id === 'CHEAPEST' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300'}`}><StrategyIcon size={18} strokeWidth={2.2} aria-hidden="true"/></span>
          <span aria-label={formatTransferCount(journey.transfers)} title={formatTransferCount(journey.transfers)} className="journey-result-transfer-badge inline-flex h-8 shrink-0 items-center gap-1 rounded-full border bg-slate-100 px-1.5 text-[10px] font-extrabold tabular-nums text-slate-700 dark:bg-[#15283A] dark:text-slate-200"><ArrowLeftRight size={13} aria-hidden="true"/>{journey.transfers}</span>
          <button type="button" aria-label={saved ? 'Видалити маршрут зі збережених' : 'Зберегти маршрут'} aria-pressed={saved} onClick={toggleSaved} onPointerDown={event => event.stopPropagation()} className="journey-result-save-button pointer-events-auto relative z-20 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-transparent text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800" title={saved ? 'Збережено на цьому пристрої' : 'Зберегти маршрут'}>
            <span className="journey-result-save-visual"><Heart size={19} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-rose-500' : ''} aria-hidden="true"/></span>
          </button>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300" aria-hidden="true"><ChevronRight size={18}/></span>
        </>}
        items={stripItems}
        ariaLabel="Послідовність етапів маршруту"
        className="pointer-events-none"
        stripClassName="mt-1.5 pointer-events-none"
        durationNote={waitingSeconds > 0 ? <span data-testid="journey-result-wait" className="text-[10px] font-semibold leading-4 tabular-nums text-slate-500 dark:text-slate-400">Очікування · {formatJourneyDuration(waitingSeconds)}</span> : undefined}
      />
      {boardingLabel && (
        <p data-testid="journey-result-boarding" className="mt-1 flex items-center gap-1 text-[10px] font-semibold leading-4 tabular-nums text-slate-600 dark:text-slate-300">
          <Clock size={10} className="shrink-0" aria-hidden="true"/>
          {boardingLabel}
        </p>
      )}
      {segments.map(segment => segment.leg && <span key={segment.id} className="sr-only">{formatJourneyDistance(segment.leg.distanceMeters)}</span>)}
      {caveats.length > 0 && <p className="journey-result-caveat mt-1 text-[10px] leading-4 text-amber-800 dark:text-amber-200">{caveats.join(' ')}</p>}
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      <span className="sr-only">Виїзд {formatJourneyClock(startAt)}, прибуття {formatJourneyClock(lastLeg.arrivalAt)}{waitingSeconds > 0 ? `, очікування ${formatJourneyDuration(waitingSeconds)}` : ''}{boardingLabel ? `, ${boardingLabel}` : ''}.</span>
    </div>
  </article>;
}

/**
 * Shown while a journey search is in flight. Multi-provider corridors really do take tens of
 * seconds, so the only honest progress signal is measured elapsed time plus a skeleton of the
 * cards that are about to arrive.
 */
export function JourneySearchPending({ startedAt }: { startedAt: number }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
  useEffect(() => {
    setElapsedSeconds(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    const timer = window.setInterval(() => setElapsedSeconds(Math.max(0, Math.round((Date.now() - startedAt) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const copy = searchPendingCopy(elapsedSeconds);
  return <section className="journey-results mt-3 space-y-2" aria-busy="true" data-testid="journey-search-pending">
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-[13px] font-bold leading-5 text-slate-700 dark:text-slate-200">
      <span className="mg-live-dot inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--mg-blue)]" aria-hidden="true" />
      <span className="tabular-nums">{copy.title}</span>
    </p>
    {copy.note && <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">{copy.note}</p>}
    {[0, 1, 2].map(i => <div
      key={i}
      className="mg-rise mg-stagger flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/50"
      style={{ '--mg-stagger-i': i } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="mg-skeleton h-11 w-11 shrink-0 rounded-xl" />
      <span className="min-w-0 flex-1 space-y-2 pt-0.5">
        <span className="mg-skeleton block h-3 w-2/3" />
        <span className="mg-skeleton block h-3 w-1/3" />
      </span>
      <span className="mg-skeleton h-8 w-16 shrink-0 rounded-lg" />
    </div>)}
  </section>;
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
  const shownCaveats = shownJourneys.map(journeyCaveats);
  // A caveat repeated on every card is one fact about the search, not about a route.
  const sharedCaveats = shownJourneys.length
    ? shownCaveats[0].filter(text => shownCaveats.every(list => list.includes(text)))
    : [];

  const preferenceMessages: Record<string, string> = {
    preferredVehicleClass: 'клас автомобіля не застосовується до розкладів громадського транспорту',
    'maxPriceMinor:public-transit-fare-unavailable': 'обмеження ціни не застосовується до рейсів без тарифів у джерелі',
    'CHEAPEST:public-transit-fares-unavailable': 'найдешевший варіант серед розкладів без оприлюднених тарифів визначити неможливо',
    'maxTransfers:limited-to-4': 'планувальник будує максимум чотири пересадки',
  };

  // Transport-type tokens are availability facts, not preferences: they get their own honest lines.
  const unavailable = unavailableTransportNotices(result.blockedProviders, result.unsupportedPreferences, result.completeness);
  const walkReach = stopWalkReachNotice(result.partialReasons ?? [], result.completeness);
  const notices: Array<{ tone: 'amber' | 'blue' | 'rose' | 'slate'; text: string }> = [];
  if (result.partial && !result.partialReasons?.length) notices.push({ tone: 'amber', text: 'Пошук має обмеження. Розкладні рейси показано за розкладом; наявність місць і тариф стороннього перевізника потрібно підтвердити у нього.' });
  if (result.partialReasons?.includes('walking_routing_unavailable')) notices.push({ tone: 'amber', text: 'Піші ділянки частини варіантів показано як оцінку: пішохідний маршрутизатор не підтвердив для них реальний шлях.' });
  if (walkReach) notices.push({ tone: 'amber', text: walkReach });
  const preferenceTokens = result.unsupportedPreferences.filter(token => !token.startsWith('transportType:'));
  if (preferenceTokens.length > 0) notices.push({ tone: 'amber', text: `Не всі умови можна врахувати: ${preferenceTokens.map(value => preferenceMessages[value] ?? value).join('; ')}.` });
  providerErrorNotices(result.providerErrors).forEach(notice => notices.push(notice));
  if (result.resultsTruncated) notices.push({ tone: 'blue', text: `Показано до ${result.alternativeLimitPerStrategy ?? 12} різних варіантів на режим із ${result.paretoCount ?? result.candidateCount ?? 'знайдених'} Pareto-варіантів. Результати обмежені, щоб пошук залишався швидким.` });
  if (result.candidateGenerationTruncated) notices.push({ tone: 'amber', text: 'Пошук не охопив усі можливі варіанти в частині джерел. Деякі маршрути можуть бути відсутні; спробуйте змінити час або види транспорту.' });
  unavailable.forEach(notice => notices.push({ tone: 'slate', text: notice.text }));
  sharedCaveats.forEach(text => notices.push({ tone: 'amber', text }));
  const { headline, technical } = splitResultNotices(notices);
  const showDiagnostics = diagnosticsRequested(
    typeof window !== 'undefined' ? window.location.search : '',
    typeof window !== 'undefined' ? window.localStorage.getItem('marshgo.results.diagnostics') : null,
  );
  const funnel = showDiagnostics ? funnelLines(result) : [];

  return <section aria-label="Результати мультимодального пошуку" className="mt-2">
    <div role="group" aria-label="Режим пошуку маршрутів" className="mb-2 grid grid-cols-3 gap-1.5">
      {strategyConfig.map(({ id, label, Icon, tone }) => {
        const count = strategyJourneys(result, id).length;
        const active = activeStrategy === id;
        const disabled = count === 0;
        const filled = active && !disabled;
        return <button key={id} type="button" disabled={disabled} aria-pressed={active} aria-label={`${label}${count ? `, ${formatRouteCount(count)}` : ', немає доступних маршрутів'}`} onClick={() => setActiveStrategy(id)} className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl border px-1 text-center transition-colors disabled:cursor-not-allowed ${filled ? 'border-[var(--mg-action)] bg-[var(--mg-action)] text-white shadow-[0_5px_14px_rgba(11,99,214,.25)]' : `border-[var(--mg-line)] bg-[var(--mg-surface-tint)] text-[var(--mg-ink)] ${active ? 'border-[var(--mg-action)]' : disabled ? 'opacity-70' : 'hover:border-[var(--mg-blue)]'}`}`}>
          <Icon size={18} className={`shrink-0 ${filled ? 'text-white' : tone}`} aria-hidden="true"/><span className="whitespace-nowrap text-[10px] font-extrabold leading-tight sm:text-[11px]">{label}</span>
        </button>;
      })}
    </div>

    {headline && <p role="status" className={`search-headline-note mb-2 flex items-start gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold leading-4 ${noticeTone[headline.tone].softBg} ${noticeTone[headline.tone].text}`}><Info size={13} className="mt-0.5 shrink-0" aria-hidden="true"/><span>{headline.text}</span></p>}
    {showDiagnostics && (technical.length > 0 || funnel.length > 0) && <details className="search-notices mb-3 rounded-2xl border border-slate-200 bg-slate-50 dark:border-[#20354A] dark:bg-[#0D1B28]">
      <summary aria-label="Діагностика пошуку для розробників" className="search-notices-summary flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
        <Info size={14} aria-hidden="true"/>
        <span className="flex-1">Діагностика пошуку</span>
        <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 tabular-nums dark:bg-[#15283A]">{technical.length + funnel.length}</span>
        <ChevronRight size={16} aria-hidden="true" className="search-notices-chevron shrink-0"/>
      </summary>
      <ul className="search-notices-list space-y-1.5 px-3 pb-3">
        {technical.map(notice => <li key={notice.text} className="flex gap-2 text-[11px] leading-4">
          <span aria-hidden="true" className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${noticeTone[notice.tone].dot}`}/>
          <span className={noticeTone[notice.tone].text}>{notice.text}</span>
        </li>)}
        {funnel.map(line => <li key={line} className="font-mono text-[10px] leading-4 text-slate-600 dark:text-slate-300">{line}</li>)}
      </ul>
    </details>}

    {shownJourneys.length ? <div className="space-y-1.5" data-testid="journey-results-list">{shownJourneys.map((journey, index) => <RouteResultCard key={journey.id} journey={journey} strategy={activeStrategy} index={index} caveats={shownCaveats[index].filter(text => !sharedCaveats.includes(text))} onOpen={onOpenMap}/>)}</div>
      : <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-[#111820]">
        <p className="font-bold text-slate-800 dark:text-white">{result.journeys.length ? 'У цьому режимі немає маршрутів із достатніми даними' : 'Актуальних маршрутів поки немає'}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{result.journeys.length
          ? 'Спробуйте інший режим або змініть умови пошуку.'
          : walkReach ?? 'Змініть час або види транспорту й повторіть пошук. Ми не показуємо вигадані пропозиції.'}</p>
        {unavailable.length > 0 && <ul className="mx-auto mt-3 max-w-sm space-y-1.5 text-left">
          {unavailable.map(notice => <li key={notice.mode} className="flex gap-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"/>
            <span>{notice.text}</span>
          </li>)}
        </ul>}
      </div>}
  </section>;
}
