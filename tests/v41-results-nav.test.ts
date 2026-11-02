import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/views/ProductionMarketplace.tsx', import.meta.url), 'utf8');

const declaration = source.split('\n').find((line) => line.includes('const immersiveRouteView ='));
assert.ok(declaration, 'immersiveRouteView must exist in ProductionMarketplace');

test('v41: the journey results list keeps the global navigation (only the full-screen map is immersive)', () => {
  assert.ok(!/showResults/.test(declaration!), 'immersiveRouteView must not cover showResults: it removes data-testid="global-bottom-navigation" and applies .route-immersive-shell (height:100svh; overflow:hidden), which makes later result cards unreachable');
  assert.ok(/selectedRouteMap/.test(declaration!), 'the full-screen route map is the screen that should stay immersive');
});
