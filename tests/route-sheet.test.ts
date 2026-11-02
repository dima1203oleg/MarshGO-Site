import assert from 'node:assert/strict';
import test from 'node:test';
import { routeBearingForHorizontalFit } from '../src/map/routeOrientation';
import { nearestRouteSheetSnap, ROUTE_SHEET_SNAPS, routeSheetHeights, settleRouteSheetSnap } from '../src/views/routeSheet';

test('route sheet keeps three ordered detents with a live map strip', () => {
  assert.deepEqual(ROUTE_SHEET_SNAPS, ['collapsed', 'half', 'expanded']);
  for (const viewport of [667, 844, 932]) {
    const heights = routeSheetHeights(viewport);
    assert.ok(heights.collapsed < heights.half);
    assert.ok(heights.half < heights.expanded);
    assert.ok(viewport - heights.expanded >= 172);
    assert.ok(heights.collapsed >= 200);
  }
  // The canonical detent is the approved composition: summary, ribbon and the
  // single primary action, exactly one screenful without inner scrolling.
  assert.equal(routeSheetHeights(844).half, 316.5);
  assert.equal(routeSheetHeights(844).expanded, 672);
  assert.ok(routeSheetHeights(844).expanded - routeSheetHeights(844).half >= 300);
});

test('slow release chooses the nearest snap and a quick swipe advances one snap', () => {
  const heights = routeSheetHeights(844);
  assert.equal(nearestRouteSheetSnap(heights.half - 40, heights), 'collapsed');
  assert.equal(nearestRouteSheetSnap(heights.half + 40, heights), 'half');
  assert.equal(nearestRouteSheetSnap(heights.expanded + 40, heights), 'expanded');
  assert.equal(settleRouteSheetSnap(heights.collapsed + 40, 0.8, heights, 0.45, heights.collapsed), 'half');
  assert.equal(settleRouteSheetSnap(heights.expanded - 40, -0.8, heights), 'half');
  assert.equal(settleRouteSheetSnap(heights.expanded - 10, 0.1, heights), 'expanded');
  assert.equal(settleRouteSheetSnap(heights.half + 4, 0.8, heights, 0.45, heights.collapsed), 'half');
  assert.equal(settleRouteSheetSnap(heights.half + 80, 0.8, heights, 0.45, heights.half), 'expanded');
  assert.equal(settleRouteSheetSnap(heights.expanded - 120, 0.8, heights, 0.45, heights.expanded), 'half');
  assert.equal(settleRouteSheetSnap(heights.half + 4, -0.8, heights, 0.45, heights.collapsed), 'half');
  assert.equal(settleRouteSheetSnap(heights.expanded - 140, 0.1, heights, 0.45, heights.expanded), 'half');
  assert.equal(settleRouteSheetSnap(heights.expanded - 30, 0.1, heights, 0.45, heights.expanded), 'expanded');
  assert.equal(settleRouteSheetSnap(heights.expanded + 40, 0.8, heights, 0.45, heights.expanded), 'expanded');
  assert.equal(settleRouteSheetSnap(heights.expanded - 40, -0.8, heights, 0.45, heights.expanded), 'half');
});

test('route alignment rotates north-south routes sideways and leaves east-west routes north-up', () => {
  assert.equal(routeBearingForHorizontalFit([[24, 49], [24, 50]]), -90);
  assert.ok(Math.abs(routeBearingForHorizontalFit([[24, 49], [25, 49]])) < 1);
  assert.equal(routeBearingForHorizontalFit([[24, 49]]), 0);
  assert.ok(routeBearingForHorizontalFit([[24.003, 49.8682], [24.0576, 49.7941]]) > 0);
});
