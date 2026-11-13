import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextStopsLegId, sheetNeedsRaiseForStops, stopsDetent } from '../src/views/journeyStopsPanel';

const routeMap = readFileSync(new URL('../src/views/JourneyRouteMapScreen.tsx', import.meta.url), 'utf8');
const activeNav = readFileSync(new URL('../src/views/JourneyActiveNavigation.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

/**
 * The owner's complaint was spatial, not visual: a stop list bloomed as its own
 * block in the sheet, and every scheduled leg kept one open at once, so the
 * itinerary turned into a stack of detached panels. These tests hold the two
 * properties that fix it — one open at a time, and rendered inside its own card.
 */
test('a tap on one leg closes the other leg instead of opening a second panel', () => {
  assert.equal(nextStopsLegId(null, 'bus'), 'bus');
  assert.equal(nextStopsLegId('bus', 'bus'), null);
  assert.equal(nextStopsLegId('bus', 'tram'), 'tram');
});

test('stops are shown where the sheet has a real scrolling body, and never above it', () => {
  assert.equal(stopsDetent(), 'expanded');
  assert.equal(sheetNeedsRaiseForStops('half'), true);
  assert.equal(sheetNeedsRaiseForStops('expanded'), false);
});

function assertInsideOneItem(source: string, itemOpen: string, panel: string, label: string) {
  const start = source.indexOf(itemOpen);
  assert.ok(start >= 0, `${label}: item anchor ${itemOpen} missing`);
  const panelAt = source.indexOf(panel, start);
  assert.ok(panelAt > start, `${label}: the stop panel must come after the card opens`);
  const end = source.indexOf('</li>', panelAt);
  assert.ok(end > panelAt, `${label}: the stop panel must be closed inside the same item`);
  assert.equal(
    source.slice(start, panelAt).includes('</li>'),
    false,
    `${label}: the stop panel escaped its card and became a separate block`,
  );
}

test('the route sheet renders stops fused to their own segment card', () => {
  assertInsideOneItem(routeMap, 'data-testid="journey-route-segment"', 'mg-route-stops', 'route sheet');

  // One state holds one open leg. It starts on the reference's short verified
  // timetable (≤8 stops, see bottom-sheet-density) and never pre-blooms a long one.
  assert.match(routeMap, /const \[stopsLegId, setStopsLegId\] = useState<string \| null>\(\(\) => initialExpandedStopsLeg\?\.id \?\? null\)/);
  assert.doesNotMatch(routeMap, /expandedSegments/, 'the many-open Set that sprawled the sheet must stay gone');
  assert.match(routeMap, /const stopsOpen = stopsLegId === leg\.id/);

  // The panel is reachable by assistive tech and by the pill that owns it.
  assert.match(routeMap, /aria-expanded=\{stopsOpen\}/);
  assert.match(routeMap, /aria-controls=\{`route-stops-\$\{leg\.id\}`\}/);
  assert.match(routeMap, /id=\{`route-stops-\$\{leg\.id\}`\} className="mg-route-stops/);
});

test('opening stops raises the sheet and brings that card into view', () => {
  const start = routeMap.indexOf('const toggleStops');
  assert.ok(start > 0, 'toggleStops must exist');
  const body = routeMap.slice(start, routeMap.indexOf('\n  };', start) + 5);
  assert.match(body, /nextStopsLegId\(stopsLegId, legId\)/);
  assert.match(body, /moveToSnap\(stopsDetent\(\), true\)/, 'opening stops raises the sheet without a second sensory cue');
  assert.match(body, /type: 'STOPS_EXPANDED'/, 'the stop action owns its feedback');
  assert.match(body, /scrollIntoView/, 'the opened card must come back into the visible window');
});

test('the navigation sheet folds stops into the leg card and opens only the current leg', () => {
  assertInsideOneItem(activeNav, '<li key={item.id}>', 'mg-route-stops', 'navigation sheet');
  assert.match(activeNav, /setOpenStopsLegId\(nextStopsLegId\(openStopsLegId, item\.id\)\)/);
  assert.match(activeNav, /const \[openStopsLegId, setOpenStopsLegId\] = useState<string \| null>/);
  assert.doesNotMatch(activeNav, /openStopsLegIds/, 'the navigation sheet must not multi-open either');

  // A leg without a published stop list says so instead of showing an empty block.
  assert.match(activeNav, /Перевізник не надав список зупинок для цього рейсу\./);
});

test('the fused stop panel is token-only and stills itself under reduced motion', () => {
  const rule = css.slice(css.indexOf('.mg-route-stops {'), css.indexOf('}', css.indexOf('.mg-route-stops {')));
  assert.ok(rule.includes('.mg-route-stops {'), '.mg-route-stops must be defined so the panel reads as part of the card');
  assert.doesNotMatch(rule, /#[0-9a-fA-F]{3,8}/, 'no literal hex in the stop panel');
  assert.doesNotMatch(rule, /rgba?\(/, 'no literal color in the stop panel — it has to survive both themes');
  assert.match(rule, /var\(--route-hover\)/);

  const ruleAt = css.indexOf('.mg-route-stops {');
  const guardAt = css.indexOf('@media (prefers-reduced-motion: reduce)', ruleAt);
  assert.ok(guardAt > ruleAt, 'the reduced-motion guard must come after the rule it stills');
  assert.match(css.slice(guardAt), /\.mg-route-stops\b/, 'the reveal animation must respect prefers-reduced-motion');
});
