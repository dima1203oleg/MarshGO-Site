import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchRoute, parseSearchRoute, type SearchRouteState } from '../src/routing/searchRouteState';
import { kyivDateTimeInputToDate } from '../src/domain/kyivTime';

const base: SearchRouteState = {
  origin: { label: 'Личаківська вулиця, Львів', latitude: 49.832, longitude: 24.0262, providerId: 'openstreetmap' },
  destination: { label: 'вулиця Городоцька, Львів', latitude: 49.806, longitude: 24.021, providerId: 'openstreetmap' },
  date: '2026-11-01',
  passengers: 1,
  departure: '2026-11-01T10:00',
  strategy: 'BALANCED',
  mode: 'planner',
};

function withDeparture(departure: string): string {
  const query = new URLSearchParams({
    mode: base.mode,
    origin: base.origin.label, originLat: String(base.origin.latitude), originLon: String(base.origin.longitude), originProvider: base.origin.providerId,
    destination: base.destination.label, destinationLat: String(base.destination.latitude), destinationLon: String(base.destination.longitude), destinationProvider: base.destination.providerId,
    date: base.date, passengers: String(base.passengers), departure, strategy: base.strategy,
  });
  return `?${query.toString()}`;
}

test('a shared link with second precision restores a departure the planner can submit', () => {
  const parsed = parseSearchRoute(withDeparture('2026-11-01T09:30:00'));
  assert.equal(parsed?.departure, '2026-11-01T09:30');
  assert.notEqual(kyivDateTimeInputToDate(parsed?.departure ?? ''), null);
});

test('a shared link at minute precision round-trips untouched', () => {
  const parsed = parseSearchRoute(withDeparture('2026-11-01T10:00'));
  assert.equal(parsed?.departure, '2026-11-01T10:00');
});

test('a shared link whose departure carries a zone is rejected rather than misread as Kyiv wall time', () => {
  assert.equal(parseSearchRoute(withDeparture('2026-11-01T10:00:00Z')), null);
  assert.equal(parseSearchRoute(withDeparture('2026-11-01 10:00')), null);
  assert.equal(parseSearchRoute(withDeparture('tomorrow')), null);
});

test('building a search link keeps the minute-precision departure contract', () => {
  const path = buildSearchRoute(base);
  assert.match(path, /departure=2026-11-01T10%3A00&strategy=BALANCED$/);
  assert.deepEqual(parseSearchRoute(path.replace('/journeys/search', '')), base);
});
