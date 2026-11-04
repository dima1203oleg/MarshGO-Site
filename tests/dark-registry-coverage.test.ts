import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * DARK-REGISTRY-1 — the dark theme is a registry, not a wish.
 *
 * The remap block in src/index.css is the single place where a light-palette utility is told what it
 * means on graphite. Whenever a call site uses a light surface or a dark ink that the registry does
 * not name, the dark build silently renders the light value: near-white panels, and -800 ink that
 * measures ~1.4:1 against its own tint. This test walks the real module graph (src/main.tsx down) and
 * fails on any such utility that the registry — or an explicit `dark:` partner on the same line — does
 * not already cover.
 */

const repoRoot = path.resolve(import.meta.dirname, '..');
const srcRoot = path.join(repoRoot, 'src');
const css = fs.readFileSync(path.join(srcRoot, 'index.css'), 'utf8');

const EXTENSIONS = ['.tsx', '.ts', '.js', '.jsx', ''];

function resolveImport(fromFile: string, spec: string): string | null {
  if (spec.startsWith('@/')) {
    const base = path.resolve(srcRoot, spec.slice(2));
    for (const ext of EXTENSIONS) {
      const candidate = base + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
  }
  if (!spec.startsWith('.')) return null; // packages are leaves for styling purposes
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  for (const ext of ['.tsx', '.ts']) {
    const candidate = path.join(base, `index${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function moduleGraph(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    const specs = new Set<string>();
    for (const m of source.matchAll(/(?:^|\n)\s*(?:import|export)[^;'"]*['"]([^'"]+)['"]/g)) specs.add(m[1]);
    for (const m of source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.add(m[1]);
    for (const spec of specs) {
      const resolved = resolveImport(file, spec);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return [...seen];
}

// Selectors html.dark actually overrides. CSS escapes (`\/`, `\[`) are unescaped so a registry entry
// written as `.bg-blue-50\/70` compares equal to the JSX class name `bg-blue-50/70`.
const coveredSelectors = new Set<string>();
for (const rule of css.match(/html\.dark[^{}]*\{[^{}]*\}/g) ?? []) {
  const selector = rule.slice(0, rule.indexOf('{'));
  for (const token of selector.matchAll(/\.([^{,()\s]+)/g)) {
    const cls = token[1].replace(/\\/g, '').replace(/:.*$/, '');
    if (/^(bg|text|border|divide)-/.test(cls)) coveredSelectors.add(cls);
  }
}

const NEUTRAL_SURFACE = /^(slate|gray|zinc|neutral|stone)-(50|100|200)$/;
const ACCENT_SURFACE = /^(blue|emerald|amber|rose|red|green|indigo|violet|purple|sky|teal|cyan|orange)-(50|100)$/;
const NEUTRAL_INK = /^(slate|gray|zinc)-(500|600|700|800|900)$/;
const ACCENT_INK = /^(blue|emerald|amber|rose|red|green|indigo|violet|purple|sky|teal|cyan|orange)-(600|700|800|900)$/;
const NEUTRAL_LINE = /^(slate|gray)-(100|200|300)$/;
const ACCENT_LINE = /^(blue|emerald|amber|rose|red|green|indigo|sky|teal)-(100|200)$/;

const files = moduleGraph(path.join(srcRoot, 'main.tsx')).filter((f) => /\.(tsx|ts)$/.test(f));

test('dark registry: every light-palette utility in the canonical module graph has a dark partner', () => {
  assert.ok(files.includes(path.join(srcRoot, 'views/ProductionMarketplace.tsx')), 'module graph must include the canonical screen');
  const offenders: string[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    source.split('\n').forEach((line, index) => {
      for (const m of line.matchAll(/\b(?<prefix>(?:hover:|focus:|active:|group-hover:|sm:|md:|lg:)?)(?<kind>bg|text|border)-(?<palette>[a-z]+)-(?<shade>\d{2,3})(?:\/(?<alpha>\d+(?:\.\d+)?))?\b/g)) {
        const { prefix, kind, palette, shade, alpha } = m.groups as Record<string, string>;
        if (prefix || !palette || !shade) continue;
        const isOffender =
          (kind === 'bg' && (NEUTRAL_SURFACE.test(`${palette}-${shade}`) || ACCENT_SURFACE.test(`${palette}-${shade}`))) ||
          (kind === 'text' && (NEUTRAL_INK.test(`${palette}-${shade}`) || ACCENT_INK.test(`${palette}-${shade}`))) ||
          (kind === 'border' && (NEUTRAL_LINE.test(`${palette}-${shade}`) || ACCENT_LINE.test(`${palette}-${shade}`)));
        if (!isOffender) continue;
        const exact = `${kind}-${palette}-${shade}${alpha ? `/${alpha}` : ''}`;
        const base = `${kind}-${palette}-${shade}`;
        // Alpha tints must be named exactly: `.bg-blue-50` does not restyle `.bg-blue-50/70`.
        const inRegistry = alpha ? coveredSelectors.has(exact) : coveredSelectors.has(base);
        if (inRegistry) continue;
        // Or handled at the call site with an explicit dark: partner of the same property.
        if (new RegExp(`dark:${kind}-`).test(line)) continue;
        offenders.push(`${path.relative(repoRoot, file)}:${index + 1} ${exact}`);
      }
    });
  }

  assert.deepEqual(
    [...new Set(offenders)].sort(),
    [],
    'these utilities render their light value inside the dark theme — add them to the html.dark registry in src/index.css, or give the call site an explicit dark: partner',
  );
});

test('dark registry: alpha tints are named exactly, never inherited from their -50 partner', () => {
  // Guards the fix itself: `.bg-blue-50` in the registry must not be mistaken for `.bg-blue-50/70`.
  assert.ok(coveredSelectors.has('bg-blue-50/70'), 'bg-blue-50/70 (Зустріч із… panel) needs its own dark value');
  assert.ok(coveredSelectors.has('bg-slate-50/80'), 'bg-slate-50/80 (map layer popover) needs its own dark value');
  assert.ok(coveredSelectors.has('bg-amber-50/95'), 'bg-amber-50/95 (navigation warning) needs its own dark value');
  assert.ok(coveredSelectors.has('text-emerald-800'), 'emerald -800 ink is 1.4:1 on graphite');
  assert.ok(coveredSelectors.has('text-blue-600'), 'blue -600 ink is 3.7:1 on graphite, below AA at 12 px');
  assert.ok(coveredSelectors.has('text-rose-600'), 'rose -600 ink is 3.3:1 on its own tint');
});

test('token contract: white text never sits on --mg-blue, which is the stroke accent', () => {
  // src/index.css:41 states the rule: --mg-blue paints strokes/icons/large text, --mg-action fills a
  // control carrying white text. #1687FF under white measures 3.53:1 — below AA — while --mg-action
  // #0B63D6 measures 5.57:1. The create FAB had hard-painted `dark:bg-[#1687FF]` over
  // `bg-[var(--mg-action)] text-white`, so the dark theme silently broke a control the light theme
  // got right. Arbitrary hex is invisible to the palette registry above, so guard it here.
  const offenders: string[] = [];
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx|ts)$/.test(entry.name) ? [full] : [];
  });
  for (const file of walk(srcRoot)) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (!/text-white/.test(line)) return;
      const blueFill = /(?:dark:)?bg-\[(?:var\(--mg-blue\)|#1687FF)\]/.test(line)
        || /(?:dark:)?(?:from|to)-\[(?:var\(--mg-blue\)|#1687FF)\]/.test(line);
      if (blueFill) offenders.push(`${path.relative(repoRoot, file)}:${index + 1}`);
    });
  }
  assert.deepEqual(
    [...new Set(offenders)].sort(),
    [],
    'a control with white text must fill with --mg-action (5.57:1), never --mg-blue/#1687FF (3.53:1 — below AA)',
  );
});
