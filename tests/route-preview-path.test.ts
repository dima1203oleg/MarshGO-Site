import assert from 'node:assert/strict';
import test from 'node:test';
import {
  distanceBetweenCoordinates,
  nearestRoutePreviewDistance,
  prepareRoutePreviewPath,
  reverseRoutePreviewPath,
  routePreviewAnchorsMatch,
  routePreviewDurationMs,
  routePreviewEasedProgress,
  sampleRoutePreviewPath,
  sliceRoutePreviewPath,
} from '../src/map/routePreviewPath';

const bentRoute = [[24, 49], [24.001, 49], [24.001, 49.001]] as const;

test('path preparation measures the road vertices and removes duplicate points', () => {
  const path = prepareRoutePreviewPath([[24, 49], [24, 49], [24.001, 49], [24.001, 49.001]]);
  assert.ok(path);
  assert.equal(path.coordinates.length, 3);
  assert.ok(path.totalMeters > 180 && path.totalMeters < 230);
  assert.equal(path.turnCount, 1);
});

test('malformed geometry and long unverified jumps never become a fly-through path', () => {
  assert.equal(prepareRoutePreviewPath([[24, 49]]), null);
  assert.equal(prepareRoutePreviewPath([[24, 49], [181, 49]]), null);
  assert.equal(prepareRoutePreviewPath([[24, 49], [25, 49]]), null);
  assert.equal(prepareRoutePreviewPath([[24, 49], [26, 49]], 120_000), null);
});

test('distance and sampling stay geographically correct across the antimeridian', () => {
  const distance = distanceBetweenCoordinates([179.999, 0], [-179.999, 0]);
  assert.ok(distance < 250);
  const path = prepareRoutePreviewPath([[179.999, 0], [-179.999, 0]], 500);
  assert.ok(path);
  const middle = sampleRoutePreviewPath(path, path.totalMeters / 2).coordinate;
  assert.ok(Math.abs(Math.abs(middle[0]) - 180) < 0.001);
});

test('route sampling lands exactly at both anchors and preserves the real corner', () => {
  const path = prepareRoutePreviewPath(bentRoute);
  assert.ok(path);
  assert.deepEqual(sampleRoutePreviewPath(path, 0).coordinate, bentRoute[0]);
  assert.deepEqual(sampleRoutePreviewPath(path, path.totalMeters).coordinate, bentRoute[2]);
  const atCorner = sampleRoutePreviewPath(path, path.cumulativeMeters[1]!);
  assert.deepEqual(atCorner.coordinate, bentRoute[1]);
  assert.equal(atCorner.segmentIndex, 1);
});

test('route slices follow source vertices without drawing a shortcut across a corner', () => {
  const path = prepareRoutePreviewPath(bentRoute);
  assert.ok(path);
  assert.deepEqual(sliceRoutePreviewPath(path, 0, path.totalMeters), bentRoute);
});

test('route docking requires the confirmed geometry to meet both segment anchors', () => {
  const path = prepareRoutePreviewPath(bentRoute);
  assert.ok(path);
  assert.equal(routePreviewAnchorsMatch(path, bentRoute[0]!, bentRoute[2]!), true);
  assert.equal(routePreviewAnchorsMatch(path, bentRoute[0]!, [24.002, 49.001]), false);
});

test('reverse preview follows the same source geometry in reverse and finds the visible start', () => {
  const path = prepareRoutePreviewPath(bentRoute);
  assert.ok(path);
  const reversed = reverseRoutePreviewPath(path);
  assert.ok(reversed);
  assert.deepEqual(reversed.coordinates, [...bentRoute].reverse());
  assert.deepEqual(sampleRoutePreviewPath(reversed, 0).coordinate, bentRoute[2]);
  const distance = nearestRoutePreviewDistance(path, [24.0005, 49]);
  assert.ok(distance > 25 && distance < 50);
});

test('cinematic progress accelerates, cruises, and decelerates monotonically', () => {
  const values = Array.from({ length: 101 }, (_, index) => routePreviewEasedProgress(index / 100));
  assert.equal(values[0], 0);
  assert.equal(values.at(-1), 1);
  assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]!));
  assert.ok(values[18]! < 0.13);
  assert.ok(values[50]! > 0.45 && values[50]! < 0.55);
  assert.ok(values[82]! > 0.87 && values[82]! < 0.9);
});

test('duration adapts to route length and corner complexity and honors reduced motion', () => {
  const short = prepareRoutePreviewPath([[24, 49], [24.0001, 49]]);
  const bent = prepareRoutePreviewPath(bentRoute);
  const long = prepareRoutePreviewPath([[24, 49], [24.02, 49]], 2_000);
  assert.ok(short && bent && long);
  assert.ok(routePreviewDurationMs(bent) > routePreviewDurationMs(short));
  assert.ok(routePreviewDurationMs(long) > routePreviewDurationMs(bent));
  assert.equal(routePreviewDurationMs(long, true), 0);
});
