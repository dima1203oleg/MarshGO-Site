import assert from 'node:assert/strict';
import test from 'node:test';
import { createNavigationShareUrl, parseSharedNavigationDestination } from '../src/routing/navigationShare';

test('shared navigation links contain only a validated destination and reopen the destination in MARSHGO', () => {
  const href = createNavigationShareUrl({ label: 'вул. Хрещатик, 1', latitude: 50.4501, longitude: 30.5234 }, 'https://marshgo.example');
  const url = new URL(href);
  assert.equal(url.pathname, '/navigate');
  assert.deepEqual(parseSharedNavigationDestination(url.search), {
    providerId: 'shared-navigation', label: 'вул. Хрещатик, 1', latitude: 50.4501, longitude: 30.5234,
  });
  assert.equal(url.searchParams.has('session'), false);
  assert.equal(url.searchParams.has('origin'), false);
});

test('invalid and incomplete shared navigation coordinates are rejected', () => {
  assert.equal(parseSharedNavigationDestination('?lat=50&lon=181'), null);
  assert.equal(parseSharedNavigationDestination('?lat=50'), null);
});
