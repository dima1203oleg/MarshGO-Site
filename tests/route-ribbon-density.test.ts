import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(path.resolve(import.meta.dirname, '../src/index.css'), 'utf8');
const peekRibbon = css.slice(css.indexOf('/* PEEK keeps'));
const routeScreen = readFileSync(path.resolve(import.meta.dirname, '../src/views/JourneyRouteMapScreen.tsx'), 'utf8');

test('peek keeps each route stage visible in a swipeable compact horizontal row', () => {
  assert.match(routeScreen, /data-testid="route-peek-ribbon"[^>]*role="list"/);
  assert.match(routeScreen, /className=\{`route-peek-ribbon__stage mg-press-subtle/);
  assert.doesNotMatch(routeScreen, /data-testid="route-peek-chain"|data-testid="route-peek-scale"/);
  assert.match(peekRibbon, /\.route-peek-ribbon\s*\{[^}]*overflow-x:\s*auto;[^}]*-webkit-overflow-scrolling:\s*touch;/s);
  assert.match(peekRibbon, /\.route-peek-ribbon__stage\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(peekRibbon, /\.route-peek-ribbon__stage\.is-active\s*\{/);
});
