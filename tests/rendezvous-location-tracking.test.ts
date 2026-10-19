import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApiRendezvous } from '../src/services/productionApi';
import { isFreshRendezvousSample, shouldWatchRendezvousLocation } from '../src/domain/rendezvousLocationTracking';

const session = (patch: Partial<ApiRendezvous> = {}): ApiRendezvous => ({
  id: 'rendezvous', bookingId: 'booking', journeyLegId: null, state: 'ACTIVE',
  pickup: { label: 'Pickup', coordinates: [30.52, 50.45] }, plannedPickupAt: '2026-10-18T08:00:00Z', predictedPickupAt: null,
  activationAt: '2026-10-18T07:45:00Z', locationSharingEnabled: true, driverArrivedAt: null, passengerArrivedAt: null,
  currentParticipant: 'driver', currentParticipantConsent: true, otherParticipantConsent: true,
  locations: { driver: null, passenger: null }, ...patch,
});

test('rendezvous GPS watch requires authentication, foreground visibility, both consents, and a live session', () => {
  assert.equal(shouldWatchRendezvousLocation(session(), true, true), true);
  assert.equal(shouldWatchRendezvousLocation(session(), true, false), false);
  assert.equal(shouldWatchRendezvousLocation(session(), false, true), false);
  assert.equal(shouldWatchRendezvousLocation(session({ currentParticipantConsent: false }), true, true), false);
  assert.equal(shouldWatchRendezvousLocation(session({ otherParticipantConsent: false }), true, true), false);
  assert.equal(shouldWatchRendezvousLocation(session({ locationSharingEnabled: false }), true, true), false);
  for (const state of ['BOARDING', 'COMPLETED', 'CANCELLED', 'EXPIRED']) {
    assert.equal(shouldWatchRendezvousLocation(session({ state }), true, true), false, state);
  }
});

test('rendezvous live updates reject invalid coordinates, stale samples, and implausibly future timestamps', () => {
  const now = Date.parse('2026-10-20T08:00:00.000Z');
  assert.equal(isFreshRendezvousSample([24.03, 49.84], '2026-10-20T07:59:30.000Z', now), true);
  assert.equal(isFreshRendezvousSample([24.03, 49.84], '2026-10-20T07:58:29.999Z', now), false);
  assert.equal(isFreshRendezvousSample([181, 49.84], '2026-10-20T08:00:00.000Z', now), false);
  assert.equal(isFreshRendezvousSample([24.03, 91], '2026-10-20T08:00:00.000Z', now), false);
  assert.equal(isFreshRendezvousSample([24.03, 49.84], '2026-10-20T08:00:30.001Z', now), false);
  assert.equal(isFreshRendezvousSample(null, '2026-10-20T08:00:00.000Z', now), false);
});
