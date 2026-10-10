import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLayers } from '../src/map/mapMode';
import { mapStyleTokens } from '../src/map/style/tokens';

test('the map exposes exactly three base modes and four explicit day/night vector themes', () => {
  assert.deepEqual(Object.keys(mapLayers), ['simple', 'threeD', 'satellite']);
  assert.equal(mapLayers.simple.pitch, 0);
  assert.ok(mapLayers.threeD.pitch > 0);
  assert.equal(mapLayers.satellite.pitch, 0);
  assert.deepEqual(Object.keys(mapStyleTokens), [
    'MARSHGO_LIGHT', 'MARSHGO_DARK', 'MARSHGO_3D_LIGHT', 'MARSHGO_3D_DARK',
  ]);
});
