import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiJourney } from '../src/services/productionApi';
import { buildJourneyRouteMapModel, journeyModeColor } from '../src/map/journeyRouteModel';

type ModeCase = {
  id: string;
  mode: string;
  transportType: string;
  label: string;
};

const canonicalModes: ModeCase[] = [
  { id: 'carpool', mode: 'COMMUNITY', transportType: 'carpool', label: 'Попутка' },
  { id: 'minibus', mode: 'MINIBUS', transportType: 'marshrutka', label: 'Маршрутка' },
  { id: 'bus', mode: 'BUS', transportType: 'bus', label: 'Автобус' },
  { id: 'taxi', mode: 'TAXI', transportType: 'taxi', label: 'Таксі' },
  { id: 'tram', mode: 'TRAM', transportType: 'tram', label: 'Трамвай' },
  { id: 'trolleybus', mode: 'TROLLEYBUS', transportType: 'trolleybus', label: 'Тролейбус' },
  { id: 'metro', mode: 'METRO', transportType: 'metro', label: 'Метро' },
  { id: 'train', mode: 'RAIL', transportType: 'train', label: 'Поїзд' },
  { id: 'bike', mode: 'BICYCLE', transportType: 'bike', label: 'Велосипед' },
  { id: 'scooter', mode: 'SCOOTER', transportType: 'scooter', label: 'Самокат' },
  { id: 'carsharing', mode: 'CARSHARING', transportType: 'carsharing', label: 'Каршеринг' },
  { id: 'transfer', mode: 'TRANSFER', transportType: 'transfer', label: 'Трансфер' },
];

function asJourneyLegs(value: unknown): ApiJourney['legs'] {
  return value as ApiJourney['legs'];
}

test('maps all twelve canonical transport segments in order with their own labels and colors', () => {
  const legs = canonicalModes.map((item, index) => {
    const origin: [number, number] = [24 + index * 0.01, 49.8];
    const midpoint: [number, number] = [origin[0] + 0.005, 49.805];
    const destination: [number, number] = [origin[0] + 0.01, 49.81];
    return {
      id: item.id,
      mode: item.mode,
      transportType: item.transportType,
      source: 'deterministic-test-fixture',
      origin: { name: `${item.id} start`, coordinates: origin },
      destination: { name: `${item.id} end`, coordinates: destination },
      routeGeometry: [origin, midpoint, destination],
    };
  });

  const model = buildJourneyRouteMapModel(asJourneyLegs(legs));

  assert.equal(model.routeSegments.length, canonicalModes.length);
  assert.deepEqual(model.routeSegments.map(segment => segment.id), canonicalModes.map(item => item.id));
  assert.deepEqual(model.legs.map(leg => leg.label), canonicalModes.map(item => item.label));
  assert.deepEqual(
    model.routeSegments.map(segment => segment.modeColor),
    canonicalModes.map(item => journeyModeColor(item.mode, item.transportType)),
  );
  assert.equal(model.routeWaypoints.length, canonicalModes.length + 1);
  assert.ok(model.routeWaypoints.slice(1, -1).every(point => point.kind === 'TRANSFER'));
});
