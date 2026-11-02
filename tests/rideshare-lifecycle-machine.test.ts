import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSessionState,
  rideshareLifecycleReducer,
  canTransition,
  calculateStraightLineDistance,
  estimateEtaMinutes,
  formatDistanceUk,
} from '../src/domain/rideshareLifecycleMachine';

test('Rideshare Lifecycle State Machine: Happy Path from Proposal to Rated History', () => {
  let state = createInitialSessionState();
  assert.equal(state.stage, 'PROPOSAL');

  // 1. Submit Request
  state = rideshareLifecycleReducer(state, { type: 'SUBMIT_REQUEST' });
  assert.equal(state.stage, 'REQUESTED');
  assert.equal(state.historyLog.length, 1);

  // 2. Confirm Booking
  state = rideshareLifecycleReducer(state, { type: 'CONFIRM_BOOKING' });
  assert.equal(state.stage, 'BOOKING_CONFIRMED');

  // 3. Prompt GPS Consent
  state = rideshareLifecycleReducer(state, { type: 'PROMPT_GPS' });
  assert.equal(state.stage, 'GPS_CONSENT_PENDING');

  // 4. Passenger grants GPS consent (driver hasn't yet) -> stays pending
  state = rideshareLifecycleReducer(state, { type: 'GRANT_GPS_CONSENT', role: 'passenger' });
  assert.equal(state.passengerGpsConsent, true);
  assert.equal(state.driverGpsConsent, false);
  assert.equal(state.stage, 'GPS_CONSENT_PENDING');

  // 5. Driver grants consent -> mutual consent reached, transitions to RENDEZVOUS_ACTIVE
  state = rideshareLifecycleReducer(state, { type: 'GRANT_GPS_CONSENT', role: 'driver' });
  assert.equal(state.driverGpsConsent, true);
  assert.equal(state.stage, 'RENDEZVOUS_ACTIVE');

  // 6. Driver arrives at pickup
  state = rideshareLifecycleReducer(state, { type: 'DRIVER_ARRIVED' });
  assert.equal(state.stage, 'ARRIVED_AT_PICKUP');

  // 7. Handshake: verify PIN (valid PIN: 4819)
  state = rideshareLifecycleReducer(state, { type: 'ENTER_PIN', pin: '4819' });
  assert.equal(state.stage, 'IN_TRANSIT');
  assert.equal(state.pinError, null);

  // 8. Complete Ride
  state = rideshareLifecycleReducer(state, { type: 'COMPLETE_RIDE' });
  assert.equal(state.stage, 'COMPLETED');

  // 9. Submit Rating & Save to History
  state = rideshareLifecycleReducer(state, {
    type: 'SUBMIT_RATING',
    stars: 5,
    tags: ['Швидко', 'Комфортно'],
    comment: 'Чудова поїздка!',
  });
  assert.equal(state.stage, 'RATED_AND_HISTORY');
  assert.equal(state.ratingStars, 5);
  assert.equal(state.ratingComment, 'Чудова поїздка!');
});

test('Rideshare Lifecycle State Machine: GPS Denied branch uses Landmark Fallback', () => {
  let state = createInitialSessionState({ stage: 'GPS_CONSENT_PENDING' });

  // Passenger denies GPS consent
  state = rideshareLifecycleReducer(state, { type: 'DENY_GPS_CONSENT', role: 'passenger' });
  assert.equal(state.stage, 'GPS_DENIED');
  assert.equal(state.passengerGpsConsent, false);

  // Can still proceed to arrival and boarding via landmark rendezvous
  state = rideshareLifecycleReducer(state, { type: 'DRIVER_ARRIVED' });
  assert.equal(state.stage, 'ARRIVED_AT_PICKUP');

  // QR boarding handshake works
  state = rideshareLifecycleReducer(state, { type: 'CONFIRM_BOARDING_QR' });
  assert.equal(state.stage, 'IN_TRANSIT');
});

