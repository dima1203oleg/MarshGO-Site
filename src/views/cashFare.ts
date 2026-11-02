import type { ApiJourney } from '../services/productionApi';
import { formatJourneyTotalPrice, formatMoneyMinor } from './journeyResultPresentation';

type Leg = ApiJourney['legs'][number];

type CityCashTariff = {
  city: string;
  /** west, south, east, north */
  bbox: [number, number, number, number];
  modes: string[];
  priceMinor: number;
  verifiedAt: string;
};

/**
 * Cash single-ride fares from the audited city tariff registry
 * (MarshGO-Server server/mobility/transportTariffs.ts). The planner prices the
 * cheapest applicable product (LeoCard/app), so a rider paying cash in the
 * vehicle sees a different, higher amount. Private marshrutkas are excluded
 * because they do not inherit the municipal tariff.
 */
const CITY_CASH_TARIFFS: CityCashTariff[] = [
  { city: 'Львів', bbox: [23.9, 49.75, 24.15, 49.92], modes: ['BUS', 'TROLLEYBUS', 'TRAM'], priceMinor: 3_000, verifiedAt: '2026-10-25' },
  { city: 'Київ', bbox: [30.2, 50.2, 30.85, 50.6], modes: ['BUS', 'TROLLEYBUS', 'TRAM', 'METRO', 'CITY_RAIL', 'FUNICULAR'], priceMinor: 3_000, verifiedAt: '2026-10-13' },
  { city: 'Дніпро', bbox: [34.85, 48.35, 35.15, 48.55], modes: ['METRO'], priceMinor: 1_000, verifiedAt: '2026-10-13' },
];

const PRIVATE_FEED_TYPES = new Set(['marshrutka', 'intercity_bus', 'minibus', 'taxi', 'rideshare']);

const inside = (point: [number, number] | undefined, bbox: [number, number, number, number]) =>
  Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
  && point[0] >= bbox[0] && point[0] <= bbox[2] && point[1] >= bbox[1] && point[1] <= bbox[3];

export type CashFare = { city: string; amountMinor: number; verifiedAt: string };

/** The cash amount a rider pays in the vehicle, or null when no verified tariff covers the leg. */
export function cashFareForLeg(leg: Leg): CashFare | null {
  // A cash rider pays each boarding: the planner's fare allocation can mark a
  // later leg as covered by a transfer product, which cash does not include.
  if (leg.mode === 'WALK') return null;
  if (leg.transportType && PRIVATE_FEED_TYPES.has(leg.transportType)) return null;
  const tariff = CITY_CASH_TARIFFS.find(candidate => candidate.modes.includes(leg.mode)
    && inside(leg.origin?.coordinates, candidate.bbox)
    && inside(leg.destination?.coordinates, candidate.bbox));
  return tariff ? { city: tariff.city, amountMinor: tariff.priceMinor, verifiedAt: tariff.verifiedAt } : null;
}

export type LegPriceDisplay = {
  value: string;
  caption: string;
  /** cash = verified city tariff; api = planner quote; included = covered by the previous ticket. */
  source: 'cash' | 'api' | 'included' | 'walk';
};

export function legPriceDisplay(leg: Leg): LegPriceDisplay {
  if (leg.mode === 'WALK') return { value: '0\u00a0₴', caption: '', source: 'walk' };
  const cash = cashFareForLeg(leg);
  if (cash) {
    const value = `${formatMoneyMinor(cash.amountMinor, 'UAH')}${leg.mode === 'COMMUNITY' ? ' / місце' : ''}`;
    return { value, caption: 'готівкою', source: 'cash' };
  }
  if (leg.fareIncludedByPreviousSegment) return { value: 'у квитку', caption: 'пересадка', source: 'included' };
  if (leg.priceMinor === null || !Number.isFinite(leg.priceMinor)) return { value: '—', caption: '', source: 'api' };
  const value = formatMoneyMinor(leg.priceMinor, leg.currency ?? 'UAH');
  return { value: `≈ ${value}`, caption: '', source: 'api' };
}

/**
 * The journey total a rider actually pays. Published city cash tariffs carry no
 * approximation mark; a journey priced only by the planner keeps the honest "≈"
 * from the API and its coverage caveats.
 */
export function journeyPriceDisplay(journey: ApiJourney): { label: string; cashOnly: boolean } {
  const cash = summarizeLegPrices(journey.legs);
  if (cash.totalMinor === null) return { label: '—', cashOnly: cash.cashLegCount > 0 };
  // Mixed journeys still sum the cash part; a planner-only quote stays as the API stated it.
  if (cash.cashLegCount > 0) return { label: formatMoneyMinor(cash.totalMinor, journey.currency ?? 'UAH'), cashOnly: true };
  return { label: formatJourneyTotalPrice(journey), cashOnly: false };
}

/** Totals use the same per-leg cash amounts, so the summary never disagrees with the cards. */
export function summarizeLegPrices(legs: Leg[]): { totalMinor: number | null; cashLegCount: number } {
  let total = 0;
  let cashLegCount = 0;
  for (const leg of legs) {
    if (leg.mode === 'WALK') continue;
    const cash = cashFareForLeg(leg);
    if (cash) {
      total += cash.amountMinor;
      cashLegCount += 1;
      continue;
    }
    if (leg.fareIncludedByPreviousSegment) continue;
    if (leg.priceMinor === null || !Number.isFinite(leg.priceMinor)) return { totalMinor: null, cashLegCount };
    total += leg.priceMinor;
  }
  return { totalMinor: total, cashLegCount };
}
