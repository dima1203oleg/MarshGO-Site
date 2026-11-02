import assert from 'node:assert/strict';
import test from 'node:test';
import type { Coordinate } from '../shared/navigation/contracts';
import { extentMeters, principalBearing } from '../src/map/routeCameraFocus';

const line = (points: Array<[number, number]>): Coordinate[] => points;

const close = (actual: number, expected: number, tolerance = 0.5) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance}° of ${expected}°`);

test('a northbound leg points at 0° so it runs up the screen', () => {
  close(principalBearing(line([[24.0, 49.8], [24.0, 49.82], [24.0, 49.85]]))!, 0);
});

test('an eastbound leg points at 90° and its reverse at 270°, always along travel', () => {
  const west = line([[24.0, 49.8], [24.02, 49.8], [24.04, 49.8]]);
  const east = [...west].reverse();
  close(principalBearing(west)!, 90);
  close(principalBearing(east)!, 270);
});

test('the principal axis of a wiggly leg is not thrown off by one stray vertex', () => {
  const points = line([[24.0, 49.8], [24.0005, 49.82], [23.9995, 49.84], [24.001, 49.87]]);
  close(principalBearing(points)!, 0, 6);
});

test('a degenerate or empty leg has no bearing to rotate to', () => {
  assert.equal(principalBearing([]), null);
  assert.equal(principalBearing(line([[24.0, 49.8]])), null);
  assert.equal(principalBearing(line([[24.0, 49.8], [24.0, 49.8]])), null);
});

test('extent is measured in metres, not degrees', () => {
  const walk = extentMeters(line([[24.0, 49.8], [24.0, 49.8]]));
  assert.equal(walk, 0);
  const kilometre = extentMeters(line([[24.0, 49.8], [24.0145, 49.8]]));
  assert.ok(kilometre > 1000 && kilometre < 1100, `expected about 1055 m, got ${kilometre}`);
});
