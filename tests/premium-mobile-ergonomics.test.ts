import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { createFrameWriter, prefersReducedMotion, subscribeReducedMotion } from '../src/views/routeSheet';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');
const css = read('src/index.css');
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '');
const code = stripComments(css);

/**
 * CP4 guard: the owner's iPhone readability floor is 12 px and the touch floor is 44x44 px.
 * Both are declared once in the token source, so a regression has to fail here rather than
 * reappear as an unreadable caption on a 6.3-inch screen.
 */
test('type scale never goes below the 12 px iPhone reading floor', () => {
  const sizes = [...code.matchAll(/--mg-type-([a-z-]+):\s*([0-9.]+)px/g)];
  assert.ok(sizes.length >= 6, `only ${sizes.length} type steps found`);
  for (const [, name, value] of sizes) {
    const px = Number.parseFloat(value);
    assert.ok(px >= 12, `--mg-type-${name} is ${px}px, below the 12 px floor`);
  }
  assert.equal(code.match(/--mg-type-name:\s*14px/)?.[0], '--mg-type-name: 14px', 'the primary-name step must be the owner-set 14 px');
});

test('the touch floor is the single 44 px source and the visible controls use it', () => {
  assert.match(code, /--mg-touch:\s*2\.75rem/);
  for (const selector of [
    /\.journey-result-transfer-badge \{ min-width: var\(--mg-touch\)/,
    /\.journey-result-action-badge \{ width: var\(--mg-touch\); height: var\(--mg-touch\)/,
    /\.journey-search-card input \{ min-height: var\(--mg-touch\);/,
    // The tappable node is the `summary` inside `.maplibregl-ctrl-attrib`, not an element carrying
    // both classes: the compound selector compiled, matched nothing and the ⓘ stayed at 24x24 px.
    // Only measuring the live page caught it, so the guard pins the selector that actually matches.
    /\.maplibregl-ctrl-attrib summary\.maplibregl-ctrl-attrib-button,/,
    /\.mg-route-ribbon__pill::before \{[\s\S]*?height: var\(--mg-touch\)/,
  ]) {
    assert.match(code, selector, `a control lost the touch floor: ${selector}`);
  }
});

test('no stylesheet rule sets text below the reading floor any more', () => {
  const offenders = [...code.matchAll(/font-size:\s*(9|9\.5|10|10\.5|11|11\.5)px/g)].map(m => m[0]);
  assert.deepEqual(offenders, [], `sub-12 px sizes returned: ${offenders.join(', ')}`);
  // The list above is exactly what let `.625rem` through: the short-viewport block (max-height 620px)
  // kept 10 px hero copy on a 320x568 screen, and only the live measurement at that width found it.
  // So convert every literal — px and rem — rather than matching known-bad numbers.
  const literals: string[] = [];
  for (const match of code.matchAll(/font-size:\s*([0-9.]+)(px|rem)/g)) {
    const px = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
    if (px < 12) literals.push(`${match[0]} = ${px.toFixed(1)} px`);
  }
  assert.deepEqual(literals, [], `sub-12 px literals returned: ${literals.join(', ')}`);
  assert.doesNotMatch(code, /transport-mode-grid button \{[^}]*font-size:\s*9px/, 'the narrow-phone rule shrank mode captions again');
});

test('the arbitrary-utility reading floor is one unlayered rule, not 500 call sites', () => {
  const rule = code.match(/\.production-app :is\(([^)]*)\) \{\s*font-size: var\(--mg-type-label\);/);
  assert.ok(rule, 'the central .production-app type floor disappeared');
  for (const utility of ['text-\\[10px\\]', 'text-\\[10\\.5px\\]', 'text-\\[11px\\]', 'text-\\[0\\.72rem\\]']) {
    assert.ok(rule[1].includes(utility), `floor missed .${utility}`);
  }
  assert.ok(!rule[0].includes('!important'), 'the type floor must win by cascade, not by !important');
});

test('the twelve categories keep the registry order and their canonical colors', async () => {
  const { transportModeRegistry } = await import('../src/design-system/transport/transportModeRegistry');
  const canonical = ['bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'carpool', 'taxi', 'train', 'bike', 'scooter', 'carsharing', 'transfer'];
  assert.deepEqual(Object.keys(transportModeRegistry), canonical, 'the public category set or its order changed');
  const palette = [...code.matchAll(/--mode-([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)];
  for (const id of canonical) {
    const visual = transportModeRegistry[id as keyof typeof transportModeRegistry];
    const token = palette.find(entry => entry[1] === id);
    assert.ok(token, `--mode-${id} vanished from the token source`);
    assert.equal(token[2].toUpperCase(), visual.color.toUpperCase(), `--mode-${id} no longer matches the registry colour`);
  }
});

test('the mode grid re-flows instead of shrinking its captions', () => {
  assert.match(code, /\.transport-mode-grid \{[^}]*grid-template-columns: repeat\(auto-fit, minmax\(4\.75rem, 1fr\)\)/);
  const panel = read('src/components/TransportTypesPanel.tsx');
  assert.doesNotMatch(panel, /transport-mode-grid grid \$\{compact \? 'grid-cols/, 'the panel pinned a fixed column count again');
});

test('drag writes land once per frame, latest value wins', () => {
  const queue = new Map<number, () => void>();
  let nextHandle = 1;
  const request = (callback: () => void) => { queue.set(nextHandle, callback); return nextHandle++; };
  const cancel = (handle: number) => { queue.delete(handle); };
  const drain = () => { const callbacks = [...queue.values()]; queue.clear(); for (const cb of callbacks) cb(); };
  const writes: number[] = [];
  const writer = createFrameWriter(height => writes.push(height), request, cancel);
  writer.schedule(100);
  writer.schedule(140);
  writer.schedule(180);
  assert.equal(queue.size, 1, 'each pointermove scheduled its own frame');
  drain();
  assert.deepEqual(writes, [180], 'the frame must paint the newest height only');
  writer.schedule(200);
  writer.flush();
  assert.deepEqual(writes, [180, 200], 'flush has to paint the pending height before the gesture ends');
  writer.schedule(260);
  writer.discard();
  assert.equal(queue.size, 0, 'discard must cancel the scheduled frame');
});

test('reduced motion is read and subscribed without a browser, not guessed from CSS', () => {
  assert.equal(prefersReducedMotion(), false, 'a server render must not claim reduced motion');
  assert.equal(typeof subscribeReducedMotion(() => {}), 'function');
  const screens = ['src/views/JourneyActiveNavigation.tsx', 'src/views/JourneyRouteMapScreen.tsx'].map(read);
  for (const screen of screens) {
    assert.match(screen, /createFrameWriter/, 'the sheet stopped coalescing its drag writes');
    assert.match(screen, /dragWriter\.current\?\.flush\(\)/, 'the release dropped the last frame');
    assert.match(screen, /routeSheetTransition\(draggingRef\.current, reducedMotion\)/,
      'the sheet eases even when the OS says stop, or its curve left the shared source');
    assert.match(screen, /data-dragging=\{draggingRef\.current \? 'true' : 'false'\}/,
      'the containment hook lost its drag state');
    // A render on touch-down measured ~89 ms of blocked main thread: the finger touched and the
    // sheet answered late. The gesture may not write React state — only the committed detent may.
    assert.doesNotMatch(screen, /const \[dragging, setDragging\] = useState/,
      'the drag went back through React state; touch-down will hitch again');
    for (const handler of ['handlePointerDown', 'handlePointerMove']) {
      const body = screen.split(`${handler} = (`)[1]?.split('\n  };')[0] ?? '';
      // `setPointerCapture` is a DOM call, not a re-render; only React setters can hitch the grab.
      assert.ok(body && !/set(?:SheetHeight|Dragging|SheetSnap)\(/.test(body), `${handler} must not write React state`);
    }
  }
  assert.match(code, /\[data-dragging="true"\] \{[^}]*contain: layout style/);
  // The curve itself is defined once, on the motion tokens, and both screens import it.
  const sheet = read('src/views/routeSheet.ts');
  assert.match(sheet, /export function routeSheetTransition[\s\S]*?var\(--mg-dur-base\) var\(--mg-ease-entrance\)/,
    'the sheet curve lost its single token-driven source');
});

test('CP4 bought its floors with cascade, not with a new !important', () => {
  // 200 is the count on CP4's own base (CP1 27f5097); CP3's sibling branch sits at 194.
  // Every floor here is an unlayered rule or a token, so an increase means somebody reached
  // for !important instead of fixing the source.
  const count = (code.match(/!important/g) ?? []).length;
  assert.ok(count <= 200, `!important declarations grew from 200 to ${count}`);
});

test('the 320px hero lets its CTA row wrap, never the CTA label', () => {
  // Live measurement at 320x568 found «Опублікувати поїздку» broken over two lines inside the pill:
  // the 44 px banner dots squeezed the button to 166 px. The fix wraps the row instead of the text,
  // so guard both halves of it and the dots themselves — they are the only banner switcher and must
  // never be traded away for space.
  const block = code.match(/@media \(max-width: 639px\) and \(max-height: 620px\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(block, 'the short-viewport compression block disappeared');
  assert.match(block, /\.home-canonical-banner > div:last-child \{[^}]*flex-wrap: wrap/, 'the hero CTA row stopped wrapping');
  assert.match(block, /\.home-action-cta \{[^}]*white-space: nowrap/, 'the hero CTA label is free to break again');
  assert.doesNotMatch(block, /\.home-canonical-banner[^{]*\{[^}]*display: none/, 'a banner control was hidden to buy space');
});
