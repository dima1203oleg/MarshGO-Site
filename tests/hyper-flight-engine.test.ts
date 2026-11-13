import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFlightPath,
  reverseFlightPath,
  flightDurationMs,
  flightFractionAt,
  flightVelocityAt,
  cinematicCameraFrame,
  dockCameraFrame,
  calloutStageAt,
  lerp,
  lerpBearing,
  type FlightPath,
} from '../src/map/hyperFlightEngine';
import { distanceMeters } from '../src/map/cinematicRouteEngine';
import type { Coordinate } from '../shared/navigation/contracts';

// A real-shaped Lviv walking leg: a long eastbound street, then a short northbound turn.
// Eastbound ≈ 430m, northbound ≈ 111m, total ≈ 541m — so the arc-length midpoint
// lands on the eastbound stretch, proving sampling follows distance not vertex count.
const WALK_LINE: Coordinate[] = [
  [24.0200, 49.8436],
  [24.0230, 49.8436],
  [24.0260, 49.8436],
  [24.0260, 49.8446],
];

function path(): FlightPath {
  const built = buildFlightPath(WALK_LINE);
  assert.ok(built, 'walk line must build a flight path');
  return built;
}

test('hyperFlight — buildFlightPath rejects degenerate or discontinuous geometry instead of inventing a flight', () => {
  assert.equal(buildFlightPath([]), null);
  assert.equal(buildFlightPath([[24.0, 49.8]]), null);
  assert.equal(buildFlightPath([[24.0, 49.8], [24.0, 49.8]]), null);
  assert.equal(buildFlightPath([[24.0, 49.8], [Number.NaN, 49.81], [24.001, 49.8]]), null, 'an invalid middle point must not be bridged');
  assert.equal(buildFlightPath([[24.0, 49.8], [24.001, 91]]), null, 'coordinates outside geographic bounds are rejected');
});

test('hyperFlight — arc-length sampling follows real geometry, not vertex count', () => {
  const p = path();
  const expectedTotal = WALK_LINE.slice(1).reduce((sum, point, i) => sum + distanceMeters(WALK_LINE[i]!, point), 0);
  assert.ok(Math.abs(p.totalMeters - expectedTotal) < 1e-6, 'total equals the sum of real segment lengths');
  assert.ok(p.totalMeters > 500 && p.totalMeters < 600, `walk leg ~541m, got ${p.totalMeters}`);
  assert.deepEqual(p.fractionPoint(0), WALK_LINE[0]);
  assert.deepEqual(p.fractionPoint(1), WALK_LINE.at(-1));
  // The midpoint by DISTANCE lies on the long eastbound stretch, before the turn.
  const mid = p.fractionPoint(0.5);
  assert.ok(Math.abs(mid[1] - 49.8436) < 1e-6, 'midpoint must stay on the eastbound street');
  assert.ok(mid[0] > 24.0200 && mid[0] < 24.0260);
  // Clamping outside 0..1 never leaves the path.
  assert.deepEqual(p.fractionPoint(-3), WALK_LINE[0]);
  assert.deepEqual(p.fractionPoint(9), WALK_LINE.at(-1));
});

test('hyperFlight — bearingAt anticipates the curve with a forward tangent', () => {
  const p = path();
  const east = p.bearingAt(p.totalMeters * 0.2);
  assert.ok(east > 80 && east < 100, `eastbound ~90°, got ${east}`);
  const north = p.bearingAt(p.totalMeters * 0.9);
  assert.ok(north < 10 || north > 350, `northbound ~0°, got ${north}`);
  // Just before the corner the lookahead already begins to rotate toward north.
  const corner = p.cumulative[2]!;
  const before = p.bearingAt(corner - 4);
  assert.ok(before > 30 && before < 90, `curve anticipation between E and N, got ${before}`);
});

test('hyperFlight — sliceTo reveals a growing prefix of the REAL polyline', () => {
  const p = path();
  assert.deepEqual(p.sliceTo(0), [WALK_LINE[0]]);
  assert.deepEqual(p.sliceTo(1), WALK_LINE);
  const half = p.sliceTo(0.5);
  assert.ok(half.length >= 2);
  assert.deepEqual(half[0], WALK_LINE[0]);
  assert.deepEqual(half.at(-1), p.fractionPoint(0.5));
  // Reveal length is monotonic and the tip always sits on the geometry.
  let previous = 0;
  for (let f = 0; f <= 1.0001; f += 0.1) {
    const slice = p.sliceTo(f);
    let length = 0;
    for (let i = 1; i < slice.length; i += 1) length += distanceMeters(slice[i - 1]!, slice[i]!);
    assert.ok(length >= previous - 1e-6, 'reveal must never shrink');
    assert.ok(Math.abs(length - p.totalMeters * Math.min(1, f)) < 0.5, 'revealed arc length matches fraction');
    previous = length;
  }
});

