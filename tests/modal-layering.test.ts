import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const marketplace = read('src/views/ProductionMarketplace.tsx');
const css = read('src/index.css');

test('marketplace dialogs sit above the bottom navigation chrome', () => {
  assert.doesNotMatch(marketplace, /fixed inset-0 z-50/);
  assert.doesNotMatch(marketplace, /fixed inset-0 z-\[var\(--mg-z-(?:scrim|scrim-raised|picker-scrim|map-control)\)\]/);
  const overlays = marketplace.match(/fixed inset-0 z-\[[^\]]+\]/g) ?? [];
  assert.ok(overlays.length >= 12, 'every marketplace overlay must declare an explicit z token');
  for (const overlay of overlays) assert.equal(overlay, 'fixed inset-0 z-[var(--mg-z-modal)]');
});

test('shell pickers and the offer edit sheet use the modal layer', () => {
  for (const path of ['src/components/CurrentCitySelector.tsx', 'src/components/MapPointPicker.tsx', 'src/components/TripManagement.tsx']) {
    const source = read(path);
    assert.match(source, /fixed inset-0 z-\[var\(--mg-z-modal\)\]/, `${path} must open above the nav chrome`);
    assert.doesNotMatch(source, /fixed inset-0 z-(?:50|\[\d+\]|\[var\(--mg-z-(?:picker-scrim|map-control)\)\])/);
  }
});

test('the modal token outranks the navigation chrome token', () => {
  const navChrome = Number(css.match(/--mg-z-nav-chrome:\s*(\d+)/)?.[1]);
  const modal = Number(css.match(/--mg-z-modal:\s*(\d+)/)?.[1]);
  assert.ok(Number.isFinite(navChrome) && Number.isFinite(modal));
  assert.ok(modal > navChrome, 'a modal dialog must cover the bottom navigation, not render beneath it');
});
