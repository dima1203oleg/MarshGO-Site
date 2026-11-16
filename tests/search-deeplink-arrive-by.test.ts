import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchRoute, parseSearchRoute, type SearchRouteState } from '../src/routing/searchRouteState';

const base: SearchRouteState = {
  origin: { label: 'Вокзальна вулиця, 38, Чернівці', latitude: 48.3010524, longitude: 25.9299818, providerId: 'openstreetmap' },
  destination: { label: 'Привокзальна вулиця, 1, Івано-Франківськ', latitude: 48.9252915, longitude: 24.7234494, providerId: 'openstreetmap' },
  date: '2026-11-15',
  passengers: 1,
  departure: '2026-11-15T09:00',
  strategy: 'BALANCED',
  mode: 'planner',
};

function withQuery(extra: Record<string, string>): string {
  const query = new URLSearchParams({
    mode: base.mode,
    origin: base.origin.label, originLat: String(base.origin.latitude), originLon: String(base.origin.longitude), originProvider: base.origin.providerId,
    destination: base.destination.label, destinationLat: String(base.destination.latitude), destinationLon: String(base.destination.longitude), destinationProvider: base.destination.providerId,
    date: base.date, passengers: String(base.passengers), departure: base.departure, strategy: base.strategy,
    ...extra,
  });
  return `?${query.toString()}`;
}

test('an arrive-by deadline survives the shared search link', () => {
  const path = buildSearchRoute({ ...base, arrivalBy: '2026-11-15T22:00' });
  const parsed = parseSearchRoute(path.replace('/journeys/search', ''));
  assert.equal(parsed?.arrivalBy, '2026-11-15T22:00');
  assert.deepEqual(parsed, { ...base, arrivalBy: '2026-11-15T22:00' });
});

test('links without a deadline keep the exact previous shape', () => {
  const path = buildSearchRoute(base);
  assert.ok(!path.includes('arrivalBy'));
  assert.deepEqual(parseSearchRoute(path.replace('/journeys/search', '')), base);
});

test('a shared deadline at second precision restores minute precision', () => {
  const parsed = parseSearchRoute(withQuery({ arrivalBy: '2026-11-15T22:00:00' }));
  assert.equal(parsed?.arrivalBy, '2026-11-15T22:00');
});

test('a deadline that is not after departure is not carried into the link', () => {
  assert.ok(!buildSearchRoute({ ...base, arrivalBy: '2026-11-15T09:00' }).includes('arrivalBy'));
  assert.ok(!buildSearchRoute({ ...base, arrivalBy: '2026-11-15T08:00' }).includes('arrivalBy'));
  assert.equal(parseSearchRoute(withQuery({ arrivalBy: '2026-11-15T08:00' }))?.arrivalBy, undefined);
});

test('a malformed or zoned deadline is dropped, the rest of the link still restores', () => {
  for (const arrivalBy of ['2026-11-15T22:00:00Z', '2026-11-15 22:00', 'tomorrow', '']) {
    const parsed = parseSearchRoute(withQuery({ arrivalBy }));
    assert.notEqual(parsed, null);
    assert.equal(parsed?.arrivalBy, undefined);
    assert.equal(parsed?.departure, base.departure);
  }
});

test('a deadline on the next calendar day round-trips', () => {
  const path = buildSearchRoute({ ...base, departure: '2026-11-15T23:30', arrivalBy: '2026-11-16T06:00' });
  const parsed = parseSearchRoute(path.replace('/journeys/search', ''));
  assert.equal(parsed?.arrivalBy, '2026-11-16T06:00');
});