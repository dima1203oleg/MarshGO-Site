import { kyivDateTimeInputToDate } from './kyivTime';

// The engine anchors a search at `departureAt`; it has no arrive-by deadline, only a
// duration cap. «По» therefore bounds the trip length, never a fabricated arrival query.
const MIN_DURATION_SECONDS = 60;
const MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;
export const MAX_JOURNEY_BUDGET_UAH = 1_000_000;
const MAX_PRICE_MINOR = MAX_JOURNEY_BUDGET_UAH * 100;

export type JourneySearchBounds = { maxTotalDurationSeconds?: number; maxPriceMinor?: number; maxTransfers?: number };

export function parseJourneyBudgetUah(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const budget = Number(value);
  return Number.isSafeInteger(budget) && budget > 0 && budget <= MAX_JOURNEY_BUDGET_UAH ? budget : null;
}

export function isAppliedJourneyBudgetDraft(value: string, appliedBudgetUah: number | null): boolean {
  const draftBudget = parseJourneyBudgetUah(value);
  return draftBudget !== null && draftBudget === appliedBudgetUah;
}

export function journeySearchBounds(departure: string, arrivalBy: string | null, budgetUah: number | null, directOnly = false): JourneySearchBounds {
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
  // «Без пересадок»: the engine reads maxTransfers=0 as exactly one transit leg
  // (gtfsTimetable maxTransitLegs = maximumTransfers + 1); walking access/egress stays allowed.
  if (directOnly) bounds.maxTransfers = 0;
  return bounds;
}

export function budgetLabel(budgetUah: number | null): string {
  return budgetUah === null || budgetUah <= 0 ? 'Без обмеження' : `До ${budgetUah} грн`;
}
