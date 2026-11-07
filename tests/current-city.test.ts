import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoDetectCity, cityNameFromPlaceLabel, isCurrentCityRequest, parseCurrentCity, parseRecentCities } from '../src/domain/currentCity';

test('reverse-geocoder labels resolve to a locality instead of a street or region', () => {
  assert.equal(cityNameFromPlaceLabel('вулиця Городоцька, Львів, Львівська область, Україна'), 'Львів');
  assert.equal(cityNameFromPlaceLabel('Київ, Україна'), 'Київ');
  assert.equal(cityNameFromPlaceLabel('вулиця без населеного пункту, Україна'), '');
});

test('stored city data contains a label and mode, never coordinates', () => {
  assert.deepEqual(parseCurrentCity(JSON.stringify({ name: 'Чернівці', source: 'manual', verified: false, latitude: 48.29, longitude: 25.93 })), {
    name: 'Чернівці', source: 'manual', verified: false,
  });
  assert.deepEqual(parseCurrentCity('{invalid'), { name: '', source: 'unset', verified: false });
});

test('manual choice cannot be overwritten by a granted GPS permission', () => {
  assert.equal(canAutoDetectCity({ name: 'Стрий', source: 'manual', verified: true }, 'granted'), false);
  assert.equal(canAutoDetectCity({ name: '', source: 'unset', verified: false }, 'granted'), true);
  assert.equal(canAutoDetectCity({ name: 'Львів', source: 'gps', verified: true }, 'prompt'), false);
  assert.equal(canAutoDetectCity({ name: 'Львів', source: 'gps', verified: true }, 'unsupported'), false);
});

test('a manual city change supersedes an in-flight GPS lookup', () => {
  assert.equal(isCurrentCityRequest(4, 4), true);
  assert.equal(isCurrentCityRequest(4, 5), false);
});

test('recent city list is valid, unique, and bounded', () => {
  const entries = Array.from({ length: 8 }, (_, index) => ({ name: `Місто ${index}`, source: 'manual', verified: false }));
  assert.equal(parseRecentCities(JSON.stringify(entries)).length, 5);
  assert.deepEqual(parseRecentCities(JSON.stringify([{ name: 'Львів', source: 'manual' }, { name: 'львів', source: 'gps', verified: true }])), [
    { name: 'Львів', source: 'manual', verified: false },
  ]);
});
