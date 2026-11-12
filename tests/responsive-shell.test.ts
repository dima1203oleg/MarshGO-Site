import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sheet = readFileSync(new URL('../src/styles/responsive-shell.css', import.meta.url), 'utf8');
const indexCss = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const mainTsx = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const marketplace = readFileSync(new URL('../src/views/ProductionMarketplace.tsx', import.meta.url), 'utf8');
const homeHero = readFileSync(new URL('../src/views/HomeHero.tsx', import.meta.url), 'utf8');
const formFactor = readFileSync(new URL('../src/services/formFactor.ts', import.meta.url), 'utf8');

const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...withoutComments(sheet).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((match) => ({ selector: match[1].trim(), body: match[2] }));
const bodyOf = (selector: string) => rules.find((rule) => rule.selector === selector)?.body ?? '';

const rootBlocks = [...indexCss.matchAll(/(?:^|\n):root \{([\s\S]*?)\n\}/g)].map((match) => match[1]).join('\n');
const darkBlock = indexCss.match(/(?:^|\n)html\.dark \{([\s\S]*?)\n\}/)?.[1] ?? '';
const definedIn = (block: string, token: string) => new RegExp(`${token}\\s*:`).test(block);

test('the responsive sheet is imported after index.css and before the theme service', () => {
  const indexImport = mainTsx.indexOf("import './index.css'");
  const shellImport = mainTsx.indexOf("import './styles/responsive-shell.css'");
  assert.ok(indexImport >= 0 && shellImport > indexImport, 'responsive-shell.css must load after the token registry so equal-specificity rules win');
});

