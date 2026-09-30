import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const assetDirectory = path.resolve('dist/assets');
const javascript = (await readdir(assetDirectory)).filter((name) => name.endsWith('.js'));
if (javascript.length === 0) throw new Error('Production JavaScript bundle was not emitted');

const forbiddenProductionMarkers = ['conv_dmd_01', 'cand_duliby_01', 'dmd_stryi_lviv_01'];
for (const name of javascript) {
  const contents = await readFile(path.join(assetDirectory, name), 'utf8');
  const leakedMarker = forbiddenProductionMarkers.find((marker) => contents.includes(marker));
  if (leakedMarker) {
    throw new Error(`Demo data marker "${leakedMarker}" leaked into production asset ${name}`);
  }
}

const measurements = await Promise.all(javascript.map(async (name) => {
  const contents = await readFile(path.join(assetDirectory, name));
  return { name, gzipBytes: gzipSync(contents, { level: 9 }).byteLength };
}));
const largest = measurements.toSorted((left, right) => right.gzipBytes - left.gzipBytes).slice(0, 5);
for (const item of largest) console.log(`${item.name}: ${(item.gzipBytes / 1024).toFixed(1)} KB gzip`);

const budgetBytes = 350 * 1024;
const violations = measurements.filter((item) => item.gzipBytes > budgetBytes);
if (violations.length) {
  throw new Error(`JavaScript gzip budget exceeded (${budgetBytes} bytes): ${violations.map((item) => item.name).join(', ')}`);
}
console.log(`Bundle transfer budget passed: ${javascript.length} JavaScript chunks ≤ 350 KB gzip each`);
