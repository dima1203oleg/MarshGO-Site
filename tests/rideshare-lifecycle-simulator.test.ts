import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSessionState,
  rideshareLifecycleReducer,
  calculateStraightLineDistance,
  estimateEtaMinutes,
} from '../src/domain/rideshareLifecycleMachine';

test('Simulator Telemetry & Role Projections: Passenger perspective vs Driver perspective', () => {
  const state = createInitialSessionState({
    stage: 'RENDEZVOUS_ACTIVE',
    driverGpsConsent: true,
    passengerGpsConsent: true,
  });

  const pickupCoord = state.trip.pickup.coordinates;
  const driverCoord = state.driverTelemetry!.coordinates;
  const passengerCoord = state.passengerTelemetry!.coordinates;

  // Passenger distance to pickup
  const passengerToPickupMeters = calculateStraightLineDistance(passengerCoord, pickupCoord);
  const passengerEtaMin = estimateEtaMinutes(passengerToPickupMeters, 'walking');

  // Driver distance to pickup
  const driverToPickupMeters = calculateStraightLineDistance(driverCoord, pickupCoord);
  const driverEtaMin = estimateEtaMinutes(driverToPickupMeters, 'driving');

  assert.ok(passengerToPickupMeters > 0 && passengerToPickupMeters < 500, 'Passenger should be within walking distance of pickup');
  assert.ok(driverToPickupMeters > 500 && driverToPickupMeters < 5000, 'Driver is approaching pickup');

  assert.ok(passengerEtaMin >= 0 && passengerEtaMin <= 5);
  assert.ok(driverEtaMin >= 1 && driverEtaMin <= 15);
});

test('Simulator Telemetry: Stale location detection updates telemetry flags', () => {
  let state = createInitialSessionState();
  assert.equal(state.driverTelemetry?.isStale, false);
  assert.equal(state.passengerTelemetry?.isStale, false);

  // Trigger simulated stale GPS
  state = rideshareLifecycleReducer(state, { type: 'SET_GPS_STALE', isStale: true });
  assert.equal(state.isSimulatingGpsStale, true);
  assert.equal(state.driverTelemetry?.isStale, true);
  assert.equal(state.passengerTelemetry?.isStale, true);

  // Restore GPS freshness
  state = rideshareLifecycleReducer(state, { type: 'SET_GPS_STALE', isStale: false });
  assert.equal(state.isSimulatingGpsStale, false);
  assert.equal(state.driverTelemetry?.isStale, false);
  assert.equal(state.passengerTelemetry?.isStale, false);
});

test('Simulator Telemetry: Role switching retains state integrity', () => {
  let state = createInitialSessionState({ activeRole: 'passenger' });
  assert.equal(state.activeRole, 'passenger');

  state = rideshareLifecycleReducer(state, { type: 'SWITCH_ROLE', role: 'driver' });
  assert.equal(state.activeRole, 'driver');

  state = rideshareLifecycleReducer(state, { type: 'SWITCH_ROLE', role: 'passenger' });
  assert.equal(state.activeRole, 'passenger');
});

test('Simulator Dual-Consent: Unlocks meeting ONLY when BOTH passenger and driver consent', () => {
  let state = createInitialSessionState({ stage: 'GPS_CONSENT_PENDING' });
  assert.equal(state.stage, 'GPS_CONSENT_PENDING');
  assert.equal(state.passengerGpsConsent, false);
  assert.equal(state.driverGpsConsent, false);

  // 1. Only Passenger grants consent -> meeting remains locked in GPS_CONSENT_PENDING
  state = rideshareLifecycleReducer(state, { type: 'GRANT_GPS_CONSENT', role: 'passenger' });
  assert.equal(state.passengerGpsConsent, true);
  assert.equal(state.driverGpsConsent, false);
  assert.equal(state.stage, 'GPS_CONSENT_PENDING');

  // 2. Driver also grants consent -> meeting UNLOCKS into RENDEZVOUS_ACTIVE
  state = rideshareLifecycleReducer(state, { type: 'GRANT_GPS_CONSENT', role: 'driver' });
  assert.equal(state.driverGpsConsent, true);
  assert.equal(state.stage, 'RENDEZVOUS_ACTIVE');
});

test('Simulator Dual-Consent: Driver-first consent keeps meeting locked until passenger consents', () => {
  let state = createInitialSessionState({ stage: 'GPS_CONSENT_PENDING' });

  // 1. Driver grants first
  state = rideshareLifecycleReducer(state, { type: 'GRANT_GPS_CONSENT', role: 'driver' });
  assert.equal(state.driverGpsConsent, true);
  assert.equal(state.passengerGpsConsent, false);
  assert.equal(state.stage, 'GPS_CONSENT_PENDING');

  // 2. Passenger grants second -> UNLOCKED
  state = rideshareLifecycleReducer(state, { type: 'GRANT_GPS_CONSENT', role: 'passenger' });
  assert.equal(state.passengerGpsConsent, true);
  assert.equal(state.stage, 'RENDEZVOUS_ACTIVE');
});

test('Simulator GPS denial affects only the participant who refuses and keeps the map disabled', () => {
  let state = createInitialSessionState({ stage: 'GPS_CONSENT_PENDING' });
  state = rideshareLifecycleReducer(state, { type: 'GRANT_GPS_CONSENT', role: 'driver' });
  state = rideshareLifecycleReducer(state, { type: 'DENY_GPS_CONSENT', role: 'passenger' });

  assert.equal(state.passengerGpsConsent, false);
  assert.equal(state.driverGpsConsent, true, 'the passenger action must not rewrite the driver consent');
  assert.equal(state.stage, 'GPS_DENIED', 'one refusal must keep the shared location map disabled');
});

test('Simulator Offline Fault Tolerance: reducer throws descriptive error caught cleanly by UI', () => {
  let state = createInitialSessionState({ stage: 'PROPOSAL', isOffline: true });

  let caughtError: string | null = null;
  try {
    state = rideshareLifecycleReducer(state, { type: 'SUBMIT_REQUEST' });
  } catch (err) {
    caughtError = (err as Error).message;
  }

  // Error caught cleanly without changing state or crashing
  assert.ok(caughtError !== null);
  assert.match(caughtError, /відсутній звʼязок \(Offline\)/);
  assert.equal(state.stage, 'PROPOSAL');
});

test('Simulator Query Param: recognises ?demo=rideshare_lifecycle_simulator', () => {
  const url = 'http://127.0.0.1:3000/?demo=rideshare_lifecycle_simulator';
  const parsed = new URL(url);
  const param = parsed.searchParams.get('demo');
  assert.equal(param, 'rideshare_lifecycle_simulator');
});

