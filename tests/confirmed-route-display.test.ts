import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedJourneySegments } from '../src/map/journeyRouteModel';
import type { ColoredRouteSegment } from '../src/map/MapAdapter';

test('only confirmed segments reach the route map; estimates remain unmodified in the source', () => {
  const confirmed: ColoredRouteSegment = { id: 'walk', coordinates: [[24, 49], [24.01, 49]], modeColor: '#123456', isWalk: true };
  const estimated: ColoredRouteSegment = { id: 'unknown', coordinates: [[24.01, 49], [24.02, 49]], modeColor: '#123456', isWalk: true, approximate: true };
  const input = [confirmed, estimated];
  assert.deepEqual(confirmedJourneySegments(input), [confirmed]);
  assert.deepEqual(input, [confirmed, estimated]);
});
