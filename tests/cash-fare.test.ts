import assert from 'node:assert/strict';
import test from 'node:test';
import { cashFareForLeg, journeyPriceDisplay, legPriceDisplay, summarizeLegPrices } from '../src/views/cashFare';
import { spokenJourneyPrice } from '../src/views/JourneyResultsPanel';
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

const walk = (overrides: Partial<Record<string, unknown>> = {}) =>
  leg({ id: 'walk', mode: 'WALK', transportType: 'walk', priceMinor: 0, ...overrides });

test('cash fare uses the verified city tariff instead of the card product', () => {
  const lvivBus = cashFareForLeg(leg());
  assert.deepEqual(lvivBus, { city: 'Львів', amountMinor: 3_000, currency: 'UAH', origin: 'client-registry', verifiedAt: '2026-10-25' });
  assert.deepEqual(legPriceDisplay(leg()), { value: '30\u00a0₴', caption: 'готівкою', source: 'cash' });

  const kyivMetro = cashFareForLeg(leg({
    mode: 'METRO', transportType: 'metro',
    origin: { name: 'Вокзальна', coordinates: [30.4419, 50.4419] },
    destination: { name: 'Золоті ворота', coordinates: [30.5147, 50.4489] },
  }));
  assert.deepEqual(kyivMetro, { city: 'Київ', amountMinor: 3_000, currency: 'UAH', origin: 'client-registry', verifiedAt: '2026-10-13' });

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

test('no cash label without a server price or a verified city tariff', () => {
  const odessa = leg({ mode: 'BUS', transportType: 'bus', cashPriceMinor: null,
    origin: { name: 'Дерібасівська', coordinates: [30.7326, 46.4825] },
    destination: { name: 'Привокзальна', coordinates: [30.75, 46.49] } });
  assert.equal(cashFareForLeg(odessa), null);
  // Without a cash price the rider gets the planner quote, marked as an estimate.
  assert.deepEqual(legPriceDisplay(odessa), { value: '≈ 23\u00a0₴', caption: '', source: 'api' });
  // A walking leg never carries a fare, even if a stale field arrives with one.
  assert.equal(cashFareForLeg(walk({ cashPriceMinor: 3_000 })), null);
});

test('list and details share one total: cash for transit, planner quote elsewhere', () => {
  const journey = (legs: Leg[], totalPriceMinor: number | null) => ({
    legs, totalPriceMinor, confirmedPriceMinor: null, currency: 'UAH', priceStatus: 'ESTIMATED',
  }) as unknown as Parameters<typeof journeyPriceDisplay>[0];
  assert.deepEqual(journeyPriceDisplay(journey([walk(), leg(), walk(), leg({ id: 'leg-2', mode: 'TRAM', transportType: 'tram' }), walk()], 2_300)),
    { label: '60\u00a0₴', source: 'cash', caption: 'готівкою' });
  assert.deepEqual(journeyPriceDisplay(journey([walk(), leg({ offerId: 'offer-1', mode: 'COMMUNITY', transportType: 'car', priceMinor: 15_000, priceStatus: 'LOCKED' }), walk()], 15_000)),
    { label: '≈ 150\u00a0₴', source: 'api', caption: '' });
  assert.deepEqual(journeyPriceDisplay(journey([walk(), leg({ id: 'leg-3', priceMinor: null, origin: { name: 'Одеса', coordinates: [30.7326, 46.4825] }, destination: { name: 'Одеса', coordinates: [30.75, 46.49] } })], null)),
    { label: '—', source: 'unknown', caption: 'тариф невідомий' });
});

test('the server cash price wins over the client table and covers cities the table lacks', () => {
  const lvivFromApi = leg({ cashPriceMinor: 3_500, cashCurrency: 'UAH', cashFareProductId: 'lviv-cash-adult', cashFareSource: 'city-tariff-registry' });
  assert.deepEqual(cashFareForLeg(lvivFromApi), { amountMinor: 3_500, currency: 'UAH', origin: 'api', productId: 'lviv-cash-adult' });
  assert.deepEqual(legPriceDisplay(lvivFromApi), { value: '35\u00a0₴', caption: 'готівкою', source: 'cash' });

  const uzhorod = leg({
    cashPriceMinor: 800, cashCurrency: 'UAH', cashFareProductId: 'uzhorod-cash-adult',
    origin: { name: 'Корятовича', coordinates: [22.287, 48.62] },
    destination: { name: 'Театральна', coordinates: [22.295, 48.615] },
  });
  assert.equal(cashFareForLeg(uzhorod)?.origin, 'api');
  assert.deepEqual(legPriceDisplay(uzhorod), { value: '8\u00a0₴', caption: 'готівкою', source: 'cash' });

  const total = (legs: Leg[]) => journeyPriceDisplay({ legs, totalPriceMinor: 2_300, confirmedPriceMinor: null, currency: 'UAH', priceStatus: 'ESTIMATED' } as unknown as Parameters<typeof journeyPriceDisplay>[0]);
  assert.deepEqual(summarizeLegPrices([walk(), lvivFromApi, walk(), uzhorod, walk()]), { totalMinor: 4_300, cashLegCount: 2, quotedLegCount: 0 });
  assert.deepEqual(total([walk(), lvivFromApi, walk(), uzhorod, walk()]), { label: '43\u00a0₴', source: 'cash', caption: 'готівкою' });
});

test('a published free fare and a second boarding both come from the server price', () => {
  const free = leg({
    mode: 'METRO', transportType: 'metro', cashPriceMinor: 0,
    origin: { name: 'Сад Міжнародний', coordinates: [35.095, 48.467] },
    destination: { name: 'Театральна', coordinates: [35.0457, 48.4686] },
  });
  assert.deepEqual(legPriceDisplay(free), { value: '0\u00a0₴', caption: 'готівкою', source: 'cash' });
  // Cash has no transfer product, so a leg the planner marks as included still costs a boarding.
  const secondBoarding = leg({ id: 'leg-2', fareIncludedByPreviousSegment: true, priceMinor: 0, cashPriceMinor: 3_000 });
  assert.deepEqual(legPriceDisplay(secondBoarding), { value: '30\u00a0₴', caption: 'готівкою', source: 'cash' });
});

test('malformed server cash values never reach the rider', () => {
  for (const bad of [-5, 12.5, '3000', Number.NaN]) {
    // Lviv falls back to its verified client tariff; nothing is invented elsewhere.
    assert.deepEqual(cashFareForLeg(leg({ cashPriceMinor: bad })), { city: 'Львів', amountMinor: 3_000, currency: 'UAH', origin: 'client-registry', verifiedAt: '2026-10-25' }, `string ${String(bad)}`);
    const odessa = leg({ cashPriceMinor: bad,
      origin: { name: 'Дерібасівська', coordinates: [30.7326, 46.4825] },
      destination: { name: 'Привокзальна', coordinates: [30.75, 46.49] } });
    assert.equal(cashFareForLeg(odessa), null, `string ${String(bad)} must not price Odesa`);
  }
});

test('a journey that pays part in cash says so instead of claiming one basis', () => {
  const bus = leg();
  const carpool = leg({ id: 'carpool', mode: 'COMMUNITY', transportType: 'car', priceMinor: 15_000 });
  const quote = (priceStatus: string, confirmedPriceMinor: number | null) => journeyPriceDisplay({
    legs: [walk(), bus, walk(), carpool, walk()], totalPriceMinor: 18_000, confirmedPriceMinor, currency: 'UAH', priceStatus,
  } as unknown as Parameters<typeof journeyPriceDisplay>[0]);
  assert.deepEqual(quote('ESTIMATED', null), { label: '≈ 180\u00a0₴', source: 'mixed', caption: 'частина готівкою' });
  assert.deepEqual(quote('LOCKED', 18_000), { label: '180\u00a0₴', source: 'mixed', caption: 'частина готівкою' });
});

test('a known cash leg does not hide an unknown later boarding', () => {
  const odessa = leg({ id: 'odessa', priceMinor: null,
    origin: { name: 'Дерібасівська', coordinates: [30.7326, 46.4825] },
    destination: { name: 'Привокзальна', coordinates: [30.75, 46.49] } });
  const price = journeyPriceDisplay({
    legs: [walk(), leg(), walk(), odessa, walk()], totalPriceMinor: null, confirmedPriceMinor: null, currency: 'UAH', priceStatus: 'ESTIMATED',
  } as unknown as Parameters<typeof journeyPriceDisplay>[0]);
  assert.deepEqual(price, { label: '—', source: 'unknown', caption: 'частково невідомий тариф' });
});

test('the spoken price names the basis, and an unknown total never sounds like a price', () => {
  assert.equal(spokenJourneyPrice({ label: '60\u00a0₴', source: 'cash', caption: 'готівкою' }), '60\u00a0₴ готівкою');
  assert.equal(spokenJourneyPrice({ label: '≈ 180\u00a0₴', source: 'mixed', caption: 'частина готівкою' }), '≈ 180\u00a0₴ частина готівкою');
  assert.equal(spokenJourneyPrice({ label: '≈ 150\u00a0₴', source: 'api', caption: '' }), '≈ 150\u00a0₴');
  assert.equal(spokenJourneyPrice({ label: '—', source: 'unknown', caption: 'тариф невідомий' }), 'ціна уточнюється');
});