test('hyperFlight — reverseFlightPath flies «Назад» over the same geometry', () => {
  const p = path();
  const back = reverseFlightPath(p);
  assert.ok(back);
  assert.deepEqual(back.fractionPoint(0), WALK_LINE.at(-1));
  assert.deepEqual(back.fractionPoint(1), WALK_LINE[0]);
  assert.ok(Math.abs(back.totalMeters - p.totalMeters) < 1e-6);
  // Reversed, the first stretch runs south; by the midpoint it runs west.
  const south = back.bearingAt(back.totalMeters * 0.1);
  assert.ok(south > 170 && south < 190, `reversed start southbound ~180°, got ${south}`);
  const west = back.bearingAt(back.totalMeters * 0.5);
  assert.ok(west > 260 && west < 280, `reversed midpoint westbound ~270°, got ${west}`);
});

test('hyperFlight — adaptive duration: walk slower/closer, transit faster, both clamped', () => {
  assert.equal(flightDurationMs(0, 'walk'), 1900);
  assert.equal(flightDurationMs(100_000, 'walk'), 5200);
  assert.equal(flightDurationMs(0, 'transit'), 2400);
  assert.equal(flightDurationMs(100_000, 'transit'), 7000);
  assert.ok(flightDurationMs(300, 'walk') > flightDurationMs(300, 'transit'));
  assert.ok(flightDurationMs(50, 'walk') > flightDurationMs(20, 'walk'));
  assert.ok(flightDurationMs(3000, 'transit') > flightDurationMs(500, 'transit'));
});

test('hyperFlight — trapezoidal profile: exact endpoints, monotonic, continuous velocity', () => {
  const duration = 4000;
  assert.equal(flightFractionAt(0, duration), 0);
  assert.equal(flightFractionAt(duration, duration), 1);
  assert.equal(flightFractionAt(duration * 5, duration), 1);
  assert.equal(flightFractionAt(100, 0), 1);
  let previous = 0;
  for (let t = 0; t <= duration; t += 25) {
    const f = flightFractionAt(t, duration);
    assert.ok(f >= previous - 1e-9 && f <= 1, 'fraction must be monotonic and bounded');
    previous = f;
  }
  // Velocity is continuous at the accel→cruise and cruise→decel knots (no jerk).
  const accelKnot = duration * 0.18;
  const decelKnot = duration * 0.72;
  assert.ok(Math.abs(flightVelocityAt(accelKnot - 1, duration) - flightVelocityAt(accelKnot + 1, duration)) < 0.01);
  assert.ok(Math.abs(flightVelocityAt(decelKnot - 1, duration) - flightVelocityAt(decelKnot + 1, duration)) < 0.01);
  // Accelerates early, cruises mid, brakes into the dock.
  assert.ok(flightVelocityAt(duration * 0.05, duration) < flightVelocityAt(duration * 0.4, duration));
  assert.ok(flightVelocityAt(duration * 0.95, duration) < flightVelocityAt(duration * 0.4, duration));
  assert.ok(flightFractionAt(duration * 0.5, duration) > 0.45);
});

test('hyperFlight — camera rides the geometry, looks ahead, eases zoom and pitch', () => {
  const p = path();
  const start = cinematicCameraFrame(p, 0, { kind: 'walk', startZoom: 15.5, perspective: '3d' });
  assert.deepEqual(start.marker, WALK_LINE[0]);
  assert.ok(Math.abs(start.zoom - 15.5) < 0.01, 'flight begins at the current map zoom');
  assert.ok(start.pitch >= 27 && start.pitch <= 30, 'starts near-upright');
  const cruise = cinematicCameraFrame(p, 0.5, { kind: 'walk', startZoom: 15.5, perspective: '3d' });
  assert.deepEqual(cruise.marker, p.fractionPoint(0.5));
  assert.ok(cruise.zoom > start.zoom && cruise.zoom <= 18.31);
  assert.ok(cruise.pitch > 50, 'cruising tilts into 3D');
  // Look-ahead: the camera centre leads the marker along the eastbound street.
  assert.ok(distanceMeters(WALK_LINE[0]!, cruise.center) > 0, 'centre is ahead of the start');
  assert.ok(cruise.center[0] >= cruise.marker[0] - 1e-9, 'centre leads the marker eastbound');
  const dock = cinematicCameraFrame(p, 1, { kind: 'walk', startZoom: 15.5, perspective: '3d' });
  assert.deepEqual(dock.marker, WALK_LINE.at(-1));
  assert.ok(Math.abs(dock.zoom - 18.0) < 0.05, 'settles to the walking dock zoom');
  assert.ok(Math.abs(dock.pitch - 44) < 0.5, 'docking relaxes the pitch');
  // 3D basemap boost only applies while cruising, never at the dock.
  const boosted = cinematicCameraFrame(p, 0.5, { kind: 'walk', perspective: '3d', perspectiveBoost: 8 });
  assert.ok(boosted.pitch > cruise.pitch);
  const boostedDock = cinematicCameraFrame(p, 1, { kind: 'walk', perspective: '3d', perspectiveBoost: 8 });
  assert.ok(Math.abs(boostedDock.pitch - 44) < 0.5);
  // Every frame stays finite and inside sane bounds.
  for (let f = 0; f <= 1.0001; f += 0.05) {
    const frame = cinematicCameraFrame(p, f, { kind: 'transit', startZoom: 14, perspective: '3d' });
    assert.ok(Number.isFinite(frame.zoom) && frame.zoom >= 13 && frame.zoom <= 18.5);
    assert.ok(frame.pitch >= 27 && frame.pitch <= 66);
    assert.ok(frame.bearing >= 0 && frame.bearing < 360);
  }
});

