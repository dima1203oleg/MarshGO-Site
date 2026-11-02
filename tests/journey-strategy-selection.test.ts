import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiJourney, ApiJourneySearchResult } from '../src/services/productionApi';
import { strategyJourneys } from '../src/views/journeyStrategySelection';

const journey = (overrides: Partial<ApiJourney> = {}): ApiJourney => ({
  id: 'j1', offerId: null, strategy: 'BALANCED', state: 'READY', totalDurationSeconds: 1200,
  totalPriceMinor: 1000, confirmedPriceMinor: null, estimatedPriceMinMinor: null,
  estimatedPriceMaxMinor: null, walkingMeters: 0, transfers: 0, reliabilityScore: null,
  legs: [{
    id: 'leg1', mode: 'BUS', offerId: null,
    origin: { name: 'A', coordinates: [24, 49] }, destination: { name: 'B', coordinates: [24.1, 49.1] },
    departureAt: '2026-10-27T08:00:00+03:00', arrivalAt: '2026-10-27T08:20:00+03:00',
    durationSeconds: 1200, distanceMeters: 5000, priceMinor: 1000, priceStatus: 'LOCKED',
    availabilityStatus: 'SCHEDULED', source: 'gtfs-static', lastUpdatedAt: '2026-10-27T05:00:00Z',
  }],
  ...overrides,
});

function result(journeys: ApiJourney[], availableStrategies?: ApiJourneySearchResult['availableStrategies']): ApiJourneySearchResult {
  return { journeys, partial: false, blockedProviders: [], ...(availableStrategies ? { availableStrategies } : {}) };
}

test('server-declared unavailable strategy stays unavailable even if a journey carries a stale recommendation', () => {
  const staleCheapest = journey({ strategy: 'CHEAPEST', recommendedStrategies: ['CHEAPEST'] });
  assert.deepEqual(strategyJourneys(result([staleCheapest], ['BALANCED', 'FASTEST']), 'CHEAPEST'), []);
});

test('available strategy uses server ranks and never presents a journey with unknown fare as cheapest', () => {
  const slower = journey({ id: 'slower', strategyRanks: { CHEAPEST: 2 } });
  const faster = journey({ id: 'faster', strategyRanks: { CHEAPEST: 1 }, totalPriceMinor: 800,
    legs: [journey().legs[0]!, { ...journey().legs[0]!, id: 'unknown-fare', priceMinor: null, priceStatus: 'UNKNOWN' }],
  });
  const available = result([slower, faster], ['BALANCED', 'FASTEST', 'CHEAPEST']);
  assert.deepEqual(strategyJourneys(available, 'CHEAPEST').map(item => item.id), ['slower']);
  assert.deepEqual(strategyJourneys(available, 'FASTEST').map(item => item.id), []);
});

test('three strategy tabs preserve distinct server-ranked winners', () => {
  const fastest = journey({ id: 'fastest', totalDurationSeconds: 600, totalPriceMinor: 1200,
    strategyRanks: { FASTEST: 1, BALANCED: 2, CHEAPEST: 3 } });
  const balanced = journey({ id: 'balanced', totalDurationSeconds: 900, totalPriceMinor: 800,
    strategyRanks: { FASTEST: 2, BALANCED: 1, CHEAPEST: 2 } });
  const cheapest = journey({ id: 'cheapest', totalDurationSeconds: 1200, totalPriceMinor: 200,
    strategyRanks: { FASTEST: 3, BALANCED: 3, CHEAPEST: 1 } });
  const available = result([cheapest, fastest, balanced], ['BALANCED', 'FASTEST', 'CHEAPEST']);

  assert.deepEqual(strategyJourneys(available, 'FASTEST').map(item => item.id), ['fastest', 'balanced', 'cheapest']);
  assert.deepEqual(strategyJourneys(available, 'BALANCED').map(item => item.id), ['balanced', 'fastest', 'cheapest']);
  assert.deepEqual(strategyJourneys(available, 'CHEAPEST').map(item => item.id), ['cheapest', 'balanced', 'fastest']);
});

const boardingAt = (departureAt: string, mode: 'BUS' | 'WALK' = 'BUS') => [
  { ...journey().legs[0]!, mode, departureAt },
];

