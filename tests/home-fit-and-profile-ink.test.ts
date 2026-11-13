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
    assert.match(source, /Увесь міський і міжміський транспорт/);
    assert.match(source, /home-marshpass-promo__barcode/);
    assert.match(source, /home-marshpass-promo__destination/);
    assert.doesNotMatch(banner, /Куди завгодно|0% комісії|Отримати квиток/);
    assert.match(css(), /\.home-marshpass-promo::before/);
    assert.match(css(), /\.home-marshpass-promo::after/);
    assert.match(css(), /\.home-marshpass-promo__route/);
  });

  it('keeps featured destinations aligned with their visible origin and search action', () => {
    const source = hero();
    assert.match(source, /origin: 'Львів', city: 'Київ'/);
    assert.match(source, /aria-label=\{`Маршрут \$\{origin\} — \$\{city\}`\}/);
    assert.match(source, /onSearchDestination\(city, origin\)/);
    assert.match(marketplace(), /onSearchDestination=\{\(city, from\) => \{\s*const fromPlace = localCityPlace\(from\);\s*const destinationPlace = localCityPlace\(city\);\s*setOrigin\(fromPlace\?\.label \?\? from\);\s*setDestination\(destinationPlace\?\.label \?\? city\);\s*setSearchOriginPlace\(fromPlace\);\s*setSearchDestinationPlace\(destinationPlace\);/);
    assert.match(css(), /\.home-popular-routes__row \{ flex: 0 0 auto; height: clamp\(7\.75rem, 16svh, 8\.6rem\); \}/);
  });

  it('keeps the five canonical destinations visible in a floating glass home tab bar', () => {
    const source = marketplace();
    for (const label of ['Головна', 'Пошук', 'Поїздки', 'Профіль']) assert.match(source, new RegExp(`label: '${label}'`));
    assert.match(source, /aria-label="Створити поїздку або запит"/);
    assert.match(css(), /\.production-app > nav\[data-testid="global-bottom-navigation"\][^{]*\{[^}]*border-radius: var\(--mg-radius-sheet\)/);
    assert.doesNotMatch(source, /!immersiveRouteView && <nav data-testid="global-bottom-navigation"/);
    assert.match(css(), /\.production-app > nav\[data-testid="global-bottom-navigation"\][^{]*\{[^}]*z-index: var\(--mg-z-nav-sheet\)/);
  });

  it('distributes tall-phone hero slack instead of leaving dead space above the tab bar', () => {
    const sheet = css();
    assert.match(sheet, /\.home-marshpass-promo \{[^}]*flex-grow: 1;[^}]*max-height: clamp\(11\.25rem, 21svh, 12\.25rem\);/, 'the promo must absorb slack while matching the reference height on tall iPhones');
    assert.match(sheet, /\.home-action-grid \{ grid-template-rows: repeat\(2, clamp\(6\.5rem, 12\.5svh, 7\.25rem\)\); \}/, 'the 15 Pro Max action tiles must keep the reference proportions');
    assert.match(sheet, /\.home-popular-routes \{[^}]*flex-grow: 1;/, 'popular routes share the slack');
    assert.match(sheet, /\.home-popular-routes__row \{ flex: 1; \}/, 'the card row stretches inside the section');
    assert.match(sheet, /\.home-popular-route \{ height: auto; min-height: 4rem; \}/, 'cards stretch from a floor, not a fixed height');
    assert.match(hero(), /home-popular-routes__row no-scrollbar flex/, 'the row keeps its stretch hook');
  });

  it('transport tile labels wrap instead of truncating mid-word', () => {
    const panel = readFileSync('src/components/TransportTypesPanel.tsx', 'utf8');
    assert.doesNotMatch(panel, /truncate/, 'truncate cut «Маршрутка»/«Тролейбус» mid-word on 390px tiles');
    assert.match(panel, /transport-mode-tile__label w-full font-bold/, 'the label keeps its full-width wrap hook');
    const labelRule = css().match(/\.transport-mode-grid--horizontal \.transport-mode-tile__label \{([^}]+)\}/)?.[1];
    assert.ok(labelRule);
    assert.match(labelRule, /overflow-wrap: anywhere;/);
    assert.match(labelRule, /font-size: \.75rem;/);
    assert.doesNotMatch(labelRule, /overflow: hidden|line-clamp/);
    assert.doesNotMatch(css(), /\.transport-types-inline \.transport-mode-tile__label \{ font-size: \.625rem;/);
  });

  it('renders an unverified profile in neutral ink instead of the success colour', () => {
    const line = marketplace().split('\n').find((row) => row.includes('Профіль не верифіковано'));
    assert.ok(line, 'the profile screen must state the verification status');
    assert.doesNotMatch(line, /className="[^"]*text-emerald/, 'the success colour must not be inherited by both branches');
    assert.match(line, /is_verified \? 'text-emerald-700' : 'text-\[#526477\] dark:text-\[var\(--mg-ink-secondary\)\]'/);
  });
});
