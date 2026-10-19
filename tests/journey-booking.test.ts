import assert from 'node:assert/strict';
import test from 'node:test';
import { journeyLegCanBeBooked } from '../src/domain/journeyBooking';

const leg = (overrides: Partial<Parameters<typeof journeyLegCanBeBooked>[0]> = {}) => ({
  offerId: 'offer-1', bookingId: null, state: 'SELECTED', availabilityStatus: 'AVAILABLE', ...overrides,
});

test('allows a selected Community offer without an existing booking', () => {
  assert.equal(journeyLegCanBeBooked(leg()), true);
});

test('hides repeat booking for a confirmed leg even if an offer ID remains in its saved DTO', () => {
  assert.equal(journeyLegCanBeBooked(leg({ bookingId: 'booking-1', state: 'CONFIRMED' })), false);
  assert.equal(journeyLegCanBeBooked(leg({ state: 'CONFIRMED' })), false);
});

test('hides booking for terminal legs and offers known to be unavailable', () => {
  for (const state of ['RESERVED', 'WAITING', 'ACTIVE', 'COMPLETED', 'MISSED', 'CANCELLED', 'REPLACED', 'FAILED']) {
    assert.equal(journeyLegCanBeBooked(leg({ state })), false, state);
  }
  assert.equal(journeyLegCanBeBooked(leg({ availabilityStatus: 'UNAVAILABLE' })), false);
});
