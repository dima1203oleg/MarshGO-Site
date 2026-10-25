import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMoneyMinor } from '../src/domain/money';

test('formats Ukrainian hryvnia with one browser-independent symbol', () => {
  assert.equal(formatMoneyMinor(15000, 'UAH'), '150\u00a0₴');
  assert.equal(formatMoneyMinor(0), '0\u00a0₴');
});

test('formats other currencies with their stable ISO code', () => {
  assert.equal(formatMoneyMinor(123400, 'eur'), '1 234 EUR');
});
