import test from 'node:test';
import assert from 'node:assert/strict';
import { focusedApproachVehicles, focusedFleetNextExpiry } from '../src/map/transportVisualZones';

const now = Date.parse('2026-11-11T12:00:00Z');
const vehicle = (id: string, offset: number, emphasized = true) => ({ id, emphasized, updatedAt: new Date(now + offset).toISOString(), coordinates: [24, 49] as [number, number] });

test('focused fleet contains at most three server-confirmed fresh approaches', () => {
  const items = [vehicle('other', 0, false), vehicle('a', -90000), vehicle('b', 0), vehicle('c', 30000), vehicle('d', 0)];
  assert.deepEqual(focusedApproachVehicles(items, now).map(item => item.id), ['a', 'b', 'c']);
});

test('focused fleet excludes expired, implausibly future and invalid fixes', () => {
  const invalid = { ...vehicle('invalid', 0), coordinates: [200, 49] as [number, number] };
  assert.deepEqual(focusedApproachVehicles([vehicle('old', -90001), vehicle('future', 30001), invalid, { ...vehicle('bad', 0), updatedAt: 'invalid' }], now), []);
});

test('visible vehicles expire without waiting for another provider response', () => {
  const items = [vehicle('a', -89_000), vehicle('b', -10_000)];
  const expiry = focusedFleetNextExpiry(items, now);
  assert.equal(expiry, now + 1001);
  assert.deepEqual(focusedApproachVehicles(items, expiry!).map(item => item.id), ['b']);
  assert.equal(focusedFleetNextExpiry(items, now + 90_001), null);
});
