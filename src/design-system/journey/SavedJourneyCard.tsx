import { ChevronRight } from 'lucide-react';
import type { ApiStoredJourney } from '../../services/productionApi';
import { storedJourneyToApiJourney } from '../../routing/storedJourneyView';
import { compactPlaceLabel, fullPlaceLabel } from '../../domain/placeLabel';
import { passengersLabel } from '../../domain/plural';
import { formatTransferCount } from '../../map/journeyRouteModel';
import { journeyLegLabel } from '../../views/journeyLegLabel';
import {
  buildJourneyResultSegments, formatJourneyDistance, formatJourneyDuration, formatJourneyDurationTile,
  formatJourneySegmentPrice, formatJourneyTotalPrice, journeyStrategyLabel,
} from '../../views/journeyResultPresentation';
import { CanonicalRouteLip } from './CanonicalRouteLip';
import type { JourneySegmentStripItem } from './JourneySegmentStrip';

const stateLabels: Record<string, string> = {
  PLANNED: 'Заплановано',
  READY: 'Маршрут готовий',
  PARTIALLY_RESERVED: 'Частково заброньовано',
  REPLANNING: 'Потрібне перепланування',
  ACTIVE: 'У дорозі',
  COMPLETED: 'Завершено',
  CANCELLED: 'Скасовано',
  FAILED: 'Не вдалося побудувати',
};

const stateTone: Record<string, string> = {
  READY: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  PARTIALLY_RESERVED: 'bg-[var(--mg-blue-tint)] text-[var(--mg-blue-ink)]',
  ACTIVE: 'bg-[var(--mg-blue-tint)] text-[var(--mg-blue-ink)]',
  COMPLETED: 'bg-[var(--mg-surface-tint)] text-[var(--mg-muted)]',
  CANCELLED: 'bg-[var(--mg-surface-tint)] text-[var(--mg-muted)]',
  REPLANNING: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  FAILED: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
};

/**
 * The persistence row is saved as soon as the planner succeeds, so a leg can still be an
 * unbooked proposal. Only states that change what the passenger must do are worth a line.
 */
function journeyException(journey: ApiStoredJourney): string | null {
  const cancelled = journey.legs.filter((leg) => leg.state === 'CANCELLED').length;
  if (cancelled > 0) return `${cancelled === 1 ? 'Сегмент скасовано' : `${cancelled} сегменти скасовано`} — потрібне перепланування`;
  const replaced = journey.legs.filter((leg) => leg.state === 'REPLACED').length;
  return replaced > 0 ? `${replaced === 1 ? 'Сегмент замінено' : `${replaced} сегменти замінено`} через Rescue` : null;
}

/** A cancelled leg keeps its place in the ribbon but loses its mode color: the segment is gone. */
const CANCELLED_SEGMENT_COLOR = '#94A3B8';

function stageLabel(count: number): string {
  const category = new Intl.PluralRules('uk-UA').select(count);
  const noun = category === 'one' ? 'етап' : category === 'few' ? 'етапи' : 'етапів';
  return `${count} ${noun}`;
}

const clock = (value: string | null | undefined) => (value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date(value))
  : null);

/** Saved journeys reuse the canonical route lip so the Trips list reads like the search results. */
export function SavedJourneyCard({ journey, departureLabel, onOpen }: {
  journey: ApiStoredJourney;
  departureLabel: string;
  onOpen: () => void;
}) {
  const view = storedJourneyToApiJourney(journey);
  const segments = buildJourneyResultSegments(view).filter((segment) => segment.kind === 'LEG');
  const totalPrice = formatJourneyTotalPrice(view);
  const durationLabel = view.totalDurationSeconds > 0 ? formatJourneyDuration(view.totalDurationSeconds) : '—';
  const startAt = clock(journey.requested_departure_at);
  const endAt = clock(view.legs.at(-1)?.arrivalAt);
  const exception = journeyException(journey);
  const cancelledLegIds = new Set(journey.legs.filter((leg) => leg.state === 'CANCELLED').map((leg) => leg.id));
  const routeTitle = `${compactPlaceLabel(journey.origin_name)} → ${compactPlaceLabel(journey.destination_name)}`;
  const routeFullAddress = `${fullPlaceLabel(journey.origin_name)} → ${fullPlaceLabel(journey.destination_name)}`;

  const stripItems: JourneySegmentStripItem[] = segments.map((segment) => ({
    id: segment.id,
    mode: segment.mode,
    transportType: segment.leg?.transportType,
    label: segment.mode === 'COMMUNITY' ? 'Попутка' : journeyLegLabel(segment.mode, segment.leg?.transportType),
    durationSeconds: segment.durationSeconds,
    durationLabel: formatJourneyDurationTile(segment.durationSeconds),
    priceLabel: formatJourneySegmentPrice(segment, view.currency ?? 'UAH'),
    color: segment.leg && cancelledLegIds.has(segment.leg.id) ? CANCELLED_SEGMENT_COLOR : segment.color,
  }));

  return <article
    data-testid="saved-journey-card"
    className="relative isolate overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_3px_14px_rgba(30,64,110,.07)] dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)] dark:shadow-[0_4px_18px_rgba(0,0,0,.18)]"
  >
    <button type="button" onClick={onOpen} aria-label={`Відкрити збережений маршрут: ${routeFullAddress}, ${durationLabel}, ${totalPrice === '—' ? 'ціна уточнюється' : totalPrice}`} className="absolute inset-0 z-0 h-full w-full rounded-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <span className="sr-only">Карта й деталі маршруту</span>
    </button>
    <div className="pointer-events-none relative z-10 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${stateTone[journey.state] ?? 'bg-[var(--mg-blue-tint)] text-[var(--mg-blue-ink)]'}`}>{stateLabels[journey.state] ?? journey.state}</span>
        <span className="min-w-0 truncate text-right text-xs font-semibold text-slate-500 dark:text-slate-400">{departureLabel}{startAt ? ` · ${startAt}` : ''}</span>
      </div>
      <h3 className="truncate text-[15px] font-extrabold leading-5 text-[#0E1F35] dark:text-[var(--mg-ink-primary)]" title={routeFullAddress}>
        {routeTitle}
      </h3>
      <CanonicalRouteLip
        className="mt-1.5"
        durationLabel={durationLabel}
        durationTitle={startAt && endAt ? `Виїзд ${startAt} · прибуття ${endAt}` : undefined}
        priceLabel={totalPrice}
        priceAccessibleLabel={`Загальна вартість: ${totalPrice === '—' ? 'невідома' : totalPrice}`}
        priceUnavailable={totalPrice === '—'}
        priceCaption={totalPrice === '—' ? <span className="block max-w-[7.5rem] truncate text-xs font-semibold leading-4 text-slate-500 dark:text-slate-400">тариф невідомий</span> : undefined}
        distanceLabel={`${formatTransferCount(view.transfers)} · пішки ${formatJourneyDistance(view.walkingMeters)}`}
        summaryRowClassName="gap-2"
        items={stripItems}
        ariaLabel={`Етапи збереженого маршруту: ${routeTitle}`}
        actions={<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--mg-blue-tint)] text-[var(--mg-blue-ink)]"><ChevronRight size={17}/></span>}
        actionsClassName="shrink-0"
      />
      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span>{journeyStrategyLabel(journey.strategy)}</span>
        <span aria-hidden="true">·</span>
        <span>{passengersLabel(journey.passenger_count)}</span>
        <span aria-hidden="true">·</span>
        <span>{stageLabel(segments.length)}</span>
      </p>
      {exception && <p role="status" className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{exception}</p>}
    </div>
  </article>;
}
