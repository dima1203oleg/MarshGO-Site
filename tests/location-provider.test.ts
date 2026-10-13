import test from 'node:test';
import assert from 'node:assert/strict';
import { geolocationTimestampToIso, validateLocationFix } from '../src/platform/LocationProvider';

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
