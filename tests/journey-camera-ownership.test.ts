import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldFocusJourneyStage } from '../src/navigation/journeyCameraOwnership';

test('frames the selected stage while GPS follow waits for a fresh fix', () => {
  assert.equal(shouldFocusJourneyStage('follow', false), true);
});

test('fresh GPS follow owns the camera once a fix is available', () => {
  assert.equal(shouldFocusJourneyStage('follow', true), false);
});

test('manual gestures and preview flights keep camera ownership', () => {
  assert.equal(shouldFocusJourneyStage('user', false), false);
  assert.equal(shouldFocusJourneyStage('preview', false), false);
});

test('explicit stage focus remains available with or without GPS', () => {
  assert.equal(shouldFocusJourneyStage('stage', false), true);
  assert.equal(shouldFocusJourneyStage('stage', true), true);
});
