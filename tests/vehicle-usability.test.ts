import assert from 'node:assert/strict';
import test from 'node:test';
import { vehicleUsable } from '../src/domain/vehicleUsability';

test('vehicles with plate and photo evidence can be used before document verification', () => {
  assert.equal(vehicleUsable({ trust_level: 1, verification_status: 'pending' }), true);
});

test('legacy verified vehicles remain usable when trust level is absent', () => {
  assert.equal(vehicleUsable({ verification_status: 'verified' }), true);
});

test('vehicles without usability evidence cannot be used for a proposal', () => {
  assert.equal(vehicleUsable({ trust_level: 0, verification_status: 'pending' }), false);
});
