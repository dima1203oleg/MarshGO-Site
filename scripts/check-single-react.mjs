import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Gate G6: check-single-react
 * Ensures there is strictly ONE copy of the React runtime / React factory in the production bundle.
 * Detects duplicate React runtimes across code-split chunks.
 */

const distAssetsDir = resolve(process.cwd(), 'dist/assets');

if (!existsSync(distAssetsDir)) {
  console.error(`G6 FAIL: Directory ${distAssetsDir} does not exist. Run 'npm run build' first.`);
  process.exit(1);
}

const jsFiles = readdirSync(distAssetsDir).filter((file) => file.endsWith('.js'));

if (jsFiles.length === 0) {
  console.error(`G6 FAIL: No JavaScript chunks found in ${distAssetsDir}.`);
  process.exit(1);
}

// React factory and runtime signatures
const REACT_FACTORY_PATTERNS = [
  /useState\s*=\s*function/g,
  /exports\.useState\s*=\s*function/g,
  /function\s+useState\s*\(/g,
];

const filesWithReactRuntime = [];

for (const file of jsFiles) {
  const filePath = join(distAssetsDir, file);
  const content = readFileSync(filePath, 'utf8');

  let matchCount = 0;
  for (const pattern of REACT_FACTORY_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      matchCount += matches.length;
    }
  }

  if (matchCount > 0) {
    filesWithReactRuntime.push({ file, matchCount });
  }
}

console.log(`[G6 check-single-react] Scanned ${jsFiles.length} chunk(s) in dist/assets`);
for (const entry of filesWithReactRuntime) {
  console.log(`  - ${entry.file}: ${entry.matchCount} React factory signature(s)`);
}

if (filesWithReactRuntime.length === 0) {
  console.error('G6 FAIL: No React runtime found in any bundle chunk (bundle is empty or invalid).');
  process.exit(1);
}

if (filesWithReactRuntime.length > 1) {
  console.error(
    `G6 FAIL: Multiple React runtimes detected in ${filesWithReactRuntime.length} files: ${filesWithReactRuntime.map((f) => f.file).join(', ')}. ` +
    'This causes "Cannot read properties of null (reading \'useState\')" and black screen in React.',
  );
  process.exit(1);
}

console.log(`G6 PASS: Exactly one React runtime chunk detected (${filesWithReactRuntime[0].file}).`);
process.exit(0);
