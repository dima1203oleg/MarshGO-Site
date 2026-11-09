import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateAdaptiveMapPadding,
  computeVisibleMapArea,
} from '../src/map/mapViewportCoordinator';
import {
  RouteCameraController,
  calculateSegmentFocusTarget,
  shouldShowRecenterButton,
  initialRouteCameraState,
} from '../src/map/routeCameraController';
import { cameraForRotatedPoints, principalBearing, segmentBearingForViewport, SEGMENT_FOCUS_MAX_ZOOM } from '../src/map/routeCameraFocus';
import { routeSheetHeights } from '../src/views/routeSheet';
import type { Coordinate } from '../shared/navigation/contracts';

test('TEST 1 & TEST 9: adaptive map padding preserves visible corridor and respects MapLibre constraints across mobile & desktop viewports', () => {
  const viewports = [
    { width: 360, height: 740, label: 'Compact Android' },
    { width: 390, height: 844, label: 'iPhone 14/15' },
    { width: 430, height: 932, label: 'iPhone Pro Max' },
    { width: 1280, height: 800, label: 'Desktop' },
  ];

  for (const vp of viewports) {
    const isDesktop = vp.width >= 1024;
    const heights = routeSheetHeights(vp.height);

    for (const snap of ['peek', 'collapsed', 'half', 'expanded'] as const) {
      const padding = calculateAdaptiveMapPadding({
        viewportWidth: vp.width,
        viewportHeight: vp.height,
        sheetHeight: heights[snap],
        sheetSnap: snap,
        topBarHeight: 84,
        isDesktop,
        hasWarningNote: false,
      });

      // MapLibre invariant: combined vertical padding must stay strictly below viewport height
      const verticalPadding = (padding.top ?? 0) + (padding.bottom ?? 0);
      assert.ok(
        verticalPadding < vp.height,
        `vertical padding ${verticalPadding} must be less than height ${vp.height} for ${vp.label} on snap ${snap}`,
      );

      // MapLibre invariant: combined horizontal padding must stay below viewport width
      const horizontalPadding = (padding.left ?? 0) + (padding.right ?? 0);
      assert.ok(
        horizontalPadding < vp.width,
        `horizontal padding ${horizontalPadding} must be less than width ${vp.width} for ${vp.label}`,
      );

      // Top padding must clear the compact top bar (84 px + margin)
      if (!isDesktop) {
        assert.ok((padding.top ?? 0) >= 88, 'top padding must clear compact top bar');
      }
    }
  }
});

test('TEST 2 & TEST 4: bottom sheet heights provide 4 ordered states with high map visibility on collapsed detents', () => {
  const vpHeight = 844;
  const heights = routeSheetHeights(vpHeight);

  // Four strictly ordered snaps
  assert.ok(heights.peek < heights.collapsed);
  assert.ok(heights.collapsed < heights.half);
  assert.ok(heights.half < heights.expanded);

  // STATE 1 — peek (COLLAPSED): ~17–23% height, leaves > 75% map visible
  const peekRatio = heights.peek / vpHeight;
  assert.ok(peekRatio >= 0.17 && peekRatio <= 0.25, `peek ratio ${peekRatio} must be ~17–25%`);

  // STATE 2 — collapsed (COMPACT): ~28–36% height
  const compactRatio = heights.collapsed / vpHeight;
  assert.ok(compactRatio >= 0.25 && compactRatio <= 0.38, `compact ratio ${compactRatio} must be ~28–36%`);

  // STATE 3 — half (MEDIUM): ~37–50% height
  const mediumRatio = heights.half / vpHeight;
  assert.ok(mediumRatio >= 0.35 && mediumRatio <= 0.55, `medium ratio ${mediumRatio} must be ~37–55%`);

  // STATE 4 — expanded (FULL): leaves at least 96–120 px interactive map strip at the top
  const remainingMapStrip = vpHeight - heights.expanded;
  assert.ok(remainingMapStrip >= 96, `expanded state must leave >= 96 px map strip, got ${remainingMapStrip}`);
});

test('TEST 3: expanded state bounds cap bottom padding to guarantee top map strip remains visible', () => {
  const vpHeight = 844;
  const vpWidth = 390;
  const heights = routeSheetHeights(vpHeight);

  const padding = calculateAdaptiveMapPadding({
    viewportWidth: vpWidth,
    viewportHeight: vpHeight,
    sheetHeight: heights.expanded,
    sheetSnap: 'expanded',
    topBarHeight: 84,
  });

  const remainingVisibleHeight = vpHeight - (padding.top ?? 0) - (padding.bottom ?? 0);
  assert.ok(
    remainingVisibleHeight >= 64,
    `expanded state must keep at least 64 px of clear route fit height, got ${remainingVisibleHeight}`,
  );
});

