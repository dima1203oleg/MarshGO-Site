import assert from 'node:assert/strict';
import test from 'node:test';
import { carpoolBookingTotalLabel, carpoolBookingTotalMinor, carpoolFareBasis, carpoolFareLabel } from '../src/domain/carpoolFare';

test('PER_SEAT remains the legacy default and multiplies by passenger count', () => {
  assert.equal(carpoolFareBasis(undefined), 'PER_SEAT');
  assert.equal(carpoolBookingTotalMinor(45_000, 2, undefined), 90_000);
  assert.equal(carpoolFareLabel(undefined), 'за місце');
  assert.equal(carpoolBookingTotalLabel(2, undefined), 'Вартість за 2 місця');
});

test('TOTAL_ALL is a fixed trip total regardless of passenger count', () => {
  assert.equal(carpoolFareBasis('TOTAL_ALL'), 'TOTAL_ALL');
  assert.equal(carpoolBookingTotalMinor(45_000, 2, 'TOTAL_ALL'), 45_000);
  assert.equal(carpoolBookingTotalMinor(45_000, 4, 'TOTAL_ALL'), 45_000);
  assert.equal(carpoolFareLabel('TOTAL_ALL'), 'за всю поїздку');
  assert.equal(carpoolBookingTotalLabel(2, 'TOTAL_ALL'), 'Вартість усієї поїздки');
});

test('unknown fare basis safely falls back to the legacy per-seat contract', () => {
  assert.equal(carpoolBookingTotalMinor(45_000, 3, 'UNRECOGNIZED'), 135_000);
});
