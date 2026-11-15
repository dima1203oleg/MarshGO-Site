import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const routeScreen = read('src/views/JourneyRouteMapScreen.tsx');
const stops = read('src/views/JourneyLegStops.tsx');
const css = read('src/index.css');
const density = read('src/views/routeSheetDensity.css');

test('stop rows arrive as a bounded cascade, not a twenty-step delay', () => {
  assert.match(stops, /className="relative mg-rise mg-stagger"/);
  assert.match(stops, /Math\.min\(index, 6\)/, 'a 30-stop timetable must not wait 1.6 s for its last row');
});

test('the timeline node sits on the card header and is never clipped', () => {
  assert.doesNotMatch(routeScreen, /mg-route-segment overflow-hidden/, 'overflow-hidden clips the rail node that lives outside the card');
  assert.match(density, /inset-block-start: calc\(var\(--mg-sheet-card-pad-y\) \+ 22px\)/, 'the node centers on the 44 px header row, not on the middle of an expanded card');
  assert.match(density, /\.mg-route-segment > :last-child\s*\{[^}]*border-bottom-left-radius/s, 'without the clip, the last child keeps the card corners itself');
});

test('wait and transfer rows join the same itinerary rail', () => {
  assert.match(routeScreen, /className="mg-route-wait mg-fade rounded-xl/);
  assert.match(routeScreen, /className="mg-route-transfer mg-fade"/);
  assert.match(density, /\.mg-route-wait::before/);
  assert.match(density, /\.mg-route-transfer::before/);
});

test('selection answers once: node pulse, stop ping, bookmark pop', () => {
  for (const name of ['mg-node-pulse', 'mg-stop-ping', 'mg-bookmark-pop']) {
    assert.match(css, new RegExp(`@keyframes ${name}`), `${name} must be defined`);
    const rule = css.slice(css.indexOf(`animation: ${name}`), css.indexOf(';', css.indexOf(`animation: ${name}`)));
    assert.match(rule, / 1 both/, `${name} runs once per state change, never loops`);
  }
  assert.match(routeScreen, /route-save-toggle/);
  const guardAt = css.indexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('@keyframes mg-node-pulse'));
  assert.ok(guardAt > 0, 'the route reduced-motion guard must follow the new cues');
  const guard = css.slice(guardAt, css.indexOf('}', css.indexOf('animation: none !important', guardAt)));
  assert.match(guard, /mg-route-segment\[data-active="true"\]::before/);
  assert.match(guard, /mg-journey-stop-row\[aria-pressed="true"\]/);
  assert.match(guard, /route-save-toggle/);
});

test('the selected card ring comes from the accent token, not a hand-picked blue', () => {
  assert.doesNotMatch(routeScreen, /rgba\(22,135,255/, 'rgba(22,135,255) is #1687FF in disguise');
  assert.match(routeScreen, /color-mix\(in_srgb,var\(--mg-blue\)_45%,transparent\)/);
});

test('summary pills pop once when details open', () => {
  assert.match(routeScreen, /route-sheet-summary__metrics mg-pop mg-stagger/);
  assert.match(routeScreen, /route-sheet-summary__fare mg-pop mg-stagger/);
});

test('compact ribbon text uses a surface instead of transport fill and stays opaque', () => {
  assert.match(routeScreen, /backgroundColor: 'var\(--route-card\)', borderColor: walk \? 'var\(--route-ribbon-walk\)' : item\.color/);
  assert.match(css, /\.mg-route-ribbon--compact \.mg-route-ribbon__item\.is-muted \{ opacity: 1; \}/);
  for (const name of ['label', 'detail']) {
    const rule = css.match(new RegExp(`\\.mg-route-ribbon--compact \\.mg-route-ribbon__${name} \\{([^}]+)\\}`))?.[1];
    assert.ok(rule);
    assert.doesNotMatch(rule, /font-size:/, 'compact text inherits the readable ribbon type scale');
  }
});