test('TEST 3b: the padded fit region ends above the sheet and centres on the real visible band', () => {
  for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    const heights = routeSheetHeights(vp.height);
    for (const snap of ['half', 'expanded'] as const) {
      const area = computeVisibleMapArea({
        viewportWidth: vp.width,
        viewportHeight: vp.height,
        sheetHeight: heights[snap],
        sheetSnap: snap,
        topBarHeight: 84,
      });
      const sheetTop = vp.height - heights[snap];
      const fitBottom = area.insets.top + area.visibleHeight;
      assert.ok(
        fitBottom <= sheetTop,
        `${vp.width}x${vp.height} ${snap}: fit region bottom ${fitBottom} must not reach under the sheet at ${sheetTop}`,
      );
      const bandCenter = (84 + sheetTop) / 2;
      assert.ok(
        Math.abs(area.visibleCenterY - bandCenter) <= 8,
        `${vp.width}x${vp.height} ${snap}: fit centre ${area.visibleCenterY} must sit in the visible band centred at ${bandCenter}`,
      );
    }
  }
});

test('TEST 5: segment focus calculates dominant bearing and corridor fit bounds', () => {
  // A northbound bus leg in Kyiv
  const busCoordinates: Coordinate[] = [
    [30.5234, 50.4501],
    [30.5238, 50.4550],
    [30.5242, 50.4610],
  ];

  const target = calculateSegmentFocusTarget(busCoordinates, [], 'bus-1');
  assert.ok(target !== null);
  assert.equal(target.points.length, busCoordinates.length);
  // Dominant bearing should be roughly north (0° or 360°)
  assert.ok(
    target.bearing !== null && (target.bearing <= 15 || target.bearing >= 345),
    `bearing should point north along travel, got ${target.bearing}`,
  );
  assert.ok(target.key.startsWith('bus-1:'));
});

test('TEST 5b: the map strip left by the expanded sheet rotates a leg to use its full width', () => {
  const northbound: Coordinate[] = [
    [30.5234, 50.4501],
    [30.5238, 50.4550],
    [30.5242, 50.4610],
  ];

  const tallBand = calculateSegmentFocusTarget(northbound, [], 'leg-tall', { width: 360, height: 600 });
  const wideBand = calculateSegmentFocusTarget(northbound, [], 'leg-wide', { width: 390, height: 88 });
  assert.ok(tallBand !== null && wideBand !== null);

  const travelBearing = principalBearing(northbound);
  assert.ok(travelBearing !== null);
  for (const [target, width, height, label] of [
    [tallBand, 360, 600, 'tall'],
    [wideBand, 390, 88, 'wide'],
  ] as const) {
    assert.ok(target.bearing !== null);
    const optimized = cameraForRotatedPoints(northbound, target.bearing, width, height, 0, SEGMENT_FOCUS_MAX_ZOOM);
    const previousHeuristic = cameraForRotatedPoints(
      northbound,
      segmentBearingForViewport(travelBearing, width, height),
      width,
      height,
      0,
      SEGMENT_FOCUS_MAX_ZOOM,
    );
    assert.ok(optimized && previousHeuristic);

    let oracleZoom = Number.NEGATIVE_INFINITY;
    for (let bearing = 0; bearing < 180; bearing += 0.5) {
      const camera = cameraForRotatedPoints(northbound, bearing, width, height, 0, SEGMENT_FOCUS_MAX_ZOOM);
      if (camera) oracleZoom = Math.max(oracleZoom, camera.zoom);
    }
    assert.ok(optimized.zoom >= oracleZoom - 0.02, `${label} band should approach exhaustive best fit`);
    assert.ok(optimized.zoom >= previousHeuristic.zoom - 0.02, `${label} band should not be worse than prior fit`);
  }
  assert.notEqual(tallBand.key, wideBand.key, 'the focus key must change when the band orientation changes');

  // A leg too short to have a meaningful direction never rotates the camera.
  const stub: Coordinate[] = [[30.5234, 50.4501], [30.52345, 50.45015]];
  assert.equal(calculateSegmentFocusTarget(stub, [], 'leg-stub', { width: 390, height: 88 })?.bearing, null);
});

