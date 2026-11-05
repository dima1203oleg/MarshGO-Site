import assert from 'node:assert/strict';
import test from 'node:test';
import type { MapAnnotation } from '../src/map/MapAdapter';
import {
  edgeAnchorFor,
  estimateLabelBoxPx,
  labelPriority,
  labelRectPx,
  placeJourneyLabels,
} from '../src/map/routeLabelPlacement';

const VIEWPORT = { width: 390, height: 760 };

function annotation(partial: Pick<MapAnnotation, 'id' | 'kind'> & Partial<MapAnnotation>): MapAnnotation {
  return { coordinates: [24.03, 49.82], title: 'Чип', detail: undefined, ...partial } as MapAnnotation;
}

function projector(points: Record<string, { x: number; y: number } | null>) {
  return (label: MapAnnotation) => points[label.id] ?? null;
}

test('priority order is boarding/alighting over terminus over walk over route over vehicle', () => {
  assert.ok(labelPriority('BOARDING') < labelPriority('TERMINUS'));
  assert.ok(labelPriority('ALIGHTING') < labelPriority('TERMINUS'));
  assert.ok(labelPriority('TERMINUS') < labelPriority('WALK'));
  assert.ok(labelPriority('WALK') < labelPriority('ROUTE'));
  assert.ok(labelPriority('ROUTE') < labelPriority('VEHICLE'));
  assert.equal(labelPriority('BOARDING'), labelPriority('ALIGHTING'));
});

test('a walk callout colliding with the alighting chip is suppressed entirely, not drawn on top', () => {
  // The screenshot defect: the last walk's midpoint sits ~20 px from the alighting point.
  const labels = [
    annotation({ id: 'alighting:t1', kind: 'ALIGHTING', title: 'Висадка', detail: 'Стрий' }),
    annotation({ id: 'walk:w2', kind: 'WALK', title: 'Пішки', detail: '13 хв · 948 м' }),
  ];
  const placed = placeJourneyLabels(labels, projector({
    'alighting:t1': { x: 200, y: 420 },
    'walk:w2': { x: 218, y: 432 },
  }), VIEWPORT);
  assert.deepEqual(placed.map(item => item.annotation.id), ['alighting:t1']);
});

test('the walk feed order does not rescue a low-priority label, and kept labels come back in feed order', () => {
  const labels = [
    annotation({ id: 'walk:first', kind: 'WALK', title: 'Пішки', detail: '2 хв · 126 м' }),
    annotation({ id: 'terminus:end', kind: 'TERMINUS', title: 'Кінцева', detail: 'Сихів' }),
    annotation({ id: 'route:end', kind: 'ROUTE', title: 'Н1' }),
  ];
  // walk:first and route:end overlap each other; the terminus sits alone.
  const placed = placeJourneyLabels(labels, projector({
    'walk:first': { x: 120, y: 300 },
    'terminus:end': { x: 300, y: 620 },
    'route:end': { x: 130, y: 305 },
  }), VIEWPORT);
  assert.deepEqual(placed.map(item => item.annotation.id), ['walk:first', 'terminus:end']);
});

test('boarding and alighting chips near an edge grow toward the map interior', () => {
  const labels = [
    annotation({ id: 'boarding:b', kind: 'BOARDING', title: 'Посадка', detail: 'Вулиця Довга' }),
    annotation({ id: 'alighting:a', kind: 'ALIGHTING', title: 'Висадка', detail: 'Стрий' }),
    annotation({ id: 'walk:m', kind: 'WALK', title: 'Пішки', detail: '13 хв · 948 м' }),
  ];
  const placed = placeJourneyLabels(labels, projector({
    'boarding:b': { x: 18, y: 320 },
    'alighting:a': { x: 372, y: 320 },
    'walk:m': { x: 195, y: 520 },
  }), VIEWPORT);
  const byId = new Map(placed.map(item => [item.annotation.id, item.anchor]));
  assert.equal(byId.get('boarding:b'), 'left');
  assert.equal(byId.get('alighting:a'), 'right');
  // Non-chip labels stay centred on their coordinate.
  assert.equal(byId.get('walk:m'), 'center');
});

test('edgeAnchorFor keeps a centred chip centred while it fits', () => {
  const box = { width: 120, height: 30 };
  assert.equal(edgeAnchorFor({ x: 195 }, box, 390), 'center');
  assert.equal(edgeAnchorFor({ x: 40 }, box, 390), 'left');
  assert.equal(edgeAnchorFor({ x: 360 }, box, 390), 'right');
  // A point past the left edge on the right half still flips toward the interior.
  assert.equal(edgeAnchorFor({ x: 20 }, { width: 300, height: 30 }, 390), 'left');
});

test('labelRectPx honors the maplibre anchor semantics', () => {
  const box = { width: 100, height: 40 };
  assert.deepEqual(labelRectPx({ x: 50, y: 60 }, box, 'center'), { left: 0, top: 40, right: 100, bottom: 80 });
  assert.deepEqual(labelRectPx({ x: 50, y: 60 }, box, 'left'), { left: 50, top: 40, right: 150, bottom: 80 });
  assert.deepEqual(labelRectPx({ x: 50, y: 60 }, box, 'right'), { left: -50, top: 40, right: 50, bottom: 80 });
});

test('non-finite projections drop the label for this camera without crashing the rest', () => {
  const labels = [
    annotation({ id: 'ok', kind: 'BOARDING', title: 'Посадка', detail: 'Ковель' }),
    annotation({ id: 'bad', kind: 'VEHICLE', title: 'Н1' }),
  ];
  const placed = placeJourneyLabels(labels, projector({ ok: { x: 100, y: 100 }, bad: null }), VIEWPORT);
  assert.deepEqual(placed.map(item => item.annotation.id), ['ok']);
});

test('estimated boxes respect the CSS max-width clamp and never go below their text', () => {
  const wideWalk = estimateLabelBoxPx({ kind: 'WALK', title: 'Пішки', detail: '13 хв · 948 м' });
  assert.ok(wideWalk.width <= 236, 'clamped at the 216 px label max-width plus chrome');
  assert.ok(wideWalk.width > 'Пішки'.length * 8);
  const chip = estimateLabelBoxPx({ kind: 'BOARDING', title: 'Посадка', detail: undefined });
  assert.ok(chip.width >= 'Посадка'.length * 8, 'the chip always fits its own title');
  assert.ok(chip.height >= 26, 'never below one text line of chrome');
});

test('two walk callouts far apart keep each other; labels keep their own min-gap', () => {
  const labels = [
    annotation({ id: 'walk:a', kind: 'WALK', title: 'Пішки', detail: '2 хв · 126 м' }),
    annotation({ id: 'walk:b', kind: 'WALK', title: 'Пішки', detail: '13 хв · 948 м' }),
  ];
  const apart = placeJourneyLabels(labels, projector({
    'walk:a': { x: 80, y: 200 },
    'walk:b': { x: 300, y: 640 },
  }), VIEWPORT);
  assert.equal(apart.length, 2);
  // Touching boxes (within the 4 px min gap) keep the feed-order-first walk.
  const close = placeJourneyLabels(labels, projector({
    'walk:a': { x: 120, y: 300 },
    'walk:b': { x: 122, y: 302 },
  }), VIEWPORT);
  assert.deepEqual(close.map(item => item.annotation.id), ['walk:a']);
});
