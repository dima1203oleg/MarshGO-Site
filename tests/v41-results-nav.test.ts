import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/views/ProductionMarketplace.tsx', import.meta.url), 'utf8');

const declaration = source.split('\n').find((line) => line.includes('const immersiveRouteView ='));
assert.ok(declaration, 'immersiveRouteView must exist in ProductionMarketplace');

test('v41: results keep the global navigation and route maps move it below the viewport', () => {
  assert.ok(!/showResults/.test(declaration!), 'the results list remains outside the immersive route shell');
  assert.ok(/selectedRouteMap/.test(declaration!), 'the full-screen route map remains immersive');
  assert.match(source, /aria-hidden=\{!mapNavigationVisible\} inert=\{!mapNavigationVisible\}/, 'map screens hide the dock from assistive technology and keyboard focus');
  assert.match(source, /transform: mapNavigationVisible \? 'translateY\(0\)' : 'translateY\(calc\(100% \+ env\(safe-area-inset-bottom\)\)\)'/, 'map screens slide the dock below the safe area');
});
