import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraEasing, cameraMotionDuration, CAMERA_FOCUS_DURATION_MS, interruptCameraForUserGesture } from '../src/map/cameraMotion';

test('the camera easing is the entrance token: it starts fast and settles softly', () => {
  const easing = cameraEasing();
  assert.equal(easing(0), 0);
  assert.equal(easing(1), 1);
  assert.equal(easing(-0.5), 0);
  assert.equal(easing(1.5), 1);
  // cubic-bezier(.16,.84,.28,1) is far ahead of linear halfway through.
  assert.ok(easing(0.5) > 0.8, `expected a fast start, got ${easing(0.5)} at 50%`);
  assert.ok(easing(0.9) > 0.985, `expected a soft landing, got ${easing(0.9)} at 90%`);
  let previous = -1;
  for (let step = 0; step <= 20; step += 1) {
    const value = easing(step / 20);
    assert.ok(value >= previous - 1e-6, `easing must not go backwards at ${step / 20}`);
    previous = value;
  }
});

test('a focused leg glides longer than a reduced-motion user waits', () => {
  assert.ok(CAMERA_FOCUS_DURATION_MS >= 620 && CAMERA_FOCUS_DURATION_MS <= 900);
  assert.equal(cameraMotionDuration(CAMERA_FOCUS_DURATION_MS, true), 0);
});

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
