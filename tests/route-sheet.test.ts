import assert from 'node:assert/strict';
import test from 'node:test';
import { routeBearingForHorizontalFit } from '../src/map/routeOrientation';
import {
  createFrameWriter,
  nearestRouteSheetSnap,
  ROUTE_SHEET_LOGICAL_LABELS,
  ROUTE_SHEET_SNAPS,
  routeSheetHeights,
  routeSheetTransition,
  settleRouteSheetSnap,
} from '../src/views/routeSheet';

test('route sheet keeps four ordered detents (PEEK -> COMPACT -> MEDIUM -> FULL) with a live map strip', () => {
  assert.deepEqual(ROUTE_SHEET_SNAPS, ['peek', 'collapsed', 'half', 'expanded']);
  assert.deepEqual(ROUTE_SHEET_LOGICAL_LABELS, {
    peek: 'PEEK',
    collapsed: 'COMPACT',
    half: 'MEDIUM',
    expanded: 'FULL',
  });
  for (const viewport of [568, 667, 844, 932]) {
    const heights = routeSheetHeights(viewport);
    assert.ok(heights.peek >= 160 && heights.peek <= 220, `peek height ${heights.peek} on ${viewport}px must remain compact without clipping controls`);
    assert.ok(heights.peek < heights.collapsed);
    assert.ok(heights.collapsed < heights.half);
    assert.ok(heights.half < heights.expanded);
    assert.ok(viewport - heights.expanded >= 172);
    assert.ok(heights.collapsed >= 200);
  }
  assert.equal(routeSheetHeights(844).peek, 168);
  assert.equal(routeSheetHeights(844).half, 316.5);
  assert.equal(routeSheetHeights(844).expanded, 672);
  assert.ok(routeSheetHeights(844).expanded - routeSheetHeights(844).half >= 300);
});

test('slow release chooses the nearest snap and a quick swipe advances one snap across 4 detents', () => {
  const heights = routeSheetHeights(844);
  assert.equal(nearestRouteSheetSnap(heights.peek + 10, heights), 'peek');
  assert.equal(nearestRouteSheetSnap(heights.collapsed + 10, heights), 'collapsed');
  assert.equal(nearestRouteSheetSnap(heights.half + 40, heights), 'half');
  assert.equal(nearestRouteSheetSnap(heights.expanded + 40, heights), 'expanded');
  assert.equal(settleRouteSheetSnap(heights.peek + 25, 0.8, heights, 0.45, heights.peek), 'collapsed');
  assert.equal(settleRouteSheetSnap(heights.collapsed - 25, -0.8, heights, 0.45, heights.collapsed), 'peek');
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

test('createFrameWriter coalesces multiple updates into one RAF paint and routeSheetTransition honours reducedMotion', () => {
  const written: number[] = [];
  let scheduled: (() => void) | null = null;
  const writer = createFrameWriter(
    (v) => written.push(v),
    (cb) => { scheduled = cb; return 1; },
    () => { scheduled = null; },
  );
  writer.schedule(210);
  writer.schedule(235);
  writer.schedule(260);
  assert.deepEqual(written, []);
  scheduled?.();
  assert.deepEqual(written, [260]);
  assert.equal(routeSheetTransition(true, false), 'none');
  assert.equal(routeSheetTransition(false, true), 'none');
  assert.equal(routeSheetTransition(false, false), 'height var(--mg-dur-base) var(--mg-ease-entrance)');
});

test('route alignment rotates north-south routes sideways and leaves east-west routes north-up', () => {
  assert.equal(routeBearingForHorizontalFit([[24, 49], [24, 50]]), -90);
  assert.ok(Math.abs(routeBearingForHorizontalFit([[24, 49], [25, 49]])) < 1);
  assert.equal(routeBearingForHorizontalFit([[24, 49]]), 0);
  assert.ok(routeBearingForHorizontalFit([[24.003, 49.8682], [24.0576, 49.7941]]) > 0);
});
