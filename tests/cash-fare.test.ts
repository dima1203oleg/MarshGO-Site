import assert from 'node:assert/strict';
import test from 'node:test';
import { cashFareForLeg, journeyPriceDisplay, legPriceDisplay, summarizeLegPrices } from '../src/views/cashFare';
import type { ApiJourney } from '../src/services/productionApi';

type Leg = ApiJourney['legs'][number];

function leg(overrides: Partial<Record<string, unknown>> = {}): Leg {
  return {
    id: 'leg-1', mode: 'BUS', transportType: 'bus',
    origin: { name: 'Площа Ринок', coordinates: [24.0323, 49.8419] },
    destination: { name: 'Вокзал', coordinates: [24.0029, 49.8681] },
    departureAt: '2026-11-03T06:00:00Z', arrivalAt: '2026-11-03T06:20:00Z',
    durationSeconds: 1200, distanceMeters: 3000, priceMinor: 2_300, priceStatus: 'ESTIMATED',
    availabilityStatus: 'UNKNOWN', source: 'gtfs-static', lastUpdatedAt: '2026-11-03T05:00:00Z',
    ...overrides,
  } as unknown as Leg;
}

const walk = () => leg({ id: 'walk', mode: 'WALK', transportType: 'walk', priceMinor: 0 });

test('cash fare uses the verified city tariff instead of the card product', () => {
  const lvivBus = cashFareForLeg(leg());
  assert.deepEqual(lvivBus, { city: 'Львів', amountMinor: 3_000, verifiedAt: '2026-10-25' });
  assert.deepEqual(legPriceDisplay(leg()), { value: '30\u00a0₴', caption: 'готівкою', source: 'cash' });

  const kyivMetro = cashFareForLeg(leg({
    mode: 'METRO', transportType: 'metro',
    origin: { name: 'Вокзальна', coordinates: [30.4419, 50.4419] },
    destination: { name: 'Золоті ворота', coordinates: [30.5147, 50.4489] },
  }));
  assert.deepEqual(kyivMetro, { city: 'Київ', amountMinor: 3_000, verifiedAt: '2026-10-13' });

  const dniproMetro = cashFareForLeg(leg({
    mode: 'METRO', transportType: 'metro',
    origin: { name: 'Вокзальна', coordinates: [35.0152, 48.4553] },
    destination: { name: 'Покровська', coordinates: [35.032, 48.4695] },
  }));
  assert.equal(dniproMetro?.amountMinor, 1_000);
});

test('no invented cash fare for uncovered modes, cities or private marshrutkas', () => {
  assert.equal(cashFareForLeg(leg({ mode: 'TRAM', transportType: 'marshrutka' })), null);
  assert.equal(cashFareForLeg(leg({ mode: 'METRO', transportType: 'metro' })), null, 'Lviv has no metro tariff');
  assert.equal(cashFareForLeg(leg({ mode: 'BUS', transportType: 'intercity_bus' })), null);
  assert.equal(cashFareForLeg(leg({
    mode: 'BUS',
    origin: { name: 'Ужгород', coordinates: [22.287, 48.62] },
    destination: { name: 'Мукачево', coordinates: [22.705, 48.44] },
  })), null);
  assert.equal(cashFareForLeg(walk()), null);
  assert.deepEqual(legPriceDisplay(walk()), { value: '0\u00a0₴', caption: '', source: 'walk' });
});

test('transfers and unknown legs keep honest labels', () => {
  const included = leg({
    id: 'leg-2', fareIncludedByPreviousSegment: true, priceMinor: 0,
    origin: { name: 'Одеса', coordinates: [30.7326, 46.4825] },
    destination: { name: 'Одеса', coordinates: [30.75, 46.49] },
  });
  assert.deepEqual(legPriceDisplay(included), { value: 'у квитку', caption: 'пересадка', source: 'included' });
  const unknown = leg({
    id: 'leg-3', priceMinor: null, mode: 'BUS', transportType: 'bus',
    origin: { name: 'Одеса', coordinates: [30.7326, 46.4825] },
    destination: { name: 'Одеса', coordinates: [30.75, 46.49] },
  });
  assert.deepEqual(legPriceDisplay(unknown), { value: '—', caption: '', source: 'api' });
  assert.deepEqual(summarizeLegPrices([walk(), unknown]), { totalMinor: null, cashLegCount: 0, quotedLegCount: 0 });
});