test('every rule is scoped to the desktop or tablet form factor — the phone shell is untouched', () => {
  assert.ok(rules.length >= 20, 'expected a real desktop and tablet composition');
  assert.doesNotMatch(sheet, /\[data-formfactor="mobile"\]/, 'no rule may target the mobile form factor');
  for (const { selector } of rules) {
    for (const part of selector.split(',')) {
      assert.match(part, /\[data-formfactor="(desktop|tablet)"\]/, `unscoped selector would leak into the phone layout: ${part.trim()}`);
    }
  }
  for (const media of withoutComments(sheet).matchAll(/@media[^{]*max-width:\s*(\d+)px/g)) {
    assert.ok(Number(media[1]) >= 768, 'no breakpoint below the tablet floor may appear');
  }
});

test('layout geometry comes from tokens defined in the index.css registry', () => {
  for (const token of ['--mg-shell-sidebar-w', '--mg-shell-rail-w', '--mg-shell-content-max']) {
    assert.ok(definedIn(rootBlocks, token), `${token} must be defined in :root of index.css`);
    assert.match(sheet, new RegExp(`var\\(${token}\\)`), `${token} must be consumed by the responsive shell`);
  }
  assert.match(bodyOf('[data-formfactor="desktop"].production-app > .app-tabbar'), /width:\s*var\(--mg-shell-sidebar-w\)/);
  assert.match(bodyOf('[data-formfactor="tablet"].production-app > .app-tabbar'), /width:\s*var\(--mg-shell-rail-w\)/);
});

test('no hardcoded hex colours and no inline motion values are introduced', () => {
  assert.doesNotMatch(sheet, /#[0-9a-fA-F]{3,8}\b/, 'colours must come from the --mg-* registry');
  assert.doesNotMatch(sheet, /\b\d+m?s\b/, 'durations must come from --mg-dur-* tokens');
  assert.doesNotMatch(sheet, /cubic-bezier\(/, 'easings must come from --mg-ease-* tokens');
});

test('every colour token the shell reads is paired in both themes', () => {
  const colorFamilies = ['--mg-ink', '--mg-border', '--mg-surface', '--mg-blue', '--mg-action', '--mg-canvas'];
  const used = [...new Set([...sheet.matchAll(/var\((--mg-[a-z-]+)\)/g)].map((match) => match[1]))];
  assert.ok(used.length > 0);
  for (const token of used) {
    if (!colorFamilies.some((family) => token.startsWith(family))) {
      assert.ok(definedIn(rootBlocks, token), `${token} must exist in the registry`);
      continue;
    }
    assert.ok(definedIn(rootBlocks, token), `${token} missing from :root`);
    assert.ok(definedIn(darkBlock, token), `${token} missing from html.dark — the dark shell would inherit its light value`);
  }
  // The create pill carries white-ish text on --mg-action in both themes.
  assert.match(sheet, /html\.dark \[data-formfactor="desktop"\] \.app-tabbar-inner \.app-create-button \{[^}]*color:\s*var\(--mg-ink-primary\)/);
  assert.match(sheet, /html\.dark \[data-formfactor="tablet"\] \.app-tabbar-inner \.app-create-button \{[^}]*color:\s*var\(--mg-ink-primary\)/);
});

test('desktop turns the tab bar into a fixed left labelled sidebar', () => {
  const nav = bodyOf('[data-formfactor="desktop"].production-app > .app-tabbar');
  assert.match(nav, /position:\s*fixed/);
  assert.match(nav, /inset:\s*0 auto 0 0/, 'the sidebar pins to the left edge, full height');
  assert.match(nav, /height:\s*100dvh/);
  assert.match(nav, /flex-direction:\s*column/);
  assert.match(nav, /border-right:\s*1px solid var\(--mg-border-subtle\)/);
  assert.match(nav, /background:\s*var\(--mg-surface-primary\)/);
  const inner = bodyOf('[data-formfactor="desktop"] .app-tabbar-inner');
  assert.match(inner, /display:\s*flex/);
  assert.match(inner, /flex-direction:\s*column/);
  const create = bodyOf('[data-formfactor="desktop"] .app-tabbar-inner .app-create-button');
  assert.match(create, /order:\s*-1/, 'create leads the sidebar');
  assert.match(create, /grid-column:\s*auto/);
  assert.match(create, /width:\s*100%/);
  assert.match(create, /min-height:\s*44px/);
  assert.match(create, /background:\s*var\(--mg-action\)/);
  assert.match(bodyOf('[data-formfactor="desktop"] .desktop-create-label'), /display:\s*inline/);
  const tab = bodyOf('[data-formfactor="desktop"] .app-tabbar-inner button:not(.app-create-button)');
  assert.match(tab, /flex-direction:\s*row/, 'icon and label sit side by side');
  assert.match(tab, /min-height:\s*44px/);
  const active = bodyOf('[data-formfactor="desktop"] .app-tabbar-inner button:not(.app-create-button)[aria-current="page"]');
  assert.match(active, /background:\s*var\(--mg-surface-tint\)/);
  assert.match(active, /color:\s*var\(--mg-blue-ink\)/);
});

test('desktop is a full-bleed page, not the centred glass card', () => {
  const shell = bodyOf('[data-formfactor="desktop"].production-app:not(.route-immersive-shell)');
  assert.match(shell, /display:\s*block/);
  assert.match(shell, /max-width:\s*none/);
  assert.match(shell, /margin:\s*0/);
  assert.match(shell, /border-radius:\s*0/);
  assert.match(shell, /box-shadow:\s*none/);
  assert.match(shell, /padding:\s*0 0 32px var\(--mg-shell-sidebar-w\)/, 'content never slides under the sidebar');
  assert.match(shell, /background:\s*var\(--mg-canvas\)/);
  const header = bodyOf('[data-formfactor="desktop"].production-app:not(.route-immersive-shell) > .app-header');
  assert.match(header, /position:\s*sticky/);
  const content = bodyOf('[data-formfactor="desktop"].production-app:not(.route-immersive-shell) > .pt-1');
  assert.match(content, /max-width:\s*var\(--mg-shell-content-max\)/);
  assert.match(content, /margin-inline:\s*auto/);
});

test('tablet turns the tab bar into a fixed left icon rail with accessible names', () => {
  const nav = bodyOf('[data-formfactor="tablet"].production-app > .app-tabbar');
  assert.match(nav, /position:\s*fixed/);
  assert.match(nav, /inset:\s*0 auto 0 0/);
  assert.match(nav, /height:\s*100dvh/);
  assert.match(nav, /border-right:\s*1px solid var\(--mg-border-subtle\)/);
  const tab = bodyOf('[data-formfactor="tablet"] .app-tabbar-inner button:not(.app-create-button)');
  assert.match(tab, /min-height:\s*56px/, 'rail targets stay above the 44px floor');
  assert.match(tab, /width:\s*56px/);
  assert.match(bodyOf('[data-formfactor="tablet"] .app-tabbar-inner button:not(.app-create-button) > span'), /display:\s*none/);
  const create = bodyOf('[data-formfactor="tablet"] .app-tabbar-inner .app-create-button');
  assert.match(create, /order:\s*-1/);
  assert.match(create, /min-height:\s*56px/);
  assert.match(create, /border-radius:\s*var\(--mg-radius-pill\)/);
  assert.match(bodyOf('[data-formfactor="tablet"] .desktop-create-label'), /display:\s*none/);
  // The hidden visible label must not remove the accessible name.
  const renderTab = marketplace.split('\n').find((line) => line.includes('const renderBottomTab'));
  assert.ok(renderTab, 'renderBottomTab must exist');
  assert.match(renderTab, /aria-label=\{item\.label\}/);
});

test('tablet shell is full-bleed with a rail-wide content offset and a two-column home', () => {
  const shell = bodyOf('[data-formfactor="tablet"].production-app:not(.route-immersive-shell)');
  assert.match(shell, /display:\s*block/);
  assert.match(shell, /max-width:\s*none/);
  assert.match(shell, /padding:\s*0 0 32px var\(--mg-shell-rail-w\)/);
  const hero = bodyOf('[data-formfactor="tablet"] .home-hero--canonical');
  assert.match(hero, /display:\s*grid/);
  assert.match(hero, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(bodyOf('[data-formfactor="tablet"] .home-hero--canonical > .home-action-grid'), /grid-column:\s*1/);
  assert.match(bodyOf('[data-formfactor="tablet"] .home-hero--canonical > .home-popular-routes'), /grid-column:\s*2/);
  const results = bodyOf('[data-formfactor="tablet"].production-app > .pt-1 > .journey-results');
  assert.match(results, /display:\s*grid/);
  assert.match(results, /grid-template-columns:\s*minmax\(320px, \.6fr\) minmax\(0, 1\.4fr\)/);
});

test('the immersive map shell keeps owning the viewport in both form factors', () => {
  for (const factor of ['desktop', 'tablet']) {
    const resets = rules.filter((rule) => rule.selector.includes(`[data-formfactor="${factor}"].production-app`) && /display:\s*block/.test(rule.body));
    assert.ok(resets.length >= 1, `${factor} must reset the shell`);
    for (const reset of resets) {
      assert.match(reset.selector, /:not\(\.route-immersive-shell\)/, 'the route map + bottom sheet must not be reflowed by the shell reset');
    }
  }
  assert.doesNotMatch(sheet, /\.route-map-screen|\.mg-route-sheet|journey-route-map/, 'the sheet geometry stays owned by the route screen');
});

test('the shell attribute is written before any early return and the home fit stays phone-only', () => {
  assert.match(marketplace, /import \{ useFormFactor \} from '\.\.\/services\/formFactor'/);
  const hookCall = marketplace.indexOf('const formFactor = useFormFactor();');
  const firstEarlyReturn = marketplace.search(/^  if \(.*return/m);
  assert.ok(hookCall > 0 && hookCall < firstEarlyReturn, 'useFormFactor must run before the loading/auth/404 early returns');
  assert.match(marketplace, /<main data-formfactor=\{formFactor\} className=\{`production-app/);
  assert.match(formFactor, /export function useFormFactor\(\): FormFactor/);
  assert.match(homeHero, /getAttribute\('data-formfactor'\)/);
  assert.match(homeHero, /formFactor !== 'mobile'/, 'the tablet rail must not squeeze Home into the phone height floor');
});

test('focus stays visible on every rail and sidebar control', () => {
  for (const factor of ['desktop', 'tablet']) {
    const focus = bodyOf(`[data-formfactor="${factor}"] .app-tabbar-inner button:focus-visible`);
    assert.match(focus, /outline:\s*2px solid var\(--mg-blue\)/);
    assert.match(focus, /outline-offset:\s*2px/);
  }
});