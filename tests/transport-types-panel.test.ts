import assert from 'node:assert/strict';
import { createElement } from 'react';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { TransportTypesPanel } from '../src/components/TransportTypesPanel';
import { defaultSelection, supportedJourneySearchTypes, transportTypes } from '../src/domain/transportPreferences';

describe('TransportTypesPanel corridor-aware selection', () => {
  it('keeps all twelve supported modes selectable when endpoint discovery only finds a bus feed', async () => {
    const html = renderToStaticMarkup(createElement(TransportTypesPanel, {
      selection: defaultSelection,
      groups: [{
        transportType: 'bus',
        providers: [{ id: 'bus:lviv', name: 'Lviv GTFS', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['bus'] }],
      }],
      onChange: () => undefined,
      compact: true,
    }));

    assert.match(html, /data-testid="transport-mode-selector" role="group" aria-label="Усі 12 видів транспорту" class="transport-mode-grid transport-mode-grid--compact"/,
      'the compact search selector announces all twelve categories on one fixed board');
    const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
    assert.match(css, /\.transport-types-inline \.transport-mode-grid--compact\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/,
      'the mobile selector is a four-column board, so twelve categories fill three rows');
    assert.doesNotMatch(css, /\.transport-mode-grid--compact\s*\{[^}]*overflow-x:\s*auto;/,
      'no category may hide behind horizontal scrolling');
    assert.match(css, /\.transport-mode-grid--compact \.transport-mode-tile__label\s*\{[^}]*white-space:\s*nowrap;[^}]*font-size:\s*\.75rem;/,
      'tile labels stay on one line at the 12 px typography floor');

    for (const id of supportedJourneySearchTypes) {
      const mode = transportTypes.find((item) => item.id === id);
      assert.ok(mode, `mode ${id} must have a product label`);
      const escapedLabel = mode.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const button = html.match(new RegExp(`<button\\b(?=[^>]*aria-label="${escapedLabel}")[^>]*>`))?.[0];
      assert.ok(button, `${mode.label} tile should be rendered`);
      assert.doesNotMatch(button, /\sdisabled(?:="")?(?:\s|>)/, `${mode.label} should not be disabled by endpoint-local coverage`);
      assert.match(button, /aria-pressed="true"/, `${mode.label} stays selected by default`);
    }

    assert.doesNotMatch(html, /провайдери біля вибраних точок знайдені|усі види.*додасть решту/i,
      'endpoint coverage stays out of the passenger-facing transport picker');
  });

  it('renders twelve categories as a 4x3 board with a unique icon per category', async () => {
    const html = renderToStaticMarkup(createElement(TransportTypesPanel, {
      selection: defaultSelection,
      groups: null,
      onChange: () => undefined,
      compact: true,
    }));
    const tiles = html.match(/transport-mode-tile__label/g) ?? [];
    assert.equal(tiles.length, 12, 'all twelve categories render as selectable tiles');

    const { transportModeRegistry } = await import('../src/design-system/transport/transportModeRegistry');
    const { canonicalTransportTypes } = await import('../src/domain/transportCatalog');
    const icons = canonicalTransportTypes.map((id) => transportModeRegistry[id].icon);
    assert.equal(new Set(icons).size, 12, 'each of the twelve categories owns a distinct icon component');
    const names = canonicalTransportTypes.map((id) => transportModeRegistry[id].icon.displayName ?? transportModeRegistry[id].icon.name);
    assert.equal(new Set(names).size, 12, 'icon identities stay unique, not twelve copies of one glyph');
  });
});
