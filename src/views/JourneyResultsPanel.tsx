import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight, Check, ChevronRight, Coins, Heart, Info, Scale, Timer, X,
} from 'lucide-react';
import type { ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy } from '../services/productionApi';
import { CanonicalRouteLip } from '../design-system/journey/CanonicalRouteLip';
import type { JourneySegmentStripItem } from '../design-system/journey/JourneySegmentStrip';
import { journeyLegCaveat } from './journeyLegLabel';
import { formatTransferCount } from '../map/journeyRouteModel';
import {
  buildJourneyResultSegments, formatJourneyDuration,
  formatJourneyDurationTile,
  journeyRouteBadge, providerErrorNotices, searchPendingCopy, unavailableTransportNotices,
} from './journeyResultPresentation';
import { journeyPriceDisplay, legPriceDisplay, type JourneyPriceDisplay } from './cashFare';
import { strategyJourneys } from './journeyStrategySelection';
import { groupJourneyDepartures, journeyGroupAlternatives } from './journeyDepartureGrouping';
import { diagnosticsRequested, funnelLines, gtfsTruncationNotices, partialReasonNotices, splitResultNotices, truncationNotices } from './resultsDiagnostics';
import { JOURNEY_EMPTY_PROVIDER_FAILURE_COPY, JOURNEY_EMPTY_PROVIDER_FAILURE_TITLE, journeyEmptyStateKind, journeyNoRoutesCopy } from './journeySearchRecovery';
import { sensory } from '../sensory';

const FAVORITES_KEY = 'marshgo.saved-route-results.v1';

type PanelStrategy = 'BALANCED' | 'FASTEST' | 'CHEAPEST';

