import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePolyline6, boundsOf } from '../shared/navigation/geometry';
import type { RouteResult } from '../shared/navigation/contracts';
import { BasicRouteMapMatchingProvider } from '../src/navigation/BasicRouteMapMatchingProvider';

test('basic map matcher projects a GPS fix onto route geometry and returns confidence metadata', async () => {
  const points: [number, number][] = [[24, 49], [24.5, 49.5], [25, 50]];
  const route: RouteResult = {
    id: 'route', provider: 'osrm', geometry: { encoding: 'polyline6', value: encodePolyline6(points) }, bounds: boundsOf(points),
    distanceMeters: 1000, durationSeconds: 100, trafficAware: false, legs: [], maneuvers: [], confidence: 'BASELINE',
    calculatedAt: '2026-09-30T12:00:00Z', routeVersion: 1,
  };
  const fix = { longitude: 24.5, latitude: 49.5001, accuracyMeters: 5, capturedAtClient: '2026-09-30T12:00:00Z', source: 'gps' as const };
  const result = await new BasicRouteMapMatchingProvider().match([fix], { route });
  assert.equal(result.provider, 'route-projection-v1');
  assert.ok(result.confidence > 0.5);
  assert.ok(result.location.distanceFromRouteMeters < 120);
  assert.ok(Math.abs(result.location.latitude - 49.50005) < 0.0002);
});
