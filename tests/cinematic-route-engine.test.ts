import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceMeters,
  interpolateLineProgress,
  generateSmartStepSummary,
  calculateCalloutAnchor,
  calloutIconType,
  cleanStopName,
  type JourneyLeg,
} from '../src/map/cinematicRouteEngine';

test('cinematic route engine — distanceMeters calculates great-circle distance accurately', () => {
  // Lviv Opera House [24.0255, 49.8436] to Lviv Railway Station [23.9950, 49.8356]
  const dist = distanceMeters([24.0255, 49.8436], [23.9950, 49.8356]);
  assert.ok(dist > 2000 && dist < 3000, `Expected ~2.3km, got ${dist}`);

  // Zero distance for identical point
  assert.equal(distanceMeters([24.0, 50.0], [24.0, 50.0]), 0);
});

test('cinematic route engine — interpolateLineProgress handles fractional distance', () => {
  const line: [number, number][] = [
    [24.0, 50.0],
    [24.0, 50.1],
    [24.0, 50.2],
  ];

  // 0% returns first point
  assert.deepEqual(interpolateLineProgress(line, 0), [[24.0, 50.0]]);

  // 100% returns full line
  assert.deepEqual(interpolateLineProgress(line, 1), line);

  // 50% returns first point and midpoint
  const mid = interpolateLineProgress(line, 0.5);
  assert.equal(mid.length, 2);
  assert.equal(mid[0]![0], 24.0);
  assert.equal(mid[0]![1], 50.0);
  assert.ok(Math.abs(mid[1]![1] - 50.1) < 0.001);

  // Handles single point or empty array safely
  assert.deepEqual(interpolateLineProgress([], 0.5), []);
  assert.deepEqual(interpolateLineProgress([[24.0, 50.0]], 0.5), [[24.0, 50.0]]);
});

test('cinematic route engine — calloutIconType maps modes properly', () => {
  const walkLeg: Partial<JourneyLeg> = { mode: 'WALK' };
  assert.equal(calloutIconType(walkLeg as JourneyLeg), 'walk');

  const tramLeg: Partial<JourneyLeg> = { mode: 'TRANSIT', transportType: 'tram' };
  assert.equal(calloutIconType(tramLeg as JourneyLeg), 'tram');

  const trolleyLeg: Partial<JourneyLeg> = { mode: 'TRANSIT', transportType: 'trolleybus' };
  assert.equal(calloutIconType(trolleyLeg as JourneyLeg), 'trolleybus');

  const busLeg: Partial<JourneyLeg> = { mode: 'TRANSIT', transportType: 'bus' };
  assert.equal(calloutIconType(busLeg as JourneyLeg), 'bus');
});

test('cinematic route engine — generateSmartStepSummary creates clear Ukrainian narrative', () => {
  const walkLeg: JourneyLeg = {
    id: 'leg-1',
    mode: 'WALK',
    durationSeconds: 180,
    distanceMeters: 220,
    origin: { name: 'Готель Жорж', coordinates: [24.03, 49.838] },
    destination: { name: 'пл. Митна', coordinates: [24.035, 49.839] },
    departureAt: '2026-11-05T10:00:00Z',
    arrivalAt: '2026-11-05T10:03:00Z',
  };

  const transitLeg: JourneyLeg = {
    id: 'leg-2',
    mode: 'TRANSIT',
    transportType: 'tram',
    routeName: 'Трамвай 2',
    durationSeconds: 900,
    origin: { name: 'пл. Митна', coordinates: [24.035, 49.839] },
    destination: { name: 'вул. Коновальця', coordinates: [24.0, 49.82] },
    stops: [
      { id: 's1', name: 'пл. Митна' },
      { id: 's2', name: 'вул. Зелена' },
      { id: 's3', name: 'вул. Коновальця' },
    ],
    departureAt: '2026-11-05T10:05:00Z',
    arrivalAt: '2026-11-05T10:20:00Z',
  };

  // Walk with next transit leg
  const walkSummary = generateSmartStepSummary(walkLeg, transitLeg);
  assert.equal(walkSummary.headline, 'Піший перехід до посадки');
  assert.ok(walkSummary.narrative.includes('Пройдіть 220 м (3 хв)'));
  assert.ok(walkSummary.narrative.includes('Трамвай 2'));

  // Transit leg
  const transitSummary = generateSmartStepSummary(transitLeg);
  assert.equal(transitSummary.headline, 'Поїздка: Трамвай 2');
  assert.ok(transitSummary.narrative.includes('3 зупинок'));
  assert.ok(transitSummary.narrative.includes('15 хв'));
});

test('cinematic route engine — calculateCalloutAnchor keeps callout in visible window', () => {
  const anchor = calculateCalloutAnchor(
    200, // screenX
    300, // screenY
    390, // viewWidth
    844, // viewHeight
    320, // sheetHeight
    84,  // topHudHeight
    180, // calloutWidth
    60   // calloutHeight
  );

  assert.ok(anchor.left >= 12);
  assert.ok(anchor.left + 180 <= 390 - 12);
  assert.ok(anchor.top >= 84 + 12);
  assert.ok(anchor.top + 60 <= 844 - 320 - 12);
});

test('cinematic route engine — cleanStopName strips database IDs and suffixes', () => {
  assert.equal(cleanStopName('Львівська політехніка (64)'), 'Львівська політехніка');
  assert.equal(cleanStopName('Залізничний вокзал (117)'), 'Залізничний вокзал');
  assert.equal(cleanStopName('вул. Степана Бандери, 12'), 'вул. Степана Бандери');
  assert.equal(cleanStopName('Центр (зупинка)'), 'Центр');
  assert.equal(cleanStopName(''), '');
});
