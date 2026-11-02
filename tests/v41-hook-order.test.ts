import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/views/ProductionMarketplace.tsx', import.meta.url), 'utf8');

const componentBody = (() => {
  const start = source.indexOf('export function ProductionMarketplace()');
  assert.ok(start >= 0, 'ProductionMarketplace component must exist');
  const rest = source.slice(start + 'export function ProductionMarketplace()'.length);
  const nextExport = rest.indexOf('\nexport ');
  return nextExport === -1 ? rest : rest.slice(0, nextExport);
})();

test('v41: no React hook is called after a top-level early return (hook order must be stable)', () => {
  const earlyReturn = componentBody
    .split('\n')
    .findIndex((line) => /^  if \(.*return/.test(line));
  assert.ok(earlyReturn > 0, 'expected the guard renders to keep their early returns');
  const hookLines = componentBody
    .split('\n')
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^  (useEffect|useMemo|useState|useCallback)\(/.test(line));
  const offenders = hookLines.filter(({ index }) => index > earlyReturn).map(({ line }) => line.slice(0, 80));
  assert.deepEqual(offenders, [], 'hooks after an early return crash React when the guard stops returning');
});
