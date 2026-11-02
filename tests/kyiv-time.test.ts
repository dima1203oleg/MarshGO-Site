import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultKyivDateTime, formatKyivDateTimeInput, kyivDateTimeInputToDate, kyivDateTimeInputToIso } from '../src/domain/kyivTime';

test('converts Kyiv local times to UTC across standard and daylight time', () => {
  assert.equal(kyivDateTimeInputToIso('2026-01-15T08:00'), '2026-01-15T06:00:00.000Z');
  assert.equal(kyivDateTimeInputToIso('2026-07-15T08:00'), '2026-07-15T05:00:00.000Z');
  assert.equal(formatKyivDateTimeInput('2026-07-15T05:00:00.000Z'), '2026-07-15T08:00');
  assert.equal(formatKyivDateTimeInput('2026-07-15T05:00:01.000Z'), '2026-07-15T08:01');
  assert.equal(formatKyivDateTimeInput('2026-07-15T20:59:30.000Z'), '2026-07-16T00:00');
});

test('rejects a local time that does not exist during the spring DST jump', () => {
  assert.equal(kyivDateTimeInputToDate('2026-03-29T03:30'), null);
});

test('resolves the repeated autumn DST hour to its first occurrence', () => {
  assert.equal(kyivDateTimeInputToIso('2026-10-25T03:30'), '2026-10-25T00:30:00.000Z');
  assert.equal(formatKyivDateTimeInput('2026-10-25T01:30:00.000Z'), '2026-10-25T03:30');
});

test('defaults use Kyiv calendar dates, independent of device timezone', () => {
  const now = new Date('2026-03-28T22:30:00.000Z');
  assert.equal(defaultKyivDateTime(1, 8, now), '2026-03-30T08:00');
  assert.equal(kyivDateTimeInputToDate('2026-02-30T08:00'), null);
});
