import test from 'node:test';
import assert from 'node:assert/strict';
import { initialNavigationState, transition } from '../src/navigation/NavigationCore';

const request = { origin: [24, 50] as [number, number], destination: [25, 51] as [number, number], profile: { mode: 'CAR' as const }, requestId: 'test-1' };
const route = { id: 'route-1', provider: 'osrm', geometry: { encoding: 'polyline6' as const, value: '??_ibE_ibE' }, bounds: [[24,50],[25,51]] as [[number,number],[number,number]], distanceMeters: 1000, durationSeconds: 100, durationWithoutTrafficSeconds: 100, trafficAware: false, legs: [{ distanceMeters: 1000, durationSeconds: 100 }], maneuvers: [], confidence: 'BASELINE' as const, calculatedAt: '2026-09-30T12:00:00Z', routeVersion: 1 };
test('navigation transition requests routing without performing effects', () => {
  const result = transition(initialNavigationState(), { type: 'NAVIGATION_START_REQUESTED', request });
  assert.equal(result.state.lifecycle, 'PLANNING');
  assert.deepEqual(result.effects, [{ type: 'REQUEST_ROUTE', request }]);
});
test('offline preserves a usable route and restore reconciles lifecycle', () => {
  const planning = transition(initialNavigationState(), { type: 'NAVIGATION_START_REQUESTED', request }).state;
  const active = transition(planning, { type: 'ROUTE_RECEIVED', route }).state;
  const offline = transition(active, { type: 'CONNECTIVITY_LOST' });
  assert.equal(offline.state.lifecycle, 'OFFLINE');
  assert.equal(offline.state.route?.id, route.id);
  assert.deepEqual(offline.effects, [{ type: 'PERSIST_OFFLINE_STATE' }]);
  assert.equal(transition(offline.state, { type: 'CONNECTIVITY_RESTORED' }).state.lifecycle, 'ACTIVE');
});
test('authoritative session snapshots hydrate the core and keep raw fixes out of rendered position', () => {
  const active = transition(initialNavigationState(), { type: 'NAVIGATION_SESSION_RECONCILED', sessionId: 'session-1', route, paused: false }).state;
  const rawFix = { longitude: 24.2, latitude: 50.2, accuracyMeters: 5, capturedAtClient: '2026-09-30T12:00:00Z', source: 'gps' as const };
  const gps = transition(active, { type: 'GPS_FIX_RECEIVED', fix: rawFix }).state;
  assert.equal(gps.sessionId, 'session-1');
  assert.equal(gps.routeVersion, route.routeVersion);
  assert.equal(gps.currentLocation, null);
  const matched = { ...rawFix, confidence: 0.9, distanceFromRouteMeters: 4, distanceAlongRouteMeters: 120, matchingProvider: 'route-projection-v1' };
  const progressed = transition(gps, { type: 'LOCATION_MATCHED', location: matched }).state;
  assert.equal(progressed.currentLocation?.matchingProvider, 'route-projection-v1');
  assert.equal(progressed.remainingDistanceMeters, 880);
  assert.equal(progressed.remainingDurationSeconds, 88);
  assert.equal(progressed.eta?.source, 'LIVE_PROGRESS');
});
test('arrival requires a confident matched fix at the routed destination', () => {
  const active = transition(initialNavigationState(), { type: 'NAVIGATION_SESSION_RECONCILED', sessionId: 'session-1', route, paused: false }).state;
  const nearDestination = {
    longitude: 24.2, latitude: 50.2, accuracyMeters: 5,
    capturedAtClient: '2026-09-30T12:00:00Z', source: 'gps' as const,
    confidence: 0.95, distanceFromRouteMeters: 3, distanceAlongRouteMeters: 980,
    matchingProvider: 'route-projection-v1',
  };
  const notYetThere = transition(active, { type: 'LOCATION_MATCHED', location: { ...nearDestination, distanceAlongRouteMeters: 950 } });
  assert.equal(notYetThere.state.lifecycle, 'ACTIVE');

  const lowConfidence = transition(active, { type: 'LOCATION_MATCHED', location: { ...nearDestination, confidence: 0.4 } });
  assert.equal(lowConfidence.state.lifecycle, 'ACTIVE');

  const arrived = transition(active, { type: 'LOCATION_MATCHED', location: nearDestination });
  assert.equal(arrived.state.lifecycle, 'ARRIVED');
  assert.equal(arrived.state.remainingDistanceMeters, 20);
  assert.deepEqual(arrived.effects, [{ type: 'EMIT_TELEMETRY', name: 'navigation.arrived' }]);
});
test('stale route versions cannot replace current state and terminal events are idempotent', () => {
  let state = transition(initialNavigationState(), { type: 'NAVIGATION_START_REQUESTED', request }).state;
  state = transition(state, { type: 'ROUTE_RECEIVED', route }).state;
  state = { ...state, lifecycle: 'REROUTING' };
  const stale = transition(state, { type: 'REROUTE_SUCCEEDED', route });
  assert.equal(stale.state.routeVersion, 1);
  assert.equal(stale.state.lifecycle, 'REROUTING');
  const ended = transition(state, { type: 'NAVIGATION_ENDED' });
  assert.equal(ended.state.lifecycle, 'ENDED');
  assert.equal(transition(ended.state, { type: 'NAVIGATION_ENDED' }).state.lifecycle, 'ENDED');
});
