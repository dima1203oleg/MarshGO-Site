import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { LocationFix } from '../shared/navigation/contracts';
import { passengerLocationStartMessage, validatePassengerLocationUpdate, validatePassengerStartFix } from '../src/navigation/passengerLocation';

const fixtureTime = Date.parse('2026-11-10T10:00:00.000Z');
const freshFix = (overrides: Partial<LocationFix> = {}): LocationFix => ({
  longitude: 24.03,
  latitude: 49.84,
  accuracyMeters: 18,
  capturedAtClient: new Date(fixtureTime).toISOString(),
  source: 'gps',
  ...overrides,
});

test('passenger navigation accepts only a fresh, accurate browser GPS fix', () => {
  const result = validatePassengerStartFix(freshFix(), fixtureTime);
  assert.equal(result.accepted, true);
  if (result.accepted) assert.equal(result.fix.source, 'gps');
});

test('passenger navigation rejects simulated coordinates, low accuracy, and stale positions', () => {
  assert.deepEqual(validatePassengerStartFix(freshFix({ source: 'simulated' }), fixtureTime), { accepted: false, code: 'GPS_INVALID_FIX' });
  assert.deepEqual(validatePassengerStartFix(freshFix({ accuracyMeters: 101 }), fixtureTime), { accepted: false, code: 'GPS_LOW_ACCURACY' });
  assert.deepEqual(validatePassengerStartFix(freshFix({ capturedAtClient: new Date(fixtureTime - 61_000).toISOString() }), fixtureTime), { accepted: false, code: 'GPS_STALE' });
});

test('passenger location updates ignore duplicates and reject implausible jumps', () => {
  const previous = freshFix();
  assert.deepEqual(validatePassengerLocationUpdate(previous, fixtureTime, previous), { accepted: false, duplicate: true });
  const jump = freshFix({ longitude: 25.2, capturedAtClient: new Date(fixtureTime + 1_000).toISOString() });
  assert.deepEqual(validatePassengerLocationUpdate(jump, fixtureTime + 1_000, previous), { accepted: false, code: 'GPS_TELEPORT_DETECTED' });
});

test('location failure copy stays understandable and excludes implementation details', () => {
  const text = passengerLocationStartMessage('GPS_PERMISSION_DENIED');
  assert.match(text, /доступ до місцезнаходження/i);
  assert.doesNotMatch(text, /GPS_PERMISSION_DENIED|GeolocationPosition|watchPosition/);
});

test('the route starts GPS before server activation and stores no coordinate', () => {
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/views/ProductionMarketplace.tsx'), 'utf8');
  const start = source.slice(source.indexOf('const startJourneyNavigation = async'));
  const gpsRequest = start.indexOf('getCurrentFix(');
  const activation = start.indexOf('activatePassengerJourney(');
  const persistence = start.indexOf('activeJourneyStore.write(');
  assert.ok(gpsRequest >= 0 && activation > gpsRequest && persistence > activation);
  assert.match(start, /setActiveJourneyStartFix\(validation\.fix\)/);
  assert.doesNotMatch(start, /activeJourneyStore\.write\([^\n]*(?:latitude|longitude|coordinates)/i);
});

test('the route map keeps GPS-follow, stage preview, and full overview as separate camera actions', () => {
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/views/JourneyActiveNavigation.tsx'), 'utf8');
  assert.match(source, /useState<'gps' \| 'preview' \| 'overview' \| 'free'>/);
  assert.match(source, /aria-label="Показати весь маршрут"/);
  assert.match(source, /aria-label="До навігації"/);
  assert.match(source, /onPreviewStageChange\?:/);
  assert.match(source, /setVehicle\(coordinate, locationFix\.headingDegrees\)/);
  assert.match(source, /recenter\(coordinate\)/);
});

test('HyperFlight is a cancellable preview between confirmed adjacent route geometries', () => {
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/views/JourneyActiveNavigation.tsx'), 'utf8');
  assert.match(source, /const baseIndex = previewFlightCancel\.current \? previewTargetLegIndex\.current/);
  assert.match(source, /moveToAdjacentLeg\(baseIndex \+ 1, 'forward'\)/);
  assert.match(source, /moveToAdjacentLeg\(baseIndex - 1, 'backward'\)/);
  assert.match(source, /!mapGeometry\.approximate/);
  assert.match(source, /routePreviewAnchorsMatch\(sourcePath/);
  assert.match(source, /distanceBetweenCoordinates\(flightPath\.coordinates\.at\(-1\)!?, dockingAnchor\) > 15/);
  assert.match(source, /playRoutePreviewFlight\?\./);
  assert.match(source, /autoFocusRouteSegment=\{false\}/);
  assert.match(source, /cancelPreviewFlight\(\);\s*const previous = latestLocationFix\.current/);
  assert.match(source, /aria-label="Попередній етап маршруту"/);
});

test('active navigation keeps the map route prop stable so parent renders cannot cancel HyperFlight', () => {
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/views/JourneyActiveNavigation.tsx'), 'utf8');
  assert.match(source, /const EMPTY_MAP_ROUTE: Coordinate\[\] = \[\]/);
  assert.match(source, /route=\{EMPTY_MAP_ROUTE\}/);
  assert.doesNotMatch(source, /route=\{\[\]\}/);
});

test('active navigation waits for the map style status before its initial route framing', () => {
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/views/JourneyActiveNavigation.tsx'), 'utf8');
  assert.match(source, /mapAdapterReady \|\| mapStatus === 'loading' \|\| !leg/);
  assert.match(source, /mapAdapterReady, mapPadding, mapStatus, sheetSnap/);
});

test('active walking stages do not show a duplicate floating card over their route label', () => {
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/views/JourneyActiveNavigation.tsx'), 'utf8');
  assert.match(source, /leg\.mode === 'WALK' \? null : floatingInfoForLeg\(leg\)/);
});

test('the virtual camera and Scout never write a fake GPS position or route lifecycle state', () => {
  const adapter = readFileSync(path.resolve(import.meta.dirname, '../src/map/MapLibreAdapter.ts'), 'utf8');
  const flight = adapter.slice(adapter.indexOf('playRoutePreviewFlight('), adapter.indexOf("cancelRoutePreviewFlight(reason:"));
  assert.match(flight, /marshgo-hyperlight-scout/);
  assert.match(flight, /this\.map\.jumpTo/);
  assert.doesNotMatch(flight, /setVehicle\(|activatePassengerJourney|completePassengerJourney|updateStage\(/);
  assert.match(adapter, /if \(event\.originalEvent\) this\.cancelRoutePreviewFlight\('user'\)/);
});
