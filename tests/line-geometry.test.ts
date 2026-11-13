import assert from 'node:assert/strict';
import test from 'node:test';
import { interpolateGreatCircle, lineMidpointByDistance, sanitizeLineCoordinates } from '../src/map/lineGeometry';

test('rejects a LineString with any invalid vertex instead of bridging across the bad point', () => {
  assert.deepEqual(sanitizeLineCoordinates([[24, 49.8], [200, 49.81], [24.02, 49.82]]), []);
  assert.deepEqual(sanitizeLineCoordinates([[24, 49.8], [24.01, Number.NaN]]), []);
});

test('removes only exact consecutive duplicate vertices without mutating provider geometry', () => {
  const input: [number, number][] = [[24, 49.8], [24, 49.8], [24.01, 49.81], [24.01, 49.81]];
  const original = structuredClone(input);
  assert.deepEqual(sanitizeLineCoordinates(input), [[24, 49.8], [24.01, 49.81]]);
  assert.deepEqual(input, original);
  assert.deepEqual(sanitizeLineCoordinates([[24, 49.8], [24, 49.8]]), []);
});

test('places a line label at half the real ground distance, not half the coordinate degrees', () => {
  const midpoint = lineMidpointByDistance([[0, 60], [0.01, 60], [0.01, 60.01]]);
  assert.ok(midpoint);
  assert.ok(Math.abs(midpoint[0] - 0.01) < 0.00001);
  assert.ok(midpoint[1] > 60.002 && midpoint[1] < 60.003);
});

test('interpolates across the antimeridian along the short great-circle arc', () => {
  const midpoint = interpolateGreatCircle([179, 0], [-179, 0], 0.5);
  assert.ok(Math.abs(Math.abs(midpoint[0]) - 180) < 0.000001);
  assert.ok(Math.abs(midpoint[1]) < 0.000001);
});
