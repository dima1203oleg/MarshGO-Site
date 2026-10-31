import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const canonicalDir = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/design/canonical');
const references = [
  ['task-2026-10-13/1-Фото-1.jpg', 'f9d4b61d267cb7ada6041d43f5ebab1c6b434ae8fb7f35e758f4c332bda0505f'],
  ['task-2026-10-13/8-Фото-8.jpg', 'ddf757b52ad00fc36e93b1fe1c45ea519b6612b94f30a0fafb98e163f9f6aa08'],
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
  ['journey-search-results/01-results-light-dark-board.jpg', '81ec8c9049a12a29b093faa0b6d0977f3102e16c4a90e9c8e696debf7d5862a5'],
  ['journey-search-results/02-results-light-detail.jpg', '2cd6bf47ad92f9ece3622a29803286148e1d2fbe21f76c6995fe3bffb7286259'],
  ['journey-search-results/03-results-dark-final.jpg', 'ed3954cce34fa604d6d14570b533b242ebb3b8c089f0a00b7503de408a9b6e00'],
  ['route-map-bottom-sheet/06-expanded-route-details-dark-final.jpg', '93d3c8db8eadedb3d3ae339be40a87adfcd097633f37d1b3d4edfed68b1b1df9'],
  ['route-map-bottom-sheet/07-half-sheet-dark-final.jpg', 'c029db8f7f0afcd55649ae66d2b29a791d13b8e8c558710546427fad0b9da8ee'],
  ['route-map-bottom-sheet/08-collapsed-map-dark-final.jpg', '104dae85afe60d83b66040006f0628f166e790248f96ca13ababb4a23899a884'],
] as const;

test('canonical MARSHGO design references stay owner-approved', async () => {
  for (const [filename, expectedHash] of references) {
    const bytes = await readFile(resolve(canonicalDir, filename));
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(actualHash, expectedHash, `${filename} changed; replace only with an owner-approved canonical board`);
  }
});
