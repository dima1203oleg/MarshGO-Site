import test from 'node:test';
import assert from 'node:assert/strict';
import { themeStyleUrls } from '../src/map/style/themeStyles';

const LIGHT = 'https://tiles.example.org/styles/bright';
const DARK = 'https://tiles.example.org/styles/dark';

test('a deployment with both palettes gets one style per theme', () => {
  assert.deepEqual(themeStyleUrls(LIGHT, DARK), { MARSHGO_LIGHT: LIGHT, MARSHGO_DARK: DARK });
});

test('a light-only deployment degrades to the same style instead of a blank map', () => {
  assert.deepEqual(themeStyleUrls(LIGHT), { MARSHGO_LIGHT: LIGHT, MARSHGO_DARK: LIGHT });
});

test('no style is declared until the deployment provides one', () => {
  assert.equal(themeStyleUrls(undefined, undefined), undefined);
  assert.equal(themeStyleUrls(''), undefined);
});
