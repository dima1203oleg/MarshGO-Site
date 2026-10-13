import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleTransportLayers } from '../src/map/focusMode';

test('focus mode hides secondary map layers without mutating saved selections', () => {
  const saved = new Set(['BUS', 'BIKE', 'SCOOTER'] as const);
  assert.deepEqual(visibleTransportLayers(saved, true), new Set());
  assert.deepEqual(saved, new Set(['BUS', 'BIKE', 'SCOOTER']));
});

test('normal navigation renders exactly the selected map layers', () => {
  const saved = new Set(['BUS', 'STOPS'] as const);
  assert.deepEqual(visibleTransportLayers(saved, false), saved);
});
