import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { readThemeScopes } from './support/themeScopes';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// CP5 repaints every chrome surface from one blue ramp. A palette that converges can quietly
// become unreadable, and no amount of token-shape checking sees that, so this reads the live token
// source and does the arithmetic the browser would. It deliberately does not read
// tests/fixtures/theme-token-values.json: a fixture can be regenerated to match a regression, and
// then the guard passes on the very change it exists to catch.
const { resolved } = readThemeScopes();

type Rgb = { r: number; g: number; b: number; a: number };

const parse = (value: string): Rgb => {
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+?)\)$/.exec(value);
  if (mix) {
    const over = parse(mix[1]);
    const under = parse(mix[3]);
    const pct = Number(mix[2]) / 100;
    return {
      r: over.r * pct + under.r * (1 - pct),
      g: over.g * pct + under.g * (1 - pct),
      b: over.b * pct + under.b * (1 - pct),
      a: over.a * pct + under.a * (1 - pct),
    };
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map(d => d + d) : [hex[1].slice(0, 2), hex[1].slice(2, 4), hex[1].slice(4, 6)];
    return { r: parseInt(digits[0], 16), g: parseInt(digits[1], 16), b: parseInt(digits[2], 16), a: 1 };
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(value);
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] === undefined ? 1 : +rgb[4] };
  throw new Error(`contrast harness cannot read "${value}" — teach parse() before trusting the result`);
};

// Alpha is never a contrast answer: a 94% opaque glass header reads against the canvas behind it,
// so compositing first is what makes the ratio the passenger actually sees.
const flatten = (fg: Rgb, bg: Rgb): Rgb => (fg.a >= 1 ? fg : {
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});

