import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(root, 'src/index.css'), 'utf8');
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '');
const declarations = (block: string) => new Set([...block.matchAll(/(--mg-[a-z0-9-]+):/g)].map(match => match[1]));

const lightBlock = css.match(/^:root \{[\s\S]*?\n\}/m);
const darkBlock = css.match(/^html\.dark \{[\s\S]*?\n\}/m);
assert.ok(lightBlock && darkBlock, 'index.css lost one of its two theme blocks');

// CP1 defect class: three :root blocks each holding part of the palette, so nobody could tell
// which value a light screen actually painted. The token source is one block per theme.
test('every light --mg-* role comes from one contiguous token block', () => {
  const rootBlocks = [...css.matchAll(/^:root \{/gm)];
  assert.equal(rootBlocks.length, 1, `the palette split into ${rootBlocks.length} :root blocks again`);
  assert.equal(css.match(/^:root \{[^}]*--mg-/gm)?.length, 1, 'a second block redeclares --mg-* roles');
});

const themableRoles = [
  '--mg-blue', '--mg-blue-pressed', '--mg-blue-tint', '--mg-blue-ink',
  '--mg-navy', '--mg-ink', '--mg-muted', '--mg-canvas', '--mg-line',
  '--mg-surface-tint', '--mg-surface-primary', '--mg-surface-secondary', '--mg-surface-glass',
  '--mg-ink-primary', '--mg-ink-secondary', '--mg-ink-muted',
  '--mg-border-subtle', '--mg-border-medium',
  '--mg-action', '--mg-action-hover', '--mg-card-shadow',
];

// Before CP1 only html.dark answered the surface/ink/border roles, so a light call site resolved
// to nothing and every consumer had to hand-write its own dark remap.
test('each themable role is declared once per theme, light included', () => {
  const light = declarations(lightBlock![0]);
  const dark = declarations(darkBlock![0]);
  assert.deepEqual(themableRoles.filter(role => !light.has(role) || !dark.has(role)), [],
    'a role is missing from one theme');
  const inSource = [...css.matchAll(/(--mg-[a-z0-9-]+):/g)].map(match => match[1]);
  assert.deepEqual(themableRoles.filter(role => inSource.filter(value => value === role).length !== 2), [],
    'a role is not declared exactly twice (light + dark)');
});

// Theme-neutral scales are declared once, in the token source, and are the only place a
// spacing/radius/stacking/type value may be written.
test('space, radius, stacking, type and motion scales exist in the token source', () => {
  const light = declarations(lightBlock![0]);
  const required = [
    '--mg-space-1', '--mg-space-2', '--mg-space-3', '--mg-space-4', '--mg-space-5',
    '--mg-space-6', '--mg-space-8', '--mg-space-10', '--mg-space-12',
    '--mg-radius-sm', '--mg-radius-md', '--mg-radius-lg', '--mg-radius-xl', '--mg-radius-2xl',
    '--mg-radius-3xl', '--mg-radius-sheet', '--mg-radius-pill',
    '--mg-z-base', '--mg-z-raised', '--mg-z-control', '--mg-z-sticky', '--mg-z-overlay',
    '--mg-type-micro', '--mg-type-caption', '--mg-type-label', '--mg-type-body',
    '--mg-type-lead', '--mg-type-title', '--mg-type-headline',
    '--mg-ease-standard', '--mg-ease-entrance', '--mg-ease-exit',
    '--mg-dur-tap', '--mg-dur-fast', '--mg-dur-base', '--mg-dur-slow',
  ];
  assert.deepEqual(required.filter(role => !light.has(role)), [], 'a scale left the token source');
});

// A var() that no theme answers paints nothing, and the consumer silently falls back. Two tokens
// are element-scoped by design and exempt: --mg-stagger-i is set from React inline styles, and
// --mg-label-tone is set by the .mg-map-label--tone-* modifiers on the label itself.
test('no --mg-* read by the app is left undeclared in light', async () => {
  const routeLight = css.match(/^\.route-map-screen \{[\s\S]*?\n\}/m);
  const routeDark = css.match(/^\.route-map-screen\[data-theme="dark"\] \{[\s\S]*?\n\}/m);
  assert.ok(routeLight && routeDark, 'the route sheet surface palette went missing');
  const declared = new Set([...declarations(lightBlock![0]), ...declarations(routeLight![0])]);
  assert.deepEqual([...declarations(routeDark![0])].filter(role => !declared.has(role)), [],
    'a route surface token has no light answer');

  const elementScoped = new Set(['--mg-stagger-i', '--mg-label-tone']);
  const unresolved = new Set<string>();
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (['.ts', '.tsx', '.css'].includes(extname(entry.name))) {
        const source = readFileSync(path, 'utf8');
        for (const match of source.matchAll(/var\((--mg-[a-z0-9-]+)[),]/g))
          if (!declared.has(match[1]) && !elementScoped.has(match[1])) unresolved.add(`${relative(root, path)} → ${match[1]}`);
      }
    }
  };
  walk(resolve(root, 'src'));
  assert.deepEqual([...unresolved].sort(), [], 'a screen reads a --mg-* token that no light surface declares');
});

