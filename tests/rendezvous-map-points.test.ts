import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApiRendezvous } from '../src/services/productionApi';
import { interpolateRendezvousMapPoints, rendezvousDistanceToPickup, rendezvousMapPoints } from '../src/domain/rendezvousMapPoints';

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

test('rendezvous marker interpolation eases only between matching live points and preserves exact pickup', () => {
  const from = rendezvousMapPoints(session(), true);
  const to = rendezvousMapPoints(session({
    pickup: { label: 'Pickup moved by server', coordinates: [30.60, 50.60] },
    locations: {
      driver: { coordinates: [30.53, 50.50], accuracyMeters: 12, capturedAt: '2026-10-18T07:59:10Z', freshness: 'LIVE' },
      passenger: { coordinates: [30.54, 50.51], accuracyMeters: 20, capturedAt: '2026-10-18T07:59:10Z', freshness: 'LIVE' },
    },
  }), true);
  const halfway = interpolateRendezvousMapPoints(from, to, 0.5);
  assert.deepEqual(halfway[0]?.coordinate, [30.60, 50.60]);
  for (const index of [1, 2]) {
    assert.ok(Math.abs((halfway[index]?.coordinate[0] ?? NaN) - 30.52) < 1e-10);
    assert.ok(Math.abs((halfway[index]?.coordinate[1] ?? NaN) - 50.47) < 1e-10);
  }
  assert.deepEqual(interpolateRendezvousMapPoints(from, to, 1), to);
  assert.deepEqual(interpolateRendezvousMapPoints(from, to, -1), interpolateRendezvousMapPoints(from, to, 0));
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
