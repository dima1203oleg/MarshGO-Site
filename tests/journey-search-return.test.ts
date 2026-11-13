import assert from 'node:assert/strict';
import test from 'node:test';
import { captureJourneySearchReturnPath, resolveJourneyRouteBackTarget } from '../src/routing/journeySearchReturn';

test('captures the planner URL and filters when a journey starts', () => {
  const query = '?mode=planner&origin=Сихів&destination=Центр&strategy=BALANCED';
  assert.equal(captureJourneySearchReturnPath('/journeys/search', query), `/journeys/search${query}`);
  assert.equal(captureJourneySearchReturnPath('/journeys/search/', query), `/journeys/search/${query}`);
});

test('does not invent a search destination when navigation starts from a deep link', () => {
  assert.equal(captureJourneySearchReturnPath('/journeys/abc', ''), null);
  assert.equal(captureJourneySearchReturnPath('/trips', ''), null);
});

test('returns a direct saved journey to Trips instead of reopening its detail overlay', () => {
  assert.deepEqual(resolveJourneyRouteBackTarget(null, true), { kind: 'trips' });
});

test('restores the planner when one was captured before navigation', () => {
  assert.deepEqual(resolveJourneyRouteBackTarget('/journeys/search?mode=planner', true), {
    kind: 'planner',
    path: '/journeys/search?mode=planner',
  });
});

test('dismisses a route opened from results without changing the current tab', () => {
  assert.deepEqual(resolveJourneyRouteBackTarget(null, false), { kind: 'dismiss' });
});
