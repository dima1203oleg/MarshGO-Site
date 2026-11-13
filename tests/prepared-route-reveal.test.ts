import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareLineProgress } from '../src/map/cinematicRouteEngine';
import type { Coordinate } from '../shared/navigation/contracts';

test('prepared reveal advances by distance across turns and keeps exact anchors', () => {
  const line: Coordinate[] = [[0, 0], [0.001, 0], [0.004, 0], [0.004, 0.003]];
  const sample = prepareLineProgress(line);
  assert.deepEqual(sample(0), [[0, 0]]);
  assert.deepEqual(sample(1), line);
  const mid = sample(0.5);
  assert.equal(mid.length, 3);
  assert.ok(Math.abs(mid[2]![0] - 0.0035) < 1e-7);
  assert.equal(mid[2]![1], 0);
  line[1]![0] = 0.2;
  assert.deepEqual(sample(0), [[0, 0]]);
  assert.equal(sample(0.5)[1]![0], 0.001);
});

test('prepared reveal handles empty, single-point and zero-length paths', () => {
  assert.deepEqual(prepareLineProgress([])(0.5), []);
  assert.deepEqual(prepareLineProgress([[1, 2]])(0.5), [[1, 2]]);
  assert.deepEqual(prepareLineProgress([[1, 2], [1, 2]])(0.5), [[1, 2], [1, 2]]);
});
