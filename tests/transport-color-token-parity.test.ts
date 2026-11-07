import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { transportModeRegistry } from '../src/design-system/transport/transportModeRegistry';

test('keeps all canonical transport modes in the monochrome palette', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /--mg-mode-monochrome:\s*#71C7F2/);
  for (const [mode, visual] of Object.entries(transportModeRegistry)) {
    assert.equal(visual.color, '#327FC3', `${mode} shared map color`);
    assert.match(css, new RegExp(`--mode-${mode}:\\s*var\\(--mg-mode-monochrome\\);`), `${mode} CSS token`);
  }
});
