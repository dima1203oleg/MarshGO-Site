import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isMapToolbarContext,
  shouldShowGlobalBottomNavigation,
  shouldRemeasureAfterNavigationTransition,
} from '../src/views/mapAwareBottomNavigation';

test('standalone map and navigation screens tuck away the global dock', () => {
  assert.equal(isMapToolbarContext({ tab: 'map', activeJourneyNavigation: false, journeyStartPending: false, selectedRouteMap: false, selectedJourney: false }), true);
  assert.equal(isMapToolbarContext({ tab: 'navigation', activeJourneyNavigation: false, journeyStartPending: false, selectedRouteMap: false, selectedJourney: false }), true);
  for (const tab of ['home', 'search', 'trips', 'map', 'navigation']) {
    assert.equal(isMapToolbarContext({ tab, activeJourneyNavigation: true, journeyStartPending: false, selectedRouteMap: false, selectedJourney: false }), true);
  }
  assert.equal(isMapToolbarContext({ tab: 'home', activeJourneyNavigation: false, journeyStartPending: false, selectedRouteMap: false, selectedJourney: false }), false);
});

test('route details retain the dock while start-pending and active navigation tuck it away', () => {
  for (const context of [
    { tab: 'trips', activeJourneyNavigation: false, journeyStartPending: false, selectedRouteMap: true, selectedJourney: false },
    { tab: 'trips', activeJourneyNavigation: false, journeyStartPending: false, selectedRouteMap: false, selectedJourney: true },
  ]) {
    assert.equal(isMapToolbarContext(context), false);
    assert.equal(shouldShowGlobalBottomNavigation(isMapToolbarContext(context)), true);
  }
  assert.equal(isMapToolbarContext({ tab: 'trips', activeJourneyNavigation: true, journeyStartPending: false, selectedRouteMap: false, selectedJourney: false }), true);
  assert.equal(isMapToolbarContext({ tab: 'trips', activeJourneyNavigation: false, journeyStartPending: false, selectedRouteMap: true, selectedJourney: false }), false);
  const startPending = isMapToolbarContext({ tab: 'trips', activeJourneyNavigation: false, journeyStartPending: true, selectedRouteMap: true, selectedJourney: false });
  assert.equal(startPending, true);
  assert.equal(shouldShowGlobalBottomNavigation(startPending), false);
  assert.equal(shouldShowGlobalBottomNavigation(true), false);
  assert.equal(shouldShowGlobalBottomNavigation(false), true);
});

test('map and sheet remeasure only after the dock transform finishes', () => {
  const navigation = {};
  assert.equal(shouldRemeasureAfterNavigationTransition(navigation, navigation, 'transform'), true);
  assert.equal(shouldRemeasureAfterNavigationTransition(navigation, navigation, 'opacity'), false);
  assert.equal(shouldRemeasureAfterNavigationTransition({}, navigation, 'transform'), false);
});
