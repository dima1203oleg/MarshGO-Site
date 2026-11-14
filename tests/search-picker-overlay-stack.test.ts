import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const picker = readFileSync(new URL('../src/components/DepartureDateTimePicker.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('date/time picker sits above the persistent create tab bar', () => {
  const navLayer = Number(css.match(/--mg-z-nav-sheet:\s*(\d+)/)?.[1]);
  const modalLayer = Number(css.match(/--mg-z-modal:\s*(\d+)/)?.[1]);

  assert.ok(Number.isFinite(navLayer) && Number.isFinite(modalLayer));
  assert.ok(modalLayer > navLayer, 'modal layer must outrank the global bottom navigation');
  assert.match(picker, /fixed\s+inset-0\s+z-\[var\(--mg-z-modal\)\]/);
});
