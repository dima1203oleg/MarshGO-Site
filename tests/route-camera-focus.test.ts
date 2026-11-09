import assert from 'node:assert/strict';
import test from 'node:test';
import type { Coordinate } from '../shared/navigation/contracts';
import { cameraForRotatedPoints, extentMeters, maximizeFitBearing, principalBearing, segmentBearingForViewport, shortestBearingDelta, cameraMoveEffort, SEGMENT_FOCUS_MAX_ZOOM } from '../src/map/routeCameraFocus';

const line = (points: Array<[number, number]>): Coordinate[] => points;

const mercator = ([lng, lat]: Coordinate): [number, number] => {
  const sin = Math.sin(lat * Math.PI / 180);
  return [(lng + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)];
};

const rotatedSpan = (points: readonly Coordinate[], camera: { center: Coordinate; zoom: number }, bearing: number) => {
  const angle = -bearing * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const worldSize = 512 * 2 ** camera.zoom;
  const [cx, cy] = mercator(camera.center);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const point of points) {
    const [x, y] = mercator(point);
    const dx = x - cx;
    const dy = y - cy;
    xs.push((dx * cos - dy * sin) * worldSize);
    ys.push((dx * sin + dy * cos) * worldSize);
  }
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    centerX: (Math.max(...xs) + Math.min(...xs)) / 2,
    centerY: (Math.max(...ys) + Math.min(...ys)) / 2,
  };
};

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

test('a wide, short map band turns the leg across the screen instead of up it', () => {
  // Tall band before the sheet rises: the travel direction points up the screen.
  close(segmentBearingForViewport(0, 360, 600), 0);
  // Expanded sheet leaves 390×88: northbound travel becomes eastbound on screen.
  close(segmentBearingForViewport(0, 390, 88), 270);
  close(segmentBearingForViewport(90, 390, 88), 0);
  close(segmentBearingForViewport(270, 390, 88), 180);
});

test('an unknown or degenerate bearing stays north and never rotates the camera', () => {
  assert.equal(segmentBearingForViewport(null, 390, 88), 0);
  assert.equal(segmentBearingForViewport(Number.NaN, 390, 88), 0);
});

test('a rotated fit fills the wide strip with the leg itself, not its rotated bounding box', () => {
  const diagonal = line([[24.0, 49.8], [24.004, 49.806], [24.01, 49.81]]);
  const travel = principalBearing(diagonal)!;
  const bearing = segmentBearingForViewport(travel, 350, 118);
  const camera = cameraForRotatedPoints(diagonal, bearing, 350, 118, 12, 17);
  assert.ok(camera, 'a two-point leg must produce a camera');

  const span = rotatedSpan(diagonal, camera, bearing);
  // The leg spans the whole padded strip and stays inside its short edge.
  assert.ok(span.width > 345 && span.width <= 350.5, `leg should span ~350 px, got ${span.width}`);
  assert.ok(span.height <= 118.5, `leg must stay inside the 118 px band, got ${span.height}`);
  assert.ok(Math.abs(span.centerX) < 0.5 && Math.abs(span.centerY) < 0.5, 'the leg is centred in the strip');
  // The centre is a point of the leg, not the far corner of a rotated envelope.
  assert.ok(camera.center[0] > 23.999 && camera.center[0] < 24.011);
  assert.ok(camera.center[1] > 49.799 && camera.center[1] < 49.811);
});

test('turning the leg across a short band earns zoom that the north-up fit cannot reach', () => {
  const diagonal = line([[24.0, 49.8], [24.004, 49.806], [24.01, 49.81]]);
  const travel = principalBearing(diagonal)!;
  const horizontal = cameraForRotatedPoints(diagonal, segmentBearingForViewport(travel, 350, 118), 350, 118, 12, 17);
  const northUp = cameraForRotatedPoints(diagonal, 0, 350, 118, 12, 17);
  assert.ok(horizontal && northUp);
  assert.ok(horizontal.zoom > northUp.zoom + 1, `rotated ${horizontal.zoom} should beat north-up ${northUp.zoom}`);
  const northSpan = rotatedSpan(diagonal, northUp, 0);
  assert.ok(northSpan.height > 117 && northSpan.height <= 118.5, `north-up leg should fill the band height, got ${northSpan.height}`);
  assert.ok(northSpan.width < 300, 'north-up leaves most of the strip width unused');
});

