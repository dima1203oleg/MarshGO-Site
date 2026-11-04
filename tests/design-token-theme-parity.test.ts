import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
