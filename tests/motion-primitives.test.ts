import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// MOTION-1 regression guard. The audit (D-17) found animate-slideUp,
// animate-fade-in and animate-spin-slow referenced across components while
// index.css defined nothing under those names, so every entrance they were
// supposed to carry popped in instantly. This test fails if any animate-*
// utility is used in src/ without a matching definition somewhere in src/*.css
// (or a Tailwind v4 built-in).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = resolve(root, 'src');

// Tailwind v4 ships these keyframe utilities in its default theme; anything
// else must be defined by our own stylesheets.
const TAILWIND_V4_BUILTINS = new Set(['spin', 'ping', 'pulse', 'bounce']);

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

const files = walkFiles(srcDir);
const cssFiles = files.filter((f) => f.endsWith('.css'));
const codeFiles = files.filter((f) => /\.tsx?$/.test(f));

test('every animate-* class used in src is defined in a stylesheet or built into Tailwind', () => {
  const defined = new Set<string>();
  for (const file of cssFiles) {
    const css = readFileSync(file, 'utf8');
    // Plain class selectors (.animate-fadeIn) and @theme tokens (--animate-*).
    for (const match of css.matchAll(/\.animate-([A-Za-z0-9_-]+)\s*(?=[{,:])/g)) defined.add(match[1]);
    for (const match of css.matchAll(/--animate-([A-Za-z0-9_-]+)\s*:/g)) defined.add(match[1]);
  }

  const offenders: string[] = [];
  for (const file of codeFiles) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(/\banimate-([A-Za-z0-9_-]+)/g)) {
        const name = match[1];
        if (!defined.has(name) && !TAILWIND_V4_BUILTINS.has(name)) {
          offenders.push(`${relative(root, file)}:${index + 1} uses animate-${name} with no definition`);
        }
      }
    });
  }
  assert.deepEqual(offenders, [], `dead animation classes found:\n${offenders.join('\n')}`);
});

test('JS scrollIntoView honours prefers-reduced-motion (D-18)', () => {
  const offenders: string[] = [];
  for (const file of codeFiles) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (line.includes('scrollIntoView(') && line.includes('behavior')) {
        if (!line.includes('prefers-reduced-motion')) {
          offenders.push(`${relative(root, file)}:${index + 1} smooth scroll without a reduced-motion check`);
        }
      }
    });
  }
  assert.deepEqual(offenders, [], `unconditional smooth scrolls found:\n${offenders.join('\n')}`);
});

test('the spin-slow primitive is switched off under prefers-reduced-motion', () => {
  const motionCss = readFileSync(resolve(srcDir, 'styles/motion.css'), 'utf8');
  assert.match(motionCss, /@keyframes\s+mg-spin\b/, 'mg-spin keyframe must exist');
  assert.match(motionCss, /\.animate-spin-slow\s*\{[^}]*animation:\s*mg-spin/, 'animate-spin-slow must bind mg-spin');
  assert.match(
    motionCss,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.animate-spin-slow\s*\{\s*animation:\s*none/,
    'animate-spin-slow must be disabled under reduced motion'
  );
});
