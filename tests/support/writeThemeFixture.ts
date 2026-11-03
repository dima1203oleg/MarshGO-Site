// Re-baseline tests/fixtures/theme-token-values.json from src/index.css:
//   npx tsx tests/support/writeThemeFixture.ts
//
// Run it only for a deliberate colour change, read the diff it prints, and commit the fixture in
// the same change as the CSS that moved. premium-token-source.test.ts fails without this, so the
// fixture must stay derived from source rather than hand-edited.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cssRoot, readThemeScopes, themeScopes } from './themeScopes';

const fixturePath = resolve(cssRoot, 'tests/fixtures/theme-token-values.json');
const { resolved } = readThemeScopes();
const before = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, Record<string, string>>;

for (const scope of themeScopes) {
  const current = resolved[scope];
  const moved = Object.entries(current)
    .filter(([token, value]) => (before[scope]?.[token] ?? null) !== value)
    .map(([token, value]) => `  ${scope} ${token}: ${before[scope]?.[token] ?? '(new)'} → ${value}`);
  const deleted = Object.keys(before[scope] ?? {}).filter(token => !(token in current))
    .map(token => `  ${scope} ${token}: ${before[scope][token]} → (deleted)`);
  console.log(`${scope}: ${Object.keys(current).length} tokens, ${moved.length} moved, ${deleted.length} deleted`);
  [...moved, ...deleted].forEach(line => console.log(line));
}

writeFileSync(fixturePath, JSON.stringify(resolved, null, 2) + '\n');
