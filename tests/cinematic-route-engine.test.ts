import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CALLOUT_EXIT_MS,
  CALLOUT_GAP_PX,
  CALLOUT_MIN_BAND_PX,
  CALLOUT_SIZE,
  CALLOUT_VISIBLE_MS,
  distanceMeters,
  interpolateLineProgress,
  generateSmartStepSummary,
  calculateCalloutAnchor,
  calloutIconType,
  calloutVisibleBand,
  cleanStopName,
  layoutCallouts,
  type CinematicCallout,
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

test('cinematic route engine — callouts stay off the expanded sheet and hide when no strip is left', () => {
  // Expanded sheet on a 844 px viewport leaves an 88 px map strip under the top HUD.
  const strip = calloutVisibleBand(844, 672, 84);
  assert.equal(strip, 88);
  assert.ok(strip >= CALLOUT_MIN_BAND_PX, `expected the ${strip} px strip to fit a callout`);

  // A sheet tall enough to consume the strip (e.g. mid-gesture) removes the hints
  // instead of painting them over the sheet.
  assert.ok(calloutVisibleBand(844, 760, 84) < CALLOUT_MIN_BAND_PX);
  assert.ok(calloutVisibleBand(844, 844, 84) < CALLOUT_MIN_BAND_PX);
  // Degenerate input must not produce NaN and keep the overlay hidden.
  assert.equal(calloutVisibleBand(Number.NaN, Number.NaN, Number.NaN), 0);
});

test('cinematic route engine — a compact callout never crosses the live sheet edge', () => {
  const viewHeight = 844;
  const sheetHeight = 672;
  const sheetTop = viewHeight - sheetHeight;

  // Every projected anchor (including one far below the strip) must clamp above the sheet.
  for (const screenY of [110, 260, 520, 1_200]) {
    const anchor = calculateCalloutAnchor(
      200,
      screenY,
      390,
      viewHeight,
      sheetHeight,
      84,
      CALLOUT_SIZE.width,
      CALLOUT_SIZE.height,
    );
    assert.ok(anchor.top >= 84 + 12, `callout top ${anchor.top} must clear the top HUD`);
    assert.ok(
      anchor.top + CALLOUT_SIZE.height <= sheetTop - 12,
      `callout bottom ${anchor.top + CALLOUT_SIZE.height} must stay above the sheet at ${sheetTop}`,
    );
    assert.ok(anchor.left >= 12);
    assert.ok(anchor.left + CALLOUT_SIZE.width <= 390 - 12);
  }
});

test('cinematic route engine — hints live two seconds then dissolve slowly in sync with --mg-dur-dissolve', () => {
  assert.equal(CALLOUT_VISIBLE_MS, 2000);
  // Owner requirement: hints must fade out slowly, not vanish within one motion step.
  assert.equal(CALLOUT_EXIT_MS, 900);
  const css = readFileSync('src/index.css', 'utf8');
  const token = css.match(/--mg-dur-dissolve:\s*(\d+)ms/);
  assert.ok(token, '--mg-dur-dissolve має бути оголошений у src/index.css');
  assert.equal(Number(token[1]), CALLOUT_EXIT_MS, 'JS-таймер видалення і CSS-перехід мають збігатися до мілісекунди');
});

