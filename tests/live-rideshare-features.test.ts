import assert from 'node:assert/strict';
import test from 'node:test';
import { freshRideshareApproachRoute, freshRidesharePositions } from '../src/map/liveRideshareFeatures';
import type { LiveRideshareApproachRoute, LiveRidesharePosition } from '../src/map/MapAdapter';

const now = Date.parse('2026-10-14T09:00:00.000Z');
const position = (overrides: Partial<LiveRidesharePosition> = {}): LiveRidesharePosition => ({
  id: 'rendezvous-1', coordinates: [24.03, 49.83], capturedAt: new Date(now - 20_000).toISOString(), freshness: 'LIVE', ...overrides,
});

test('keeps an authorized fresh rendezvous GPS point live and demotes an old live flag', () => {
  const accepted = freshRidesharePositions([
    position(),
    position({ id: 'old-live-flag', capturedAt: new Date(now - 91_000).toISOString() }),
  ], now);
  assert.deepEqual(accepted.map((item) => item.freshness), ['LIVE', 'STALE']);
});

test('drops expired, future-skewed and invalid coordinates without inventing a location', () => {
  const accepted = freshRidesharePositions([
    position({ id: 'expired', capturedAt: new Date(now - 300_001).toISOString(), freshness: 'STALE' }),
    position({ id: 'future', capturedAt: new Date(now + 30_001).toISOString() }),
    position({ id: 'bad-coordinate', coordinates: [181, 49.83] }),
  ], now);
  assert.deepEqual(accepted, []);
});

test('keeps a fresh OSRM approach route only while its source GPS fix and route result are fresh', () => {
  const route: LiveRideshareApproachRoute = {
    id: 'rendezvous-1', coordinates: [[24.03, 49.83], [24.031, 49.829]],
    vehicleCapturedAt: new Date(now - 20_000).toISOString(), calculatedAt: new Date(now - 5_000).toISOString(),
    distanceMeters: 1400, durationSeconds: 240, provider: 'osrm',
  };
  assert.deepEqual(freshRideshareApproachRoute(route, now), route);
  assert.equal(freshRideshareApproachRoute({ ...route, vehicleCapturedAt: new Date(now - 90_001).toISOString() }, now), null);
  assert.equal(freshRideshareApproachRoute({ ...route, calculatedAt: new Date(now - 60_001).toISOString() }, now), null);
  assert.equal(freshRideshareApproachRoute({ ...route, provider: 'schedule' }, now), null);
  assert.equal(freshRideshareApproachRoute({ ...route, coordinates: [[24.03, 49.83], [181, 49.829]] }, now), null);
});
