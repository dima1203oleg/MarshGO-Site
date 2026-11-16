import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ApiJourney } from '../src/services/productionApi';
import { JourneyLegStops } from '../src/views/JourneyLegStops';
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

type Leg = ApiJourney['legs'][number];
const datedLeg = (departureAt: string, arrivalAt: string): Leg => ({
  id: 'rail-106', mode: 'RAIL', transportType: 'train', routeName: '106', offerId: null,
  origin: { name: 'Львів', coordinates: [24, 49] }, destination: { name: 'Київ', coordinates: [30, 50] },
  departureAt, arrivalAt, durationSeconds: 31740, distanceMeters: null, priceMinor: null, priceStatus: 'UNKNOWN',
  availabilityStatus: 'SCHEDULED', source: 'gtfs-static', lastUpdatedAt: '', driver: null, vehicle: null,
  stops: [
    { id: 'lviv', name: 'Львів', departureAt, arrivalAt: '2026-11-15T21:58:00+02:00', coordinates: [24, 49] },
    { id: 'kyiv', name: 'Київ', arrivalAt, departureAt: '2026-11-16T07:10:00+02:00', coordinates: [30, 50] },
  ],
});
const stopMarkup = (leg: Leg) => renderToStaticMarkup(createElement(JourneyLegStops, { leg, color: 'var(--mode-train)', onStopSelect: () => undefined }));
const visibleMarkup = (html: string) => html.replace(/<[^>]*>/g, '');

test('DATE-01 renders full Nov 15/16 stop dates below clocks and original dateTime', () => {
  const departureAt = '2026-11-15T22:08:00+02:00';
  const arrivalAt = '2026-11-16T06:57:00+02:00';
  const html = stopMarkup(datedLeg(departureAt, arrivalAt));
  assert.match(visibleMarkup(html), /22:0815\.11\.2026/);
  assert.match(visibleMarkup(html), /06:5716\.11\.2026/);
  assert.ok(html.includes(`dateTime="${departureAt}"`));
  assert.ok(html.includes(`dateTime="${arrivalAt}"`));
  assert.ok(html.includes('aria-label="Зупинка: Львів, час 22:08 15.11.2026"'));
  assert.ok(html.includes('aria-label="Зупинка: Київ, час 06:57 16.11.2026"'));
  assert.match(html, /<time[^>]*>22:08<span class="[^"]*block[^"]*text-xs[^"]*">15\.11\.<wbr\/>2026<\/span><\/time>/);
});

test('DATE-01 stop dates stay compact on the same Kyiv day, even across UTC midnight', () => {
  for (const [from, to] of [
    ['2026-11-15T15:00:00+02:00', '2026-11-15T22:08:00+02:00'],
    ['2026-11-15T23:30:00Z', '2026-11-16T04:57:00Z'],
  ]) {
    const html = stopMarkup(datedLeg(from, to));
    assert.doesNotMatch(visibleMarkup(html), /\d{2}\.\d{2}\.\d{4}/);
    assert.ok(html.includes(`dateTime="${from}"`));
    assert.ok(html.includes(`dateTime="${to}"`));
  }
});

test('DATE-01 rendered stops honor month/year boundaries and DST from source timestamps', () => {
  for (const [from, to, fromDate, toDate] of [
    ['2026-11-30T22:08:00+02:00', '2026-12-01T06:57:00+02:00', '30.11.2026', '01.12.2026'],
    ['2026-12-31T22:08:00+02:00', '2027-01-01T06:57:00+02:00', '31.12.2026', '01.01.2027'],
    ['2026-03-28T23:30:00+02:00', '2026-03-29T04:30:00+03:00', '28.03.2026', '29.03.2026'],
    ['2026-10-24T23:30:00+03:00', '2026-10-25T03:30:00+02:00', '24.10.2026', '25.10.2026'],
  ]) {
    const visible = visibleMarkup(stopMarkup(datedLeg(from, to)));
    assert.ok(visible.includes(fromDate));
    assert.ok(visible.includes(toDate));
  }
});

test('DATE-01 missing/invalid stop times remain dashes without borrowed dates', () => {
  const leg = datedLeg('2026-11-15T22:08:00+02:00', '2026-11-16T06:57:00+02:00');
  leg.stops = [
    { id: 'missing', name: 'Невідомий', arrivalAt: leg.departureAt, coordinates: [24, 49] },
    { id: 'invalid', name: 'Некоректний', arrivalAt: 'invalid', departureAt: leg.arrivalAt, coordinates: [30, 50] },
  ];
  const html = stopMarkup(leg);
  assert.equal((html.match(/<time[^>]*>—<\/time>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /dateTime=|\d{2}\.\d{2}\.\d{4}/);
  assert.ok(html.includes('Зупинка: Невідомий, час —'));
});

test('DATE-01 uses known selected stop timestamps when leg endpoint times are absent', () => {
  const leg = datedLeg('2026-11-15T22:08:00+02:00', '2026-11-16T06:57:00+02:00');
  leg.departureAt = '';
  leg.arrivalAt = '';
  const visible = visibleMarkup(stopMarkup(leg));
  assert.ok(visible.includes('15.11.2026'));
  assert.ok(visible.includes('16.11.2026'));
});

test('DATE-01 preserves stop order, skipped state, selection and callback coordinates', () => {
  const leg = datedLeg('2026-11-15T22:08:00+02:00', '2026-11-16T06:57:00+02:00');
  leg.stops!.splice(1, 0, { id: 'skipped', name: 'Пропущена', arrivalAt: '2026-11-16T03:00:00+02:00', skipped: true, coordinates: [27, 50] });
  let selected: unknown[] = [];
  const tree = JourneyLegStops({ leg, color: 'var(--mode-train)', activeStopId: 'skipped', onStopSelect: (...args) => { selected = args; } });
  const elements: ReactElement<Record<string, unknown>>[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!isValidElement<Record<string, unknown>>(value)) return;
    elements.push(value);
    visit(value.props.children);
  };
  visit(tree);
  const buttons = elements.filter(element => element.type === 'button');
  assert.deepEqual(buttons.map(button => button.props['aria-pressed']), [false, true, false]);
  (buttons[1].props.onClick as () => void)();
  assert.deepEqual(selected, [leg.stops![1], [27, 50]]);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /line-through/);
  const visible = visibleMarkup(html);
  assert.ok(visible.indexOf('Львів') < visible.indexOf('Пропущена'));
  assert.ok(visible.indexOf('Пропущена') < visible.indexOf('Київ'));
  assert.match(visible, /Посадка.*Пропускається.*Висадка/);
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
