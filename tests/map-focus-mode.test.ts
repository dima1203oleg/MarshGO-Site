import assert from 'node:assert/strict';
import test from 'node:test';
import { journeySegmentsForFocus, visibleJourneyWaypoints, visibleTransportLayers } from '../src/map/focusMode';

test('focus mode hides secondary map layers without mutating saved selections', () => {
  const saved = new Set(['BUS', 'BIKE', 'SCOOTER'] as const);
  assert.deepEqual(visibleTransportLayers(saved, true), new Set());
  assert.deepEqual(saved, new Set(['BUS', 'BIKE', 'SCOOTER']));
});

test('normal navigation renders exactly the selected map layers', () => {
  const saved = new Set(['BUS', 'STOPS'] as const);
  assert.deepEqual(visibleTransportLayers(saved, false), saved);
});

test('segment focus leaves only the selected leg on the map base layer', () => {
  const itinerary = [
    { id: 'walk', coordinates: [[24, 49], [24.01, 49.01]] as [number, number][], modeColor: '#91A6BB' },
    { id: 'minibus', coordinates: [[24.01, 49.01], [24.2, 49.2]] as [number, number][], modeColor: '#F43F7B' },
    { id: 'carpool', coordinates: [[24.2, 49.2], [24.3, 49.3]] as [number, number][], modeColor: '#A855F7' },
  ];

  assert.deepEqual(journeySegmentsForFocus(itinerary, 'minibus').map(({ id, selected, dimmed }) => ({ id, selected, dimmed })), [
    { id: 'minibus', selected: true, dimmed: false },
  ]);
  assert.deepEqual(journeySegmentsForFocus(itinerary, null).map(({ id, selected, dimmed }) => ({ id, selected, dimmed })), [
    { id: 'walk', selected: true, dimmed: false },
    { id: 'minibus', selected: true, dimmed: false },
    { id: 'carpool', selected: true, dimmed: false },
  ]);
  assert.deepEqual(journeySegmentsForFocus(itinerary, 'unknown'), []);
  assert.deepEqual(itinerary.map(segment => segment.id), ['walk', 'minibus', 'carpool']);
});

test('segment focus hides waypoints for other legs and keeps shared transfer points', () => {
  const points = [
    { coordinate: [24, 49] as [number, number], kind: 'PICKUP', segmentIds: ['walk'] },
    { coordinate: [24.1, 49.1] as [number, number], kind: 'TRANSFER', segmentIds: ['walk', 'metro'] },
    { coordinate: [24.2, 49.2] as [number, number], kind: 'STOP', segmentIds: ['metro'] },
    { coordinate: [24.3, 49.3] as [number, number], kind: 'DROPOFF' },
  ];

  assert.deepEqual(visibleJourneyWaypoints(points, 'metro').map(point => point.kind), ['TRANSFER', 'STOP']);
  assert.deepEqual(visibleJourneyWaypoints(points, null), points);
});
