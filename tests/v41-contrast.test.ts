import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const srcRoot = path.resolve(import.meta.dirname, '../src');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx|css)$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles(srcRoot);

test('v41: no white text sits on a -600 emerald/amber fill (below AA at badge sizes)', () => {
  const offenders: string[] = [];
  for (const file of files) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (!/text-white/.test(line)) return;
      const hit = /(?:hover:|border:)?bg-(?:emerald|amber)-600\b/.exec(line);
      if (hit) offenders.push(`${path.relative(srcRoot, file)}:${index + 1} ${hit[0]}`);
    });
  }
  assert.deepEqual(offenders, [], 'white on #059669 is 3.77:1 and on #D97706 is 3.19:1 — AA needs 4.5:1 for 10–12 px text; -700 fills give 5.48:1 and 5.02:1');
});

test('v41: the light-theme secondary ink keeps the AA-checked hex', () => {
  const css = fs.readFileSync(path.join(srcRoot, 'index.css'), 'utf8');
  const lightBlock = css.slice(css.indexOf(':root {\n  --mg-blue: #327FC3;'));
  const muted = /--mg-muted:\s*(#[0-9a-fA-F]{6})/.exec(lightBlock)?.[1]?.toLowerCase();
  assert.equal(muted, '#526477', '#64748b measured 4.76:1 on white; #526477 measures 6.09:1');
});