test('cinematic route engine — callout layer paints below the sheet, clips at its top edge, and fades with the dissolve token', () => {
  const css = readFileSync('src/index.css', 'utf8');
  const zOf = (name: string) => Number(css.match(new RegExp(`${name}:\\s*(\\d+)`))?.[1]);
  assert.ok(zOf('--mg-z-control') < zOf('--mg-z-sticky'), 'шар підказок має бути нижче шторки в стеку');

  const source = readFileSync('src/views/GlassGuidanceCallouts.tsx', 'utf8');
  assert.match(source, /z-\[var\(--mg-z-control\)\]/, 'шар підказок використовує z нижче шторки');
  assert.doesNotMatch(source, /z-\[var\(--mg-z-map-control\)\]/, 'старе z поверх шторки заборонене');
  assert.match(source, /bottom:\s*viewport\.sheetHeight/, 'шар обрізається по верхньому краю губи');
  assert.match(source, /duration-\[var\(--mg-dur-dissolve\)\]/, 'затухання використовує повільний токен');
  assert.match(source, /ease-\[var\(--mg-ease-dissolve\)\]/, 'затухання використовує симетричну повільну криву');
  assert.match(css, /--mg-ease-dissolve:\s*cubic-bezier\(/, 'крива затухання оголошена токеном');
});

test('cinematic route engine — cleanStopName strips database IDs and suffixes', () => {
  assert.equal(cleanStopName('Львівська політехніка (64)'), 'Львівська політехніка');
  assert.equal(cleanStopName('Залізничний вокзал (117)'), 'Залізничний вокзал');
  assert.equal(cleanStopName('вул. Степана Бандери, 12'), 'вул. Степана Бандери');
  assert.equal(cleanStopName('Центр (зупинка)'), 'Центр');
  assert.equal(cleanStopName(''), '');
});

function hint(type: CinematicCallout['type'], id: string, x: number, y: number): CinematicCallout {
  return {
    id,
    type,
    coordinates: [24.02, 49.84],
    title: type,
    subtitle: 'тест',
    accentColor: '#91A6BB',
    iconType: 'pin',
    stage: 'enter',
    screenPos: { x, y },
  };
}

function rectsOverlap(
  a: { left: number; top: number },
  b: { left: number; top: number },
): boolean {
  return a.left < b.left + CALLOUT_SIZE.width + CALLOUT_GAP_PX
    && b.left < a.left + CALLOUT_SIZE.width + CALLOUT_GAP_PX
    && a.top < b.top + CALLOUT_SIZE.height + CALLOUT_GAP_PX
    && b.top < a.top + CALLOUT_SIZE.height + CALLOUT_GAP_PX;
}

test('callout layout — negative control: raw anchors stack same-coordinate hints on top of each other', () => {
  const alighting = calculateCalloutAnchor(195, 130, 390, 844, 672, 84, CALLOUT_SIZE.width, CALLOUT_SIZE.height);
  const transfer = calculateCalloutAnchor(195, 130, 390, 844, 672, 84, CALLOUT_SIZE.width, CALLOUT_SIZE.height);
  assert.deepEqual(alighting, transfer);
  assert.ok(rectsOverlap(alighting, transfer), 'the unlayouted anchors must overlap, otherwise this control proves nothing');
});

test('callout layout — expanded 88 px strip keeps one priority hint, never a stack over the sheet', () => {
  const viewport = { width: 390, height: 844, sheetHeight: 672, topHudHeight: 84 };
  const callouts = [
    hint('BOARDING', 'b', 120, 150),
    hint('ALIGHTING', 'a', 195, 130),
    hint('TRANSFER', 't', 195, 130),
  ];
  const placed = layoutCallouts(callouts, viewport);
  assert.equal(placed.length, 1, `expected one card in the ${calloutVisibleBand(844, 672, 84)} px strip, got ${placed.length}`);
  assert.equal(placed[0]!.callout.type, 'TRANSFER');
  assert.ok(placed[0]!.top >= 96);
  assert.ok(placed[0]!.top + CALLOUT_SIZE.height <= 844 - 672 - 12);
});

test('callout layout — priority winner does not depend on input order', () => {
  const viewport = { width: 390, height: 844, sheetHeight: 672 };
  const callouts = [hint('STOPS_COUNT', 's', 195, 130), hint('ALIGHTING', 'a', 195, 130), hint('TRANSFER', 't', 195, 130)];
  const forward = layoutCallouts(callouts, viewport).map(p => p.callout.id);
  const backward = layoutCallouts([...callouts].reverse(), viewport).map(p => p.callout.id);
  assert.deepEqual(forward, ['t']);
  assert.deepEqual(backward, forward);
});

test('callout layout — half detent separates same-coordinate hints and keeps every card inside the band', () => {
  const viewport = { width: 390, height: 844, sheetHeight: 317, topHudHeight: 84 };
  const placed = layoutCallouts([
    hint('BOARDING', 'b', 60, 470),
    hint('ALIGHTING', 'a', 195, 180),
    hint('TRANSFER', 't', 195, 180),
    hint('STOPS_COUNT', 's', 330, 360),
  ], viewport);
  assert.equal(placed.length, 4, 'the tall half-detent band fits all four hints');
  for (let i = 0; i < placed.length; i += 1) {
    const p = placed[i]!;
    assert.ok(p.top >= 96, `${p.callout.id} top ${p.top} must clear the HUD`);
    assert.ok(p.top + CALLOUT_SIZE.height <= 844 - 317 - 12, `${p.callout.id} must stay above the sheet`);
    assert.ok(p.left >= 12 && p.left + CALLOUT_SIZE.width <= 378);
    for (let j = i + 1; j < placed.length; j += 1) {
      assert.ok(!rectsOverlap(p, placed[j]!), `${p.callout.id} overlaps ${placed[j]!.callout.id}`);
    }
  }
  const alighting = placed.find(p => p.callout.id === 'a')!;
  const transfer = placed.find(p => p.callout.id === 't')!;
  assert.notEqual(alighting.top, transfer.top, 'same-coordinate hints must flip to opposite sides');
  assert.equal(transfer.pointerDirection, 'down');
  assert.equal(alighting.pointerDirection, 'up');
});

test('callout layout — a hint with both sides taken is dropped, never stacked or moved off its anchor', () => {
  const viewport = { width: 390, height: 844, sheetHeight: 317 };
  const placed = layoutCallouts([
    hint('TRANSFER', 't', 195, 200),
    hint('ALIGHTING', 'a', 195, 200),
    hint('STOPS_COUNT', 's', 195, 214),
  ], viewport);
  assert.deepEqual(placed.map(p => p.callout.id), ['t', 'a']);
  assert.ok(!rectsOverlap(placed[0]!, placed[1]!));
});

test('callout layout — a strip shorter than one card renders nothing instead of covering the sheet', () => {
  assert.ok(CALLOUT_MIN_BAND_PX >= CALLOUT_SIZE.height + 24);
  for (const sheetHeight of [700, 760, 844]) {
    assert.deepEqual(layoutCallouts([hint('TRANSFER', 't', 195, 130)], { width: 390, height: 844, sheetHeight }), []);
  }
});

test('callout layout — unprojected hints are skipped and horizontal anchors stay clamped', () => {
  const viewport = { width: 390, height: 844, sheetHeight: 317 };
  const unprojected = { ...hint('BOARDING', 'u', 0, 0), screenPos: undefined };
  const placed = layoutCallouts([unprojected, hint('TRANSFER', 't', 2, 300), hint('BOARDING', 'b', 388, 300)], viewport);
  assert.deepEqual(placed.map(p => p.callout.id).sort(), ['b', 't']);
  for (const p of placed) {
    assert.ok(p.left >= 12, `left ${p.left} must respect the margin`);
    assert.ok(p.left + CALLOUT_SIZE.width <= 378, `right edge ${p.left + CALLOUT_SIZE.width} must stay on screen`);
  }
});

test('callout layout — the half-detent mode chip zone stays clear of hints', () => {
  // 390x844 half: sheet 316, the floating mode chip occupies roughly [sheetTop-56, sheetTop-8].
  const viewport = { width: 390, height: 844, sheetHeight: 316, topHudHeight: 84, bottomReservedPx: 52 };
  const corridorBottom = 844 - 316 - 12 - 52;
  const placed = layoutCallouts([hint('BOARDING', 'b', 195, 500), hint('TRANSFER', 't', 100, 300)], viewport);
  const boarding = placed.find(p => p.callout.id === 'b');
  assert.ok(boarding, 'a hint anchored inside the chip zone is pulled above it, not dropped');
  for (const p of placed) {
    assert.ok(p.top + CALLOUT_SIZE.height <= corridorBottom, `${p.callout.id} bottom ${p.top + CALLOUT_SIZE.height} must stay above the reserved chip zone ${corridorBottom}`);
  }
  const unreserved = layoutCallouts([hint('BOARDING', 'b', 195, 500)], { width: 390, height: 844, sheetHeight: 316, topHudHeight: 84 });
  assert.ok(unreserved[0]!.top + CALLOUT_SIZE.height > corridorBottom, 'negative control: without the reservation the same hint lands in the chip zone');
});

test('callout layout — a band that fits a card but not the reserved chip shows no hints', () => {
  // Band 100 px fits a 58 px card with margins, but reserving the 52 px chip leaves 24 px.
  const viewport = { width: 390, height: 844, sheetHeight: 660, topHudHeight: 84, bottomReservedPx: 52 };
  assert.ok(calloutVisibleBand(844, 660, 84) >= CALLOUT_MIN_BAND_PX);
  assert.deepEqual(layoutCallouts([hint('TRANSFER', 't', 195, 130)], viewport), []);
});
