import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const marketplace = readFileSync(new URL('../src/views/ProductionMarketplace.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

describe('app-wide visual consistency', () => {
  it('uses the shared icon-button treatment for both global header actions', () => {
    assert.match(marketplace, /className="app-header-icon-button[^"]*"[^>]*><MessageCircle/);
    assert.match(marketplace, /className="app-header-icon-button[^"]*"[^>]*><Bell/);

    const rule = css.match(/\.production-app \.app-header-icon-button\s*\{([^}]+)\}/)?.[1] ?? '';
    assert.match(rule, /min-width:\s*2\.75rem/);
    assert.match(rule, /min-height:\s*2\.75rem/);
    assert.match(rule, /border:\s*1px solid var\(--mg-border-subtle\)/);
    assert.match(rule, /background:\s*var\(--mg-surface-secondary\)/);
    assert.match(rule, /color:\s*var\(--mg-ink-primary\)/);
  });

  it('shows the selected main tab with one theme-safe accent surface', () => {
    assert.match(marketplace, /active \? 'text-\[var\(--mg-blue-ink\)\]' : 'text-\[var\(--mg-ink-secondary\)\]'/);
    assert.match(css, /\.production-app \.app-tabbar-inner button:not\(\.app-create-button\)\[aria-current="page"\]\s*\{[^}]*background:\s*var\(--mg-blue-tint\);[^}]*color:\s*var\(--mg-blue-ink\);/);
    assert.match(css, /\.production-app \.app-tabbar-inner button:not\(\.app-create-button\)\[aria-current="page"\] svg\s*\{\s*color:\s*var\(--mg-blue-ink\);/);
  });

  it('keeps interaction feedback on the shared motion system', () => {
    const transitionRule = css.match(/\.production-app :is\(button, a\)\s*\{([^}]+)\}/)?.[1] ?? '';
    assert.match(transitionRule, /var\(--mg-dur-fast\)/);
    assert.match(transitionRule, /var\(--mg-ease-standard\)/);
    assert.doesNotMatch(transitionRule, /\.16s|ease,/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition:\s*none !important/);
  });
});
