import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { readFileSync } from 'node:fs';
import type { ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy } from '../src/services/productionApi';
import { strategyJourneys } from '../src/views/journeyStrategySelection';

const leg = (overrides: Partial<ApiJourney['legs'][number]> = {}): ApiJourney['legs'][number] => ({
  id: 'leg', mode: 'BUS', offerId: null,
  origin: { name: 'A', coordinates: [24, 49] }, destination: { name: 'B', coordinates: [24.1, 49.1] },
  departureAt: '2026-11-09T06:00:00.000Z', arrivalAt: '2026-11-09T06:20:00.000Z',
  durationSeconds: 1200, distanceMeters: 5000, priceMinor: 1000, priceStatus: 'LOCKED',
  availabilityStatus: 'SCHEDULED', source: 'gtfs-static', lastUpdatedAt: '2026-11-09T05:00:00Z',
  ...overrides,
});

const journey = (overrides: Partial<ApiJourney> = {}): ApiJourney => ({
  id: 'j', offerId: null, strategy: 'BALANCED', state: 'READY', totalDurationSeconds: 1200,
  totalPriceMinor: 1000, confirmedPriceMinor: null, estimatedPriceMinMinor: null,
  estimatedPriceMaxMinor: null, walkingMeters: 0, transfers: 0, reliabilityScore: null,
  legs: [leg()],
  ...overrides,
});

/** One shared pool; only per-journey ranks differ between the tabs. */
function pool(): ApiJourney[] {
  return [
    journey({ id: 'express', totalDurationSeconds: 600, totalPriceMinor: 1500, strategyRanks: { BALANCED: 2, FASTEST: 1, CHEAPEST: 3 } }),
    journey({ id: 'cheap', totalDurationSeconds: 1800, totalPriceMinor: 300, strategyRanks: { BALANCED: 3, FASTEST: 3, CHEAPEST: 1 } }),
    journey({ id: 'middle', totalDurationSeconds: 1100, totalPriceMinor: 800, strategyRanks: { BALANCED: 1, FASTEST: 2, CHEAPEST: 2 } }),
    journey({ id: 'unknown-fare', totalDurationSeconds: 900, totalPriceMinor: null, strategyRanks: { BALANCED: 4, FASTEST: 4, CHEAPEST: 4 } }),
  ];
}

const result = (journeys: ApiJourney[]): ApiJourneySearchResult => ({
  journeys, partial: false, blockedProviders: [],
  availableStrategies: ['BALANCED', 'FASTEST', 'CHEAPEST'],
});

describe('one pool, three independently ranked views', () => {
  test('every tab is a permutation of one shared pool: nothing invented, nothing duplicated, nothing dropped', () => {
    const source = pool();
    const all = result(source);
    const poolIds = source.map(item => item.id).sort();
    for (const strategy of ['BALANCED', 'FASTEST', 'CHEAPEST'] as const) {
      const shown = strategyJourneys(all, strategy).map(item => item.id);
      assert.equal(new Set(shown).size, shown.length, `${strategy} must not repeat a journey`);
      // The only documented eligibility rule is the cheapest tab's unknown-fare exclusion.
      const expected = strategy === 'CHEAPEST' ? poolIds.filter(id => id !== 'unknown-fare') : poolIds;
      assert.deepEqual([...shown].sort(), expected, `${strategy} must only reorder the single pool`);
    }
  });

  test('the three tabs name different winners for the same four journeys', () => {
    const all = result(pool());
    assert.equal(strategyJourneys(all, 'FASTEST')[0]?.id, 'express');
    assert.equal(strategyJourneys(all, 'BALANCED')[0]?.id, 'middle');
    assert.equal(strategyJourneys(all, 'CHEAPEST')[0]?.id, 'cheap');
  });

  test('a strategy the server did not declare available shows nothing instead of a stale pick', () => {
    const all = { ...result(pool()), availableStrategies: ['FASTEST'] as ApiJourneyStrategy[] };
    assert.deepEqual(strategyJourneys(all, 'CHEAPEST'), []);
    assert.deepEqual(strategyJourneys(all, 'BALANCED'), []);
    assert.equal(strategyJourneys(all, 'FASTEST').length, 4);
  });
});

describe('independent oracle on a small synthetic graph', () => {
  // No server ranks: the client must apply the documented objective per strategy.
  const ranked = pool().map(({ strategyRanks: _ranks, ...item }) => ({ ...item, recommendedStrategies: ['BALANCED', 'FASTEST', 'CHEAPEST'] }));
  const knownTotal = (item: ApiJourney) => item.confirmedPriceMinor ?? item.totalPriceMinor;
  const boarding = (item: ApiJourney) => Date.parse(item.legs[0]!.departureAt!);
  const oracle = {
    FASTEST: [...ranked].sort((a, b) => a.totalDurationSeconds - b.totalDurationSeconds || boarding(a) - boarding(b)),
    // An unknown fare is not zero: it cannot take part in a cheapest comparison at all.
    CHEAPEST: [...ranked].filter(item => knownTotal(item) !== null).sort((a, b) => knownTotal(a)! - knownTotal(b)! || boarding(a) - boarding(b)),
    BALANCED: [...ranked].sort((a, b) => a.totalDurationSeconds - b.totalDurationSeconds || (knownTotal(a) ?? Number.MAX_SAFE_INTEGER) - (knownTotal(b) ?? Number.MAX_SAFE_INTEGER) || boarding(a) - boarding(b)),
  };

  for (const strategy of ['FASTEST', 'CHEAPEST', 'BALANCED'] as const) {
    test(`${strategy} order matches the oracle`, () => {
      const shown = strategyJourneys(result(ranked), strategy).map(item => item.id);
      assert.deepEqual(shown, oracle[strategy].map(item => item.id));
      assert.equal(shown.includes('unknown-fare'), strategy !== 'CHEAPEST',
        strategy === 'CHEAPEST' ? 'an unknown fare cannot be ranked as cheapest' : 'a fast or balanced journey keeps its place even without a published fare');
    });
  }
});

describe('switching strategies is a local, read-only operation', () => {
  test('all three views read the same immutable result object', () => {
    const all = result(pool());
    const snapshot = JSON.stringify(all);
    const first = strategyJourneys(all, 'BALANCED').map(item => item.id);
    strategyJourneys(all, 'FASTEST');
    strategyJourneys(all, 'CHEAPEST');
    const again = strategyJourneys(all, 'BALANCED').map(item => item.id);
    assert.deepEqual(again, first);
    assert.equal(JSON.stringify(all), snapshot, 'a strategy view must not mutate the shared pool');
  });

  test('the selection module owns no network call, so a switch never refetches', () => {
    const source = readFileSync('src/views/journeyStrategySelection.ts', 'utf8');
    assert.match(source, /import type \{[^}]*\} from '\.\.\/services\/productionApi'/, 'the module only needs types from the API layer');
    assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|axios|searchJourneys|productionApi\./, 'sorting a local pool must not call the API');
  });
});
