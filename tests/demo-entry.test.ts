import test from 'node:test';
import assert from 'node:assert/strict';
import { isRideshareSimulatorRequest } from '../src/demoEntry';

test('rideshare simulator requires a dev build and explicit demo-mode opt-in', () => {
  assert.equal(isRideshareSimulatorRequest('?demo=simulator', { isDev: false, demoEnabled: true }), false);
  assert.equal(isRideshareSimulatorRequest('?demo=simulator', { isDev: true, demoEnabled: false }), false);
  assert.equal(isRideshareSimulatorRequest('?guest=true&origin=Kyiv', { isDev: true, demoEnabled: true }), false);
  assert.equal(isRideshareSimulatorRequest('?demo=rideshare_live', { isDev: true, demoEnabled: true }), false);
  assert.equal(isRideshareSimulatorRequest('?guest=true', { isDev: false, demoEnabled: false }), false);
  assert.equal(isRideshareSimulatorRequest('?origin=guest-explorer', { isDev: false, demoEnabled: false }), false);
  assert.equal(isRideshareSimulatorRequest('?mode=rideshare_live', { isDev: false, demoEnabled: false }), false);
});

test('rideshare simulator accepts only its explicit local demo aliases', () => {
  for (const demo of ['rideshare_lifecycle_simulator', 'rideshare_simulator', 'simulator']) {
    assert.equal(isRideshareSimulatorRequest(`?demo=${demo}`, { isDev: true, demoEnabled: true }), true);
  }
  assert.equal(isRideshareSimulatorRequest('?demo=other', { isDev: true, demoEnabled: true }), false);
});
