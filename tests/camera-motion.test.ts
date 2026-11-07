import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraMotionDuration, interruptCameraForUserGesture } from '../src/map/cameraMotion';

test('camera animations become immediate when reduced motion is requested', () => {
  assert.equal(cameraMotionDuration(500, true), 0);
  assert.equal(cameraMotionDuration(0, true), 0);
});

test('camera animations retain their configured duration otherwise', () => {
  assert.equal(cameraMotionDuration(520, false), 520);
});

test('programmatic camera events do not interrupt motion or enter manual mode', () => {
  let stopped = 0;
  let manual = 0;
  assert.equal(interruptCameraForUserGesture(undefined, 'FOLLOW', () => stopped++, () => manual++), false);
  assert.equal(interruptCameraForUserGesture(null, 'FOLLOW', () => stopped++, () => manual++), false);
  assert.equal(stopped, 0);
  assert.equal(manual, 0);
});

test('user gestures stop in-flight motion and leave follow mode', () => {
  let stopped = 0;
  let manual = 0;
  assert.equal(interruptCameraForUserGesture({ type: 'pointerdown' }, 'FOLLOW', () => stopped++, () => manual++), true);
  assert.equal(stopped, 1);
  assert.equal(manual, 1);
});

test('user gestures stop animation without redundant mode transitions when already manual', () => {
  let stopped = 0;
  let manual = 0;
  interruptCameraForUserGesture({ type: 'wheel' }, 'FREE', () => stopped++, () => manual++);
  assert.equal(stopped, 1);
  assert.equal(manual, 0);
});
