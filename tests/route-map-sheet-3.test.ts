import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  calculateAdaptiveMapPadding,
} from '../src/map/mapViewportCoordinator';
import {
  RouteCameraController,
  initialRouteCameraState,
  shouldShowRecenterButton,
} from '../src/map/routeCameraController';
import { measureProjectedFocus } from '../src/map/routeFocusMeasurement';
import { routeSheetHeights } from '../src/views/routeSheet';
import type { Coordinate } from '../shared/navigation/contracts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const routeScreen = read('src/views/JourneyRouteMapScreen.tsx');
const css = read('src/index.css');
const stops = read('src/views/JourneyLegStops.tsx');
const adapter = read('src/map/MapLibreAdapter.ts');

test('peek sheet separates duration and fare while retaining a compact action', () => {
  assert.match(routeScreen, /data-testid="route-peek-summary-divider"/);
  assert.match(routeScreen, /data-testid="route-peek-ribbon"/);
  assert.match(routeScreen, /aria-label="Етапи маршруту — гортайте вбік"/);
  assert.doesNotMatch(routeScreen, /data-testid="route-peek-chain"|data-testid="route-peek-scale"/);
  assert.match(routeScreen, /route-sheet-peek-cta/);
});

test('route streets and summary metrics keep compact side-by-side layouts', () => {
  assert.match(routeScreen, /data-testid="route-sheet-endpoints"/);
  assert.match(routeScreen, /data-testid="route-sheet-summary"[\s\S]*?route-sheet-summary__metrics/);
  assert.match(routeScreen, /mg-route-endpoints__name--end/);
  assert.match(css, /\.route-sheet-endpoints\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+13px\s+minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.route-sheet-summary\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.mg-route-endpoints\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+12px\s+minmax\(0,\s*1fr\)/s);
  assert.match(css, /route-sheet-summary__transfer-short/);
  assert.match(routeScreen, /aria-label=\{`Вибрати сегмент: \$\{legLabel\(leg\)\}; \$\{originLabel\} до \$\{destinationLabel\}.*walkHint\.title/);
});

test('expanded route details use a 44px swipeable stage ribbon instead of a tall vertical ribbon', () => {
  assert.match(routeScreen, /mg-route-ribbon mg-route-ribbon--compact[^>]*role="list"/);
  assert.match(routeScreen, /mg-route-ribbon__copy[\s\S]*?mg-route-ribbon__label[\s\S]*?mg-route-ribbon__detail/);
  assert.match(css, /\.mg-route-ribbon--compact\s*\{[^}]*height:\s*var\(--mg-sheet-ribbon-height\);[^}]*min-height:\s*var\(--mg-sheet-ribbon-height\);/s);
  assert.match(css, /\.mg-route-ribbon--compact \.mg-route-ribbon__pill\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;/s);
});

test('small mobile route-sheet detents expose details without a tall empty half state', () => {
  for (const height of [568, 844, 932]) {
    const snaps = routeSheetHeights(height);
    assert.ok(snaps.peek < snaps.collapsed && snaps.collapsed < snaps.half && snaps.half < snaps.expanded);
    assert.ok(snaps.half <= Math.round(height * 0.5), `${height}px half detent should stay compact`);
    assert.ok(height - snaps.expanded >= 96, `${height}px expanded state keeps a map strip`);
  }
  assert.equal(routeSheetHeights(568).collapsed, 220);
  assert.equal(routeSheetHeights(568).half, 260);
});

const route: Coordinate[] = [[30.5, 50.4], [30.52, 50.45], [30.55, 50.5]];

/**
 * The sheet used to cap its bottom inset to leave a nominal "visible band" that
 * was itself covered by the expanded sheet, so a focused point could project
 * underneath it. The fit rectangle now ends above the sheet on every detent.
 */
test('the camera fit rectangle ends above the sheet on every mobile detent', () => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    const heights = routeSheetHeights(viewport.height);
    for (const snap of ['peek', 'collapsed', 'half', 'expanded'] as const) {
      const padding = calculateAdaptiveMapPadding({
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        sheetHeight: heights[snap],
        sheetSnap: snap,
        topBarHeight: 84,
      });
      const bottom = padding.bottom ?? 0;
      const top = padding.top ?? 0;
      assert.ok(bottom >= heights[snap], `${viewport.width}×${viewport.height} ${snap}: bottom ${bottom} must clear sheet ${heights[snap]}`);
      assert.ok(top + bottom < viewport.height, `${viewport.width}×${viewport.height} ${snap}: MapLibre rejects padding ${top}+${bottom} >= ${viewport.height}`);
      assert.ok(viewport.height - top - bottom >= 8, `${viewport.width}×${viewport.height} ${snap}: fit area collapsed to ${viewport.height - top - bottom} px`);
      assert.ok((padding.left ?? 0) + (padding.right ?? 0) < viewport.width);
    }
  }
});

test('the fit rectangle clears the live chip that floats above the sheet', () => {
  const heights = routeSheetHeights(844);
  for (const snap of ['collapsed', 'half'] as const) {
    const base = { viewportWidth: 390, viewportHeight: 844, sheetHeight: heights[snap], sheetSnap: snap, topBarHeight: 100 };
    const plain = calculateAdaptiveMapPadding(base);
    const withChip = calculateAdaptiveMapPadding({ ...base, extraBottomInset: 58 });
    assert.equal((withChip.bottom ?? 0) - (plain.bottom ?? 0), 58, `${snap}: the chip must add its own inset`);
    const chipTop = 844 - (heights[snap] + 8) - 50;
    assert.ok(844 - (withChip.bottom ?? 0) <= chipTop - 8 + 0.001,
      `${snap}: fit rect bottom must sit above the 50 px chip (got ${844 - (withChip.bottom ?? 0)}, chip top ${chipTop})`);
    assert.ok((withChip.top ?? 0) + (withChip.bottom ?? 0) < 844);
  }
  const desktop = calculateAdaptiveMapPadding({
    viewportWidth: 1280, viewportHeight: 800, sheetHeight: heights.half, sheetSnap: 'half',
    isDesktop: true, extraBottomInset: 58,
  });
  assert.equal(desktop.bottom, heights.half + 66, 'desktop must clear the same chip, not only the 40 px margin');
});

test('projected focus measurement proves points live inside the visible rect', () => {
  const rect = { left: 90, top: 90, right: 300, bottom: 500 };
  const inside = measureProjectedFocus([{ x: 120, y: 200 }, { x: 180, y: 260 }], rect);
  assert.equal(inside.insideRatio, 1);
  assert.equal(inside.bboxInside, true);
  assert.equal(inside.minMarginPx, 30);

  const halfOut = measureProjectedFocus([{ x: 120, y: 200 }, { x: 320, y: 260 }], rect);
  assert.equal(halfOut.insideRatio, 0.5);
  assert.equal(halfOut.bboxInside, false);
  assert.equal(halfOut.minMarginPx, -20);

  const empty = measureProjectedFocus([], rect);
  assert.equal(empty.bbox, null);
  assert.equal(empty.insideRatio, 0);

  // A point fitted to the rect edge projects onto it with float noise; that is
  // not a geometry overlap and must not fail the acceptance proof.
  const edge = measureProjectedFocus([{ x: 90.0000000001, y: 500 - 1e-10 }], rect);
  assert.equal(edge.insideRatio, 1);
  assert.equal(edge.bboxInside, true);
});

test('the adapter publishes the projected last-fit measurement after every settle', () => {
  assert.match(adapter, /container\.dataset\.marshgoFocusMeasure = JSON\.stringify/,
    'the settled camera must expose its projected fit for acceptance');
  assert.match(adapter, /measureProjectedFocus\(this\.lastFitPoints\.map\(point => this\.map\.project\(point\)\), rect\)/,
    'the measurement must project the real coordinates, not guess from padding');
  assert.match(adapter, /this\.lastFitPoints = points;[\s\S]{0,200}this\.fitCoordinates\(points, padding, maxZoom\)/,
    'focusCoordinates must remember its own fit target');
  const publish = adapter.slice(adapter.indexOf('private publishFocusMeasure'), adapter.indexOf('private motionDuration'));
  assert.match(publish, /this\.lastFitPadding/,
    'fitBounds drops its padding, so the measurement must use the recorded intended band');
  assert.doesNotMatch(publish, /getPadding\(\)/,
    'map.getPadding() is 0 after fitBounds and would measure the whole viewport');
});

test('a transfer owns a camera mode, a recenter affordance and a snap refit', () => {
  let state = initialRouteCameraState();
  let focused: Coordinate[] | null = null;
  let focusPoint: Coordinate | null = null;
  let focusPadding: unknown = null;

  const mockAdapter = {
    setRoute: () => {},
    onRouteSegmentSelect: () => {},
    setVehicle: () => {},
    onCameraModeChange: () => {},
    setWaypoints: () => {},
    fitRoute: () => {},
    recenter: () => {},
    setCameraMode: () => {},
    setTheme: () => {},
    setLayer: () => {},
    setPerspective: () => {},
    setTransportLayers: () => {},
    setTransportDisplayPreferences: () => {},
    setActiveRouteSegment: () => {},
    focusCoordinates: (points: Coordinate[]) => { focused = points; },
    focus: (point: Coordinate, _zoom?: number, padding?: unknown) => { focusPoint = point; focusPadding = padding; },
  };

  const controller = new RouteCameraController({
    adapter: mockAdapter as never,
    padding: { top: 90, bottom: 680, left: 16, right: 16 },
    onStateChange: (next) => { state = next; },
  });

  const transfer = route[1]!;
  controller.focusTransfer('transfer:a:b', transfer, [route[0]!, route[1]!]);
  assert.equal(state.mode, 'TRANSFER_FOCUS');
  assert.equal(state.activeTransferId, 'transfer:a:b');
  assert.equal(state.activeSegmentId, null);
  assert.equal(shouldShowRecenterButton(state), true);
  assert.deepEqual(focused, [route[0], route[1]]);
  assert.deepEqual([focusPoint, focusPadding], [null, null], 'a transfer fits its corridor instead of easing to a single point');

  controller.setPadding({ top: 90, bottom: 260, left: 16, right: 16 });
  controller.syncOnSnapSettled({ routePoints: route });
  assert.deepEqual(focused, [route[0], route[1]], 'a snap change must refit the transfer, not the whole route');

  controller.onUserMapInteraction();
  const callsBefore = focused;
  controller.syncOnSnapSettled({ routePoints: route });
  assert.deepEqual(focused, callsBefore, 'manual panning must survive a snap change');

  controller.showOverview(route);
  assert.equal(state.mode, 'ROUTE_OVERVIEW');
  assert.equal(state.activeTransferId, null);
  assert.deepEqual(focused, route);
});

test('stop focus stays inside the sheet-aware visible band too', () => {
  let focusArgs: { point: Coordinate; zoom?: number; padding?: unknown } | null = null;
  const mockAdapter = {
    setRoute: () => {}, onRouteSegmentSelect: () => {}, setVehicle: () => {}, onCameraModeChange: () => {},
    setWaypoints: () => {}, fitRoute: () => {}, recenter: () => {}, setCameraMode: () => {}, setTheme: () => {},
    setLayer: () => {}, setPerspective: () => {}, setTransportLayers: () => {}, setTransportDisplayPreferences: () => {},
    focusCoordinates: () => {},
    focus: (point: Coordinate, zoom?: number, padding?: unknown) => { focusArgs = { point, zoom, padding }; },
  };
  const controller = new RouteCameraController({
    adapter: mockAdapter as never,
    padding: { top: 90, bottom: 260, left: 16, right: 16 },
  });
  const stop: Coordinate = [30.51, 50.44];
  controller.focusStop('stop-1', stop);
  assert.deepEqual(focusArgs, { point: stop, zoom: 16.5, padding: { top: 90, bottom: 260, left: 16, right: 16 } });
});

test('transfer and walk hints live inside the sheet, not in floating map callouts', () => {
  assert.doesNotMatch(routeScreen, /GlassGuidanceCallouts/, 'the route screen must not mount free-floating callouts again');
  assert.doesNotMatch(routeScreen, /buildCalloutsForLeg|updateCalloutScreenPositions|setCallouts/,
    'the callout builders were the source of the overlapping ПЕРЕСАДКА/ПОЧАТОК ПІШКИ cards');
  assert.match(routeScreen, /data-testid="route-inline-transfer"/, 'a transfer needs a row between its two segment cards');
  assert.doesNotMatch(routeScreen, /data-testid="route-walk-hint"/, 'the redundant pill should not add a full row to every walk segment');
  assert.match(routeScreen, /walkHint\.title/, 'the same route guidance remains in the segment accessible name');
  assert.match(routeScreen, /function inlineTransferHints\(/);
  assert.match(routeScreen, /import \{ legLabel, walkHintFor \} from '\.\/journeyWalkHint'/, 'the sheet wires the subject-first walk hint helper');
  const cardsAt = routeScreen.indexOf('const renderSegmentCards');
  const transferAt = routeScreen.indexOf('data-testid="route-inline-transfer"');
  const screenRootAt = routeScreen.search(/return\s*\(\s*<(?:main|section)\b/);
  assert.ok(cardsAt > 0 && transferAt > cardsAt && transferAt < screenRootAt,
    'the transfer row has to be produced by renderSegmentCards');
  const listAt = routeScreen.indexOf('data-testid="route-segment-list"');
  assert.ok(listAt > 0 && routeScreen.slice(listAt, listAt + 300).includes('{renderSegmentCards()}'),
    'the segment list must render those cards and their transfer rows');
});

test('route details show confirmed start, boarding and alighting anchors on the map', () => {
  assert.match(routeScreen, /title: 'Старт'/, 'the map marks the real journey origin');
  assert.match(routeScreen, /verifiedWalkToBoarding[\s\S]*?contextLines\.push\(verifiedWalkToBoarding\)/,
    'initial focus includes the verified approach walk so its start anchor can remain visible');
  assert.match(routeScreen, /points: \[\.\.\.target\.points, origin\]/,
    'camera framing includes the verified journey-origin point without inventing connector geometry');
  assert.match(routeScreen, /isValidCoordinate\(reportedOrigin\) \? reportedOrigin : verifiedWalkOrigin/,
    'the start callout may fall back only to the confirmed walk geometry origin');
  assert.match(routeScreen, /buildRouteMapAnnotations\(\{[\s\S]*?preferredLegId: activeSegmentId \?\? primaryLeg\?\.id[\s\S]*?focusedOnly: true/,
    'boarding and alighting labels use the focused provider-backed transit leg');
  assert.match(routeScreen, /annotation\.kind === 'BOARDING' \|\| annotation\.kind === 'ALIGHTING'/,
    'map callouts avoid repeating walking guidance already available in the sheet');
  assert.match(routeScreen, /\.map\(annotation => \(\{ \.\.\.annotation, tone: 'blue' as const \}\)\)/,
    'the route anchors use the canonical cold-blue accent');
  assert.match(routeScreen, /routeLabels=\{routeLabels\}/, 'the confirmed labels reach the existing MapLibre instance');
});

test('the duplicated stage narration is gone and the sheet breathes without it', () => {
  assert.doesNotMatch(routeScreen, /smart-step-guidance/, 'the pinned smart-step aside repeated what the active card already says');
  assert.doesNotMatch(routeScreen, /route-medium-stages/, 'the MEDIUM line repeated the ribbon labels and durations');
  assert.doesNotMatch(routeScreen, /data-testid="route-show-on-map"/, 'the expanded map band stays free of a duplicate map button');
  assert.match(routeScreen, /data-testid="route-map-expanded-toolbar"/, 'FULL keeps the route context, back action, and map layers visible above the sheet');
  assert.match(routeScreen, /route-map-context-pill[\s\S]*Маршрут · \{cleanStopName\(lastLeg\?\.destination\.name\)/, 'the map toolbar names the actual destination instead of repeating the app brand');
  assert.match(routeScreen, /<MapLayersControl overlays\/>/, 'the expanded map toolbar reuses the canonical layer control');
  assert.match(routeScreen, /<Bookmark size=\{20\} fill=\{saved \? 'currentColor' : 'none'\}\/\>/, 'route saving uses the reference bookmark glyph');
  assert.match(routeScreen, /sheetSnap !== 'peek' && sheetSnap !== 'expanded'/, 'the expanded reference state keeps one primary CTA and removes the secondary map button');
  assert.match(routeScreen, /sheetSnap === 'expanded'[\s\S]*?<Navigation size=\{20\} fill="currentColor"/, 'the expanded primary CTA uses the navigation arrow');
  assert.match(routeScreen, /bg-\[var\(--route-card-alt\)\] text-\[var\(--route-ink\)\]/, 'transport glyph tiles share the restrained graphite palette');
  const density = readFileSync(new URL('../src/views/routeSheetDensity.css', import.meta.url), 'utf8');
  assert.match(density, /\.mg-route-segment-list::before[\s\S]*background: linear-gradient\(to bottom/, 'the route cards are joined by the reference timeline rail');
  assert.match(density, /\.mg-route-segment\[data-active="true"\]::before[\s\S]*border-color: var\(--mg-blue\)/, 'the selected stage is identified by its timeline node');
  assert.match(routeScreen, /className="mg-route-segment-list"/, 'segment cards must use the token-driven compact one-step rhythm');
  assert.match(routeScreen, /onClick=\{\(\) => \{ showWholeRoute\(\); moveToSnap\('half'\); \}\}/,
    'the pinned map action returns to the route without covering the expanded map band');
  assert.match(routeScreen, /topBarHeight: 100/,
    'the measured 102 px compact header must be reserved, not a nominal 84 px');
  assert.match(routeScreen, /extraBottomInset: bottomNavigationInset \+ \(floatingChipVisible \? 58 : 0\)/,
    'the camera must reserve the navigation inset and the live chip above the sheet');
});

test('the primary action uses the canonical blue–graphite ramp, never purple', () => {
  const block = css.slice(css.indexOf('.mg-route-cta {'), css.indexOf('.mg-route-book {'));
  assert.ok(block.includes('.mg-route-cta {'));
  assert.match(block, /var\(--mg-action\)/, 'the CTA must be built from the action token');
  assert.match(block, /var\(--mg-navy\)/, 'the graphite stop of the ramp must be the navy token');
  assert.doesNotMatch(block, /#A21CFF|#7C1BE3|#A855F7|#8845E8/i, 'the purple route CTA palette must not come back');
  assert.match(block, /min-height: var\(--mg-sheet-cta-min-height\);/, 'the compact CTA keeps a 44 px+ touch target');
  assert.match(block, /color-mix\(in srgb, var\(--mg-blue\) 68%, transparent\)/, 'the focus ring follows the accent token');

  // The app-wide touch-target floor is (0,2,1) and a single-class rule is (0,1,0):
  // without the exemption it silently caps the CTA at 44 px in the browser (measured).
  const floor = css.match(/\.production-app :is\([^)]*button\.w-full[^)]*\)[^{]*\{[^}]*\}/);
  assert.ok(floor, 'the app-wide 44 px touch-target floor must still exist');
  assert.match(floor![0], /button\.w-full:not\(\.mg-route-cta\)/, 'the floor must exempt the taller primary CTA instead of outranking it');

  const book = css.slice(css.indexOf('.mg-route-book {'), css.indexOf('/* FULL-state bridge'));
  assert.match(book, /var\(--mg-action\)/);
  assert.doesNotMatch(book, /#A855F7/i);

  assert.doesNotMatch(routeScreen, /bg-\[#8845E8\]|#9958F2|rgba\(168,85,247/, 'the community booking button must use the same action palette');
  assert.match(routeScreen, /bg-\[var\(--mg-action\)\]/, 'the community booking button must be a filled action control');
});

test('stop rows separate time, axis and wrapping name with a 44px interaction floor', () => {
  const density = readFileSync(new URL('../src/views/routeSheetDensity.css', import.meta.url), 'utf8');
  assert.equal((stops.match(/className=\{?`?"?mg-journey-stop-row/g) ?? []).length, 2, 'both static and interactive rows use the shared layout');
  assert.match(density, /grid-template-columns: 44px 16px minmax\(0, 1fr\)/);
  assert.match(density, /\.mg-journey-stop-row\s*\{[^}]*min-height: 34px/s);
  assert.match(density, /button\.mg-journey-stop-row\s*\{ min-height: 44px;/);
  assert.match(stops, /mg-journey-stop-axis/);
});
