import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiJourney } from '../src/services/productionApi';
import * as routeModel from '../src/map/journeyRouteModel';

// Access through the namespace at call time: esbuild elides the named function
// import in this file, and a top-level destructure captures it before the module
// graph finishes initializing. Member access inside the tests avoids both.
function legs(value: unknown): ApiJourney['legs'] {
  return value as ApiJourney['legs'];
}

test('the join tolerance is a bounded sub-metre value, not a road-building distance', () => {
  assert.equal(routeModel.ROUTE_JOIN_SNAP_TOLERANCE_M, 1.5);
  assert.ok(routeModel.ROUTE_JOIN_SNAP_TOLERANCE_M > 0 && routeModel.ROUTE_JOIN_SNAP_TOLERANCE_M <= 2);
});

test('sub-metre rounding at a shared stop snaps to one vertex so round caps meet without a notch', () => {
  const model = routeModel.buildJourneyRouteMapModel(legs([
    { id: 'bus', mode: 'BUS', transportType: 'bus', routeGeometry: [[24, 49.8], [24.01, 49.81], [24.02, 49.82]] },
    { id: 'tram', mode: 'TRAM', transportType: 'tram', routeGeometry: [[24.020005, 49.820002], [24.03, 49.83]] },
  ]));
  const bus = model.routeSegments.find(segment => segment.id === 'bus')!;
  const tram = model.routeSegments.find(segment => segment.id === 'tram')!;
  assert.deepEqual(bus.coordinates.at(-1), tram.coordinates[0], 'the two legs must share an exact join vertex');
  assert.deepEqual(bus.coordinates.at(-1), [24.020005, 49.820002]);
});

test('a real gap between modes is preserved - no fabricated connector road', () => {
  const model = routeModel.buildJourneyRouteMapModel(legs([
    { id: 'bus', mode: 'BUS', transportType: 'bus', routeGeometry: [[24, 49.8], [24.02, 49.82]] },
    { id: 'tram', mode: 'TRAM', transportType: 'tram', routeGeometry: [[24.021, 49.8205], [24.03, 49.83]] },
  ]));
  const bus = model.routeSegments.find(segment => segment.id === 'bus')!;
  assert.deepEqual(bus.coordinates.at(-1), [24.02, 49.82], 'a ~90 m gap must stay open, not be snapped shut');
});

test('does not snap two shapes across an intervening leg whose geometry is missing', () => {
  const model = routeModel.buildJourneyRouteMapModel(legs([
    { id: 'bus', mode: 'BUS', transportType: 'bus', routeGeometry: [[24, 49.8], [24.02, 49.82]] },
    { id: 'unknown-shape', mode: 'TRAM', transportType: 'tram', routeGeometry: null },
    { id: 'train', mode: 'RAIL', transportType: 'train', routeGeometry: [[24.020005, 49.820002], [24.03, 49.83]] },
  ]));
  const bus = model.routeSegments.find(segment => segment.id === 'bus')!;
  const train = model.routeSegments.find(segment => segment.id === 'train')!;
  assert.notDeepEqual(bus.coordinates.at(-1), train.coordinates[0]);
  assert.deepEqual(bus.coordinates.at(-1), [24.02, 49.82]);
  assert.equal(model.missingShapeCount, 1);
});

test('a dashed walking estimate is never bridged to the transit line', () => {
  const model = routeModel.buildJourneyRouteMapModel(legs([
    { id: 'walk', mode: 'WALK', source: 'walking-estimate', routeGeometry: [[24.01, 49.81], [24.02, 49.82]] },
    { id: 'tram', mode: 'TRAM', transportType: 'tram', routeGeometry: [[24.020005, 49.820002], [24.03, 49.83]] },
  ]));
  const walk = model.routeSegments.find(segment => segment.id === 'walk')!;
  assert.equal(walk.approximate, true);
  assert.deepEqual(walk.coordinates.at(-1), [24.02, 49.82], 'an estimate chord keeps its own endpoint');
});

test('only the trailing vertex moves; interior geometry and the API input are untouched', () => {
  const inputGeometry: [number, number][] = [[24, 49.8], [24.01, 49.81], [24.02, 49.82]];
  const snapshot = structuredClone(inputGeometry);
  const model = routeModel.buildJourneyRouteMapModel(legs([
    { id: 'bus', mode: 'BUS', transportType: 'bus', routeGeometry: inputGeometry },
    { id: 'tram', mode: 'TRAM', transportType: 'tram', routeGeometry: [[24.020005, 49.820002], [24.03, 49.83]] },
  ]));
  const bus = model.routeSegments.find(segment => segment.id === 'bus')!;
  assert.deepEqual(inputGeometry, snapshot, 'the caller routeGeometry array must not be mutated');
  assert.deepEqual(bus.coordinates.slice(0, -1), [[24, 49.8], [24.01, 49.81]], 'interior vertices stay exact');
  assert.equal(bus.coordinates.length, 3);
});

test('an already-exact join is left unchanged', () => {
  const model = routeModel.buildJourneyRouteMapModel(legs([
    { id: 'bus', mode: 'BUS', transportType: 'bus', routeGeometry: [[24, 49.8], [24.02, 49.82]] },
    { id: 'tram', mode: 'TRAM', transportType: 'tram', routeGeometry: [[24.02, 49.82], [24.03, 49.83]] },
  ]));
  const bus = model.routeSegments.find(segment => segment.id === 'bus')!;
  const tram = model.routeSegments.find(segment => segment.id === 'tram')!;
  assert.deepEqual(bus.coordinates.at(-1), [24.02, 49.82]);
  assert.deepEqual(bus.coordinates.at(-1), tram.coordinates[0]);
});

test('an invalid transit vertex hides that shape rather than connecting around the bad point', () => {
  const model = routeModel.buildJourneyRouteMapModel(legs([
    { id: 'bus', mode: 'BUS', transportType: 'bus', routeGeometry: [[24, 49.8], [200, 49.81], [24.02, 49.82]] },
  ]));
  assert.deepEqual(model.routeSegments, []);
  assert.equal(model.missingShapeCount, 1);
});
