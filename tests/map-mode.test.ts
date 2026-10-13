import test from 'node:test';
import assert from 'node:assert/strict';
import { isBasemapConfigured, mapLayers, PERSPECTIVE_PITCH } from '../src/map/mapMode';
import { mapStyleTokens } from '../src/map/style/tokens';

test('the map exposes two basemaps and keeps perspective independent', () => {
  assert.deepEqual(Object.keys(mapLayers), ['simple', 'satellite']);
  assert.equal(mapLayers.simple.label, 'Схема');
  assert.equal(mapLayers.satellite.label, 'Супутник');
  assert.ok(PERSPECTIVE_PITCH > 0);
  assert.deepEqual(Object.keys(mapStyleTokens), ['MARSHGO_LIGHT', 'MARSHGO_DARK']);
});

test('basemap readiness is evaluated for the selected source, not a shared boolean', () => {
  assert.equal(isBasemapConfigured('simple', true, false), true);
  assert.equal(isBasemapConfigured('simple', false, true), false);
  assert.equal(isBasemapConfigured('satellite', true, false), false);
  assert.equal(isBasemapConfigured('satellite', false, true), true);
});
