import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiNavigationSession } from '../src/services/productionApi';
import { canonicalRoute } from '../src/navigation/canonicalRoute';

test('normalizes a navigation session without dropping its server maneuvers', () => {
  const session: ApiNavigationSession = {
    id: 'navigation-1',
    state: 'active',
    destination_name: 'вул. Хрещатик',
    route_distance_m: 1200,
    route_duration_s: 240,
    route_version: 2,
    opt_in: false,
    matching_vehicle_available: false,
    vehicle_seat_count: null,
    started_at: '2026-10-14T09:00:00.000Z',
    route: [[30.5234, 50.4501], [30.524, 50.451]],
    maneuvers: [{
      id: 'turn-1',
      type: 'TURN',
      modifier: 'RIGHT',
      location: [30.524, 50.451],
      distanceMeters: 1200,
      durationSeconds: 240,
      streetName: 'Хрещатик',
    }],
    current_location: null,
    current_location_accuracy_m: null,
    current_location_at: null,
  };

  const route = canonicalRoute(session);
  assert.equal(route.routeVersion, 2);
  assert.deepEqual(route.maneuvers, session.maneuvers);
  assert.equal(route.trafficAware, false);
});
