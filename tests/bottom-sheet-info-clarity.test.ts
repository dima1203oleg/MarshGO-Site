import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiJourney } from '../src/services/productionApi';
import * as walkHint from '../src/views/journeyWalkHint';

function legs(value: unknown): ApiJourney['legs'] {
  return value as ApiJourney['legs'];
}

test('a leading walk leg names its target by route number, not a conversational instruction', () => {
  const hint = walkHint.walkHintFor(legs([
    { id: 'w', mode: 'WALK' },
    { id: 'b', mode: 'BUS', transportType: 'bus', routeName: 'A53' },
  ]), 0);
  assert.deepEqual(hint, { title: 'До A53', detail: '' });
});

test('a transfer walk leg points to the next route compactly', () => {
  const hint = walkHint.walkHintFor(legs([
    { id: 'b', mode: 'BUS', transportType: 'bus', routeName: 'A53' },
    { id: 'w', mode: 'WALK' },
    { id: 't', mode: 'TRAM', transportType: 'tram', routeName: '1' },
  ]), 1);
  assert.deepEqual(hint, { title: 'До 1', detail: '' });
});

test('the final walk leg says «До фінішу» instead of «Пройдіть пішки до фінішу»', () => {
  const hint = walkHint.walkHintFor(legs([
    { id: 'b', mode: 'BUS', transportType: 'bus', routeName: 'A53' },
    { id: 'w', mode: 'WALK' },
  ]), 1);
  assert.deepEqual(hint, { title: 'До фінішу', detail: '' });
});

test('a transit leg has no walk hint', () => {
  assert.equal(walkHint.walkHintFor(legs([{ id: 'b', mode: 'BUS', transportType: 'bus', routeName: 'A53' }]), 0), null);
});

test('consecutive walk legs keep the bare «Пішки» label', () => {
  const hint = walkHint.walkHintFor(legs([
    { id: 'w1', mode: 'WALK' },
    { id: 'w2', mode: 'WALK' },
  ]), 0);
  assert.deepEqual(hint, { title: 'Пішки', detail: '' });
});

test('a target without a route number falls back to the mode label, still subject-first', () => {
  const hint = walkHint.walkHintFor(legs([
    { id: 'w', mode: 'WALK' },
    { id: 'b', mode: 'BUS', transportType: 'bus' },
  ]), 0);
  assert.ok(hint && hint.title.startsWith('До ') && hint.title.length > 3);
  assert.equal(hint.detail, '');
});

test('legLabel keeps the full mode + number for the card title (unchanged contract)', () => {
  const label = walkHint.legLabel(legs([{ id: 'b', mode: 'BUS', transportType: 'bus', routeName: 'A53' }])[0]!);
  assert.match(label, /A53$/);
  assert.ok(label.length > 'A53'.length, 'the card title still carries the mode word');
});