test('segment focus optimizes diagonal as well as cardinal rotations for the visible rectangle', () => {
  const bent = line([
    [24.000, 49.800], [24.004, 49.801], [24.006, 49.807],
    [24.012, 49.810], [24.019, 49.814], [24.021, 49.821],
  ]);
  const width = 390;
  const height = 648;
  const preferred = segmentBearingForViewport(principalBearing(bent), width, height);
  const optimized = maximizeFitBearing(bent, width, height, preferred);
  const optimizedCamera = cameraForRotatedPoints(bent, optimized, width, height, 0, SEGMENT_FOCUS_MAX_ZOOM)!;
  const preferredCamera = cameraForRotatedPoints(bent, preferred, width, height, 0, SEGMENT_FOCUS_MAX_ZOOM)!;

  let oracleZoom = Number.NEGATIVE_INFINITY;
  for (let bearing = 0; bearing < 180; bearing += 0.5) {
    oracleZoom = Math.max(oracleZoom, cameraForRotatedPoints(bent, bearing, width, height, 0, SEGMENT_FOCUS_MAX_ZOOM)!.zoom);
  }
  assert.ok(optimizedCamera.zoom >= oracleZoom - 0.02,
    `optimized zoom ${optimizedCamera.zoom} should be near exhaustive best ${oracleZoom}`);
  assert.ok(optimizedCamera.zoom >= preferredCamera.zoom - 0.02,
    'the optimized view must be no worse than the prior viewport heuristic');
});

test('a rotated fit refuses degenerate input instead of zooming to infinity', () => {
  assert.equal(cameraForRotatedPoints([], 0, 350, 118, 12, 17), null);
  assert.equal(cameraForRotatedPoints(line([[24.0, 49.8]]), 0, 350, 118, 12, 17), null);
  assert.equal(cameraForRotatedPoints(line([[24.0, 49.8], [24.01, 49.81]]), 0, 0, 118, 12, 17), null);
  assert.equal(cameraForRotatedPoints(line([[24.0, 49.8], [24.01, 49.81]]), Number.NaN, 350, 118, 12, 17), null);
});

test('extent is measured in metres, not degrees', () => {
  const walk = extentMeters(line([[24.0, 49.8], [24.0, 49.8]]));
  assert.equal(walk, 0);
  const kilometre = extentMeters(line([[24.0, 49.8], [24.0145, 49.8]]));
  assert.ok(kilometre > 1000 && kilometre < 1100, `expected about 1055 m, got ${kilometre}`);
});

test('shortest bearing delta takes the small arc across north', () => {
  assert.equal(shortestBearingDelta(350, 10), 20);
  assert.equal(shortestBearingDelta(10, 350), 20);
  assert.equal(shortestBearingDelta(0, 180), 180);
  assert.equal(shortestBearingDelta(90, 90), 0);
  assert.equal(shortestBearingDelta(Number.NaN, 10), 0);
});

test('camera move effort reports distance, zoom and turn from the current pose', () => {
  const current = { center: line([[24.0, 49.8]])[0]!, zoom: 12, bearing: 0 };
  const effort = cameraMoveEffort(current, { center: [24.0145, 49.8], zoom: 15, bearing: 90 });
  assert.ok(effort.distanceMeters! > 1000 && effort.distanceMeters! < 1100, `expected ~1055 m, got ${effort.distanceMeters}`);
  assert.equal(effort.zoomDelta, 3);
  assert.equal(effort.bearingDelta, 90);
});

test('missing target fields contribute zero effort instead of NaN', () => {
  const current = { center: line([[24.0, 49.8]])[0]!, zoom: 12, bearing: 30 };
  const effort = cameraMoveEffort(current, {});
  assert.equal(effort.distanceMeters, 0);
  assert.equal(effort.zoomDelta, 0);
  assert.equal(effort.bearingDelta, 0);
  const zoomOnly = cameraMoveEffort(current, { zoom: 16 });
  assert.equal(zoomOnly.distanceMeters, 0);
  assert.equal(zoomOnly.zoomDelta, 4);
});
