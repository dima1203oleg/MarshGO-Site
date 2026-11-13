import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectApproachingVehicles,
  projectOntoLine,
  bearingAlongLineAt,
  interpolateAlongLine,
  type ApproachingVehicle,
} from '../src/map/fleetMotion';
import type { Coordinate } from '../shared/navigation/contracts';

// An L-shaped transit line: east along a street, then north — a real corner a
// vehicle must round rather than cut across the block.
const LINE: Coordinate[] = [
  [24.0200, 49.8436],
  [24.0260, 49.8436],
  [24.0260, 49.8476],
];

function vehicle(overrides: Partial<ApproachingVehicle> & { id: string }): ApproachingVehicle {
  return {
    coordinates: [24.0210, 49.8436],
    updatedAt: new Date().toISOString(),
    approachingBoarding: true,
    emphasized: false,
    etaSeconds: 120,
    etaConfidence: 'OBSERVED',
    ...overrides,
  };
}

test('fleetMotion — only genuinely approaching vehicles with a CONFIRMED ETA are shown', () => {
  const fleet = [
    vehicle({ id: 'ok', etaSeconds: 90 }),
    vehicle({ id: 'no-eta', etaSeconds: null }),
    vehicle({ id: 'nan-eta', etaSeconds: Number.NaN }),
    vehicle({ id: 'none-confidence', etaConfidence: 'NONE' }),
    vehicle({ id: 'not-approaching', approachingBoarding: false }),
    vehicle({ id: 'predicted', etaConfidence: 'PREDICTED', etaSeconds: 60 }),
  ];
  const selected = selectApproachingVehicles(fleet);
  const ids = selected.map(v => v.id);
  assert.deepEqual(ids.sort(), ['ok', 'predicted'].sort());
  assert.ok(!ids.includes('no-eta'));
  assert.ok(!ids.includes('none-confidence'));
  assert.ok(!ids.includes('not-approaching'));
});

test('fleetMotion — emphasized (on-board) leads, the rest sort by ETA, capped at three', () => {
  const fleet = [
    vehicle({ id: 'far', etaSeconds: 300 }),
    vehicle({ id: 'near', etaSeconds: 40 }),
    vehicle({ id: 'onboard', emphasized: true, etaSeconds: 500 }),
    vehicle({ id: 'mid', etaSeconds: 150 }),
    vehicle({ id: 'closest', etaSeconds: 20 }),
  ];
  const selected = selectApproachingVehicles(fleet);
  assert.equal(selected.length, 3, 'never more than three approaching vehicles');
  assert.equal(selected[0]!.id, 'onboard', 'the primary on-board vehicle always leads');
  assert.deepEqual(selected.slice(1).map(v => v.id), ['closest', 'near']);
  // A custom limit is respected.
  assert.equal(selectApproachingVehicles(fleet, 1).length, 1);
  assert.equal(selectApproachingVehicles(fleet, 0).length, 0);
});

test('fleetMotion — projectOntoLine returns the closest arc-length on the real line', () => {
  assert.equal(projectOntoLine([24.02, 49.84], [[24.0, 49.8]]), null);
  // A point north of the eastbound street projects down onto it, before the corner.
  const projection = projectOntoLine([24.0230, 49.8446], LINE);
  assert.ok(projection);
  assert.equal(projection.segmentIndex, 0);
  assert.ok(Math.abs(projection.point[1]! - 49.8436) < 1e-6, 'snaps onto the street latitude');
  assert.ok(projection.meters > 100 && projection.meters < 350);
});

test('fleetMotion — bearingAlongLineAt rotates the marker into the real road direction', () => {
  assert.equal(bearingAlongLineAt([24.02, 49.84], null), null);
  assert.equal(bearingAlongLineAt([24.02, 49.84], [[24.0, 49.8]]), null);
  // On the eastbound stretch the heading is ~90°.
  const east = bearingAlongLineAt([24.0230, 49.8436], LINE);
  assert.ok(east !== null && east > 80 && east < 100, `eastbound ~90°, got ${east}`);
  // Past the corner, on the northbound stretch, the heading is ~0°.
  const north = bearingAlongLineAt([24.0260, 49.8466], LINE);
  assert.ok(north !== null && (north < 10 || north > 350), `northbound ~0°, got ${north}`);
});

test('fleetMotion — interpolateAlongLine rounds the corner instead of cutting the block', () => {
  const from: Coordinate = [24.0210, 49.8436];
  const to: Coordinate = [24.0260, 49.8470];
  const mid = interpolateAlongLine(LINE, from, to, 0.5);
  // Halfway by arc-length the vehicle is near the corner, still on the published line.
  const projection = projectOntoLine(mid.coordinates, LINE);
  assert.ok(projection);
  const offLineMeters = Math.hypot(
    (mid.coordinates[0] - projection.point[0]) * 111_320 * Math.cos(49.84 * Math.PI / 180),
    (mid.coordinates[1] - projection.point[1]) * 110_540,
  );
  assert.ok(offLineMeters < 2, `vehicle stays on the geometry, off by ${offLineMeters}m`);
  assert.ok(Number.isFinite(mid.bearing) && mid.bearing >= 0 && mid.bearing < 360);
  // Endpoints are exact.
  const start = interpolateAlongLine(LINE, from, to, 0);
  const end = interpolateAlongLine(LINE, from, to, 1);
  assert.ok(Math.abs(start.coordinates[0] - from[0]) < 1e-4);
  assert.ok(Math.abs(end.coordinates[1] - to[1]) < 1e-4);
});

test('fleetMotion — without published geometry it falls back to a straight hop with a real bearing', () => {
  const from: Coordinate = [24.0200, 49.8436];
  const to: Coordinate = [24.0260, 49.8436];
  const mid = interpolateAlongLine(null, from, to, 0.5);
  assert.ok(Math.abs(mid.coordinates[0] - 24.0230) < 1e-6);
  assert.ok(mid.bearing > 80 && mid.bearing < 100, 'eastbound bearing on the fallback hop');
});