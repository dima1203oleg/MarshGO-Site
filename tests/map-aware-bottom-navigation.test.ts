import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isBottomNavigationRevealEdge,
  isMapToolbarContext,
  MAP_NAVIGATION_AUTO_HIDE_MS,
  MAP_NAVIGATION_EDGE_PX,
  MAP_NAVIGATION_REVEAL_MS,
  shouldRemeasureAfterNavigationTransition,
} from '../src/views/mapAwareBottomNavigation';

test('map contexts tuck away the shared bottom navigation', () => {
  assert.equal(isMapToolbarContext({ tab: 'map', activeJourneyNavigation: false, selectedRouteMap: false, selectedJourney: false }), true);
  assert.equal(isMapToolbarContext({ tab: 'navigation', activeJourneyNavigation: false, selectedRouteMap: false, selectedJourney: false }), true);
  assert.equal(isMapToolbarContext({ tab: 'trips', activeJourneyNavigation: true, selectedRouteMap: false, selectedJourney: false }), true);
  assert.equal(isMapToolbarContext({ tab: 'trips', activeJourneyNavigation: false, selectedRouteMap: true, selectedJourney: false }), true);
  assert.equal(isMapToolbarContext({ tab: 'trips', activeJourneyNavigation: false, selectedRouteMap: false, selectedJourney: true }), true);
  assert.equal(isMapToolbarContext({ tab: 'home', activeJourneyNavigation: false, selectedRouteMap: false, selectedJourney: false }), false);
});

test('the bottom-edge reveal target stays inside the 64px touch strip', () => {
  const height = 932;
  assert.equal(isBottomNavigationRevealEdge(height - MAP_NAVIGATION_EDGE_PX, height), true);
  assert.equal(isBottomNavigationRevealEdge(height - MAP_NAVIGATION_EDGE_PX - 1, height), false);
  assert.equal(isBottomNavigationRevealEdge(height + 1, height), false);
  assert.equal(isBottomNavigationRevealEdge(Number.NaN, height), false);
});

test('map dock timing remains brief and predictable', () => {
  assert.equal(MAP_NAVIGATION_AUTO_HIDE_MS, 1650);
  assert.equal(MAP_NAVIGATION_REVEAL_MS, 2800);
});

test('map and sheet remeasure only after the dock transform finishes', () => {
  const navigation = {};
  assert.equal(shouldRemeasureAfterNavigationTransition(navigation, navigation, 'transform'), true);
  assert.equal(shouldRemeasureAfterNavigationTransition(navigation, navigation, 'opacity'), false);
  assert.equal(shouldRemeasureAfterNavigationTransition({}, navigation, 'transform'), false);
});
