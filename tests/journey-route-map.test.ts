import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApiJourney } from '../src/services/productionApi';
import { buildJourneyRouteMapModel, formatTransferCount, journeyModeColor } from '../src/map/journeyRouteModel';

function legs(value: unknown): ApiJourney['legs'] {
  return value as ApiJourney['legs'];
}

test('keeps real route shapes separate and uses each transport mode color', () => {
  const model = buildJourneyRouteMapModel(legs([
    { id: 'bus', mode: 'BUS', transportType: 'bus', routeName: '21', origin: { name: 'Start', coordinates: [24, 49.8] }, destination: { name: 'Bus end', coordinates: [24.02, 49.82] }, stops: [
      { id: 'b1', name: 'Start', coordinates: [24, 49.8], arrivalAt: '2026-10-12T05:00:00Z', departureAt: '2026-10-12T05:00:00Z' },
      { id: 'b2', name: 'Middle', coordinates: [24.01, 49.81], arrivalAt: '2026-10-12T05:10:00Z', departureAt: '2026-10-12T05:10:00Z' },
      { id: 'b3', name: 'Bus end', coordinates: [24.02, 49.82], arrivalAt: '2026-10-12T05:20:00Z', departureAt: '2026-10-12T05:20:00Z' },
    ], routeGeometry: [[24.0, 49.8], [24.01, 49.81], [24.02, 49.82]] },
    { id: 'minibus', mode: 'MINIBUS', transportType: 'marshrutka', origin: { name: 'Transfer', coordinates: [24.03, 49.83] } },
    { id: 'walk', mode: 'WALK', routeGeometry: undefined },
    { id: 'tram', mode: 'TRAM', transportType: 'tram', routeName: '2', destination: { name: 'End', coordinates: [24.05, 49.85] }, routeGeometry: [[24.04, 49.84], [24.05, 49.85]] },
  ]));

  assert.equal(model.routeSegments.length, 2);
  assert.deepEqual(model.routeSegments.map(segment => segment.modeColor), ['#1687FF', '#F43F7B']);
  assert.deepEqual(model.routeSegments.map(segment => segment.coordinates.length), [3, 2]);
  assert.deepEqual(model.routeWaypoints, [
    { coordinate: [24, 49.8], kind: 'PICKUP' },
    { coordinate: [24.01, 49.81], kind: 'STOP' },
    { coordinate: [24.02, 49.82], kind: 'STOP' },
    { coordinate: [24.03, 49.83], kind: 'TRANSFER' },
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
  assert.deepEqual(model.routeWaypoints, [
    { coordinate: [24, 49.8], kind: 'PICKUP' },
    { coordinate: [25, 50], kind: 'TRANSFER' },
    { coordinate: [25.1, 50.1], kind: 'DROPOFF' },
  ]);
  assert.equal(model.missingShapeCount, 1);
});

test('drops malformed coordinates before passing route geometry to the map', () => {
  const model = buildJourneyRouteMapModel(legs([
    { id: 'bad-shape', mode: 'RAIL', routeGeometry: [[24, 49], [181, 91], [25, 50]] },
  ]));

  assert.deepEqual(model.routeSegments, []);
  assert.equal(model.missingShapeCount, 1);
});

test('formats transfer counts with Ukrainian plural forms', () => {
  assert.equal(formatTransferCount(0), '0 пересадок');
  assert.equal(formatTransferCount(1), '1 пересадка');
  assert.equal(formatTransferCount(3), '3 пересадки');
  assert.equal(formatTransferCount(5), '5 пересадок');
  assert.equal(formatTransferCount(21), '21 пересадка');
});

test('uses one stable canonical color for each supported transport category', () => {
  const cases: Array<[string, string | undefined, string]> = [
    ['BUS', 'bus', '#1687FF'], ['MINIBUS', 'marshrutka', '#FF9A32'],
    ['TROLLEYBUS', 'trolleybus', '#00C2A0'], ['TRAM', 'tram', '#F43F7B'],
    ['METRO', 'metro', '#5B5DF2'], ['COMMUNITY', 'carpool', '#A855F7'],
    ['TAXI', 'taxi', '#FFB020'], ['RAIL', 'train', '#5B5DF2'],
    ['BIKE', 'bike', '#20B86A'], ['SCOOTER', 'scooter', '#00C59A'],
    ['CARSHARING', 'carsharing', '#8CBF26'], ['TRANSFER', 'transfer', '#52B8FF'],
    ['WALK', 'walk', '#91A6BB'],
  ];

  for (const [mode, type, expected] of cases) {
    assert.equal(journeyModeColor(mode, type), expected, `${mode}/${type} color`);
  }
});
