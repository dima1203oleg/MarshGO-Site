import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraEasing, cameraMotionDuration, adaptiveCameraDuration, CAMERA_FOCUS_DURATION_MS, claimCameraForUserGesture } from '../src/map/cameraMotion';

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

test('programmatic camera events do not enter manual mode', () => {
  let manual = 0;
  assert.equal(claimCameraForUserGesture(undefined, () => manual++), false);
  assert.equal(claimCameraForUserGesture(null, () => manual++), false);
  assert.equal(manual, 0);
});

/**
 * A stop() asked for by the gesture handler is the defect that killed pinch, rotate and flick on a
 * touch screen: MapLibre reaches it while the gesture is mid-frame, so it resets the two-finger
 * handler and clears the recorded momentum. The API takes no stop callback, so a gesture can only
 * ever publish ownership.
 */
test('a user gesture claims the camera and stops nothing', () => {
  let manual = 0;
  assert.equal(claimCameraForUserGesture({ type: 'pointerdown' }, () => manual++), true);
  assert.equal(manual, 1);
  assert.equal(claimCameraForUserGesture.length, 2);
});

/**
 * A focus animation already parks the camera in FREE, so suppressing the notification there left
 * the screen auto-refitting over the rider's pan: ownership has to be republished on every input.
 */
test('ownership is republished for a gesture that arrives while the camera already sits in FREE', () => {
  let manual = 0;
  assert.equal(claimCameraForUserGesture({ type: 'touchmove' }, () => manual++), true);
  assert.equal(claimCameraForUserGesture({ type: 'touchmove' }, () => manual++), true);
  assert.equal(manual, 2);
});

test('a near-static refit snaps faster than the base duration', () => {
  const base = 700;
  const snap = adaptiveCameraDuration(base, { distanceMeters: 0, zoomDelta: 0, bearingDelta: 0 });
  assert.ok(snap < base, `expected a short hop below ${base}, got ${snap}`);
  assert.ok(snap >= base * 0.5, `must never drop below half the base, got ${snap}`);
});

test('a cross-city move glides longer than a short hop but stays capped', () => {
  const base = 700;
  const short = adaptiveCameraDuration(base, { distanceMeters: 120 });
  const long = adaptiveCameraDuration(base, { distanceMeters: 6000 });
  assert.ok(long > short, `a long move (${long}) must outlast a short one (${short})`);
  assert.ok(long <= 1400, `must not delay the user beyond 1.4 s, got ${long}`);
});

test('zoom change and turn angle each lengthen the glide on their own', () => {
  const base = 600;
  const flat = adaptiveCameraDuration(base, {});
  assert.ok(adaptiveCameraDuration(base, { zoomDelta: 4 }) > flat, 'a 4-level zoom must glide longer');
  assert.ok(adaptiveCameraDuration(base, { bearingDelta: 90 }) > flat, 'a 90° turn must glide longer');
  // The dominant signal wins, they do not stack into an absurd duration.
  assert.ok(adaptiveCameraDuration(base, { distanceMeters: 9000, zoomDelta: 8, bearingDelta: 180 }) <= 1400);
});

test('adaptive duration is monotonic in distance and rounded to 10 ms', () => {
  let previous = -1;
  for (let metres = 0; metres <= 4000; metres += 250) {
    const value = adaptiveCameraDuration(700, { distanceMeters: metres });
    assert.ok(value >= previous, `duration must not shrink as distance grows (${metres} m)`);
    assert.equal(value % 10, 0, `expected a 10 ms grid, got ${value}`);
    previous = value;
  }
});

test('invalid or non-positive base yields no animation; reduced motion still wins upstream', () => {
  assert.equal(adaptiveCameraDuration(0, { distanceMeters: 5000 }), 0);
  assert.equal(adaptiveCameraDuration(-100, {}), 0);
  assert.equal(adaptiveCameraDuration(Number.NaN, {}), 0);
  assert.equal(cameraMotionDuration(adaptiveCameraDuration(700, { distanceMeters: 5000 }), true), 0);
});

test('non-finite effort signals are ignored instead of poisoning the duration', () => {
  const base = 700;
  const clean = adaptiveCameraDuration(base, {});
  assert.equal(adaptiveCameraDuration(base, { distanceMeters: Number.NaN, zoomDelta: Number.POSITIVE_INFINITY }), clean);
});
