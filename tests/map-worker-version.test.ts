import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
for (const [asset, dependency] of [
  ['marshgo-maplibre-worker.mjs', 'maplibre-gl-worker.mjs'],
  ['maplibre-gl-shared.mjs', 'maplibre-gl-shared.mjs'],
]) {
  test(`raw development ${asset} matches the installed map renderer`, () => {
    const installed = readFileSync(require.resolve(`maplibre-gl/dist/${dependency}`));
    const served = readFileSync(new URL(`../public/${asset}`, import.meta.url));
    assert.ok(served.equals(installed), `${asset} must come from the installed MapLibre version`);
  });
}
