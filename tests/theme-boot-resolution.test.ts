// THEME-1 (DESIGN_AUDIT_3.0 D-08 + D-06): theme resolution on the first frame and
// status feedback that does not rely on color alone.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { resolveThemeMode, resolveIsDark } from '../src/services/theme';

const repoRoot = path.resolve(import.meta.dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

// WCAG relative luminance contrast, identical to the browser-evidence script.
const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (a: string, b: string): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

test('resolveThemeMode accepts only the stored contract values and defaults to light', () => {
  assert.equal(resolveThemeMode('light'), 'light');
  assert.equal(resolveThemeMode('dark'), 'dark');
  assert.equal(resolveThemeMode('system'), 'system');
  assert.equal(resolveThemeMode('auto'), 'light', 'unknown stored values fall back like the old init did');
  assert.equal(resolveThemeMode(null), 'light');
});

test('resolveIsDark: Auto follows the OS while an explicit stored theme wins over it', () => {
  assert.equal(resolveIsDark('system', true), true, 'Авто on a dark OS must render dark');
  assert.equal(resolveIsDark('system', false), false, 'Авто on a light OS must render light');
  assert.equal(resolveIsDark('dark', false), true);
  assert.equal(resolveIsDark('light', true), false, 'a stored light choice must beat prefers-color-scheme: dark');
});

test('the boot script resolves the same way theme.ts does before the first paint', () => {
  const html = read('index.html');
  const bootBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .filter(block => block.includes('mg_theme'));
  assert.equal(bootBlocks.length, 1, 'exactly one inline script may read mg_theme');
  const boot = bootBlocks[0];
  assert.ok(boot.includes("'system'"), 'the shell must resolve a stored "system" (Авто) theme, not only "dark"');
  assert.ok(/matchMedia\(['"]\(prefers-color-scheme: dark\)['"]\)/.test(boot), 'the shell must consult the OS scheme');
  assert.ok(/classList\.add\(([^)]*'dark'[^)]*)\)/.test(boot), 'the shell must put .dark on <html> before React mounts');
});

test('theme.ts still listens for OS scheme changes while the mode is system', () => {
  const theme = read('src/services/theme.ts');
  assert.ok(theme.includes("addEventListener('change'"), 'the service must react to live prefers-color-scheme changes');
  assert.ok(/this\.currentTheme === 'system'/.test(theme));
  assert.ok(theme.includes('isDark()'), 'applyTheme must keep going through the resolver');
});

test('feedback.css defines AA-checked error tokens without touching transport colors', () => {
  const css = read('src/styles/feedback.css');
  assert.ok(!css.includes('!important'), 'no !important is allowed in the feedback layer');
  assert.ok(!/--mode-[a-z]+/.test(css), 'transport --mode-* colors are canonical and must stay untouched');
  const lightBlock = css.slice(css.indexOf(':root'), css.indexOf('html.dark'));
  const darkBlock = css.slice(css.indexOf('html.dark'));
  const token = (block: string, name: string): string => {
    const found = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block)?.[1];
    assert.ok(found, `${name} missing`);
    return found.toLowerCase();
  };
  const lightInk = token(lightBlock, '--mg-feedback-error-ink');
  const lightSurface = token(lightBlock, '--mg-feedback-error-surface');
  const darkInk = token(darkBlock, '--mg-feedback-error-ink');
  const darkSurface = token(darkBlock, '--mg-feedback-error-surface');
  assert.ok(contrast(lightInk, lightSurface) >= 4.5, `light error ${contrast(lightInk, lightSurface).toFixed(2)}:1 must clear AA`);
  assert.ok(contrast(darkInk, darkSurface) >= 4.5, `dark error ${contrast(darkInk, darkSurface).toFixed(2)}:1 must clear AA`);
});

test('index.css imports the feedback layer as its own single line', () => {
  const cssLines = read('src/index.css').split('\n');
  const importLines = cssLines.filter(line => line.includes('@import'));
  const feedback = importLines.filter(line => line.includes('./styles/feedback.css'));
  assert.equal(feedback.length, 1, 'exactly one import line for the feedback layer');
  assert.equal(feedback[0].trim(), '@import "./styles/feedback.css";', 'the import must live on its own line so PR conflicts stay single-line');
});

test('the marketplace status pill distinguishes errors with icon, text and role, not color alone', () => {
  const view = read('src/views/ProductionMarketplace.tsx');
  assert.ok(/role=\{statusIsError \? 'alert' : 'status'\}/.test(view), 'errors must announce role=alert');
  assert.ok(/statusIsError && <AlertCircle/.test(view), 'errors must carry a visible AlertCircle icon');
  assert.ok(view.includes('mg-feedback-error'), 'errors must use the tokenized error pill');
  assert.ok(/aria-hidden="true">Помилка/.test(view) || /sr-only[^>]*>\s*Помилка/.test(view), 'the pill must prefix a non-color text marker');
});
