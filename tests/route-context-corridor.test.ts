import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundsOf, clipToBbox, contextCorridor, corridorFitPoints, type GeoBbox } from '../src/map/routeContextCorridor';

const route = (points: Array<[number, number]>) => points;

test('boundsOf ignores unreadable coordinates instead of producing NaN bounds', () => {
  assert.deepEqual(boundsOf(route([[24.0, 49.8], [24.05, 49.85]])), [24.0, 49.8, 24.05, 49.85]);
  assert.deepEqual(boundsOf(route([[Number.NaN, 49.8], [24.05, 49.85]])), [24.05, 49.85, 24.05, 49.85]);
  assert.equal(boundsOf([]), null);
});

test('the corridor keeps the camera near a short itinerary and caps a long line', () => {
  const short = contextCorridor(route([[24.0, 49.8], [24.01, 49.81]]))!;
  // 0.01 span * 30% is below the floor, so the minimum pad applies on every side.
  assert.equal(short[0], 24.0 - 0.004);
  assert.equal(short[3], 49.81 + 0.004);

  const long = contextCorridor(route([[24.0, 49.8], [24.4, 49.8]]))!;
  assert.equal(long[0], 24.0 - 0.02, 'a 40 km line must not add more than the cap on the west');
  assert.equal(long[2], 24.4 + 0.02, 'a 40 km line must not add more than the cap on the east');
});

test('clipToBbox keeps contiguous runs and never bridges an excluded stretch', () => {
  const corridor: GeoBbox = [0, 0, 10, 10];
  const runs = clipToBbox(route([[1, 1], [2, 2], [3, 3], [40, 40], [50, 50], [4, 4], [5, 5]]), corridor);
  assert.equal(runs.length, 2, 'the excursion outside the corridor must split the line in two');
  // Every run is cut exactly on the corridor edge, so nothing far outside is
  // handed to the camera and the two pieces meet at the same edge point.
  assert.deepEqual(runs[0], [[1, 1], [2, 2], [3, 3], [10, 10]]);
  assert.deepEqual(runs[1], [[10, 10], [4, 4], [5, 5]]);
});

test('a published line that runs far past the ride does not drag the fit across the city', () => {
  const itinerary = route([[24.0, 49.8], [24.02, 49.82], [24.04, 49.83]]);
  // A bus line leaving the city for Briukhovychi and beyond, like A47 does.
  const published = route([[24.0, 49.8], [23.85, 49.95], [23.7, 50.05], [24.04, 49.83]]);
  const fitted = corridorFitPoints(itinerary, [published]);
  const fittedWidth = boundsOf(fitted)![2] - boundsOf(fitted)![0];
  const publishedWidth = boundsOf(published)![2] - boundsOf(published)![0];
  assert.ok(fittedWidth < 0.08, `fit width ${fittedWidth} must stay inside the corridor, not the whole line`);
  assert.ok(fittedWidth < publishedWidth / 3, 'the fit must be driven by the ride, not by the distant tail of the line');
  assert.ok(!fitted.some(point => point[0] < 23.98), 'distant vertices must not reach the fit');
});

test('without context geometry the fit is the itinerary itself', () => {
  const itinerary = route([[24.0, 49.8], [24.02, 49.82]]);
  assert.deepEqual(corridorFitPoints(itinerary, []), itinerary);
});
