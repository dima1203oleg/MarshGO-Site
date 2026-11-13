import assert from 'node:assert/strict';
import { createElement } from 'react';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { TransportTypesPanel } from '../src/components/TransportTypesPanel';
import { defaultSelection, supportedJourneySearchTypes, transportTypes } from '../src/domain/transportPreferences';

describe('transport type selector', () => {
  it('keeps all twelve named categories in an accessible compact horizontal rail', async () => {
    const html = renderToStaticMarkup(createElement(TransportTypesPanel, {
      selection: defaultSelection,
      groups: null,
      onChange: () => undefined,
      compact: true,
    }));

    assert.match(html, /data-testid="transport-mode-selector" role="group" aria-label="Усі 12 видів транспорту · гортайте горизонтально" class="transport-mode-grid transport-mode-grid--horizontal"/);
    assert.match(html, /Види транспорту<span aria-label="12 категорій"/);
    for (const id of supportedJourneySearchTypes) {
      const type = transportTypes.find(({ id: candidate }) => candidate === id);
      assert.ok(type, `missing category ${id}`);
      assert.match(html, new RegExp(`aria-pressed="true" aria-label="${type.label}"`), `${type.label} remains visible and selected`);
    }

    const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
    assert.match(css, /\.transport-types-inline \.transport-mode-grid--horizontal\s*\{[^}]*overflow-x:\s*auto;[^}]*scroll-snap-type:\s*x mandatory;/);
    assert.match(css, /\.transport-types-inline \.transport-mode-grid--horizontal\s*>\s*button\s*\{[^}]*flex:\s*0 0 5rem;[^}]*scroll-snap-align:\s*start;/);
  });
});
