import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFloatingInfoPlacement } from '../src/map/floatingInfoPlacement';

test('floating info keeps its compact above-anchor position when the map is clear', () => {
  assert.deepEqual(
    resolveFloatingInfoPlacement({ x: 170, y: 250 }, { width: 128, height: 48 }, { width: 375, height: 667 }),
    { anchor: 'bottom', offset: [0, -28] },
  );
});

test('floating info moves left of an overlapping control rail', () => {
  const placement = resolveFloatingInfoPlacement(
    { x: 270, y: 240 },
    { width: 128, height: 48 },
    { width: 375, height: 667 },
    [{ left: 319, top: 125, right: 363, bottom: 455 }],
  );
  assert.equal(placement.anchor, 'right');
  assert.ok(placement.offset[0] <= -14);
});

test('floating info stays inside the viewport when its route anchor is near an edge', () => {
  const placement = resolveFloatingInfoPlacement(
    { x: 365, y: 235 },
    { width: 128, height: 48 },
    { width: 375, height: 667 },
    [{ left: 319, top: 125, right: 363, bottom: 455 }],
  );
  assert.equal(placement.anchor, 'right');
  assert.ok(placement.offset[0] < -50);
});
