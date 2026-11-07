import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const sourceRoot = join(process.cwd(), 'src');
const builtInTailwindAnimations = new Set(['spin', 'ping', 'pulse', 'bounce']);

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

test('every static animate-* utility used by Site is defined or built into Tailwind', () => {
  const files = filesBelow(sourceRoot);
  const codeFiles = files.filter((path) => /\.tsx?$/.test(path));
  const css = files.filter((path) => path.endsWith('.css')).map((path) => readFileSync(path, 'utf8')).join('\n');
  const defined = new Set<string>();
  for (const match of css.matchAll(/\.animate-([A-Za-z0-9_-]+)\s*(?=[{,:])/g)) defined.add(match[1]);
  for (const match of css.matchAll(/--animate-([A-Za-z0-9_-]+)\s*:/g)) defined.add(match[1]);

  const used = new Set<string>();
  for (const path of codeFiles) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/\banimate-([A-Za-z0-9_-]+)/g)) used.add(match[1]);
  }
  const undefinedUtilities = [...used].filter((name) => !defined.has(name) && !builtInTailwindAnimations.has(name));
  assert.deepEqual(undefinedUtilities, [], `undefined animation utilities: ${undefinedUtilities.join(', ')}`);
});

test('programmatic smooth scroll respects reduced motion', () => {
  const onboarding = readFileSync(join(sourceRoot, 'components/OnboardingTour.tsx'), 'utf8');
  assert.match(onboarding, /scrollIntoView\(\{ behavior: window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches \? 'auto' : 'smooth'/);
});
