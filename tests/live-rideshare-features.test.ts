import assert from 'node:assert/strict';
import test from 'node:test';
import { freshRidesharePositions } from '../src/map/liveRideshareFeatures';
import type { LiveRidesharePosition } from '../src/map/MapAdapter';

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
