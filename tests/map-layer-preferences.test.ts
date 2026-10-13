import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMapDisplayPreferences } from '../src/map/mapLayerPreferences';

test('map display preferences default safely and ignore malformed stored values', () => {
  assert.deepEqual(normalizeMapDisplayPreferences(null), { routeLines: true, liveVehicles: true, routeNumbers: true });
  assert.deepEqual(normalizeMapDisplayPreferences({ routeLines: false, liveVehicles: 'yes', extra: true }), {
    routeLines: false, liveVehicles: true, routeNumbers: true,
  });
});
