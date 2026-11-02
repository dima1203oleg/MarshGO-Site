import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { activePlaceOptionId, moveActivePlaceIndex, placeSuggestionKeyAction } from '../src/routing/placeSuggestionKeyboard';

describe('geocoder place suggestion keyboard contract', () => {
  it('gives the list the arrow keys and accepts the highlighted option', () => {
    assert.equal(placeSuggestionKeyAction('ArrowDown', true, -1), 'highlight_next');
    assert.equal(placeSuggestionKeyAction('ArrowUp', true, 2), 'highlight_prev');
    assert.equal(placeSuggestionKeyAction('Enter', true, 2), 'accept');
    assert.equal(placeSuggestionKeyAction('Escape', true, 0), 'dismiss');
  });

  it('falls back to a place lookup when nothing is highlighted and ignores keys when closed', () => {
    assert.equal(placeSuggestionKeyAction('Enter', true, -1), 'search');
    assert.equal(placeSuggestionKeyAction('Enter', false, 2), 'search');
    assert.equal(placeSuggestionKeyAction('Escape', false, 0), 'none');
    assert.equal(placeSuggestionKeyAction('ArrowDown', false, 0), 'none');
    assert.equal(placeSuggestionKeyAction('a', true, 0), 'none');
  });

  it('enters the list from the ends and clamps at both boundaries', () => {
    assert.equal(moveActivePlaceIndex(-1, 4, 1), 0);
    assert.equal(moveActivePlaceIndex(-1, 4, -1), 3);
    assert.equal(moveActivePlaceIndex(0, 4, -1), 0);
    assert.equal(moveActivePlaceIndex(3, 4, 1), 3);
    assert.equal(moveActivePlaceIndex(1, 0, 1), -1);
  });

  it('exposes an activedescendant id only while an option is highlighted', () => {
    assert.equal(activePlaceOptionId('route-place-origin-list', -1), undefined);
    assert.equal(activePlaceOptionId('route-place-origin-list', 1), 'route-place-origin-list-option-1');
  });
});
