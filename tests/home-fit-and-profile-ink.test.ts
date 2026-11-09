import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const css = () => readFileSync('src/index.css', 'utf8');
const marketplace = () => readFileSync('src/views/ProductionMarketplace.tsx', 'utf8');
const hero = () => readFileSync('src/views/HomeHero.tsx', 'utf8');

describe('home banner geometry and profile trust ink', () => {
  it('sizes the canonical banner by its content, never by a fixed height', () => {
    const rules = css().match(/\.home-canonical-banner[^{]*\{[^}]*\}/g) ?? [];
    assert.ok(rules.length >= 4, 'expected banner rules for base, short screens and desktop');
    for (const rule of rules) {
      assert.doesNotMatch(rule, /(?<![-\w])height:\s*\S/, `a clipped banner cuts the publish CTA in half: ${rule}`);
    }
  });

  it('keeps the MarshPass promotion compact, tokenized, and free of fabricated content', () => {
    const source = hero();
    const banner = source.split('\n').find((line) => line.includes('home-marshpass-promo'));
    assert.ok(banner, 'the canonical MarshPass promotion must be content-sized');
    assert.match(banner, /overflow-hidden/);
    assert.match(banner, /onClick=\{onOpenTrips\}/);
    assert.match(source, /Твій шлях\. Один квиток\./);
    assert.doesNotMatch(banner, /Куди завгодно|0% комісії|Отримати квиток/);
    assert.match(css(), /\.home-marshpass-promo::before/);
    assert.match(css(), /\.home-marshpass-promo__route/);
  });

  it('distributes tall-phone hero slack instead of leaving dead space above the tab bar', () => {
    const sheet = css();
    assert.match(sheet, /\.home-marshpass-promo \{[^}]*flex-grow: 1;[^}]*max-height: 14rem;/, 'the promo must absorb slack but stay capped');
    assert.match(sheet, /\.home-popular-routes \{[^}]*flex-grow: 1;/, 'popular routes share the slack');
    assert.match(sheet, /\.home-popular-routes__row \{ flex: 1; \}/, 'the card row stretches inside the section');
    assert.match(sheet, /\.home-popular-route \{ height: auto; min-height: 4rem; \}/, 'cards stretch from a floor, not a fixed height');
    assert.match(hero(), /home-popular-routes__row no-scrollbar flex/, 'the row keeps its stretch hook');
  });

  it('transport tile labels wrap instead of truncating mid-word', () => {
    const panel = readFileSync('src/components/TransportTypesPanel.tsx', 'utf8');
    assert.doesNotMatch(panel, /truncate/, 'truncate cut «Маршрутка»/«Тролейбус» mid-word on 390px tiles');
    assert.match(panel, /transport-mode-tile__label w-full font-bold/, 'the label keeps its full-width wrap hook');
    assert.match(css(), /@media \(max-width: 380px\) \{\s*\.transport-types-inline \.transport-mode-tile__label \{ font-size: \.625rem;/, 'narrow phones scale to the 10px floor, never below');
  });

  it('renders an unverified profile in neutral ink instead of the success colour', () => {
    const line = marketplace().split('\n').find((row) => row.includes('Профіль не верифіковано'));
    assert.ok(line, 'the profile screen must state the verification status');
    assert.doesNotMatch(line, /className="[^"]*text-emerald/, 'the success colour must not be inherited by both branches');
    assert.match(line, /is_verified \? 'text-emerald-700' : 'text-\[#526477\] dark:text-\[var\(--mg-ink-secondary\)\]'/);
  });
});
