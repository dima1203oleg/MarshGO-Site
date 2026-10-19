import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingStopArrivals, stopArrivalEtaLabel, stopArrivalFreshnessNotice } from '../src/domain/stopArrivals';
import type { ApiTransitStopArrival } from '../src/services/productionApi';

function arrival(overrides: Partial<ApiTransitStopArrival> & Pick<ApiTransitStopArrival, 'routeId' | 'headsign' | 'tripId' | 'etaSeconds'>): ApiTransitStopArrival {
  return {
    stopId: 'provider:stop', mode: 'BUS', scheduledArrival: '2026-10-14T08:00:00Z',
    predictedArrival: '2026-10-14T08:00:00Z', arrivalSource: 'SCHEDULE', confidence: 'LOW',
    routeName: '7', isRealtime: false, displayLabel: '7 — 2 хв за розкладом', ...overrides,
  };
}

test('keeps only the selected route and normalized direction, sorted to the three nearest arrivals', () => {
  const result = matchingStopArrivals([
    arrival({ routeId: 'other', headsign: 'Center', tripId: 'other-route', etaSeconds: 10 }),
    arrival({ routeId: 'r7', headsign: 'Center', tripId: 'fourth', etaSeconds: 240 }),
    arrival({ routeId: 'r7', headsign: 'Reverse', tripId: 'reverse', etaSeconds: 20 }),
    arrival({ routeId: 'r7', headsign: 'Center', tripId: 'third', etaSeconds: 180 }),
    arrival({ routeId: 'r7', headsign: '  CENTER  ', tripId: 'first', etaSeconds: 30 }),
    arrival({ routeId: 'r7', headsign: 'Center', tripId: 'second', etaSeconds: 90 }),
  ], 'r7', 'center');

  assert.deepEqual(result.map(item => item.tripId), ['first', 'second', 'third']);
});

test('formats arrival seconds without claiming schedule estimates are live', () => {
  assert.equal(stopArrivalEtaLabel(0), 'Зараз');
  assert.equal(stopArrivalEtaLabel(-3), 'Зараз');
  assert.equal(stopArrivalEtaLabel(1), '1 хв');
  assert.equal(stopArrivalEtaLabel(61), '2 хв');
  assert.equal(stopArrivalEtaLabel(Number.NaN), 'Зараз');
});

test('labels stale realtime separately from the scheduled fallback and includes its source time', () => {
  assert.deepEqual(stopArrivalFreshnessNotice({
    availability: 'AVAILABLE', realtimeStatus: 'STALE', realtimeFeedTimestamp: '2026-10-14T05:00:00Z',
  }), {
    tone: 'warning', label: 'Онлайн-дані застаріли (станом на 08:00). Показано розклад.',
  });
});

test('distinguishes fresh realtime, unavailable realtime, schedule-only feeds, and unsupported schedules', () => {
  assert.deepEqual(stopArrivalFreshnessNotice({ availability: 'AVAILABLE', realtimeStatus: 'AVAILABLE', realtimeUpdatedAt: '2026-10-14T05:00:00Z' }), {
    tone: 'live', label: 'Онлайн-дані оновлено о 08:00.',
  });
  assert.equal(stopArrivalFreshnessNotice({ availability: 'AVAILABLE', realtimeStatus: 'TEMPORARILY_UNAVAILABLE' }).label,
    'Онлайн-дані тимчасово недоступні. Показано розклад.');
  assert.equal(stopArrivalFreshnessNotice({ availability: 'AVAILABLE', realtimeStatus: 'NOT_CONFIGURED' }).tone, 'muted');
  assert.equal(stopArrivalFreshnessNotice({ availability: 'SCHEDULE_UNSUPPORTED', realtimeStatus: 'NOT_CONFIGURED' }).label,
    'Провайдер не підтримує розклад для цієї зупинки.');
  assert.equal(stopArrivalFreshnessNotice(undefined).label, 'Стан онлайн-даних невідомий. ETA показано за розкладом.');
});
