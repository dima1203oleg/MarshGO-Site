import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distanceMetersBetween, isFollowableQuality, nearestStopTo } from '../src/map/transportLayers';
import type { GeoJsonCollection } from '../src/services/productionApi';

const stopsWith = (items: Array<{ name: string; geometry: { type: string; coordinates: unknown[] } }>): GeoJsonCollection => ({
  type: 'FeatureCollection',
  features: items.map((item) => ({ type: 'Feature', properties: { name: item.name }, geometry: item.geometry })),
});

const point = (coordinates: [number, number]) => ({ type: 'Point', coordinates });

test('v41: only live and estimated positions can be followed', () => {
  assert.equal(isFollowableQuality('live'), true);
  assert.equal(isFollowableQuality('estimated'), true);
  // A timetable dot or an expired fix is not a moving position, so offering «Стежити» would be a lie.
  assert.equal(isFollowableQuality('scheduled'), false);
  assert.equal(isFollowableQuality('stale'), false);
  assert.equal(isFollowableQuality(undefined), false);
});

test('v41: nearest stop picks the great-circle winner and reports metres', () => {
  const stops = stopsWith([
    { name: 'Далека', geometry: point([24.10, 49.90]) },
    { name: 'Академічна', geometry: point([23.99, 49.80]) },
    { name: 'Інша', geometry: point([24.03, 49.84]) },
  ]);
  const nearest = nearestStopTo(stops, [23.995, 49.805]);
  assert.ok(nearest);
  assert.equal(nearest.name, 'Академічна');
  assert.ok(nearest.distanceMeters > 40 && nearest.distanceMeters < 700, `expected a few hundred metres, got ${nearest.distanceMeters}`);
  assert.deepEqual(nearest.coordinates, [23.99, 49.80]);
});

test('v41: an empty or non-point stop layer yields no nearest stop', () => {
  assert.equal(nearestStopTo({ type: 'FeatureCollection', features: [] }, [24, 49.8]), null);
  assert.equal(nearestStopTo(stopsWith([{ name: 'Лінія', geometry: { type: 'LineString', coordinates: [[24, 49.8]] } }]), [24, 49.8]), null);
});

test('v41: distance is symmetric and zero on the same point', () => {
  assert.equal(distanceMetersBetween([24.03, 49.84], [24.03, 49.84]), 0);
  const a = distanceMetersBetween([24.03, 49.84], [23.99, 49.80]);
  const b = distanceMetersBetween([23.99, 49.80], [24.03, 49.84]);
  assert.ok(Math.abs(a - b) < 1, `${a} vs ${b}`);
});
