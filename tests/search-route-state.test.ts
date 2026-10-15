import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSearchRoute } from '../src/routing/searchRouteState';

const valid = new URLSearchParams({
  mode: 'planner',
  strategy: 'BALANCED',
  origin: 'Площа Ринок, Львів',
  originLat: '49.8419',
  originLon: '24.0315',
  originProvider: 'fixture-origin',
  destination: 'Сихівський ринок, Львів',
  destinationLat: '49.7889',
  destinationLon: '24.0542',
  destinationProvider: 'fixture-destination',
  date: '2026-10-14',
  passengers: '1',
  departure: '2026-10-14T09:00:00+03:00',
});

test('shared journey search rejects absent or blank raw coordinates', () => {
  const missingLatitude = new URLSearchParams(valid);
  missingLatitude.delete('originLat');
  assert.equal(parseSearchRoute(`?${missingLatitude}`), null);

  const blankLongitude = new URLSearchParams(valid);
  blankLongitude.set('destinationLon', '   ');
  assert.equal(parseSearchRoute(`?${blankLongitude}`), null);
});

test('shared journey search accepts valid coordinate values', () => {
  const parsed = parseSearchRoute(`?${valid}`);
  assert.equal(parsed?.origin.latitude, 49.8419);
  assert.equal(parsed?.destination.longitude, 24.0542);
});
