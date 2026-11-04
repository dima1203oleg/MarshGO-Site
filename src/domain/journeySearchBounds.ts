import { kyivDateTimeInputToDate } from './kyivTime';

// The engine anchors a search at `departureAt`; it has no arrive-by deadline, only a
// duration cap. «По» therefore bounds the trip length, never a fabricated arrival query.
const MIN_DURATION_SECONDS = 60;
const MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;
const MAX_PRICE_MINOR = 100_000_000;

export type JourneySearchBounds = { maxTotalDurationSeconds?: number; maxPriceMinor?: number };

export function journeySearchBounds(departure: string, arrivalBy: string | null, budgetUah: number | null): JourneySearchBounds {
  const bounds: JourneySearchBounds = {};
  const from = kyivDateTimeInputToDate(departure);
  const until = arrivalBy ? kyivDateTimeInputToDate(arrivalBy) : null;
  if (from && until && until > from) {
    const seconds = Math.floor((until.getTime() - from.getTime()) / 1000);
    if (seconds >= MIN_DURATION_SECONDS) bounds.maxTotalDurationSeconds = Math.min(seconds, MAX_DURATION_SECONDS);
  }
  if (budgetUah !== null && Number.isFinite(budgetUah) && budgetUah > 0) {
    bounds.maxPriceMinor = Math.min(Math.round(budgetUah * 100), MAX_PRICE_MINOR);
  }
  return bounds;
}

export function budgetLabel(budgetUah: number | null): string {
  return budgetUah === null || budgetUah <= 0 ? 'Без обмеження' : `До ${budgetUah} грн`;
}