test('hyperFlight — precision docking lands exactly on the next segment start, turned toward it', () => {
  const p = path();
  const nextLine: Coordinate[] = [WALK_LINE.at(-1)!, [24.0275, 49.8446], [24.0290, 49.8446]];
  const next = buildFlightPath(nextLine)!;
  const dock = dockCameraFrame(p, next, 'transit', '3d');
  assert.deepEqual(dock.center, WALK_LINE.at(-1));
  assert.deepEqual(dock.marker, WALK_LINE.at(-1));
  assert.ok(dock.bearing > 80 && dock.bearing < 100, 'docked camera faces the next leg eastbound');
  assert.equal(dock.zoom, 17.1);
  assert.equal(dock.pitch, 44);
  // Without a next leg the camera keeps the flown direction.
  const solo = dockCameraFrame(p, null, 'walk');
  assert.ok(solo.bearing < 10 || solo.bearing > 350);
});

test('hyperFlight — Glass Info holds 4 seconds then Smoke Dissolves', () => {
  assert.equal(calloutStageAt(-10), 'enter');
  assert.equal(calloutStageAt(0), 'enter');
  assert.equal(calloutStageAt(419), 'enter');
  assert.equal(calloutStageAt(420), 'hold');
  assert.equal(calloutStageAt(4419), 'hold');
  assert.equal(calloutStageAt(4420), 'exit');
  assert.equal(calloutStageAt(5259), 'exit');
  assert.equal(calloutStageAt(5260), 'gone');
});

test('hyperFlight — explicit 2D stays flat throughout the flight and docking', () => {
  const p = path();
  for (const fraction of [0, 0.1, 0.5, 0.9, 1]) {
    assert.equal(cinematicCameraFrame(p, fraction, { kind: 'walk', perspective: '2d' }).pitch, 0);
  }
  assert.equal(dockCameraFrame(p, null, 'walk', '2d').pitch, 0);
});

test('hyperFlight — intercity lookahead is bounded in meters, not a fraction of the journey', () => {
  const long = buildFlightPath([[24.02, 49.84], [30.52, 50.45]])!;
  for (const fraction of [0, 0.1, 0.5, 0.9]) {
    const frame = cinematicCameraFrame(long, fraction, { kind: 'transit' });
    assert.ok(distanceMeters(frame.marker, frame.center) <= 81, 'camera must not start kilometres ahead of the marker');
  }
  assert.deepEqual(cinematicCameraFrame(long, 1, { kind: 'transit' }).center, long.fractionPoint(1));
});

test('hyperFlight — a geometry gap must not be labelled as the next boarding point', () => {
  const p = path();
  const remote = buildFlightPath([[30.5, 50.4], [30.501, 50.4]])!;
  const dock = dockCameraFrame(p, remote, 'walk');
  assert.deepEqual(dock.marker, p.fractionPoint(1));
  assert.ok(dock.bearing < 10 || dock.bearing > 350, 'unconnected next geometry must not determine docking direction');
});

test('hyperFlight — bearing interpolation takes the shortest arc across north', () => {
  assert.equal(lerp(0, 10, 0.5), 5);
  const across = lerpBearing(350, 10, 0.5);
  assert.ok(Math.abs(across) < 1 || Math.abs(across - 360) < 1, `350→10 must pass through 0, got ${across}`);
  const reverse = lerpBearing(10, 350, 0.5);
  assert.ok(Math.abs(reverse) < 1 || Math.abs(reverse - 360) < 1);
  assert.equal(lerpBearing(90, 180, 0), 90);
  assert.equal(lerpBearing(90, 180, 1), 180);
});
