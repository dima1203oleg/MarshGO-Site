import test from 'node:test';
import assert from 'node:assert/strict';
import { productionApi } from '../src/services/productionApi';

test('transit stop arrivals keeps realtime freshness metadata from the API envelope', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      data: { stopId: 'provider:stop-1', lat: 49.84, lon: 24.02, arrivals: [] },
      meta: {
        availability: 'AVAILABLE',
        scheduleUpdatedAt: '2026-10-14T05:00:00Z',
        realtimeStatus: 'STALE',
        realtimeFeedTimestamp: '2026-10-14T04:52:00Z',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const response = await productionApi.transitStopArrivals({
      providerId: '00000000-0000-4000-8000-000000000001',
      stopId: 'stop-1', latitude: 49.84, longitude: 24.02, routeId: 'route-7', headsign: 'Center', limit: 3,
    });
    assert.equal(response.data.arrivals.length, 0);
    assert.equal(response.meta?.realtimeStatus, 'STALE');
    assert.equal(response.meta?.realtimeFeedTimestamp, '2026-10-14T04:52:00Z');
    assert.match(requestedUrl, /transit\/stops\/00000000-0000-4000-8000-000000000001%3Astop-1\/arrivals/);
    assert.match(requestedUrl, /routeId=route-7/);
    assert.match(requestedUrl, /headsign=Center/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects successful API responses without a data envelope', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 200 });
  try {
    await assert.rejects(productionApi.myNavigationMatches(), /Сервер повернув некоректну відповідь/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
