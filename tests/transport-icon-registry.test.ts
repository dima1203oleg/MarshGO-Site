import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalTransportTypes } from '../src/domain/transportCatalog';
import { getTransportModeVisual, normalizeTransportMode, transportModeRegistry } from '../src/design-system/transport/transportModeRegistry';

test('all twelve canonical modes have distinct registered icon components', () => {
  const icons = canonicalTransportTypes.map((mode) => getTransportModeVisual(mode).icon);
  assert.equal(canonicalTransportTypes.length, 12);
  assert.equal(new Set(icons).size, 12);
  assert.deepEqual(Object.keys(transportModeRegistry), [...canonicalTransportTypes]);
});

test('marshrutka, tram and trolleybus resolve to their own visual silhouettes', () => {
  assert.notEqual(getTransportModeVisual('marshrutka').icon, getTransportModeVisual('tram').icon);
  assert.notEqual(getTransportModeVisual('marshrutka').icon, getTransportModeVisual('trolleybus').icon);
  assert.notEqual(getTransportModeVisual('tram').icon, getTransportModeVisual('trolleybus').icon);
  assert.equal(normalizeTransportMode('MINIBUS'), 'marshrutka');
  assert.equal(normalizeTransportMode('TRAM'), 'tram');
  assert.equal(normalizeTransportMode('TROLLEYBUS'), 'trolleybus');
});