const strategyConfig: Array<{ id: PanelStrategy; label: string; Icon: typeof Scale; tone: string }> = [
  { id: 'BALANCED', label: 'Оптимальний', Icon: Scale, tone: 'text-[var(--mg-blue)]' },
  { id: 'FASTEST', label: 'Найшвидший', Icon: Timer, tone: 'text-[var(--mg-amber)]' },
  { id: 'CHEAPEST', label: 'Найдешевший', Icon: Coins, tone: 'text-[var(--mg-green)]' },
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

/** The spoken price carries its basis: 45 ₴ paid in the vehicle is a different promise than a 45 ₴ quote. */
export function spokenJourneyPrice(price: JourneyPriceDisplay): string {
  if (price.label === '—') return 'ціна уточнюється';
  return price.caption ? `${price.label} ${price.caption}` : price.label;
}

function journeyCaveats(journey: ApiJourney): string[] {
  return [...new Set(journey.legs.map(leg => journeyLegCaveat(leg.mode, leg.source, leg.scheduleSemantics, leg.fareSource)).filter((text): text is string => Boolean(text)))];
}

function RouteResultCard({ journey, alternatives, chosen, recommendation, onOpen }: {
  journey: ApiJourney;
  alternatives: ApiJourney[];
  chosen: boolean;
  recommendation?: string;
  onOpen: (journey: ApiJourney, alternatives: ApiJourney[], recommendation?: string) => void;
}) {
  // The card is a scan surface: waits and source notes remain in route details, while the
  // compact chain shows only actual modes and their durations.
  const segments = buildJourneyResultSegments(journey).filter(segment => segment.kind === 'LEG');
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
  const journeyPrice = journeyPriceDisplay(journey);
  const totalPrice = journeyPrice.label;
  const legPrice = (leg: ApiJourney['legs'][number] | undefined) => (!leg || leg.mode === 'WALK' ? '' : legPriceDisplay(leg).value);
  const stripItems: JourneySegmentStripItem[] = segments.map(segment => {
    const priceText = legPrice(segment.leg);
    return {
      id: segment.id,
      mode: segment.mode,
      transportType: segment.leg?.transportType,
      label: segment.label,
      badge: journeyRouteBadge(segment.leg?.routeName),
      selectionLabel: segment.label + (segment.leg?.routeName ? ' ' + segment.leg.routeName : ''),
      accessibilityLabel: segment.label + (segment.leg?.routeName ? ', маршрут ' + segment.leg.routeName : '') + ', ' + formatJourneyDuration(segment.durationSeconds) + (priceText ? ', ' + priceText : ''),
      durationSeconds: segment.durationSeconds,
      durationLabel: formatJourneyDurationTile(segment.durationSeconds),
      // Segment prices are available in route details; the compact chain carries duration only.
      priceLabel: '',
      color: segment.color,
    };
  });
  const openLabel = `Відкрити деталі маршруту: ${firstLeg.origin.name} — ${lastLeg.destination.name}, ${formatJourneyDuration(journey.totalDurationSeconds)}, ${spokenJourneyPrice(journeyPrice)}`;

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
      // Feedback follows the real write result: a soft pop only once the save landed.
      sensory.emit({ type: 'FAVORITE_TOGGLED', saved: nextSaved });
    } catch {
      setAnnouncement('Не вдалося зберегти маршрут на цьому пристрої');
      sensory.emit({ type: 'ERROR_SOFT' });
    }
  };

  const open = () => { sensory.emit({ type: 'RESULT_SELECTED', journeyId: journey.id }); onOpen(journey, alternatives, recommendation); };

  return <article
    data-testid="journey-result-card"
    data-journey-id={journey.id}
    data-chosen={chosen ? 'true' : undefined}
    data-group-size={alternatives.length + 1}
    className={`journey-result-card mg-press-subtle relative isolate overflow-hidden rounded-[var(--mg-radius-lg)] border bg-[var(--mg-surface-card)] transition-all duration-[var(--mg-dur-fast)] ${chosen ? 'border-[var(--mg-action)] ring-1 ring-[var(--mg-action)] shadow-[0_4px_20px_rgba(11,99,214,.18)]' : 'border-[var(--mg-line)] hover:border-[var(--mg-action-subtle)] shadow-[0_3px_14px_rgba(30,64,110,.07)] dark:shadow-[0_4px_18px_rgba(0,0,0,.18)]'}`}
  >
    <button type="button" aria-label={openLabel} onClick={open} className="absolute inset-0 z-0 h-full w-full rounded-[var(--mg-radius-lg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <span className="sr-only">Переглянути карту й деталі маршруту</span>
    </button>
    <div className="journey-result-card-content pointer-events-none relative z-10 p-1.5">
      <CanonicalRouteLip
        durationLabel={formatJourneyDuration(journey.totalDurationSeconds)}
        durationClassName="journey-result-duration"
        priceLabel={totalPrice}
        priceAccessibleLabel={`Загальна вартість: ${totalPrice === '—' ? 'невідома' : spokenJourneyPrice(journeyPrice)}`}
        priceClassName="journey-result-total-price"
        priceUnavailable={totalPrice === '—'}
        actionsClassName="journey-result-actions flex shrink-0 items-center gap-1"
        summaryRowClassName="journey-result-header"
        actions={<>
          <span data-testid="journey-result-transfers" aria-label={formatTransferCount(journey.transfers)} title={formatTransferCount(journey.transfers)} className="journey-result-transfer-badge inline-flex h-8 shrink-0 items-center gap-1 rounded-full border bg-slate-100 px-1.5 text-xs font-extrabold tabular-nums text-slate-700 dark:bg-[var(--mg-surface-tint)] dark:text-slate-200"><ArrowLeftRight size={13} aria-hidden="true"/>{journey.transfers}</span>
          <button type="button" aria-label={saved ? 'Видалити маршрут зі збережених' : 'Зберегти маршрут'} aria-pressed={saved} onClick={toggleSaved} onPointerDown={event => event.stopPropagation()} className="journey-result-save-button mg-press-subtle pointer-events-auto relative z-20 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-transparent text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800" title={saved ? 'Збережено на цьому пристрої' : 'Зберегти маршрут'}>
            <span className={`journey-result-save-visual${saved ? ' mg-pop' : ''}`}><Heart size={19} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-rose-500' : ''} aria-hidden="true"/></span>
          </button>
          <button type="button" data-testid="journey-result-details-button" aria-label={chosen ? `Обраний маршрут. ${openLabel}` : openLabel} onClick={open} onPointerDown={event => event.stopPropagation()} className="journey-result-details-button mg-press-subtle pointer-events-auto relative z-20 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--mg-line)] bg-[var(--mg-surface-tint)] text-[var(--mg-blue-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)] dark:text-[var(--mg-blue)]">
            {chosen ? <Check size={18} strokeWidth={2.6} aria-hidden="true"/> : <ChevronRight size={18} aria-hidden="true"/>}
          </button>
        </>}
        items={stripItems}
        ariaLabel="Послідовність етапів маршруту"
        className="pointer-events-none"
        stripClassName="mt-0.5 pointer-events-auto"
      />
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
  </article>;
}

