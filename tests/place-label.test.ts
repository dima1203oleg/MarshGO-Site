import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactPlaceLabel, fullPlaceLabel } from '../src/domain/placeLabel';

// Card titles used to print the whole geocoder label, so the 120 px of truncation was consumed by
// raions and hromadas and the passenger could not see where the trip actually ended.
test('compact place label keeps the street, number and city and drops administration', () => {
  assert.equal(
    compactPlaceLabel('вулиця Дорошенка, 1, Галицький район, Львів, Львівська область, Україна'),
    'вулиця Дорошенка, 1, Львів',
  );
  assert.equal(compactPlaceLabel('проспект Свободи, 12а, Львів, Львівська область, Україна'), 'проспект Свободи, 12а, Львів');
  assert.equal(compactPlaceLabel('Львів, Львівська область, Україна'), 'Львів');
  assert.equal(compactPlaceLabel('Залізничний вокзал «Львів», Львів, Україна'), 'Залізничний вокзал «Львів»');
  assert.equal(compactPlaceLabel('вулиця Городоцька, 1, Вінниця, Вінницька область, Україна'), 'вулиця Городоцька, 1, Вінниця');
});

// A blank geocoder answer must not become an empty title or crash the card.
test('compact place label degrades on missing input instead of throwing', () => {
  assert.equal(compactPlaceLabel(''), '');
  assert.equal(compactPlaceLabel(null), '');
  assert.equal(compactPlaceLabel(undefined), '');
  assert.equal(compactPlaceLabel('   ,   ,   '), '');
});

// Skimmers, screen readers and the title tooltip need the untouched label, so compaction cannot
// become the only representation of the place.
test('full place label preserves everything compaction removes', () => {
  const label = 'вулиця Дорошенка, 1, Галицький район, Львів, Львівська область, Україна';
  assert.equal(fullPlaceLabel(label), label);
  assert.ok(fullPlaceLabel(label).length > compactPlaceLabel(label).length);
});