// The 12 canonical categories carry real transit identity; CP1 is plumbing, so their colours must
// be identical to the base commit.
test('canonical --mode-* colours are untouched', () => {
  const expected: Record<string, string> = {
    '--mode-bus': '#1687FF', '--mode-marshrutka': '#F02F79', '--mode-trolleybus': '#00C2A0',
    '--mode-tram': '#8B3CE6', '--mode-metro': '#D6224A', '--mode-carpool': '#FF7A2F',
    '--mode-taxi': '#F5B51B', '--mode-train': '#6366F1', '--mode-bike': '#20B86A',
    '--mode-scooter': '#84CC16', '--mode-carsharing': '#00A8D6', '--mode-transfer': '#6C7A93',
    '--mode-walk': '#91A6BB', '--mode-wait': '#91A6BB', '--mode-ferry': '#0891B2',
    '--mode-funicular': '#64748B', '--mode-unknown': '#91A6BB',
  };
  const found = new Map([...css.matchAll(/(--mode-[a-z]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
  assert.deepEqual([...found.keys()].sort(), Object.keys(expected).sort(), 'the mode palette changed shape');
  for (const [name, value] of found) assert.equal(value, expected[name], `${name} drifted`);
});

// Ratchet, not a claim of cleanliness: the !important count must not increase while the palette
// converges, and the only extra hex literals allowed are the light mirrors that had no light value.
test('the token convergence did not add !important or stray hard-coded colours', () => {
  const body = stripComments(css);
  assert.equal((body.match(/!important/g) || []).length, 200, '!important grew past the CP1 baseline of 200');
  assert.ok((body.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length <= 385,
    'index.css gained hex literals beyond the four documented light mirrors');
});

// The live app has no reachable pixel baseline of its own (the 26 committed Playwright shots were
// recorded against the older standalone Web tree), so neutrality is proven where it is decided:
// on the resolved token values. tests/fixtures/theme-token-values.json is the palette as the
// release line rendered it, captured scope by scope from src/index.css.
const themeScopes = [':root', 'html.dark', '.route-map-screen', '.route-map-screen[data-theme="dark"]'];
const scopeDeclarations = (source: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declarationsInScope: Record<string, string> = {};
  for (const block of source.matchAll(new RegExp(`^${escaped} \\{([\\s\\S]*?)\\n\\}`, 'gm'))) {
    const body = block[1].replace(/\/\*[\s\S]*?\*\//g, '');
    for (const token of body.matchAll(/(--(?:mg|color|route|mode)-[a-z0-9-]+):\s*([^;]+);/g))
      declarationsInScope[token[1]] = token[2].trim();
  }
  return declarationsInScope;
};

test('merging the token source changed no rendered value in any theme', () => {
  const recorded = JSON.parse(readFileSync(resolve(root, 'tests/fixtures/theme-token-values.json'), 'utf8')) as
    Record<string, Record<string, string>>;
  for (const scope of themeScopes) {
    const current = scopeDeclarations(css, scope);
    const missing = Object.keys(recorded[scope]).filter(token => !(token in current));
    assert.deepEqual(missing, [], `${scope}: a token the app rendered is gone from the source`);
    const drift = Object.entries(recorded[scope])
      .filter(([token, value]) => current[token] !== value)
      .map(([token, value]) => `${scope} ${token}: ${value} → ${current[token]}`);
    assert.deepEqual(drift, [], 'the convergence moved a colour, shadow or geometry value');
  }
});

// A second token source in TypeScript is how two palettes drift apart silently.
test('the dead TypeScript token module stayed deleted', async () => {
  await assert.rejects(readFile(resolve(root, 'src/design-system/ui/tokens.ts'), 'utf8'),
    'design-system/ui/tokens.ts came back: the app must read one CSS token source');
});
