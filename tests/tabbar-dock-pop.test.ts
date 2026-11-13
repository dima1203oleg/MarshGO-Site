import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const marketplace = readFileSync(new URL('../src/views/ProductionMarketplace.tsx', import.meta.url), 'utf8');

const keyframes = css.slice(css.indexOf('@keyframes mg-tab-icon-dock-pop {'), css.indexOf('}', css.indexOf('100%', css.indexOf('@keyframes mg-tab-icon-dock-pop {'))) + 1);
const popAt = css.indexOf('animation: mg-tab-icon-dock-pop');
const popRule = css.slice(css.lastIndexOf('\n', css.lastIndexOf('{', popAt)) + 1, css.indexOf('}', popAt) + 1);

function frame(percent: number): { scale: number; liftRem: number } {
  const at = keyframes.indexOf(`${percent}%`);
  assert.ok(at >= 0, `the ${percent}% keyframe must exist`);
  const body = keyframes.slice(at, keyframes.indexOf('}', at));
  const scale = Number(body.match(/scale\(([\d.]+)\)/)![1]);
  const translate = body.match(/translateY\((-?[\d.]+)(rem|px)\)/);
  const liftRem = translate ? Number(translate[1]) * (translate[2] === 'px' ? 1 / 16 : 1) : 0;
  return { scale, liftRem };
}

test('the dock pop tells one story: press squash, inflate with lift, settle on the active rest', () => {
  const start = frame(0);
  const peak = frame(42);
  const settle = frame(100);
  assert.ok(start.scale <= 0.92, 'the pop must start from the pressed squash so the tap feels continuous');
  assert.ok(peak.scale >= 1.15 && peak.scale <= 1.35, 'the inflate must read as a dock pop, not a jump');
  assert.ok(peak.liftRem < 0, 'the peak lifts the icon off the bar');
  assert.ok(settle.scale > start.scale && settle.scale < peak.scale, 'the icon settles between rest and peak, never back to the squash');
  assert.deepEqual([settle.scale, settle.liftRem], [1.08, -1 / 16], 'the last frame must land exactly on the active resting transform');
  assert.doesNotMatch(keyframes, /opacity|width|height|margin|padding|color/, 'the pop animates transform only');
});

test('the pop runs on the motion tokens and exempts the central create action', () => {
  assert.match(popRule, /animation: mg-tab-icon-dock-pop var\(--mg-dur-slow\) var\(--mg-ease-entrance\) both;/);
  assert.doesNotMatch(popRule, /\d+m?s|cubic-bezier/, 'no off-system duration or curve in the pop rule');
  assert.match(popRule, /:not\(\.app-create-button\)/, 'the create button keeps its own press feedback');
  assert.match(css, /\.app-tabbar-inner button\[aria-current="page"\] svg \{ transform: translateY\(-1px\) scale\(1\.08\); \}/, 'the resting lift must match the pop landing');
});

test('every tap replays the pop, including a re-tap of the active tab', () => {
  assert.match(marketplace, /const \[tabPopTick, setTabPopTick\] = useState\(0\);/);
  const renderAt = marketplace.indexOf('const renderBottomTab');
  const tabBlock = marketplace.slice(renderAt, marketplace.indexOf('\n', marketplace.indexOf('};', renderAt)));
  assert.match(tabBlock, /setTabPopTick\(tick => tick \+ 1\);/, 'the tap handler must advance the pop tick');
  assert.match(tabBlock, /<Icon key=\{`\$\{item\.id\}-\$\{tabPopTick\}`\}/, 'the icon remounts on every tap so the CSS animation restarts');
});

test('reduced motion stills the dock pop in both guard lists', () => {
  const stillAt = css.indexOf('.app-tabbar-inner button[aria-current="page"] svg,');
  assert.ok(stillAt > 0, 'the pop selector must be listed in a reduced-motion guard');
  const guardAt = css.lastIndexOf('@media (prefers-reduced-motion: reduce)', stillAt);
  const guard = css.slice(guardAt, css.indexOf('\n}', stillAt));
  const stills = guard.match(/\.app-tabbar-inner button\[aria-current="page"\] svg/g) ?? [];
  assert.ok(stills.length >= 2, 'the pop selector must appear in both the transition and animation guard lists');
  assert.match(guard, /animation: none !important;/);
});