/**
 * Shown while a journey search is in flight. Multi-provider corridors really do take tens of
 * seconds, so the only honest progress signal is measured elapsed time plus a skeleton of the
 * cards that are about to arrive.
 */
export function JourneySearchPending({ startedAt, onCancel }: { startedAt: number; onCancel?: () => void }) {
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
    {copy.note && <p className="text-xs leading-4 text-slate-500 dark:text-slate-400">{copy.note}</p>}
    {onCancel && <button type="button" onClick={onCancel} data-testid="journey-search-cancel" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 text-xs font-bold text-slate-700 transition-colors hover:border-[var(--mg-action)] hover:text-[var(--mg-blue-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)] dark:border-slate-700 dark:text-slate-100 dark:hover:text-[var(--mg-blue)]">
      <X size={13} aria-hidden="true" />Скасувати пошук
    </button>}
    {[0, 1, 2].map(i => <div
      key={i}
      className="mg-rise mg-stagger rounded-2xl border border-slate-200/70 bg-white/70 p-2.5 dark:border-slate-700/60 dark:bg-slate-900/50"
      style={{ '--mg-stagger-i': i } as React.CSSProperties}
      aria-hidden="true"
    >
      {/* The placeholder mirrors the real card: summary row, proportion bar, stage tiles, clock row. */}
      <span className="flex items-center justify-between gap-3">
        <span className="mg-skeleton h-5 w-24 rounded-md" />
        <span className="mg-skeleton h-5 w-14 rounded-md" />
        <span className="mg-skeleton h-8 w-8 shrink-0 rounded-full" />
      </span>
      <span className="mg-skeleton mt-2 block h-1.5 w-full rounded-full" />
      <span className="mt-1.5 flex gap-2">
        <span className="mg-skeleton h-8 flex-1 rounded-lg" />
        <span className="mg-skeleton h-8 flex-1 rounded-lg" />
        <span className="mg-skeleton h-8 flex-1 rounded-lg" />
      </span>
      <span className="mg-skeleton mt-2 block h-3 w-1/2" />
    </div>)}
  </section>;
}