test('a cash rider pays every boarding even when the planner marks a transfer', () => {
  // The planner's fare allocation can cover the next leg with one ticket
  // product; cash has no such transfer, so each ride is charged separately.
  const tram = leg({ id: 'tram', mode: 'TRAM', transportType: 'tram' });
  const bus = leg({ id: 'bus', mode: 'BUS', transportType: 'bus', fareIncludedByPreviousSegment: true, priceMinor: 0 });
  assert.deepEqual(legPriceDisplay(bus), { value: '30\u00a0₴', caption: 'готівкою', source: 'cash' });
  assert.deepEqual(summarizeLegPrices([walk(), tram, walk(), bus, walk()]), { totalMinor: 6_000, cashLegCount: 2, quotedLegCount: 0 });
});

test('summary adds cash amounts for every municipality ride', () => {
  assert.deepEqual(summarizeLegPrices([
    walk(), leg(), leg({ id: 'leg-2', fareIncludedByPreviousSegment: true, priceMinor: 0 }), walk(),
  ]), { totalMinor: 6_000, cashLegCount: 2, quotedLegCount: 0 });
  assert.deepEqual(summarizeLegPrices([leg({ offerId: 'offer-1', mode: 'COMMUNITY', transportType: 'car', priceMinor: 15_000, priceStatus: 'LOCKED' })]),
    { totalMinor: 15_000, cashLegCount: 0, quotedLegCount: 1 });
});

test('list and details share one total: cash for transit, planner quote elsewhere', () => {
  const journey = (legs: Leg[], totalPriceMinor: number | null) => ({
    legs, totalPriceMinor, confirmedPriceMinor: null, currency: 'UAH', priceStatus: 'ESTIMATED',
  }) as unknown as Parameters<typeof journeyPriceDisplay>[0];
  // The qualifier is not decoration: the same journey is 60 ₴ in cash and
  // 23 ₴ on the card product the planner ranked it by, so an unqualified
  // number is a different promise than the amount the rider hands over.
  assert.deepEqual(journeyPriceDisplay(journey([walk(), leg(), walk(), leg({ id: 'leg-2', mode: 'TRAM', transportType: 'tram' }), walk()], 2_300)),
    { label: '60\u00a0₴', source: 'cash', caption: 'готівкою' });
  assert.deepEqual(journeyPriceDisplay(journey([walk(), leg({ offerId: 'offer-1', mode: 'COMMUNITY', transportType: 'car', priceMinor: 15_000, priceStatus: 'LOCKED' }), walk()], 15_000)),
    { label: '≈ 150\u00a0₴', source: 'api', caption: '' });
  assert.deepEqual(journeyPriceDisplay(journey([walk(), leg({ id: 'leg-3', priceMinor: null, origin: { name: 'Одеса', coordinates: [30.7326, 46.4825] }, destination: { name: 'Одеса', coordinates: [30.75, 46.49] } })], null)),
    { label: '—', source: 'unknown', caption: 'тариф невідомий' });
});

test('a journey paid partly in the vehicle keeps the estimate mark and says so', () => {
  const mixed = {
    legs: [walk(), leg(), walk(), leg({ id: 'carpool', offerId: 'offer-1', mode: 'COMMUNITY', transportType: 'car', priceMinor: 15_000 }), walk()],
    totalPriceMinor: 17_300, confirmedPriceMinor: null, currency: 'UAH', priceStatus: 'ESTIMATED',
  } as unknown as Parameters<typeof journeyPriceDisplay>[0];
  // 30 ₴ city cash + 150 ₴ planner quote: neither "готівкою" nor the card price is true.
  assert.deepEqual(journeyPriceDisplay(mixed), { label: '≈ 180\u00a0₴', source: 'mixed', caption: 'частина готівкою' });
  const locked = {
    ...mixed, confirmedPriceMinor: 18_000, priceStatus: 'LOCKED',
  } as unknown as Parameters<typeof journeyPriceDisplay>[0];
  assert.deepEqual(journeyPriceDisplay(locked), { label: '180\u00a0₴', source: 'mixed', caption: 'частина готівкою' });
});

test('a known cash part is not reported as an unknown whole', () => {
  const journey = {
    legs: [walk(), leg(), leg({
      id: 'unknown', mode: 'TRAIN', transportType: 'train', priceMinor: null,
      origin: { name: 'Львів', coordinates: [24.03, 49.84] },
      destination: { name: 'Трускавець', coordinates: [23.48, 48.28] },
    })],
    totalPriceMinor: null, confirmedPriceMinor: null, currency: 'UAH', priceStatus: 'UNKNOWN',
  } as unknown as Parameters<typeof journeyPriceDisplay>[0];
  assert.deepEqual(journeyPriceDisplay(journey), { label: '—', source: 'unknown', caption: 'частково невідомий тариф' });
});
