import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { tripsTabs } from '../src/views/tripsSections';

const marketplace = () => readFileSync('src/views/ProductionMarketplace.tsx', 'utf8');

describe('trips section strip fits the canonical mobile widths', () => {
  it('keeps the five 12 px labels inside 390/375/360 px by growing, not padding', () => {
    const line = marketplace().split('\n').find((row) => row.includes('aria-label="Розділи поїздок"'));
    assert.ok(line, 'the trips screen must keep its five-section strip');
    assert.equal(tripsTabs.length, 5);
    // 264 px of label text + 2 px side padding + gaps + container padding = 308 px.
    assert.match(line, /className="[^"]*text-xs/, 'labels must keep the 12 px floor');
    assert.match(line, /className="[^"]*flex snap-x/, 'overflow must stay swipeable and snap');
    assert.match(line, /ref=\{tripsTabsRef\}/, 'the strip needs a ref to keep the chosen tab visible');
    assert.match(line, /shrink-0 grow snap-start/, 'tabs share the width instead of keeping px-3');
    assert.match(line, / px-0\.5 /, '3-state horizontal padding is what pushed «Збережені» off-screen');
    assert.doesNotMatch(line, / px-3 py-2 /, 'the old padding clips the fifth tab at 390 px');
  });

  it('scrolls a still-overflowing strip until the selected section is fully visible', () => {
    assert.match(
      marketplace(),
      /\[role="tab"\]\[aria-selected="true"\][\s\S]{0,600}strip\.scrollLeft \+=/,
      'a 320 px strip must centre the active tab instead of leaving half a word',
    );
  });

  it('fades the neighbour left by the scroll instead of slicing it mid-word', () => {
    const css = readFileSync('src/index.css', 'utf8');
    assert.match(css, /\[data-testid="trips-section-tabs"\]\[data-fade-start="true"\] \{ --trips-fade-start: 1\.25rem; \}/);
    assert.match(marketplace(), /strip\.dataset\.fadeStart = strip\.scrollLeft > 4/, 'the fade must follow the real scroll position');
  });
});
