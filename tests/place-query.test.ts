import assert from 'node:assert/strict';
import test from 'node:test';
import { PLACE_QUERY_MAX, normalizePlaceQuery } from '../src/services/placeQuery';

test('drops queries the server would reject as too short', () => {
  assert.equal(normalizePlaceQuery(''), null);
  assert.equal(normalizePlaceQuery('  '), null);
  assert.equal(normalizePlaceQuery(' Лв '), null);
  assert.equal(normalizePlaceQuery('Льв'), 'Льв');
});

test('collapses whitespace so the boundary counts characters, not padding', () => {
  assert.equal(normalizePlaceQuery('  Руська,   Львів  '), 'Руська, Львів');
});

test('caps a long place label instead of forwarding the server error', () => {
  const long = 'Львів, ' + 'вулиця '.repeat(40);
  const normalized = normalizePlaceQuery(long);
  assert.equal(normalized?.length, PLACE_QUERY_MAX);
  assert.ok(normalized?.startsWith('Львів, вулиця'));
});
