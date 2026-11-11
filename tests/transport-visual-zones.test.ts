import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VEHICLE_PRIORITY_TOKENS,
  ZONE_GLOW_TOKENS,
  ZONE_LINE_TOKENS,
  priorityLevelOf,
  zoneArrowsFor,
  zoneFeaturesFor,
} from '../src/map/transportVisualZones';

const eastward = [[24.0, 49.84], [24.01, 49.84], [24.02, 49.84], [24.03, 49.84]] as const;
const coordinates = (count: number, step = 0.01): Array<[number, number]> => Array.from({ length: count }, (_, index) => [24 + index * step, 49.84]);

test('the three zones are slices of the same published line and keep their order', () => {
  const line: Array<[number, number]> = [[24, 49.84], [24.01, 49.84], [24.02, 49.84], [24.03, 49.84]];
  const features = zoneFeaturesFor({
    boardingShapeIndex: 1,
    alightingShapeIndex: 2,
    beforeBoarding: line.slice(0, 2),
    passengerSegment: line.slice(1, 3),
    afterAlighting: line.slice(2),
    snapMeters: 12,
  }, 'full_route');
  assert.deepEqual(features.map(feature => feature.zone), ['A', 'B', 'C']);
  const [zoneA, zoneB, zoneC] = features.map(feature => feature.coordinates);
  assert.deepEqual([...zoneA!, ...zoneB!.slice(1), ...zoneC!.slice(1)], line);
});

test('a leg-only fallback never invents pre-boarding or post-alighting geometry', () => {
  const features = zoneFeaturesFor({
    boardingShapeIndex: 0,
    alightingShapeIndex: 3,
    beforeBoarding: null,
    passengerSegment: coordinates(4),
    afterAlighting: null,
    snapMeters: 0,
  }, 'leg_only');
  assert.deepEqual(features.map(feature => feature.zone), ['B']);
  assert.equal(features[0]!.coordinates.length, 4);
});

test('a zone shorter than two points is not drawn at all', () => {
  const features = zoneFeaturesFor({
    boardingShapeIndex: 0,
    alightingShapeIndex: 1,
    beforeBoarding: null,
    passengerSegment: coordinates(3),
    afterAlighting: [[24.03, 49.84]],
    snapMeters: 4,
  }, 'full_route');
  assert.deepEqual(features.map(feature => feature.zone), ['B']);
});

test('a malformed passenger slice suppresses the zone ribbon instead of drawing a broken A/C fragment', () => {
  const features = zoneFeaturesFor({
    boardingShapeIndex: 1,
    alightingShapeIndex: 2,
    beforeBoarding: [[24, 49.84], [24.01, 49.84]],
    passengerSegment: [[24.01, 49.84], [200, 49.85], [24.02, 49.84]],
    afterAlighting: [[24.02, 49.84], [24.03, 49.84]],
    snapMeters: 3,
  }, 'full_route');
  assert.deepEqual(features, []);
});

test('zone tokens keep the ride line dominant over context zones', () => {
  assert.ok(ZONE_LINE_TOKENS.A.width[1] < ZONE_LINE_TOKENS.B.width[1]);
  assert.ok(ZONE_LINE_TOKENS.C.width[1] < ZONE_LINE_TOKENS.A.width[1]);
  assert.ok(ZONE_LINE_TOKENS.C.opacity < ZONE_LINE_TOKENS.A.opacity);
  assert.equal(ZONE_LINE_TOKENS.B.opacity, 1);
  assert.ok(ZONE_LINE_TOKENS.B.width[1] <= 8, 'passenger route stays within a crisp 6–8 px focus stroke');
  assert.ok(ZONE_GLOW_TOKENS.width[1] <= 12);
  assert.ok(ZONE_GLOW_TOKENS.opacity <= 0.2);
  assert.ok(ZONE_GLOW_TOKENS.blur <= 3);
});

test('direction chevrons point along the travel order of the geometry, not screen left-to-right', () => {
  const eastwardArrows = zoneArrowsFor([{ zone: 'B', coordinates: eastward.map(([lon, lat]) => [lon, lat] as [number, number]) }]);
  assert.ok(eastwardArrows.length >= 1);
  for (const arrow of eastwardArrows) assert.ok(arrow.bearingDegrees > 80 && arrow.bearingDegrees < 100);

  const reversed = [...eastward].reverse().map(([lon, lat]) => [lon, lat] as [number, number]);
  const westwardArrows = zoneArrowsFor([{ zone: 'B', coordinates: reversed }]);
  for (const arrow of westwardArrows) assert.ok(arrow.bearingDegrees > 260 && arrow.bearingDegrees < 280);
});

test('a short zone gets no chevron so the map stays quiet', () => {
  const short: Array<[number, number]> = [[24.0, 49.84], [24.0005, 49.84]];
  assert.deepEqual(zoneArrowsFor([{ zone: 'A', coordinates: short }]), []);
});

test('vehicle priority comes from the server, with the pre-priority contract as fallback', () => {
  assert.equal(priorityLevelOf({ priority: { level: 'L4', reason: 'at_boarding_stop' } }), 'L4');
  assert.equal(priorityLevelOf({ priority: { level: 'L0', reason: 'stale_position' }, emphasized: true }), 'L0');
  assert.equal(priorityLevelOf({ emphasized: true }), 'L2');
  assert.equal(priorityLevelOf({ emphasized: false }), 'L1');
  assert.equal(priorityLevelOf({}), 'L1');
});

test('priority tokens make closer-to-boarding vehicles visibly more active', () => {
  const levels = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
  for (let index = 1; index < levels.length; index += 1) {
    const lower = VEHICLE_PRIORITY_TOKENS[levels[index - 1]!];
    const higher = VEHICLE_PRIORITY_TOKENS[levels[index]!];
    assert.ok(higher.radius >= lower.radius, `${levels[index]} radius`);
    assert.ok(higher.opacity >= lower.opacity, `${levels[index]} opacity`);
  }
  assert.equal(VEHICLE_PRIORITY_TOKENS.L0.haloRadius, 0);
  assert.ok(VEHICLE_PRIORITY_TOKENS.L4.haloRadius > VEHICLE_PRIORITY_TOKENS.L2.haloRadius);
});
