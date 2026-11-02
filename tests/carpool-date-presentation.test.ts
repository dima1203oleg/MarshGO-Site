import assert from 'node:assert/strict';
import test from 'node:test';
import { carpoolDepartureDateLabel, carpoolOffersFromOtherDate } from '../src/views/carpoolDatePresentation';

test('notice appears only when the feed marks offers as another date', () => {
  assert.equal(carpoolOffersFromOtherDate([]), false);
  assert.equal(carpoolOffersFromOtherDate([{ other_date: false }, {}]), false);
  assert.equal(carpoolOffersFromOtherDate([{ other_date: true }]), true);
});

test('departure date label rolls the day in Kyiv time, not in the device zone', () => {
  assert.match(carpoolDepartureDateLabel('2026-11-02T22:30:00Z'), /^3 /);
  assert.match(carpoolDepartureDateLabel('2026-11-02T15:30:00Z'), /^2 /);
});
