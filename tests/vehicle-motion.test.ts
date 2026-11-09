import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VEHICLE_GLIDE_MAX_AGE_MS,
  VEHICLE_GLIDE_MAX_GAP_MS,
  VEHICLE_GLIDE_MAX_JUMP_METERS,
  vehicleFixAgeMs,
  isFreshVehicleFix,
  vehicleDistanceMeters,
  shouldGlideVehicle,
  interpolateVehicleCoordinate,
  vehicleGlideDuration,
} from '../src/map/vehicleMotion';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const fresh = (overrides: Partial<Parameters<typeof shouldGlideVehicle>[0]> = {}) => ({
  fromUpdatedAt: iso(-6000),
  toUpdatedAt: iso(0),
  distanceMeters: 120,
  now: NOW,
  reducedMotion: false,
  ...overrides,
});

test('a fresh fix ages forward and an unparseable stamp has no age', () => {
  assert.equal(vehicleFixAgeMs(iso(-5000), NOW), 5000);
  assert.equal(vehicleFixAgeMs(iso(5000), NOW), 0, 'a future stamp clamps to zero, never negative');
  assert.equal(vehicleFixAgeMs('not-a-date', NOW), null);
});

test('freshness uses the same 90 s window as the map badge', () => {
  assert.equal(isFreshVehicleFix(iso(-1000), NOW), true);
  assert.equal(isFreshVehicleFix(iso(-VEHICLE_GLIDE_MAX_AGE_MS), NOW), true);
  assert.equal(isFreshVehicleFix(iso(-VEHICLE_GLIDE_MAX_AGE_MS - 1), NOW), false);
  assert.equal(isFreshVehicleFix('garbage', NOW), false);
});

test('two fresh fixes a short drive apart glide', () => {
  assert.equal(shouldGlideVehicle(fresh()), true);
});

test('a stale fix is never animated as real motion', () => {
  assert.equal(shouldGlideVehicle(fresh({ fromUpdatedAt: iso(-VEHICLE_GLIDE_MAX_AGE_MS - 10_000) })), false);
  assert.equal(shouldGlideVehicle(fresh({ toUpdatedAt: iso(-VEHICLE_GLIDE_MAX_AGE_MS - 10_000), now: NOW })), false);
});

test('reduced motion jumps instead of gliding', () => {
  assert.equal(shouldGlideVehicle(fresh({ reducedMotion: true })), false);
});

test('a long silence or backwards time is not bridged as motion', () => {
  assert.equal(shouldGlideVehicle(fresh({ fromUpdatedAt: iso(-VEHICLE_GLIDE_MAX_GAP_MS - 5000) })), false);
  assert.equal(shouldGlideVehicle(fresh({ fromUpdatedAt: iso(1000), toUpdatedAt: iso(0) })), false, 'time must move forward');
  assert.equal(shouldGlideVehicle(fresh({ fromUpdatedAt: iso(0), toUpdatedAt: iso(0) })), false, 'zero gap is not a glide');
});

test('a teleport or noise spike jumps instead of gliding across the city', () => {
  assert.equal(shouldGlideVehicle(fresh({ distanceMeters: VEHICLE_GLIDE_MAX_JUMP_METERS + 1 })), false);
  assert.equal(shouldGlideVehicle(fresh({ distanceMeters: 0 })), false);
  assert.equal(shouldGlideVehicle(fresh({ distanceMeters: Number.NaN })), false);
});

test('distance is symmetric and zero on the same fix', () => {
  assert.equal(vehicleDistanceMeters([24.0, 49.8], [24.0, 49.8]), 0);
  const a = vehicleDistanceMeters([24.0, 49.8], [24.0145, 49.8]);
  assert.ok(a > 1000 && a < 1100, `expected ~1055 m, got ${a}`);
});

test('interpolation clamps to the endpoints and walks the straight line', () => {
  const from: [number, number] = [24.0, 49.8];
  const to: [number, number] = [24.02, 49.81];
  assert.deepEqual(interpolateVehicleCoordinate(from, to, 0), from);
  assert.deepEqual(interpolateVehicleCoordinate(from, to, 1), to);
  assert.deepEqual(interpolateVehicleCoordinate(from, to, -1), from);
  assert.deepEqual(interpolateVehicleCoordinate(from, to, 2), to);
  const mid = interpolateVehicleCoordinate(from, to, 0.5);
  assert.ok(Math.abs(mid[0] - 24.01) < 1e-9 && Math.abs(mid[1] - 49.805) < 1e-9);
});

test('glide duration settles before the next fix and stays bounded', () => {
  assert.equal(vehicleGlideDuration(0), 240);
  assert.equal(vehicleGlideDuration(Number.NaN), 240);
  assert.ok(vehicleGlideDuration(2000) <= 2000 * 0.85 + 10, 'must finish before the next fix');
  assert.ok(vehicleGlideDuration(60_000) <= 1200, 'a long silence never produces a crawl');
  assert.ok(vehicleGlideDuration(100) >= 240, 'a tiny gap still reads as a glide');
  assert.equal(vehicleGlideDuration(3000) % 10, 0);
});