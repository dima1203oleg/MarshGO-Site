import assert from 'node:assert/strict';
import test from 'node:test';
import { snapNavigationSheet } from '../src/navigation/navigationSheet';

test('navigation sheet advances one snap point for deliberate swipes', () => {
  assert.equal(snapNavigationSheet('collapsed', -40), 'partial');
  assert.equal(snapNavigationSheet('partial', -40), 'expanded');
  assert.equal(snapNavigationSheet('expanded', 40), 'partial');
  assert.equal(snapNavigationSheet('partial', 40), 'collapsed');
});

test('navigation sheet ignores small movements and stays within its snap points', () => {
  assert.equal(snapNavigationSheet('partial', -23), 'partial');
  assert.equal(snapNavigationSheet('partial', 23), 'partial');
  assert.equal(snapNavigationSheet('expanded', -80), 'expanded');
  assert.equal(snapNavigationSheet('collapsed', 80), 'collapsed');
});
