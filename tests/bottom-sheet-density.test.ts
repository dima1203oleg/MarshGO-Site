import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const routeScreen = readFileSync(new URL('../src/views/JourneyRouteMapScreen.tsx', import.meta.url), 'utf8');

const sheetBlock = css.slice(css.indexOf('.route-map-screen {'), css.indexOf('}', css.indexOf('.route-map-screen {')));
const darkBlock = css.slice(css.indexOf('.route-map-screen[data-theme="dark"] {'), css.indexOf('}', css.indexOf('.route-map-screen[data-theme="dark"] {')));

function tokenPx(name: string): number {
  const match = sheetBlock.match(new RegExp(`--${name}:\\s*([\\d.]+)px;`));
  assert.ok(match, `--${name} must be declared in px on the route sheet`);
  return Number(match![1]);
}

test('the compact density contract lives in one token set on the route sheet', () => {
  for (const name of [
    'mg-sheet-stack-gap', 'mg-sheet-card-pad-y', 'mg-sheet-card-pad-x',
    'mg-sheet-summary-pad-top', 'mg-sheet-summary-pad-bottom', 'mg-sheet-endpoints-pad-bottom',
    'mg-sheet-ribbon-height', 'mg-sheet-label-leading', 'mg-sheet-cta-min-height',
  ]) {
    assert.match(sheetBlock, new RegExp(`--${name}:`), `--${name} must be part of the shared density set`);
  }
  assert.doesNotMatch(darkBlock, /--mg-sheet-/, 'density is geometry: the dark theme must inherit the same rhythm, not redeclare it');
  assert.doesNotMatch(sheetBlock.match(/--mg-sheet-[^;]+;/g)!.join(' '), /#|rgb|hsl/, 'density tokens must stay spacing-only, never colors');
});

test('the token values keep the sheet dense without breaking the touch floor', () => {
  assert.ok(tokenPx('mg-sheet-stack-gap') <= 4, 'the segment stack must keep the one-step 4 px rhythm');
  assert.ok(tokenPx('mg-sheet-card-pad-y') <= 4, 'card vertical padding must stay compact');
  assert.ok(tokenPx('mg-sheet-card-pad-x') <= 8, 'card horizontal padding must not waste the narrow column');
  assert.ok(tokenPx('mg-sheet-summary-pad-top') <= 4, 'the summary header must not reintroduce a tall top gap');
  assert.ok(tokenPx('mg-sheet-summary-pad-bottom') <= 6, 'the summary must sit close to the ribbon');
  assert.ok(tokenPx('mg-sheet-endpoints-pad-bottom') <= 4, 'street names must sit close to the summary');
  const ribbon = tokenPx('mg-sheet-ribbon-height');
  assert.ok(ribbon >= 44 && ribbon <= 56, 'the stage row must clear the 44 px tap floor without becoming a second header');
  const cta = tokenPx('mg-sheet-cta-min-height');
  assert.ok(cta >= 44 && cta <= 56, 'the primary CTA stays prominent but must not eat the panel');
  const leading = Number(sheetBlock.match(/--mg-sheet-label-leading:\s*([\d.]+);/)![1]);
  assert.ok(leading <= 1.25, 'compact labels must not carry a roomy line-height');
});

test('summary, endpoints, ribbon, labels and CTA consume the density tokens', () => {
  const summary = css.slice(css.indexOf('.route-sheet-summary {'), css.indexOf('}', css.indexOf('.route-sheet-summary {')));
  assert.match(summary, /padding: var\(--mg-sheet-summary-pad-top\) 12px var\(--mg-sheet-summary-pad-bottom\);/);
  const endpoints = css.slice(css.indexOf('.route-sheet-endpoints {'), css.indexOf('}', css.indexOf('.route-sheet-endpoints {')));
  assert.match(endpoints, /padding: 0 12px var\(--mg-sheet-endpoints-pad-bottom\);/);
  const ribbon = css.slice(css.indexOf('.mg-route-ribbon--compact {'), css.indexOf('}', css.indexOf('.mg-route-ribbon--compact {')));
  assert.match(ribbon, /height: var\(--mg-sheet-ribbon-height\);/);
  const cta = css.slice(css.indexOf('.mg-route-cta {'), css.indexOf('}', css.indexOf('.mg-route-cta {')));
  assert.match(cta, /min-height: var\(--mg-sheet-cta-min-height\);/);
  const label = css.slice(css.indexOf('.mg-route-ribbon__label {'), css.indexOf('}', css.indexOf('.mg-route-ribbon__label {')));
  assert.match(label, /line-height: var\(--mg-sheet-label-leading\);/);
});

test('the segment list and card bodies take their rhythm from the same tokens', () => {
  assert.match(css, /\.mg-route-segment-list \{ display: grid; gap: var\(--mg-sheet-stack-gap\); padding-block-start: 2px; \}/);
  assert.match(css, /\.mg-route-segment__body \{ padding: var\(--mg-sheet-card-pad-y\) var\(--mg-sheet-card-pad-x\); \}/);
  assert.match(routeScreen, /<ol className="mg-route-segment-list">/);
  assert.match(routeScreen, /className="mg-route-segment__body flex items-start gap-1\.5"/);
  assert.doesNotMatch(routeScreen, /className="space-y-1 pt-0\.5"/, 'the hand-tuned list rhythm must not come back beside the tokens');
  assert.doesNotMatch(routeScreen, /px-1\.5 py-1"/, 'card padding must not drift back into per-component literals');
});

test('waiting is a compact service row, not a tall card', () => {
  const waitAt = routeScreen.indexOf('Очікування · {formatDuration(item.durationSeconds)}');
  assert.ok(waitAt > 0, 'the wait row must stay a single subject-first line');
  const waitBlock = routeScreen.slice(waitAt - 400, waitAt);
  assert.match(waitBlock, /px-3 py-1 text-xs/, 'the wait row keeps the dense 4 px vertical padding');
  assert.doesNotMatch(waitBlock, /py-1\.5|py-2/, 'the wait row must not grow back into a tall card');
});

test('density never drops the interactive rows below the 44 px tap floor', () => {
  const transferAt = routeScreen.indexOf('data-testid="route-inline-transfer"');
  const transferBlock = routeScreen.slice(transferAt, transferAt + 1200);
  assert.match(transferBlock, /min-h-11 w-full/, 'the transfer row stays tappable at 44 px');
  assert.match(routeScreen, /className="mg-press-subtle grid h-11 w-11 place-items-center rounded-lg text-\[var\(--route-muted\)\]/, 'the stops toggle keeps its 44 px square');
  assert.match(css, /\.mg-route-ribbon--compact \.mg-route-ribbon__pill\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;/s, 'compact stage pills keep the tap floor');
});

test('the CTA sits closer to the content while the safe area still wins', () => {
  assert.match(routeScreen, /mt-auto pb-\[max\(0\.5rem,env\(safe-area-inset-bottom\)\)\] pt-0\.5/, 'the expanded CTA keeps only an 8 px floor under the safe-area max');
  assert.doesNotMatch(routeScreen, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\] pt-0\.5 mb-0\.5/, 'the old double bottom reserve must not come back');
  assert.match(routeScreen, /sheetSnap === 'peek' \? 'pb-0\.5'/, 'peek keeps its minimal bottom edge');
});