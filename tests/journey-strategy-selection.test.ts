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
