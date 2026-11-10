import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/views/ProductionMarketplace.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

const declaration = source.split('\n').find((line) => line.includes('const immersiveRouteView ='));
assert.ok(declaration, 'immersiveRouteView must exist in ProductionMarketplace');

test('the global five-item navigation remains mounted in route details and active navigation', () => {
  assert.ok(!/showResults/.test(declaration!), 'immersiveRouteView must not cover showResults: it removes data-testid="global-bottom-navigation" and applies .route-immersive-shell (height:100svh; overflow:hidden), which makes later result cards unreachable');
  assert.ok(/selectedRouteMap/.test(declaration!), 'the full-screen route map is the screen that should stay immersive');
  assert.match(source, /<nav data-testid="global-bottom-navigation"/, 'the app navigation must be rendered independently of the immersive route state');
  assert.doesNotMatch(source, /\{\s*!immersiveRouteView\s*&&\s*<nav data-testid="global-bottom-navigation"/, 'route details and active navigation must not remove the global navigation');
  assert.match(source, /<JourneyRouteMapScreen\s+key=\{journey\.id\}\s+journey=\{journey\}\s+reserveBottomNavigation/, 'route details reserve the mounted tab bar');
  assert.match(source, /<JourneyActiveNavigation\s+journey=\{activeJourneyNavigation\}\s+reserveBottomNavigation/, 'active navigation reserves the mounted tab bar');
  assert.match(css, /\.route-immersive-shell > \.app-tabbar\s*\{[^}]*z-index:\s*calc\(var\(--mg-z-map-chip\) \+ 1\)/, 'the tab bar must paint above the fixed route map layer');
});