export function JourneyResultsPanel({ result, chosenJourneyId, onOpenMap, onRetry }: {
  result: ApiJourneySearchResult;
  chosenJourneyId?: string | null;
  onOpenMap: (journey: ApiJourney, alternatives: ApiJourney[], recommendation?: string) => void;
  onRetry?: () => void;
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
  const strategyCounts = useMemo(() => ({
    BALANCED: strategyJourneys(result, 'BALANCED').length,
    FASTEST: strategyJourneys(result, 'FASTEST').length,
    CHEAPEST: strategyJourneys(result, 'CHEAPEST').length,
  }), [result]);
  const groups = useMemo(() => groupJourneyDepartures(shownJourneys), [shownJourneys]);
  const shownCaveats = new Map(shownJourneys.map(journey => [journey.id, journeyCaveats(journey)]));
  // A caveat on most cards is one fact about the data source, so it is stated once above the list
  // instead of repeating on every card; card-level warnings keep only what is unique to a route.
  const caveatCounts = new Map<string, number>();
  for (const caveats of shownCaveats.values()) {
    for (const text of new Set(caveats)) caveatCounts.set(text, (caveatCounts.get(text) ?? 0) + 1);
  }
  const dominantCaveats = [...caveatCounts.entries()]
    .filter(([, count]) => shownJourneys.length >= 2 && count >= Math.ceil(shownJourneys.length / 2))
    .map(([text]) => text);
  const gtfsLimits = gtfsTruncationNotices(result);

  const preferenceMessages: Record<string, string> = {
    preferredVehicleClass: 'клас автомобіля не застосовується до розкладів громадського транспорту',
    'maxPriceMinor:public-transit-fare-unavailable': 'обмеження ціни не застосовується до рейсів без тарифів у джерелі',
    'CHEAPEST:public-transit-fares-unavailable': 'найдешевший варіант серед розкладів без оприлюднених тарифів визначити неможливо',
    'maxTransfers:limited-to-4': 'планувальник будує максимум чотири пересадки',
  };

  // Transport-type tokens are availability facts, not preferences: they get their own honest lines.
  const unavailable = unavailableTransportNotices(result.blockedProviders, result.unsupportedPreferences, result.completeness);
  const notices: Array<{ tone: 'amber' | 'blue' | 'rose' | 'slate'; text: string }> = [];
  const reasonNotices = partialReasonNotices(result.partialReasons, result.completeness);
  reasonNotices.forEach(notice => notices.push(notice));
  // The limits summary above already names every partial stage; this line only adds the
  // provenance fact a passenger must act on, so it stays one short sentence.
  if (result.partial && !reasonNotices.length) notices.push({ tone: 'amber', text: 'Розклади показано за джерелом; місця й тариф стороннього перевізника не підтверджені.' });
  const preferenceTokens = result.unsupportedPreferences.filter(token => !token.startsWith('transportType:'));
  // Provider and preference messages arrive as full sentences (often already
  // ending with a period); trim their terminal punctuation so the wrapper
  // below adds exactly one period instead of rendering "маршрут..".
  const sentenceList = (items: string[]) => items.map(item => item.trim().replace(/[.;]+$/, '')).filter(Boolean).join('; ');
  const isTechnicalRouterMsg = (msg: string) => /маршрутизатор|відхилено|ліміт|обмежив пошук|алгоритм|pareto|osrm/i.test(msg);
  const userProviderErrors = result.providerErrors.filter(err => !isTechnicalRouterMsg(err));
  const technicalProviderErrors = result.providerErrors.filter(isTechnicalRouterMsg);

  if (preferenceTokens.length > 0) notices.push({ tone: 'amber', text: `Не всі умови можна врахувати: ${sentenceList(preferenceTokens.map(value => preferenceMessages[value] ?? value))}.` });
  providerErrorNotices(userProviderErrors).forEach(notice => notices.push(notice));
  truncationNotices(result).forEach(notice => notices.push(notice));
  unavailable.forEach(notice => notices.push({ tone: 'slate', text: notice.text }));
  technicalProviderErrors.forEach(text => notices.push({ tone: 'slate', text }));
  const { headline, technical } = splitResultNotices(notices);
  const blockingHeadline = headline?.tone === 'rose' ? headline : null;
  const detailNotices = blockingHeadline ? technical : [...notices];
  const showDiagnostics = diagnosticsRequested(
    typeof window !== 'undefined' ? window.location.search : '',
    typeof window !== 'undefined' ? window.localStorage.getItem('marshgo.results.diagnostics') : null,
  );
  const funnel = showDiagnostics ? funnelLines(result) : [];

  return <section aria-label="Результати мультимодального пошуку" className="mt-2">
    {/* One row at every width: three stacked chips cost 151 px on a 320×568 screen, where the
        first card then never fits. The label sits above its own count, so even a 92 px track
        holds «Найдешевший» at the 12 px floor without breaking the word. */}
    <div role="group" aria-label="Режим пошуку маршрутів" className="mg-domino-selection mb-2 grid max-w-md grid-cols-3 gap-1.5" style={{ '--domino-selected': Math.max(0, strategyConfig.findIndex(item => item.id === activeStrategy)) } as React.CSSProperties} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
      event.preventDefault();
      buttons[next]?.focus();
      buttons[next]?.click();
    }}>
      {strategyConfig.map(({ id, label, Icon, tone }) => {
        const count = strategyCounts[id];
        const active = activeStrategy === id;
        const disabled = count === 0;
        const filled = active && !disabled;
        return <button key={id} type="button" disabled={disabled} aria-pressed={active} aria-label={`${label}${count ? `, ${formatRouteCount(count)}` : ', немає доступних маршрутів'}`} onClick={() => { if (id !== activeStrategy) sensory.emit({ type: 'SORT_CHANGED', strategy: id }); setActiveStrategy(id); }} className={`mg-pill-switch mg-press-subtle flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl border px-1 text-center transition-colors disabled:cursor-not-allowed ${filled ? 'border-[var(--mg-action)] bg-[var(--mg-action)] text-white shadow-[0_5px_14px_rgba(11,99,214,.25)]' : `border-[var(--mg-line)] bg-[var(--mg-surface-tint)] text-[var(--mg-ink)] ${active ? 'border-[var(--mg-action)]' : disabled ? 'opacity-70' : 'hover:border-[var(--mg-blue)]'}`}`}>
          {/* A 320 px screen leaves 92 px per track: the icon only returns once the track can
              hold it beside the label, and both lines stay nowrap so no word breaks mid-glyph. */}
          <Icon size={16} className={`hidden min-[390px]:block shrink-0 ${filled ? 'text-white' : tone}`} aria-hidden="true"/>
          <span className="flex min-w-0 flex-col items-center leading-[1.15]">
            <span className="min-w-0 whitespace-nowrap text-xs font-extrabold tracking-[-0.03em]">{label}</span>
            <span data-testid={`journey-strategy-count-${id.toLowerCase()}`} aria-hidden="true" className={`whitespace-nowrap text-xs font-extrabold tabular-nums ${filled ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'}`}>· {count}</span>
          </span>
        </button>;
      })}
    </div>

    {showDiagnostics && blockingHeadline && <p role="alert" className={`search-headline-note mb-2 flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs font-bold leading-4 ${noticeTone.rose.softBg} ${noticeTone.rose.text}`}><Info size={13} className="mt-0.5 shrink-0" aria-hidden="true"/><span>{blockingHeadline.text}</span></p>}
    {showDiagnostics && groups.length > 0 && unavailable.length > 0 && <p role="status" data-testid="journey-unavailable-summary" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold leading-4 text-slate-600 dark:text-slate-300">
      <Info size={13} className="shrink-0" aria-hidden="true"/>
      Недоступні види транспорту в цьому пошуку · {unavailable.length}. Деталі — нижче.
    </p>}
    {showDiagnostics && (detailNotices.length > 0 || gtfsLimits.length > 0 || dominantCaveats.length > 0) && <details data-testid="journey-search-limits" className="search-truncation mb-1.5 rounded-xl border border-[var(--mg-line)] bg-[var(--mg-surface-tint)]">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 px-2.5 text-xs font-bold leading-4 text-[var(--mg-ink-secondary)]">
        <Info size={13} className="shrink-0" aria-hidden="true"/>
        <span className="min-w-0 flex-1">Джерела й умови пошуку{detailNotices.length + gtfsLimits.length + dominantCaveats.length ? ` · ${detailNotices.length + gtfsLimits.length + dominantCaveats.length}` : ''}</span>
        <ChevronRight size={14} className="search-truncation-chevron shrink-0" aria-hidden="true"/>
      </summary>
      <ul className="space-y-1 px-2.5 pb-2 text-xs leading-4 text-[var(--mg-ink-secondary)]">
        {detailNotices.map(notice => <li key={notice.text} className="flex gap-1.5">
          <span aria-hidden="true" className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${noticeTone[notice.tone].dot}`}/>
          <span className={noticeTone[notice.tone].text}>{notice.text}</span>
        </li>)}
        {gtfsLimits.map(limit => <li key={limit.short} className="flex gap-1.5">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"/>
          <span className="text-amber-900 dark:text-amber-100">{limit.text}</span>
        </li>)}
        {dominantCaveats.map(text => <li key={text} data-testid="journey-shared-caveat" className="flex gap-1.5 text-amber-900 dark:text-amber-100">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"/>
          <span>{text}</span>
        </li>)}
      </ul>
    </details>}
    {showDiagnostics && (technical.length > 0 || funnel.length > 0) && <details className="search-notices mb-3 rounded-2xl border border-[var(--mg-line)] bg-[var(--mg-surface-tint)]">
      <summary aria-label="Діагностика пошуку для розробників" className="search-notices-summary flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">
        <Info size={14} aria-hidden="true"/>
        <span className="flex-1">Діагностика пошуку</span>
        <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 tabular-nums dark:bg-[var(--mg-surface-card)]">{technical.length + funnel.length}</span>
        <ChevronRight size={16} aria-hidden="true" className="search-notices-chevron shrink-0"/>
      </summary>
      <ul className="search-notices-list space-y-1.5 px-3 pb-3">
        {technical.map(notice => <li key={notice.text} className="flex gap-2 text-xs leading-4">
          <span aria-hidden="true" className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${noticeTone[notice.tone].dot}`}/>
          <span className={noticeTone[notice.tone].text}>{notice.text}</span>
        </li>)}
        {funnel.map(line => <li key={line} className="font-mono text-xs leading-4 text-slate-600 dark:text-slate-300">{line}</li>)}
      </ul>
    </details>}

    {groups.length ? <div className="mg-stagger-list space-y-0.5" data-testid="journey-results-list">{groups.map((group, index) => <RouteResultCard key={group.primary.id} journey={group.primary} alternatives={journeyGroupAlternatives(group)} chosen={group.primary.id === chosenJourneyId || group.departures.some(journey => journey.id === chosenJourneyId)} recommendation={index === 0 ? `Перший варіант у режимі «${strategyConfig.find(strategy => strategy.id === activeStrategy)?.label ?? 'пошуку'}»` : undefined} onOpen={onOpenMap}/>)}</div>
      : <div className="rounded-2xl border border-[var(--mg-line)] bg-[var(--mg-surface-card)] p-6 text-center">
        {result.journeys.length === 0 && journeyEmptyStateKind(result) === 'provider-failure' ? <>
          <p role="alert" className="font-bold text-rose-800 dark:text-rose-100">{JOURNEY_EMPTY_PROVIDER_FAILURE_TITLE}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{JOURNEY_EMPTY_PROVIDER_FAILURE_COPY}</p>
          {onRetry && <button type="button" onClick={onRetry} className="mg-press-subtle mx-auto mt-3 inline-flex min-h-11 items-center rounded-xl border border-[var(--mg-line)] bg-[var(--mg-surface-tint)] px-4 text-xs font-bold text-[var(--mg-blue-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)]">Повторити пошук</button>}
        </> : <>
          <p className="font-bold text-slate-800 dark:text-white">{result.journeys.length ? 'У цьому режимі маршрутів немає' : 'За цими умовами маршрутів не знайдено'}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{result.journeys.length
            ? 'Спробуйте інший режим або змініть умови пошуку.'
            : journeyNoRoutesCopy(result)}</p>
        </>}
        {showDiagnostics && unavailable.length > 0 && <ul className="mx-auto mt-3 max-w-sm space-y-1.5 text-left">
          {unavailable.map(notice => <li key={notice.mode} className="flex gap-2 text-xs leading-4 text-slate-500 dark:text-slate-400">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"/>
            <span>{notice.text}</span>
          </li>)}
        </ul>}
      </div>}
  </section>;
}
