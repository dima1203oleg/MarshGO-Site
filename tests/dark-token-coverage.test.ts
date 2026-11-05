import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * `themeService` flips the theme by adding `html.dark`, and every dark-only Tailwind utility
 * (`dark:bg-[var(--x)]`) resolves `--x` against the value the `html.dark` block restates. A token that
 * only exists in `:root` silently keeps its light value in the dark theme, which is how a dark screen
 * ends up with a white chip or a white dropdown behind dark text. The gate is cheap and catches the
 * whole defect class instead of one screen at a time.
 */

const cssUrl = new URL('../src/index.css', import.meta.url);
const srcRoot = new URL('../src/', import.meta.url);

function sourceFiles(dir: URL): string[] {
  const root = decodeURIComponent(dir.pathname);
  return readdirSync(root).flatMap((entry) => {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) return sourceFiles(new URL(`${entry}/`, dir));
    return /\.(tsx?|css)$/.test(entry) ? [full] : [];
  });
}

/** The declaration block of `html.dark { … }`, matched by brace depth so nested rules cannot cut it short. */
function darkThemeBlock(css: string): string {
  const start = css.indexOf('html.dark {');
  assert.ok(start >= 0, 'index.css must carry an html.dark token block');
  let depth = 0;
  let end = start;
  for (let index = css.indexOf('{', start); index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) { end = index; break; }
    }
  }
  return css.slice(start, end + 1);
}

const declaredInDark = new Set([...darkThemeBlock(readFileSync(cssUrl, 'utf8')).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

describe('dark theme token coverage', () => {
  it('restates every token a dark-only utility reads', () => {
    const gaps: string[] = [];
    for (const file of sourceFiles(srcRoot)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/dark:[a-z-]+-\[var\((--[\w-]+)\)\]/g)) {
        if (!declaredInDark.has(match[1])) gaps.push(`${match[1]} (used in ${file.split('/src/')[1]})`);
      }
    }
    assert.deepEqual([...new Set(gaps)].sort(), [], 'dark: utilities must read tokens html.dark actually restates');
  });

  it('declares the raised surface and the subtle action in both themes', () => {
    const css = readFileSync(cssUrl, 'utf8');
    for (const token of ['--mg-surface-elevated', '--mg-action-subtle']) {
      assert.ok(css.includes(`${token}:`), `${token} must be declared`);
      assert.ok(darkThemeBlock(css).includes(`${token}:`), `${token} must be re-declared for the dark theme`);
    }
  });

  it('fails when a dark utility reads a token the dark block does not restate', () => {
    // Negative control: the gate has to be able to go red, otherwise "coverage" is just a wish.
    const broken = 'html.dark {\n  --mg-ink: #F5F9FF;\n}\n:root { --mg-surface-elevated: #FFFFFF; }';
    const block = darkThemeBlock(broken);
    assert.equal(block.includes('--mg-surface-elevated:'), false);
    assert.ok(!/--mg-surface-elevated\s*:/.test(block), 'a token declared only in :root must not count as covered');
  });
});
