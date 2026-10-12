import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApiJourney } from '../src/services/productionApi';
import { buildJourneyRouteMapModel } from '../src/map/journeyRouteModel';

function legs(value: unknown): ApiJourney['legs'] {
  return value as ApiJourney['legs'];
}

test('keeps real route shapes separate and uses each transport mode color', () => {
  const model = buildJourneyRouteMapModel(legs([
    { id: 'bus', mode: 'BUS', transportType: 'bus', routeName: '21', routeGeometry: [[24.0, 49.8], [24.01, 49.81], [24.02, 49.82]] },
    { id: 'minibus', mode: 'MINIBUS', transportType: 'marshrutka' },
    { id: 'walk', mode: 'WALK', routeGeometry: undefined },
    { id: 'tram', mode: 'TRAM', transportType: 'tram', routeName: '2', routeGeometry: [[24.04, 49.84], [24.05, 49.85]] },
  ]));

  assert.equal(model.routeSegments.length, 2);
  assert.deepEqual(model.routeSegments.map(segment => segment.modeColor), ['#1687FF', '#EF4444']);
  assert.deepEqual(model.routeSegments.map(segment => segment.coordinates.length), [3, 2]);
  assert.deepEqual(model.routeWaypoints, [
    { coordinate: [24, 49.8], kind: 'PICKUP' },
    { coordinate: [24.05, 49.85], kind: 'DROPOFF' },
  ]);
  assert.equal(model.missingShapeCount, 1);
});

test('does not manufacture straight lines for legs without source geometry', () => {
  const model = buildJourneyRouteMapModel(legs([
    { id: 'bus', mode: 'BUS', origin: { coordinates: [24, 49.8] }, destination: { coordinates: [25, 50] } },
    { id: 'walk', mode: 'WALK', origin: { coordinates: [25, 50] }, destination: { coordinates: [25.1, 50.1] } },
  ]));

  assert.deepEqual(model.routeSegments, []);
  assert.deepEqual(model.routeWaypoints, []);
  assert.equal(model.missingShapeCount, 1);
});

test('drops malformed coordinates before passing route geometry to the map', () => {
  const model = buildJourneyRouteMapModel(legs([
    { id: 'bad-shape', mode: 'RAIL', routeGeometry: [[24, 49], [181, 91], [25, 50]] },
  ]));

  assert.deepEqual(model.routeSegments, []);
  assert.equal(model.missingShapeCount, 1);
});
