import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const canonicalDir = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/design/canonical');
const references = [
  ['marshgo-light-canonical.jpg', '3e9a728f6aaf9bf59a26f6698ffa78989aee778ec80d710f0e9cde52820eeedf'],
  ['marshgo-dark-canonical.jpg', '827223e04296385e55955d3689dc518ed38705c5aadde2d6cb94ea5fa600979f'],
] as const;

test('canonical MARSHGO light and dark design references stay owner-approved', async () => {
  for (const [filename, expectedHash] of references) {
    const bytes = await readFile(resolve(canonicalDir, filename));
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(actualHash, expectedHash, `${filename} changed; replace only with an owner-approved canonical board`);
  }
});
