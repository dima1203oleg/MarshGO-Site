import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DESTINATION_NAME_LENGTH, navigationDestinationName } from '../src/navigation/destinationName';

test('keeps a geocoder label the navigation API accepts', () => {
  const short = 'вулиця Винниченка, Львів';
  assert.equal(navigationDestinationName(short), short);
});

test('drops trailing administrative segments from a 122-character Lviv address', () => {
  const label = 'Городоцька вулиця, Залізничний район, Львів, Львівська міська громада, Львівський район, Львівська область, 79040, Україна';
  assert.ok(label.length > MAX_DESTINATION_NAME_LENGTH);
  const result = navigationDestinationName(label);
  assert.ok(result.length <= MAX_DESTINATION_NAME_LENGTH);
  assert.ok(result.startsWith('Городоцька вулиця'));
});

test('always returns a usable name, even for pathological labels', () => {
  assert.equal(navigationDestinationName('   '), 'Пункт призначення');
  const oneWord = 'д'.repeat(300);
  const result = navigationDestinationName(oneWord);
  assert.equal(result.length, MAX_DESTINATION_NAME_LENGTH);
  assert.ok(result.endsWith('…'));
});
