import test from 'node:test';
import assert from 'node:assert/strict';
import { geolocationTimestampToIso, isDuplicateLocationFix, validateLocationFix, WebGeolocationProvider } from '../src/platform/LocationProvider';

const fix = (longitude: number, capturedAtClient: string, accuracyMeters = 5) => ({ longitude, latitude: 50, accuracyMeters, capturedAtClient, source: 'gps' as const });
test('location pipeline accepts fresh valid fixes and rejects accuracy, stale time and impossible jumps', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  assert.equal(validateLocationFix(fix(24, '2026-09-30T11:59:59Z'), now).accepted, true);
  assert.deepEqual(validateLocationFix(fix(24, '2026-09-30T11:59:59Z', 150), now), { accepted: false, code: 'GPS_LOW_ACCURACY' });
  assert.deepEqual(validateLocationFix(fix(24, '2026-09-30T11:50:00Z'), now), { accepted: false, code: 'GPS_STALE' });
  const previous = fix(24, '2026-09-30T11:59:50Z');
  assert.deepEqual(validateLocationFix(fix(25, '2026-09-30T11:59:51Z'), now, previous), { accepted: false, code: 'GPS_TELEPORT_DETECTED' });
});

test('normalizes WebKit microsecond geolocation timestamps to epoch milliseconds', () => {
  const epochMilliseconds = Date.parse('2026-10-13T16:24:35.239Z');
  assert.equal(geolocationTimestampToIso(epochMilliseconds), '2026-10-13T16:24:35.239Z');
  assert.equal(geolocationTimestampToIso(epochMilliseconds * 1000), '2026-10-13T16:24:35.239Z');
  assert.equal(geolocationTimestampToIso(Number.NaN), null);
  assert.equal(geolocationTimestampToIso(Number.POSITIVE_INFINITY), null);
});

test('ignores an identical cached GPS callback while preserving distinct same-time coordinates for stale validation', () => {
  const previous = fix(24, '2026-09-30T11:59:59Z');
  assert.equal(isDuplicateLocationFix({ ...previous }, previous), true);
  assert.equal(isDuplicateLocationFix(fix(24.001, previous.capturedAtClient), previous), false);
  assert.equal(isDuplicateLocationFix(fix(24, previous.capturedAtClient, 10), previous), false);
});

test('watch reports permission loss and recovery, starts once and clears on stop', async context => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let success!: PositionCallback;
  let failure!: PositionErrorCallback;
  let watches = 0;
  const cleared: number[] = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition(onFix: PositionCallback, onError: PositionErrorCallback) { watches++; success = onFix; failure = onError; return 17; },
    clearWatch(id: number) { cleared.push(id); },
  } } });
  context.after(() => { if (original) Object.defineProperty(globalThis, 'navigator', original); else Reflect.deleteProperty(globalThis, 'navigator'); });
  const provider = new WebGeolocationProvider();
  const statuses: string[] = [];
  const received: unknown[] = [];
  const unsubscribeStatus = provider.subscribeStatus(status => statuses.push(status));
  const unsubscribeFix = provider.subscribe(value => received.push(value));
  await provider.start();
  await provider.start();
  assert.equal(watches, 1);
  failure({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
  assert.equal(provider.status(), 'PERMISSION_DENIED');
  assert.equal(received.length, 0);
  success({ timestamp: Date.now(), coords: { longitude: 24, latitude: 50, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: null, speed: null } } as GeolocationPosition);
  assert.equal(received.length, 1);
  assert.equal(provider.status(), 'ACTIVE');
  await provider.stop();
  assert.deepEqual(cleared, [17]);
  assert.deepEqual(statuses, ['ACTIVE', 'PERMISSION_DENIED', 'ACTIVE', 'IDLE']);
  unsubscribeStatus();
  unsubscribeFix();
  await provider.start();
  failure({ code: 2, PERMISSION_DENIED: 1 } as GeolocationPositionError);
  assert.equal(statuses.length, 4);
  await provider.stop();
});
