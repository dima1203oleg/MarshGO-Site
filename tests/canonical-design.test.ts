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
  ['route-map-bottom-sheet/01-expanded-route-details.jpg', '9d59fa0820870320af9ac2bdb604c6b2ca0dd16ad75c328736f52d38d5928fe7'],
  ['route-map-bottom-sheet/02-half-sheet.jpg', '52896dd5b94f35506b4ac68550345f4c258ffe395236baabf9cc0dce72a02900'],
  ['route-map-bottom-sheet/03-map-overview.jpg', '4a72f1308dc9ca74cbe7bea88b1a6ae903330788f6220215f9991259a0c0c630'],
  ['route-map-bottom-sheet/04-route-details-map.jpg', '56654feb65be639e06b38b3962c8a7329ddd4fd535826f07041feebc69daba0b'],
  ['route-map-bottom-sheet/05-route-details-sheet.jpg', '3ee7cac6b35b273dc65fe3b5fb2acae7f1065ceb116dd70a6f0ba6a2d53b460e'],
  ['route-map-bottom-sheet/light/01-expanded-route-details.jpg', '3aaa6d452c6f05e842eb1ce35dd1888977b0ef131fa1287129877c70de195f91'],
  ['route-map-bottom-sheet/light/02-half-sheet.jpg', '37c647a4cadf7bd3b62bc250cb10436ec8caa964b6facbfe399e4a03660a49ac'],
  ['route-map-bottom-sheet/light/03-map-overview.jpg', 'c798aae62becae863386698d2548462afa88ef45711203c001c9c234b0a200be'],
] as const;

test('canonical MARSHGO design references stay owner-approved', async () => {
  for (const [filename, expectedHash] of references) {
    const bytes = await readFile(resolve(canonicalDir, filename));
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(actualHash, expectedHash, `${filename} changed; replace only with an owner-approved canonical board`);
  }
});
