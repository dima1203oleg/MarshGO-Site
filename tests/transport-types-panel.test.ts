import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import { TransportTypesPanel } from '../src/components/TransportTypesPanel';
import { defaultSelection, supportedJourneySearchTypes, transportTypes } from '../src/domain/transportPreferences';

describe('TransportTypesPanel corridor-aware selection', () => {
  it('keeps all twelve supported modes selectable when endpoint discovery only finds a bus feed', () => {
    const html = renderToStaticMarkup(createElement(TransportTypesPanel, {
      selection: defaultSelection,
      groups: [{
        transportType: 'bus',
        providers: [{ id: 'bus:lviv', name: 'Lviv GTFS', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['bus'] }],
      }],
      onChange: () => undefined,
      compact: true,
    }));

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
});
