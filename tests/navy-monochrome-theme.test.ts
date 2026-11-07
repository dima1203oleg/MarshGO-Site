import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { transportModeRegistry } from '../src/design-system/transport/transportModeRegistry';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('defines one navy semantic ramp for both themes', () => {
  const css = read('../src/index.css');
  for (const token of [
    '--mg-canvas: #071521', '--mg-bg-secondary: #0B1B2C',
    '--mg-surface-primary: #10263D', '--mg-surface-secondary: #172B44',
    '--mg-surface-elevated: #1D3B58', '--mg-ink-primary: #F5F8FC',
    '--mg-ink-secondary: #AABFD1', '--mg-ink-muted: #91A7BC',
    '--mg-action: #1766B4', '--mg-blue: #71C7F2',
    '--mg-blue: #327FC3', '--mg-mode-monochrome: #155E95',
  ]) assert.ok(css.includes(token), `missing canonical theme token ${token}`);
  assert.equal((css.match(/--mg-action:/g) ?? []).length, 2, 'each theme has one action token');
  assert.equal((css.match(/--mg-blue:/g) ?? []).length, 2, 'each theme has one accent token');
});

test('keeps all twelve categories blue-monochrome while preserving icon and label identity', () => {
  const css = read('../src/index.css');
  assert.equal(Object.keys(transportModeRegistry).length, 12);
  for (const [id, visual] of Object.entries(transportModeRegistry)) {
    assert.equal(visual.color, '#327FC3', `${id} shared map color`);
    assert.ok(visual.label && visual.icon, `${id} remains identifiable without a unique hue`);
    assert.ok(css.includes(`--mode-${id}: var(--mg-mode-monochrome);`), `${id} CSS token`);
  }
  assert.match(css, /\.home-action-card--navigation,[\s\S]{0,220}\.home-action-card--publish/);
  assert.doesNotMatch(css, /\.home-action-card--search\s*\{[^}]*linear-gradient/);
});

test('keeps map, home, and MarshPass surfaces inside the navy system', () => {
  const css = read('../src/index.css');
  const darkMap = read('../src/map/style/darkStyle.ts');
  const mapTokens = read('../src/map/style/tokens.ts');
  const ticket = read('../src/views/MarshPassTicket.tsx');
  const theme = read('../src/services/theme.ts');
  assert.match(darkMap, /background: '#071521'/);
  assert.match(darkMap, /water: '#0B1B2C'/);
  assert.match(mapTokens, /MARSHGO_DARK: \{ route: '#71C7F2'/);
  assert.match(css, /\.marsh-pass-ticket\s*\{[\s\S]*?--pass-surface: var\(--mg-surface-primary\)/);
  assert.match(ticket, /rounded-\[var\(--mg-radius-lg\)\] bg-white p-2/,
    'the ticket QR keeps its high-contrast white scan surface');
  assert.match(theme, /isDarkMode \? '#071521' : '#F2F7FB'/,
    'the native status bar follows the active canvas theme');
});

test('keeps the public entry screen visually navy while retaining its existing composition', () => {
  const css = read('../src/index.css');
  const marketplace = read('../src/views/ProductionMarketplace.tsx');
  assert.match(marketplace, /authIntro && <img src="\/images\/welcome-kyiv-v1\.jpg"/,
    'the approved entry-screen composition and image remain intact');
  assert.match(css, /\.auth-intro-screen > img\s*\{[^}]*saturate\(\.28\) brightness\(\.38\)/,
    'the city image should act as subdued texture, not a competing warm palette');
  assert.match(css, /\.auth-intro-screen > \.absolute\.inset-0\s*\{[^}]*rgba\(7, 21, 33, \.97\)/,
    'the lower hero area must resolve to the canonical navy canvas');
  assert.match(css, /\.auth-intro-screen > section\s*\{\s*min-height: calc\(100svh - max\(1\.5rem, env\(safe-area-inset-bottom\)\) - env\(safe-area-inset-top\)\)/,
    'the entry content accounts for the outer safe-area padding so both actions stay visible');
});

test('keeps the sign-in backdrop inside the same navy semantic palette', () => {
  const css = read('../src/index.css');
  const marketplace = read('../src/views/ProductionMarketplace.tsx');
  assert.match(css, /--mg-auth-canvas: #071521;[\s\S]*--mg-auth-surface: #0B1B2C;[\s\S]*--mg-auth-accent: #71C7F2;/,
    'credential screens keep a stable dark-surface palette in either app theme');
  assert.match(marketplace, /'auth-screen__shade--login'/, 'sign-in uses a named palette-owned backdrop');
  assert.match(css, /\.auth-screen__shade--login\s*\{[\s\S]*var\(--mg-auth-accent\)[\s\S]*var\(--mg-auth-surface\)[\s\S]*var\(--mg-auth-canvas\)/,
    'sign-in uses its explicit dark-surface contrast tokens instead of the theme-dependent canvas');
  assert.doesNotMatch(marketplace, /rgba\(41,131,255,\.65\)/,
    'the old bright blue glow must not return to the authentication screen');
});
