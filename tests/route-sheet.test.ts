import assert from 'node:assert/strict';
import test from 'node:test';
import { routeBearingForHorizontalFit } from '../src/map/routeOrientation';
import { nearestRouteSheetSnap, routeSheetHeights, settleRouteSheetSnap } from '../src/views/routeSheet';

test('route sheet snap points leave a visible map strip and keep an ordered range', () => {
  for (const viewport of [667, 844, 932]) {
    const heights = routeSheetHeights(viewport);
    assert.ok(heights.collapsed < heights.half);
    assert.ok(heights.half < heights.expanded);
    assert.ok(viewport - heights.expanded >= 112);
    assert.ok(heights.collapsed >= 200);
  }
});

test('slow release chooses the nearest snap and a quick swipe advances one snap', () => {
  const heights = routeSheetHeights(844);
  assert.equal(nearestRouteSheetSnap((heights.collapsed + heights.half) / 2, heights), 'collapsed');
  assert.equal(settleRouteSheetSnap(heights.collapsed + 40, 0.8, heights), 'half');
  assert.equal(settleRouteSheetSnap(heights.expanded - 40, -0.8, heights), 'half');
  assert.equal(settleRouteSheetSnap(heights.expanded - 120, -0.8, heights, 'expanded'), 'half');
  assert.equal(settleRouteSheetSnap(heights.half + 120, 0.8, heights, 'half'), 'expanded');
  assert.equal(settleRouteSheetSnap(heights.half - 120, -0.8, heights, 'half'), 'collapsed');
  assert.equal(settleRouteSheetSnap(heights.expanded - 10, 0.1, heights), 'expanded');
});

test('route alignment rotates north-south routes sideways and leaves east-west routes north-up', () => {
  assert.equal(routeBearingForHorizontalFit([[24, 49], [24, 50]]), -90);
  assert.ok(Math.abs(routeBearingForHorizontalFit([[24, 49], [25, 49]])) < 1);
  assert.equal(routeBearingForHorizontalFit([[24, 49]]), 0);
  assert.ok(routeBearingForHorizontalFit([[24.003, 49.8682], [24.0576, 49.7941]]) > 0);
});
