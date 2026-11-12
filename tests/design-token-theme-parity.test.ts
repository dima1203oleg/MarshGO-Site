import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

// Component-scoped ramps (--mg-label-*, --mg-callout-*, --mg-stagger-i) are set per element in
// markup, so only the theme families below are required to carry a value in both themes.
const RAMP_FAMILIES = ['--mg-ink-', '--mg-border-', '--mg-surface-', '--mg-blue'];

const bodies = (header: string) => [...css.matchAll(new RegExp(`(?:^|\\n)${header} \\{([\\s\\S]*?)\\n\\}`, 'g'))].map((match) => match[1]).join('\n');
const defined = (header: string) => new Set([...bodies(header).matchAll(/(--mg-[a-z-]+)\s*:/g)].map((match) => match[1]));

const light = defined(':root');
const dark = defined('html\\.dark');
const isRamp = (name: string) => RAMP_FAMILIES.some((family) => name.startsWith(family));
const read = [...new Set([...css.matchAll(/var\((--mg-[a-z-]+)[),]/g)].map((match) => match[1]))].filter(isRamp);

test('a theme ramp read by the stylesheet is defined in both themes', () => {
  const unpaired = read.filter((name) => !light.has(name) || !dark.has(name));
  assert.deepEqual(unpaired, [], 'a token missing from :root resolves to the inherited value in the light theme');
});

function runTokenGate(componentCss: string, omitThemeSheet = false) {
  const root = mkdtempSync(join(tmpdir(), 'mg-token-gate-'));
  try {
    mkdirSync(join(root, 'src/styles'), { recursive: true });
    mkdirSync(join(root, 'src/views'));
    writeFileSync(join(root, 'src/index.css'), ':root { --mg-ink: black; }');
    writeFileSync(join(root, 'src/styles/motion.css'), '');
    if (!omitThemeSheet) writeFileSync(join(root, 'src/styles/feedback.css'), '');
    writeFileSync(join(root, 'src/views/component.css'), componentCss);
    return spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/check-tokens.mjs', import.meta.url))], {
      cwd: root,
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('token gate recognizes component-scoped declarations', () => {
  const result = runTokenGate('.card { --mg-local: white; color: var(--mg-ink); background: var(--mg-local); }');
  assert.equal(result.status, 0, result.stderr);
});

test('token gate rejects a genuinely undefined component token', () => {
  const result = runTokenGate('.card { background: var(--mg-missing); }');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--mg-missing \(used in: src\/views\/component.css\)/);
});

test('token gate retains explicitly supported runtime variables', () => {
  const result = runTokenGate('.card { opacity: var(--mg-stagger-i); }');
  assert.equal(result.status, 0, result.stderr);
});

test('token gate still requires the global theme sheets', () => {
  const result = runTokenGate('.card { color: var(--mg-ink); }', true);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot read CSS file .*feedback.css/);
});
