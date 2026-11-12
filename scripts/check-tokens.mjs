import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Gate G8: check-tokens
 * Ensures that all referenced CSS custom properties:
 * - var(--mg-*)
 * - var(--route-*)
 * - var(--mg-label-*)
 * have valid definitions in the global theme sheets (either in :root, html.dark, or component scope).
 * Also supports runtime inline style variables (--mg-stagger-i, --segment-color, --route-map-inset, --mg-label-tone).
 */

const projectRoot = process.cwd();
const srcDir = resolve(projectRoot, 'src');

function findSourceFiles(dir) {
  let results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(findSourceFiles(full));
    } else if (/\.(tsx?|css)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

const files = findSourceFiles(srcDir);
const cssFiles = new Set([
  join(srcDir, 'index.css'),
  join(srcDir, 'styles/motion.css'),
  join(srcDir, 'styles/feedback.css'),
  ...files.filter((file) => file.endsWith('.css')),
]);

const definedTokens = new Set();
const definedRegex = /(--[a-zA-Z0-9_-]+)\s*:/g;

for (const cssPath of cssFiles) {
  try {
    const content = readFileSync(cssPath, 'utf8');
    let m;
    while ((m = definedRegex.exec(content)) !== null) {
      definedTokens.add(m[1]);
    }
  } catch (err) {
    console.error(`G8 FAIL: Cannot read CSS file ${cssPath}:`, err.message);
    process.exit(1);
  }
}

// Dynamic runtime style tokens injected via React style attributes
const RUNTIME_DYNAMIC_TOKENS = new Set([
  '--mg-stagger-i',
  '--segment-color',
  '--route-map-inset',
  '--mg-label-tone',
]);

const usedTokensWithLocations = new Map();
const varRegex = /var\(\s*(--[a-zA-Z0-9_-]+)/g;

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  let match;
  while ((match = varRegex.exec(content)) !== null) {
    const token = match[1];
    if (!usedTokensWithLocations.has(token)) {
      usedTokensWithLocations.set(token, []);
    }
    const relPath = file.replace(`${projectRoot}/`, '');
    usedTokensWithLocations.get(token).push(relPath);
  }
}

console.log(`[G8 check-tokens] Found ${definedTokens.size} declared tokens and ${usedTokensWithLocations.size} referenced tokens.`);

const missingTokens = [];
for (const [token, locations] of usedTokensWithLocations.entries()) {
  if (RUNTIME_DYNAMIC_TOKENS.has(token)) continue;
  if (!definedTokens.has(token)) {
    missingTokens.push({ token, locations: [...new Set(locations)] });
  }
}

if (missingTokens.length > 0) {
  console.error('\n[G8 check-tokens] FAIL: The following tokens are referenced but NOT defined in CSS:');
  for (const { token, locations } of missingTokens) {
    console.error(`  - ${token} (used in: ${locations.join(', ')})`);
  }
  process.exit(1);
}

console.log('[G8 check-tokens] PASS: All referenced CSS custom properties are properly defined.');
process.exit(0);
