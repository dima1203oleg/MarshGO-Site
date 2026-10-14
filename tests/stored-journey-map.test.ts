import assert from 'node:assert/strict';
import test from 'node:test';
import { storedJourneyToApiJourney } from '../src/domain/storedJourney';
import type { ApiStoredJourney } from '../src/services/productionApi';

const storedJourney = (): ApiStoredJourney => ({
  id: 'journey-1', origin_name: 'Малоголосківська, 12', destination_name: 'Сихівська, 30',
  requested_departure_at: '2026-10-14T09:00:00.000Z', strategy: 'BALANCED', state: 'PARTIALLY_RESERVED',
  passenger_count: 1, total_price_minor: 3300, confirmed_price_minor: null, total_duration_s: 2700,
  transfer_count: 1, walking_distance_m: 1100, waitingSeconds: 120, legs: [
    {
      id: 'walk-1', mode: 'WALK', originName: 'Старт', originCoordinates: [24.01, 49.83],
      destinationName: 'Зупинка', destinationCoordinates: [24.02, 49.83], departureAt: '2026-10-14T09:00:00.000Z',
      arrivalAt: '2026-10-14T09:08:00.000Z', durationSeconds: 480, distanceMeters: 650, priceMinor: 0,
      currency: 'UAH', priceStatus: 'LOCKED', availabilityStatus: 'AVAILABLE', offerId: null, bookingId: null,
      state: 'SELECTED', dataSource: 'osrm', lastUpdatedAt: '2026-10-14T08:55:00.000Z',
      routeGeometry: [[24.01, 49.83], [24.015, 49.83], [24.02, 49.83]],
    },
    {
      id: 'ride-1', mode: 'COMMUNITY', originName: 'Зупинка', originCoordinates: [24.02, 49.83],
      destinationName: 'Фініш', destinationCoordinates: [24.04, 49.84], departureAt: '2026-10-14T09:10:00.000Z',
      arrivalAt: '2026-10-14T09:40:00.000Z', durationSeconds: 1800, distanceMeters: 8500, priceMinor: 3300,
      currency: 'UAH', priceStatus: 'LOCKED', availabilityStatus: 'AVAILABLE', offerId: 'offer-1', bookingId: 'booking-1',
      state: 'CONFIRMED', dataSource: 'community', lastUpdatedAt: '2026-10-14T08:55:00.000Z',
      metadata: { routeName: 'Поїздка водія' }, routeGeometry: [[24.02, 49.83], [24.04, 49.84]],
    },
  ],
});

test('converts an authenticated stored Journey without losing booking linkage or route geometry', () => {
  const converted = storedJourneyToApiJourney(storedJourney());
  assert.equal(converted.totalDurationSeconds, 2700);
  assert.equal(converted.transfers, 1);
  assert.equal(converted.legs[1].bookingId, 'booking-1');
  assert.equal(converted.legs[1].state, 'CONFIRMED');
  assert.deepEqual(converted.legs[1].routeGeometry, [[24.02, 49.83], [24.04, 49.84]]);
  assert.equal(converted.legs[1].routeName, 'Поїздка водія');
  assert.equal(converted.legs[0].priceMinor, 0);
});

test('rejects malformed saved endpoints instead of drawing a false map location', () => {
  const invalid = storedJourney();
  invalid.legs[0].originCoordinates = [181, 49.83];
  assert.throws(() => storedJourneyToApiJourney(invalid), /немає координат початку/);
});