test('TEST 6 & TEST 8: RouteCameraController handles overview, segment focus, stop focus, and recenter button visibility', () => {
  let latestState = initialRouteCameraState();
  let focusedCoords: Coordinate[] | null = null;
  let singleFocus: { point: Coordinate; zoom?: number } | null = null;

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
    focusCoordinates: (points: Coordinate[]) => { focusedCoords = points; },
    focus: (point: Coordinate, zoom?: number) => { singleFocus = { point, zoom }; },
  };

  const controller = new RouteCameraController({
    adapter: mockAdapter as any,
    onStateChange: (state) => { latestState = state; },
  });

  // Initially in ROUTE_OVERVIEW -> no recenter button
  assert.equal(latestState.mode, 'ROUTE_OVERVIEW');
  assert.equal(shouldShowRecenterButton(latestState), false);

  // 1. Focus a segment
  const segmentPoints: Coordinate[] = [[30.5, 50.4], [30.6, 50.5]];
  controller.focusSegment('leg-42', { points: segmentPoints, bearing: 45, key: 'leg-42:test' });
  assert.equal(latestState.mode, 'SEGMENT_FOCUS');
  assert.equal(latestState.activeSegmentId, 'leg-42');
  assert.equal(shouldShowRecenterButton(latestState), true);
  assert.deepEqual(focusedCoords, segmentPoints);

  // 2. Focus an individual stop
  const stopCoord: Coordinate = [30.55, 50.45];
  controller.focusStop('stop-7', stopCoord);
  assert.equal(latestState.mode, 'STOP_FOCUS');
  assert.equal(latestState.activeStopId, 'stop-7');
  assert.equal(shouldShowRecenterButton(latestState), true);
  assert.deepEqual(singleFocus, { point: stopCoord, zoom: 16.5 });

  // 3. Return to overview
  const wholeRoute: Coordinate[] = [[30.4, 50.3], [30.5, 50.4], [30.7, 50.6]];
  controller.showOverview(wholeRoute);
  assert.equal(latestState.mode, 'ROUTE_OVERVIEW');
  assert.equal(latestState.activeSegmentId, null);
  assert.equal(latestState.activeStopId, null);
  assert.equal(shouldShowRecenterButton(latestState), false);
  assert.deepEqual(focusedCoords, wholeRoute);
});

test('TEST 7: manual camera interaction activates MANUAL_CAMERA and suppresses intrusive snap refits', () => {
  let latestState = initialRouteCameraState();
  let fitCalled = 0;

  const mockAdapter = {
    setRoute: () => {},
    onRouteSegmentSelect: () => {},
    setVehicle: () => {},
    onCameraModeChange: () => {},
    setWaypoints: () => {},
    fitRoute: () => { fitCalled++; },
    recenter: () => {},
    setCameraMode: () => {},
    setTheme: () => {},
    setLayer: () => {},
    setPerspective: () => {},
    setTransportLayers: () => {},
    setTransportDisplayPreferences: () => {},
    focusCoordinates: () => { fitCalled++; },
    focus: () => { fitCalled++; },
  };

  const controller = new RouteCameraController({
    adapter: mockAdapter as any,
    onStateChange: (state) => { latestState = state; },
  });

  const wholeRoute: Coordinate[] = [[30.4, 50.3], [30.5, 50.4]];

  // User touches and pans the map
  controller.onUserMapInteraction();
  assert.equal(latestState.mode, 'MANUAL_CAMERA');
  assert.equal(shouldShowRecenterButton(latestState), true);

  // Now when the bottom sheet snaps or settles, camera is NOT hijacked!
  const callsBefore = fitCalled;
  controller.syncOnSnapSettled({ routePoints: wholeRoute });
  assert.equal(fitCalled, callsBefore, 'camera must not refit during MANUAL_CAMERA mode');

  // User taps "Show whole route" button -> smoothly returns to ROUTE_OVERVIEW
  controller.showOverview(wholeRoute);
  assert.equal(latestState.mode, 'ROUTE_OVERVIEW');
  assert.equal(fitCalled, callsBefore + 1, 'showOverview triggers route refit');
});

test('TEST 10: computeVisibleMapArea accurately accounts for dynamic insets and centers vertical area', () => {
  const area = computeVisibleMapArea({
    viewportWidth: 390,
    viewportHeight: 844,
    sheetHeight: 250,
    sheetSnap: 'collapsed',
    topBarHeight: 84,
  });

  assert.equal(area.viewportWidth, 390);
  assert.equal(area.viewportHeight, 844);
  assert.ok(area.visibleWidth > 300, 'visible width should be clear of side padding');
  assert.ok(area.visibleHeight > 400, 'visible height should be clear of top bar and sheet');
  assert.ok(area.visibleCenterY > 100 && area.visibleCenterY < 450, 'visible center Y must be well positioned');
});
