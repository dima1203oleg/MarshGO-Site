import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCollapsedRouteSheetHeight, fitExpandedRouteSheetHeight, fitMediumRouteSheetHeight, recoverRouteSheetDrag, routeSheetHeights, settleRouteSheetSnap } from '../src/views/routeSheet';

test('collapsed and medium detents fit their rendered content while preserving four ordered snaps', () => {
  const base = routeSheetHeights(932);
  const collapsed = fitCollapsedRouteSheetHeight(base, 200);
  const heights = { ...base, collapsed };
  const medium = fitMediumRouteSheetHeight(heights, 284);
  assert.equal(collapsed, 200);
  assert.equal(medium, 284);
  assert.ok(heights.peek < collapsed && collapsed < medium && medium < heights.expanded);
  assert.equal(fitCollapsedRouteSheetHeight(base, 900), base.collapsed, 'compact height never grows past its canonical cap');
  assert.equal(fitMediumRouteSheetHeight(heights, 900), base.half, 'medium height stays scrollable at its canonical cap for long routes');
});

test('expanded sheet fits short content and retains a distinct half detent', () => {
  const heights = routeSheetHeights(844);
  assert.equal(fitExpandedRouteSheetHeight(heights, 450), 450);
  assert.equal(fitExpandedRouteSheetHeight(heights, 20), heights.half + 24);
  const fitted = { ...heights, expanded: fitExpandedRouteSheetHeight(heights, 450) };
  assert.equal(settleRouteSheetSnap(449, 0, fitted, 0.45, 449), 'expanded');
});

test('long or unmeasurable content retains the viewport cap', () => {
  const heights = routeSheetHeights(844);
  for (const value of [null, NaN, Infinity, 0, -1, 10000]) {
    assert.equal(fitExpandedRouteSheetHeight(heights, value), heights.expanded);
  }
});

test('an interrupted drag recovers to the nearest real detent', () => {
  const heights = routeSheetHeights(779);
  assert.deepEqual(recoverRouteSheetDrag(168, heights), { snap: 'peek', height: heights.peek });
  assert.deepEqual(recoverRouteSheetDrag(heights.half + 1, heights), { snap: 'half', height: heights.half });
});