const channel = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = ({ r, g, b }: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const ratio = (scope: Record<string, string>, fgToken: string, bgToken: string, baseToken = '--mg-canvas') => {
  for (const token of [fgToken, bgToken])
    assert.ok(token in scope, `theme does not declare ${token}`);
  const base = flatten(parse(scope[baseToken]), parse(scope['--mg-canvas']));
  const bg = flatten(parse(scope[bgToken]), base);
  const fg = flatten(parse(scope[fgToken]), bg);
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

// WCAG 2.1 AA: 4.5 for body and label text, 3.0 for large text and for a non-text control that
// only has to be *findable*. Each pair below is the actual pairing a screen paints.
const textPairs: [string, string, string, string][] = [
  ['--mg-ink-primary', '--mg-surface-primary', '--mg-canvas', 'body copy on a card'],
  ['--mg-ink-primary', '--mg-surface-glass', '--mg-canvas', 'body copy on glass chrome'],
  ['--mg-ink-secondary', '--mg-surface-primary', '--mg-canvas', 'secondary copy on a card'],
  ['--mg-ink-muted', '--mg-surface-primary', '--mg-canvas', 'muted caption on a card'],
  ['--mg-ink-muted', '--mg-canvas', '--mg-canvas', 'muted caption on the page'],
  ['--mg-blue-ink', '--mg-blue-tint', '--mg-canvas', 'blue link ink on a blue tint chip'],
  ['--mg-blue-ink', '--mg-surface-primary', '--mg-canvas', 'blue link ink on a card'],
  ['--mg-on-action', '--mg-action', '--mg-canvas', 'label on the filled primary control'],
  ['--mg-success-ink', '--mg-success-tint', '--mg-surface-primary', 'success label on a success chip'],
  ['--mg-warning-ink', '--mg-warning-tint', '--mg-surface-primary', 'warning label on a warning chip'],
  ['--mg-danger-ink', '--mg-danger-tint', '--mg-surface-primary', 'error label on an error chip'],
];

const uiPairs: [string, string, string, string][] = [
  ['--mg-blue', '--mg-canvas', '--mg-canvas', 'identity blue stroke on the page'],
  ['--mg-blue', '--mg-surface-primary', '--mg-canvas', 'identity blue icon on a card'],
];

for (const [name, theme] of [['light', ':root'], ['dark', 'html.dark']] as const) {
  const scope = resolved[theme];
  test(`${name}: every documented text pairing clears WCAG AA 4.5`, () => {
    const failures = textPairs
      .filter(([fg]) => !/ink|on-action/.test(fg))
      .map(([fg]) => `${name} uses a non-ink token as body text: ${fg}`);
    assert.deepEqual(failures, [], 'a pairing must name the ink token the screen actually uses');
    const below = textPairs
      .map(([fg, bg, base, label]) => [ratio(scope, fg, bg, base), fg, label] as const)
      .filter(([r]) => r < 4.5)
      .map(([r, fg, label]) => `${label}: ${fg} at ${r.toFixed(2)} (needs 4.5)`);
    assert.deepEqual(below, [], `${name} theme has text below AA`);
  });

  test(`${name}: identity and border tokens clear the 3.0 non-text floor`, () => {
    const below = uiPairs
      .map(([fg, bg, base, label]) => [ratio(scope, fg, bg, base), fg, label] as const)
      .filter(([r]) => r < 3)
      .map(([r, fg, label]) => `${label}: ${fg} at ${r.toFixed(2)} (needs 3.0)`);
    assert.deepEqual(below, [], `${name} theme has a control affordance below the non-text floor`);
  });
}

// Three blues, three jobs. --mg-blue is an identity stroke that goes bright in dark; --mg-action is
// a fill that stays dark because it carries --mg-on-action. Blurring them is how a control ends up
// with near-white text on near-white blue (2.6:1 in dark). The check is the *pairing*, not the
// token: an aria-hidden pulse dot filled with --mg-blue is correct and must not be swept up by a
// rule that only exists to catch a label on the wrong blue.
test('nothing fills with the identity blue and carries the on-action label', () => {
  const fills = /\bbg-\[(?:color:)?var\(--mg-blue\)\]/;
  const labels = /\btext-\[(?:color:)?var\(--mg-on-action\)\]|\btext-white\b/;
  const offenders: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (['.ts', '.tsx'].includes(extname(path))) {
        for (const line of readFileSync(path, 'utf8').split('\n'))
          if (fills.test(line) && labels.test(line))
            offenders.push(`${relative(root, path)}: ${line.trim().slice(0, 90)}`);
      }
      else if (extname(path) === '.css') {
        const source = readFileSync(path, 'utf8');
        for (const block of source.matchAll(/\{[^{}]*\}/g))
          if (/background(?:-color)?\s*:\s*(?!.*(?:gradient|color-mix))[^;]*var\(--mg-blue\)(?!-)/.test(block[0])
            && /color:\s*var\(--mg-on-action\)/.test(block[0]))
            offenders.push(`${relative(root, path)}: fills --mg-blue under --mg-on-action`);
      }
    }
  };
  walk(resolve(root, 'src'));
  assert.deepEqual(offenders, [], 'pair --mg-action with --mg-on-action; --mg-blue is a stroke, not a label background');
});

// Steps 300/400/700/800 are the ones a dark screen reads as ink or accent, so they have to survive
// against the page. 50/100/200 are tints and 900/950 deep navy — those are backgrounds, and a
// background that barely differs from the page it sits on is the point, not a defect.
test('the dark accent steps of the blue ramp stay readable against the dark page', () => {
  const dark = resolved['html.dark'];
  const accents = ['--mg-blue-300', '--mg-blue-400', '--mg-blue-700', '--mg-blue-800'];
  const missing = accents.filter(token => !(token in dark));
  assert.deepEqual(missing, [], 'a dark accent step left the ramp');
  const below = accents
    .map(token => [token, ratio(dark, token, '--mg-canvas', '--mg-canvas')] as const)
    .filter(([, r]) => r < 3)
    .map(([token, r]) => `${token} at ${r.toFixed(2)}`);
  assert.deepEqual(below, [], 'a dark accent step falls under the 3.0 non-text floor');
});
