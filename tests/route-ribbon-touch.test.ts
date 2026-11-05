import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const css = () => readFileSync('src/index.css', 'utf8');

describe('stage ribbon keeps the 44 px tap floor without inflating the canonical bar', () => {
  it('extends the button hit area 9 px above and below the 26 px pill', () => {
    const source = css();
    const pill = source.match(/\.mg-route-ribbon__pill \{[^}]*height: (\d+)px;/);
    assert.ok(pill, 'the pill must keep an explicit height');
    assert.equal(pill[1], '26', 'the canonical ribbon bar renders at 26 px');

    const hitArea = source.match(/\.mg-route-ribbon__pill::before \{\s*content: '';\s*position: absolute;\s*inset: -9px 0;/);
    assert.ok(hitArea, 'a stage tap must reach 44 px: 26 + 9 + 9');

    assert.equal(Number(pill[1]) + 9 * 2, 44, 'the hit area must clear the ergonomic floor exactly');
  });

  it('leaves the active ring pseudo-element to the glow, not the hit area', () => {
    assert.match(css(), /\.mg-route-ribbon__pill\.is-active::after \{[^}]*pointer-events: none;/);
  });
});
