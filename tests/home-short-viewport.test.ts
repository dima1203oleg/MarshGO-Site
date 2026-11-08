import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateHomeAvailableHeight } from '../src/views/homeViewport';

test('home viewport reserves the fixed tab bar visible footprint, not shell padding', () => {
  assert.equal(calculateHomeAvailableHeight(568, 70, 505, 84), 431);
});

test('home viewport falls back to shell padding when no fixed tab bar is present', () => {
  assert.equal(calculateHomeAvailableHeight(568, 70, null, 84), 410);
  assert.equal(calculateHomeAvailableHeight(568, 70, Number.NaN, 84), 410);
});

test('home viewport keeps a minimum scroll area on unusually short screens', () => {
  assert.equal(calculateHomeAvailableHeight(320, 100, 300, 200), 300);
});

test('short home layouts keep compact landscape action tiles and avoid a phantom scroll tail', () => {
  const css = readFileSync('src/index.css', 'utf8');
  const shortViewport = css.split('@media (max-width: 639px) and (max-height: 730px)')[1]?.split('/* ============================================================')[0] ?? '';
  assert.match(shortViewport, /padding-bottom: max\(\.5rem, env\(safe-area-inset-bottom, 0px\)\)/);
  assert.doesNotMatch(shortViewport, /5\.5rem|!important/);
  assert.match(css, /\.home-hero--canonical > \.home-action-grid\s*\{[^}]*grid-template-rows: auto auto/);
  assert.match(css, /\.home-action-grid > \.home-action-card\s*\{[^}]*aspect-ratio: 1\.5 \/ 1/);
  assert.doesNotMatch(css, /\.home-action-grid\s*\{[^}]*grid-template-rows: repeat\(2, 4\.6rem\)/);
});
