import assert from 'node:assert/strict';
import test from 'node:test';
import { routeBearingForHorizontalFit } from '../src/map/routeOrientation';
import {
  createFrameWriter,
  nearestRouteSheetSnap,
  ROUTE_SHEET_LOGICAL_LABELS,
  ROUTE_SHEET_SNAPS,
  routeSheetExpandedFitHeight,
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
  for (const viewport of [568, 667, 844, 932, 1200]) {
    const heights = routeSheetHeights(viewport, viewport < 1024 ? 34 : 0);
    assert.ok(heights.peek >= 160 && heights.peek <= 220, `peek height ${heights.peek} on ${viewport}px must remain compact without clipping controls`);
    assert.ok(heights.peek < heights.collapsed);
    assert.ok(heights.collapsed < heights.half);
    assert.ok(heights.half < heights.expanded);
    assert.ok(viewport - heights.expanded >= 172);
    assert.ok(heights.collapsed >= 200);
  }
  const compactLandscape = routeSheetHeights(320, 34);
  assert.ok(compactLandscape.peek < compactLandscape.collapsed);
  assert.ok(compactLandscape.collapsed < compactLandscape.half);
  assert.ok(compactLandscape.half < compactLandscape.expanded);
  assert.equal(routeSheetHeights(844, 34).peek, 186);
  assert.equal(routeSheetHeights(844, 34).collapsed, 212);
  assert.equal(routeSheetHeights(844, 34).half, 414);
  assert.equal(routeSheetHeights(844, 34).expanded, 672);
  assert.equal(routeSheetHeights(568, 34).peek, 180);
  assert.equal(routeSheetHeights(568, 34).collapsed, 212);
  assert.equal(routeSheetHeights(844, 34).collapsed - routeSheetHeights(844, 0).collapsed, 34);
  assert.equal(routeSheetHeights(844, 34).expanded, routeSheetHeights(844, 0).expanded);
  assert.equal(routeSheetHeights(568, 34).half, 318);
  assert.ok(routeSheetHeights(844, 34).expanded - routeSheetHeights(844, 34).half >= 220);
});

test('compact route sheet meets the measured 25–35% height reduction target on common phone viewports', () => {
  const baselineHeights: Record<number, number> = { 568: 240, 812: 240, 844: 245, 932: 270 };
  for (const [viewportValue, baseline] of Object.entries(baselineHeights)) {
    const viewport = Number(viewportValue);
    const candidate = routeSheetHeights(viewport, 0).collapsed;
    const reduction = (baseline - candidate) / baseline;
    assert.ok(reduction >= 0.25 && reduction <= 0.35, `${viewport}px compact sheet reduction ${Math.round(reduction * 1000) / 10}% must be 25–35%`);
  }
});

test('expanded route sheet fits measured details while keeping a usable map strip and scroll cap', () => {
  assert.equal(routeSheetExpandedFitHeight(844, 0, 565), 565);
  assert.equal(routeSheetExpandedFitHeight(844, 0, 200), routeSheetHeights(844).half + 24);
  assert.equal(routeSheetExpandedFitHeight(568, 0, 565), routeSheetHeights(568).expanded);
  assert.equal(routeSheetExpandedFitHeight(932, 34, 900), routeSheetHeights(932, 34).expanded);
});

test('slow release chooses the nearest snap and a quick swipe advances one snap across 4 detents', () => {
  const heights = routeSheetHeights(844, 34);
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
