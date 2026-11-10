import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { globalBottomNavigationInset } from '../src/views/globalBottomNavigationInset';

test('shared floating navigation clearance is measured from its visible top edge', () => {
  assert.equal(globalBottomNavigationInset(844, 722), 122);
  assert.equal(globalBottomNavigationInset(844, 844), 0);
  assert.equal(globalBottomNavigationInset(844, 900), 0);
  assert.equal(globalBottomNavigationInset(Number.NaN, 700), 0);
});

test('the shared floating bar stays above immersive route screens and their sheets reserve its inset', () => {
  const marketplace = readFileSync(new URL('../src/views/ProductionMarketplace.tsx', import.meta.url), 'utf8');
  const routeMap = readFileSync(new URL('../src/views/JourneyRouteMapScreen.tsx', import.meta.url), 'utf8');
  const activeNavigation = readFileSync(new URL('../src/views/JourneyActiveNavigation.tsx', import.meta.url), 'utf8');
  const gpsNavigation = readFileSync(new URL('../src/views/ProductionNavigation.tsx', import.meta.url), 'utf8');
  assert.match(marketplace, /<nav data-testid="global-bottom-navigation"/);
  assert.doesNotMatch(marketplace, /!immersiveRouteView && <nav data-testid="global-bottom-navigation"/);
  assert.match(routeMap, /bottom: `\$\{bottomNavigationInset\}px`/);
  assert.match(activeNavigation, /bottom: `\$\{bottomNavigationInset\}px`/);
  assert.match(routeMap, /extraBottomInset: bottomNavigationInset/);
  assert.match(activeNavigation, /sheetHeight \+ bottomNavigationInset \+ 24/);
  assert.match(gpsNavigation, /measureGlobalBottomNavigationInset/);
  assert.match(gpsNavigation, /bottom: `\$\{bottomNavigationInset\}px`/);
  assert.doesNotMatch(gpsNavigation, /bottom: 'calc\(4\.6rem \+ env\(safe-area-inset-bottom\)\)'/);
});
