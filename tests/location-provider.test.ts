import test from 'node:test';
import assert from 'node:assert/strict';
import { geolocationPositionToFix, geolocationTimestampToIso, validateLocationFix } from '../src/platform/LocationProvider';

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

test('keeps valid WebKit GPS coordinates when optional measurements are non-finite', () => {
  const epochMilliseconds = Date.parse('2026-10-22T12:00:00Z');
  const parsed = geolocationPositionToFix({
    coords: {
      longitude: 24,
      latitude: 50,
      accuracy: 5,
      altitude: Number.NaN,
      altitudeAccuracy: Number.NaN,
      heading: Number.NaN,
      speed: Number.NaN,
      toJSON: () => ({}),
    },
    timestamp: epochMilliseconds * 1000,
    toJSON: () => ({}),
  } as GeolocationPosition);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.longitude, 24);
  assert.equal(parsed.data.latitude, 50);
  assert.equal(parsed.data.accuracyMeters, 5);
  assert.equal(parsed.data.capturedAtClient, '2026-10-22T12:00:00.000Z');
  assert.equal('altitudeMeters' in parsed.data, false);
  assert.equal('altitudeAccuracyMeters' in parsed.data, false);
  assert.equal('headingDegrees' in parsed.data, false);
  assert.equal('speedMps' in parsed.data, false);
});
