import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { transportModeRegistry } from '../src/design-system/transport/transportModeRegistry';

test('keeps CSS map colors aligned with the canonical transport registry', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  for (const [mode, visual] of Object.entries(transportModeRegistry)) {
    assert.match(css, new RegExp(`--mode-${mode}:\\s*${visual.color};`), `${mode} CSS token`);
  }
});
