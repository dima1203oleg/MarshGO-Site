import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCanonicalRoutePrice } from '../src/design-system/journey/CanonicalRouteLip';

describe('canonical route lip values', () => {
  it('formats UAH in integer minor units and marks estimates as approximate', () => {
    assert.equal(formatCanonicalRoutePrice(3_300, 'UAH', 'LOCKED'), '33\u00a0₴');
    assert.equal(formatCanonicalRoutePrice(3_300, 'UAH', 'ESTIMATED'), '≈ 33\u00a0₴');
    assert.equal(formatCanonicalRoutePrice(3_300, 'UAH', 'DYNAMIC'), '≈ 33\u00a0₴');
  });

  it('keeps unknown and unsafe amounts unknown instead of displaying zero', () => {
    assert.equal(formatCanonicalRoutePrice(null, 'UAH', 'UNKNOWN'), '—');
    assert.equal(formatCanonicalRoutePrice(0, 'UAH', 'UNKNOWN'), '—');
    assert.equal(formatCanonicalRoutePrice(Number.MAX_SAFE_INTEGER + 1, 'UAH', 'LOCKED'), '—');
    assert.equal(formatCanonicalRoutePrice(0, 'UAH', 'LOCKED'), '0\u00a0₴');
  });
});
