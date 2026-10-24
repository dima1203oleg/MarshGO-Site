import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiJourneyLive } from '../src/services/productionApi';
import { journeyLiveArrivalMessage } from '../src/views/journeyLiveArrival';

type LiveSegment = ApiJourneyLive['segments'][number];

function segment(overrides: Partial<LiveSegment> = {}): LiveSegment {
  return {
    legId: 'leg-1',
    status: 'SCHEDULED',
    vehiclePositionStatus: 'UNAVAILABLE',
    boardingStopArrival: { status: 'UNAVAILABLE' },
    lineRoutes: [],
    vehicles: [],
    ...overrides,
  };
}

test('shows arrival ETA only for an emphasized vehicle verified to approach boarding', () => {
  const message = journeyLiveArrivalMessage(segment({
    vehicles: [{
      id: 'vehicle-1', providerId: 'feed-1', coordinates: [24, 49], bearing: null, speed: null,
      updatedAt: '2026-10-24T08:59:30.000Z', tripId: 'trip-1', routeId: 'route-1', directionId: '0',
      approachingBoarding: true, remainingStops: 3, emphasized: true,
      approachEvidence: { source: 'TRIP_UPDATE_PREDICTION', predictedArrivalAt: '2026-10-24T09:04:00.000Z' },
      etaSeconds: 240,
    }],
  }), Date.parse('2026-10-24T09:00:00.000Z'));

  assert.equal(message, 'Машина до посадки · 4 хв · 3 зуп. · щойно оновлено');
});

test('does not promote a non-emphasized vehicle to an approaching vehicle', () => {
  const message = journeyLiveArrivalMessage(segment({
    vehicles: [{
      id: 'vehicle-1', providerId: 'feed-1', coordinates: [24, 49], bearing: null, speed: null,
      updatedAt: '2026-10-24T08:59:30.000Z', tripId: null, routeId: 'route-1', directionId: null,
      approachingBoarding: false, remainingStops: null, emphasized: false,
      approachEvidence: null, etaSeconds: null,
    }],
  }), Date.parse('2026-10-24T09:00:00.000Z'));

  assert.equal(message, '1 свіжих машин на лінії; під’їзд до посадки не підтверджено');
});

test('distinguishes a realtime stop prediction from a published schedule', () => {
  const now = Date.parse('2026-10-24T09:00:00.000Z');
  assert.equal(journeyLiveArrivalMessage(segment({
    boardingStopArrival: { status: 'PREDICTED', scheduledAt: '2026-10-24T09:08:00.000Z', predictedAt: '2026-10-24T09:05:00.000Z', realtimeUpdatedAt: '2026-10-24T08:59:00.000Z' },
  }), now), 'Прогноз прибуття на зупинку · 5 хв · оновлено 1 хв тому');
  assert.equal(journeyLiveArrivalMessage(segment({
    boardingStopArrival: { status: 'SCHEDULED', scheduledAt: '2026-10-24T06:10:00.000Z' },
  }), now), 'За розкладом · 09:10');
});

test('states plainly when no fresh position or verified prediction is available', () => {
  assert.equal(journeyLiveArrivalMessage(segment()), 'Немає свіжої позиції або підтвердженого прогнозу прибуття');
});
