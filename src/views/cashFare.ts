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
 * Fallback cash single-ride fares for servers that do not send `cashPriceMinor`
 * yet. The server's audited registry (server/mobility/transportTariffs.ts) is
 * the source of truth; this table only covers the cities verified by hand.
 * Private marshrutkas are excluded because they do not inherit the municipal tariff.
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

export type CashFare = {
  amountMinor: number;
  currency: string;
  /** api = the server priced this boarding; client-registry = fallback for a server that has no cash field yet. */
  origin: 'api' | 'client-registry';
  city?: string;
  verifiedAt?: string;
  productId?: string;
};

/** A walk has no fare, and a negative or fractional amount is not a price. */
function apiCashFare(leg: Leg): CashFare | null {
  if (leg.mode === 'WALK') return null;
  const amount = leg.cashPriceMinor;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0) return null;
  return { amountMinor: amount, currency: leg.cashCurrency ?? 'UAH', origin: 'api', productId: leg.cashFareProductId ?? undefined };
}

/** The cash amount a rider pays in the vehicle, or null when neither the server nor a verified tariff covers the leg. */
export function cashFareForLeg(leg: Leg): CashFare | null {
  // A cash rider pays each boarding: the planner's fare allocation can mark a
  // later leg as covered by a transfer product, which cash does not include.
  const priced = apiCashFare(leg);
  if (priced) return priced;
  if (leg.mode === 'WALK') return null;
  if (leg.transportType && PRIVATE_FEED_TYPES.has(leg.transportType)) return null;
  const tariff = CITY_CASH_TARIFFS.find(candidate => candidate.modes.includes(leg.mode)
    && inside(leg.origin?.coordinates, candidate.bbox)
    && inside(leg.destination?.coordinates, candidate.bbox));
  return tariff
    ? { city: tariff.city, amountMinor: tariff.priceMinor, currency: 'UAH', origin: 'client-registry', verifiedAt: tariff.verifiedAt }
    : null;
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
    const value = `${formatMoneyMinor(cash.amountMinor, cash.currency)}${leg.mode === 'COMMUNITY' ? ' / місце' : ''}`;
    return { value, caption: 'готівкою', source: 'cash' };
  }
  if (leg.fareIncludedByPreviousSegment) return { value: 'у квитку', caption: 'пересадка', source: 'included' };
  if (leg.priceMinor === null || !Number.isFinite(leg.priceMinor)) return { value: '—', caption: '', source: 'api' };
  const value = formatMoneyMinor(leg.priceMinor, leg.currency ?? 'UAH');
  return { value: `≈ ${value}`, caption: '', source: 'api' };
}

/**
 * Where the printed amount comes from. A cash rider and a card rider pay
 * different amounts for the same journey and the planner ranks by the cheaper
 * one, so an unqualified number reads as the price of the ticket product.
 */
export type JourneyPriceSource = 'cash' | 'mixed' | 'api' | 'unknown';

export type JourneyPriceDisplay = {
  label: string;
  source: JourneyPriceSource;
  /** The words under the amount that say who is being paid. Empty when the number needs no qualifier. */
  caption: string;
};

/**
 * The journey total a rider actually pays. Published city cash tariffs carry no
 * approximation mark; a journey priced only by the planner keeps the honest "≈"
 * from the API and its coverage caveats.
 */
export function journeyPriceDisplay(journey: ApiJourney): JourneyPriceDisplay {
  const cash = summarizeLegPrices(journey.legs);
  if (cash.totalMinor === null) {
    return { label: '—', source: 'unknown', caption: cash.cashLegCount > 0 ? 'частково невідомий тариф' : 'тариф невідомий' };
  }
  // A mixed journey pays part in the vehicle and part to a private carrier, so
  // neither "готівкою" alone nor the planner's product price describes it.
  if (cash.cashLegCount > 0 && cash.quotedLegCount === 0) {
    return { label: formatMoneyMinor(cash.totalMinor, journey.currency ?? 'UAH'), source: 'cash', caption: 'готівкою' };
  }
  if (cash.cashLegCount > 0) {
    const amount = formatMoneyMinor(cash.totalMinor, journey.currency ?? 'UAH');
    const exact = journey.confirmedPriceMinor !== null || journey.priceStatus === 'LOCKED';
    return { label: exact ? amount : `≈ ${amount}`, source: 'mixed', caption: 'частина готівкою' };
  }
  return { label: formatJourneyTotalPrice(journey), source: 'api', caption: '' };
}

/** Totals use the same per-leg cash amounts, so the summary never disagrees with the cards. */
export function summarizeLegPrices(legs: Leg[]): {
  totalMinor: number | null;
  cashLegCount: number;
  /** Legs priced by the planner quote rather than by a published cash tariff. */
  quotedLegCount: number;
} {
  let total = 0;
  let cashLegCount = 0;
  let quotedLegCount = 0;
  for (const leg of legs) {
    if (leg.mode === 'WALK') continue;
    const cash = cashFareForLeg(leg);
    if (cash) {
      total += cash.amountMinor;
      cashLegCount += 1;
      continue;
    }
    if (leg.fareIncludedByPreviousSegment) continue;
    if (leg.priceMinor === null || !Number.isFinite(leg.priceMinor)) return { totalMinor: null, cashLegCount, quotedLegCount };
    total += leg.priceMinor;
    quotedLegCount += 1;
  }
  return { totalMinor: total, cashLegCount, quotedLegCount };
}
