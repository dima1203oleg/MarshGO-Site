import assert from 'node:assert/strict';
import test from 'node:test';
import { transitDirectionOffsetPx } from '../src/map/MapAdapter';

test('opposing transit directions get a visible screen-space offset without changing feed coordinates', () => {
  assert.equal(transitDirectionOffsetPx('0', 0), -11);
  assert.equal(transitDirectionOffsetPx('1', 1), 11);
  assert.equal(transitDirectionOffsetPx(null, 0), -11);
  assert.equal(transitDirectionOffsetPx(undefined, 1), 11);
  assert.equal(transitDirectionOffsetPx(null, 2), 0);
});
