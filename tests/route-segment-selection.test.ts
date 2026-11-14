import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { routeMapTapAction } from '../src/map/routeSegmentSelection';

const routeScreen = readFileSync(new URL('../views/JourneyRouteMapScreen.tsx', import.meta.url), 'utf8');

test('tapping the active route segment on the map keeps its focus', () => {
  assert.equal(routeMapTapAction('walk-1', 'walk-1'), 'focus');
});

test('tapping another route segment selects that segment', () => {
  assert.equal(routeMapTapAction('walk-1', 'tram-1'), 'select');
});

test('tapping a route segment from overview selects it', () => {
  assert.equal(routeMapTapAction(null, 'walk-1'), 'select');
});

test('map hit and ambiguous-hit selection use the refocus handler', () => {
  assert.match(routeScreen, /onRouteSegmentSelect=\{focusSegmentFromMap\}/);
  assert.match(routeScreen, /validIds\[0\]\) focusSegmentFromMap\(validIds\[0\]\)/);
});
