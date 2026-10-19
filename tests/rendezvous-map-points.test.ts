import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApiRendezvous } from '../src/services/productionApi';
import { rendezvousApproachRoutes, rendezvousDistanceToPickup, rendezvousMapPoints } from '../src/domain/rendezvousMapPoints';
import type { ApiRendezvousApproaches } from '../src/services/productionApi';

const session = (patch: Partial<ApiRendezvous> = {}): ApiRendezvous => ({
  id: 'rendezvous', bookingId: 'booking', journeyLegId: null, state: 'ACTIVE',
  pickup: { label: 'Pickup', coordinates: [30.52, 50.45] }, plannedPickupAt: '2026-10-18T08:00:00Z', predictedPickupAt: null,
  activationAt: '2026-10-18T07:45:00Z', locationSharingEnabled: true, driverArrivedAt: null, passengerArrivedAt: null,
  currentParticipant: 'driver', currentParticipantConsent: true, otherParticipantConsent: true,
  locations: {
    driver: { coordinates: [30.51, 50.44], accuracyMeters: 12, capturedAt: '2026-10-18T07:59:00Z', freshness: 'LIVE' },
    passenger: { coordinates: [30.50, 50.43], accuracyMeters: 20, capturedAt: '2026-10-18T07:58:00Z', freshness: 'LIVE' },
  },
  ...patch,
});

test('rendezvous map includes pickup and both fresh points with roles relative to viewer', () => {
  const points = rendezvousMapPoints(session(), true);
  assert.deepEqual(points.map(({ coordinate, kind }) => ({ coordinate, kind })), [
    { coordinate: [30.52, 50.45], kind: 'PICKUP' },
    { coordinate: [30.51, 50.44], kind: 'SELF_LOCATION' },
    { coordinate: [30.50, 50.43], kind: 'OTHER_LOCATION' },
  ]);
});

test('rendezvous map omits stale or unauthorized participant locations', () => {
  const stale = rendezvousMapPoints(session({
    locations: {
      driver: { coordinates: [30.51, 50.44], accuracyMeters: 12, capturedAt: '2026-10-18T07:59:00Z', freshness: 'STALE' },
      passenger: null,
    },
  }), false);
  assert.deepEqual(stale.map((point) => point.kind), ['PICKUP']);

  const noConsent = rendezvousMapPoints(session({ otherParticipantConsent: false }), true);
  assert.deepEqual(noConsent.map((point) => point.kind), ['PICKUP']);

  for (const state of ['BOARDING', 'COMPLETED', 'CANCELLED', 'EXPIRED']) {
    const ended = rendezvousMapPoints(session({ state }), true);
    assert.deepEqual(ended.map((point) => point.kind), ['PICKUP'], state);
  }

  const passengerView = rendezvousMapPoints(session(), false);
  assert.equal(passengerView[1]?.kind, 'OTHER_LOCATION');
  assert.equal(passengerView[2]?.kind, 'SELF_LOCATION');
});

test('pickup distance is a separately labeled straight-line estimate and requires fresh consented GPS', () => {
  const driver = rendezvousDistanceToPickup(session(), 'driver');
  assert.equal(driver.state, 'LIVE');
  if (driver.state === 'LIVE') assert.ok(driver.straightLineMeters > 1000 && driver.straightLineMeters < 1500);

  const stale = rendezvousDistanceToPickup(session({
    locations: { driver: { coordinates: [30.51, 50.44], accuracyMeters: 12, capturedAt: '2026-10-18T07:59:00Z', freshness: 'STALE' }, passenger: null },
  }), 'driver');
  assert.deepEqual(stale, { state: 'STALE' });
  assert.deepEqual(rendezvousDistanceToPickup(session({ otherParticipantConsent: false }), 'driver'), { state: 'UNAVAILABLE' });
  assert.deepEqual(rendezvousDistanceToPickup(session({ state: 'COMPLETED' }), 'passenger'), { state: 'UNAVAILABLE' });
});


test('rendezvous map draws only valid provider-routed approaches with distinct participant colors', () => {
  const approaches: ApiRendezvousApproaches = {
    rendezvousId: 'rendezvous', pickup: { label: 'Pickup', coordinates: [30.52, 50.45] },
    driver: { location: session().locations.driver, approach: { status: 'ROUTED', geometry: [[30.51, 50.44], [30.52, 50.45]], distanceMeters: 1400, durationSeconds: 240 } },
    passenger: { location: session().locations.passenger, approach: { status: 'ROUTED', geometry: [[30.50, 50.43], [30.52, 50.45]], distanceMeters: 2800, durationSeconds: 480 } },
    updatedAt: '2026-10-18T07:59:00Z',
  };
  assert.deepEqual(rendezvousApproachRoutes(approaches).map((route) => ({ id: route.id, color: route.modeColor, coordinates: route.coordinates })), [
    { id: 'driver-approach', color: '#2563eb', coordinates: [[30.51, 50.44], [30.52, 50.45]] },
    { id: 'passenger-approach', color: '#7c3aed', coordinates: [[30.50, 50.43], [30.52, 50.45]] },
  ]);
  assert.deepEqual(rendezvousApproachRoutes(null), []);
});

test('rendezvous map rejects missing, non-routed, short and malformed approach geometry', () => {
  const approaches: ApiRendezvousApproaches = {
    rendezvousId: 'rendezvous', pickup: { label: 'Pickup', coordinates: [30.52, 50.45] },
    driver: { location: null, approach: { status: 'ROUTING_UNAVAILABLE', geometry: null, distanceMeters: null, durationSeconds: null } },
    passenger: { location: null, approach: { status: 'ROUTED', geometry: [[30.5, 50.4], [181, 50.5]], distanceMeters: 2, durationSeconds: 2 } },
    updatedAt: '2026-10-18T07:59:00Z',
  };
  assert.deepEqual(rendezvousApproachRoutes(approaches), []);
  approaches.passenger.approach.geometry = [[30.5, 50.4]];
  assert.deepEqual(rendezvousApproachRoutes(approaches), []);
});
