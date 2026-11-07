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

  it('renders an unverified profile in neutral ink instead of the success colour', () => {
    const line = marketplace().split('\n').find((row) => row.includes('Профіль не верифіковано'));
    assert.ok(line, 'the profile screen must state the verification status');
    assert.doesNotMatch(line, /className="[^"]*text-emerald/, 'the success colour must not be inherited by both branches');
    assert.match(line, /is_verified \? 'text-emerald-700' : 'text-\[#526477\] dark:text-\[var\(--mg-ink-secondary\)\]'/);
  });
});