test('journeys the planner ranks the same are ordered by when they actually leave', () => {
  // Reproduces the public Lviv → Kyiv case: equal duration, equal price, equal rank.
  const late = journey({ id: 'late', strategyRanks: { BALANCED: 1 }, legs: boardingAt('2026-10-27T10:08:00+03:00') });
  const soon = journey({ id: 'soon', strategyRanks: { BALANCED: 1 }, legs: boardingAt('2026-10-27T08:21:00+03:00') });
  const middle = journey({ id: 'middle', strategyRanks: { BALANCED: 1 }, legs: boardingAt('2026-10-27T08:33:00+03:00') });

  assert.deepEqual(
    strategyJourneys(result([late, soon, middle], ['BALANCED']), 'BALANCED').map(item => item.id),
    ['soon', 'middle', 'late'],
  );
});

test('a lower server rank still wins over an earlier departure when the results really differ', () => {
  const rankedFirstButLate = journey({ id: 'slow-but-best', strategyRanks: { BALANCED: 1 }, walkingMeters: 400,
    legs: boardingAt('2026-10-27T10:08:00+03:00') });
  const rankedSecondAndSoon = journey({ id: 'fast-but-second', strategyRanks: { BALANCED: 2 }, walkingMeters: 1400,
    legs: boardingAt('2026-10-27T08:00:00+03:00') });

  assert.deepEqual(
    strategyJourneys(result([rankedSecondAndSoon, rankedFirstButLate], ['BALANCED']), 'BALANCED').map(item => item.id),
    ['slow-but-best', 'fast-but-second'],
  );
});

test('FASTEST and CHEAPEST ties resolve by boarding time instead of input order', () => {
  const later = journey({ id: 'later', totalDurationSeconds: 600, strategyRanks: undefined,
    recommendedStrategies: ['FASTEST', 'CHEAPEST'], legs: boardingAt('2026-10-27T09:40:00+03:00') });
  const earlier = journey({ id: 'earlier', totalDurationSeconds: 600, strategyRanks: undefined,
    recommendedStrategies: ['FASTEST', 'CHEAPEST'], legs: boardingAt('2026-10-27T07:15:00+03:00') });

  assert.deepEqual(strategyJourneys(result([later, earlier], ['FASTEST', 'CHEAPEST']), 'FASTEST').map(i => i.id), ['earlier', 'later']);
  assert.deepEqual(strategyJourneys(result([later, earlier], ['FASTEST', 'CHEAPEST']), 'CHEAPEST').map(i => i.id), ['earlier', 'later']);
});

test('a journey with nothing boardable stays behind the ones with a real departure', () => {
  const walkOnly = journey({ id: 'walk-only', strategyRanks: { BALANCED: 1 }, legs: boardingAt('2026-10-27T06:00:00+03:00', 'WALK') });
  const unknown = journey({ id: 'unknown-clock', strategyRanks: { BALANCED: 1 }, legs: boardingAt('not-a-time') });
  const real = journey({ id: 'real', strategyRanks: { BALANCED: 1 }, legs: boardingAt('2026-10-27T08:05:00+03:00') });

  const ordered = strategyJourneys(result([unknown, walkOnly, real], ['BALANCED']), 'BALANCED').map(i => i.id);
  assert.equal(ordered[0], 'real');
  assert.deepEqual(ordered.slice(1).sort(), ['unknown-clock', 'walk-only']);
});

test('arbitrary server ranks among identical results do not decide the card order', () => {
  // The public Lviv → Kyiv response: ranks 1/2/3 over three journeys with the same
  // duration, price, walking, transfers and leg count, differing only in tram departure.
  const first = journey({ id: 'rank1-late', strategyRanks: { BALANCED: 1 }, totalDurationSeconds: 34548,
    walkingMeters: 3022, transfers: 1, totalPriceMinor: null, legs: boardingAt('2026-11-02T08:08:00.000Z') });
  const second = journey({ id: 'rank2-early', strategyRanks: { BALANCED: 2 }, totalDurationSeconds: 34548,
    walkingMeters: 3022, transfers: 1, totalPriceMinor: null, legs: boardingAt('2026-11-02T06:21:00.000Z') });
  const third = journey({ id: 'rank3-middle', strategyRanks: { BALANCED: 3 }, totalDurationSeconds: 34548,
    walkingMeters: 3022, transfers: 1, totalPriceMinor: null, legs: boardingAt('2026-11-02T06:33:00.000Z') });

  assert.deepEqual(
    strategyJourneys(result([first, second, third], ['BALANCED']), 'BALANCED').map(item => item.id),
    ['rank2-early', 'rank3-middle', 'rank1-late'],
  );
});