test('Rideshare Lifecycle State Machine: Rejects Illegal Transitions', () => {
  const state = createInitialSessionState({ stage: 'PROPOSAL' });

  // Cannot jump straight to IN_TRANSIT from PROPOSAL
  assert.throws(
    () => rideshareLifecycleReducer(state, { type: 'START_RIDE' }),
    /Заборонений перехід|Неможливо розпочати поїздку/
  );

  // Cannot complete ride before starting it
  assert.throws(
    () => rideshareLifecycleReducer(state, { type: 'COMPLETE_RIDE' }),
    /Заборонений перехід/
  );

  // cannot transition test directly
  assert.equal(canTransition('PROPOSAL', 'IN_TRANSIT'), false);
  assert.equal(canTransition('REQUESTED', 'COMPLETED'), false);
  assert.equal(canTransition('COMPLETED', 'CANCELLED'), false);
  assert.equal(canTransition('RATED_AND_HISTORY', 'PROPOSAL'), false);
});

test('Rideshare Lifecycle State Machine: Offline state blocks network operations', () => {
  let state = createInitialSessionState({ isOffline: true });

  assert.throws(
    () => rideshareLifecycleReducer(state, { type: 'SUBMIT_REQUEST' }),
    /відсутній звʼязок/
  );

  state = { ...state, stage: 'REQUESTED' };
  assert.throws(
    () => rideshareLifecycleReducer(state, { type: 'CONFIRM_BOOKING' }),
    /офлайн/
  );

  // Reconnecting allows action
  state = rideshareLifecycleReducer(state, { type: 'TOGGLE_OFFLINE', isOffline: false });
  assert.equal(state.isOffline, false);
  state = rideshareLifecycleReducer(state, { type: 'CONFIRM_BOOKING' });
  assert.equal(state.stage, 'BOOKING_CONFIRMED');
});

test('Rideshare Lifecycle State Machine: PIN verification validation', () => {
  let state = createInitialSessionState({ stage: 'ARRIVED_AT_PICKUP' });

  // Wrong PIN produces error
  state = rideshareLifecycleReducer(state, { type: 'ENTER_PIN', pin: '0000' });
  assert.equal(state.stage, 'BOARDING_HANDSHAKE');
  assert.equal(state.pinError, 'Невірний код! Звіртеся з пасажиром.');

  // Correct PIN enters transit
  state = rideshareLifecycleReducer(state, { type: 'ENTER_PIN', pin: '4819' });
  assert.equal(state.stage, 'IN_TRANSIT');
  assert.equal(state.pinError, null);
});

test('Rideshare Lifecycle State Machine: Cancellation with metadata', () => {
  let state = createInitialSessionState({ stage: 'RENDEZVOUS_ACTIVE' });

  state = rideshareLifecycleReducer(state, {
    type: 'CANCEL_RIDE',
    reason: 'Водій запізнюється на 20 хвилин',
    role: 'passenger',
  });

  assert.equal(state.stage, 'CANCELLED');
  assert.equal(state.cancellationReason, 'Водій запізнюється на 20 хвилин');
  assert.equal(state.cancelledByRole, 'passenger');

  // Once cancelled, cannot cancel again or progress
  assert.throws(
    () =>
      rideshareLifecycleReducer(state, {
        type: 'CANCEL_RIDE',
        reason: 'Ще одне скасування',
        role: 'driver',
      }),
    /термінальному стані/
  );
});

test('Rideshare Lifecycle State Machine: Distance, ETA and Formatting Utilities', () => {
  const p1 = { lat: 49.8654, lng: 24.0152 }; // Fabrik Lviv
  const p2 = { lat: 49.8032, lng: 24.0041 }; // Naukova Lviv

  const distanceMeters = calculateStraightLineDistance(p1, p2);
  assert.ok(distanceMeters > 6000 && distanceMeters < 8000, `Expected ~7km, got ${distanceMeters}m`);

  const etaDriving = estimateEtaMinutes(distanceMeters, 'driving');
  assert.ok(etaDriving >= 10 && etaDriving <= 20, `Expected ~13min, got ${etaDriving}min`);

  const formatted = formatDistanceUk(distanceMeters);
  assert.match(formatted, /^[67]\.\d км$/);

  const shortDistFormatted = formatDistanceUk(450);
  assert.equal(shortDistFormatted, '450 м');
});
