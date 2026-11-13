import test from 'node:test';
import assert from 'node:assert/strict';
import { passengerContextLines, passengerZoneFeaturesFor, type TransitZoneGeometry } from '../src/map/transportVisualZones';

const zones: TransitZoneGeometry = {
  boardingShapeIndex: 1, alightingShapeIndex: 2, snapMeters: 0,
  beforeBoarding: [[24, 49], [24.01, 49]],
  passengerSegment: [[24.01, 49], [24.02, 49]],
  afterAlighting: [[24.02, 49], [24.03, 49]],
};

test('focused passenger view draws B only and preserves A/C data', () => {
  assert.deepEqual(passengerZoneFeaturesFor(zones, 'full_route'), [{ zone: 'B', coordinates: zones.passengerSegment }]);
  assert.equal(zones.beforeBoarding?.length, 2);
  assert.equal(zones.afterAlighting?.length, 2);
});

test('focused view does not draw invalid or missing passenger geometry', () => {
  assert.deepEqual(passengerZoneFeaturesFor({ ...zones, passengerSegment: [[24, 49]] }, 'full_route'), []);
  assert.deepEqual(passengerZoneFeaturesFor(null, 'full_route'), []);
});

test('focused camera excludes full routes without a verified passenger slice', () => {
  const full = [[24, 49], [24.03, 49]] as [number, number][];
  assert.deepEqual(passengerContextLines([{ coordinates: full, geometryScope: 'full_route', zones }]), [zones.passengerSegment]);
  assert.deepEqual(passengerContextLines([{ coordinates: full, geometryScope: 'full_route' }]), []);
  assert.deepEqual(passengerContextLines([{ coordinates: zones.passengerSegment, geometryScope: 'leg_only' }]), [zones.passengerSegment]);
});
