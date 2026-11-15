import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ROUTE_ARROW_TOKENS,
  ROUTE_EMPHASIS_TOKENS,
  ROUTE_RENDER_TOKENS,
  ROUTE_STROKE_TOKENS,
  ROUTE_ZOOM_STOPS,
  SEGMENT_REVEAL_TOKENS,
  WALK_GEOMETRY_TOKENS,
  routeArrowExpression,
  routeRevealGradient,
  routeStrokeWidthExpression,
  walkGeometryTokens,
  walkWidthExpression,
} from '../src/map/routeGeometryTokens';
import { CAMERA_ZOOM_STEP_DURATION_MS, cameraMotionDuration } from '../src/map/cameraMotion';

const adapter = readFileSync(new URL('../src/map/MapLibreAdapter.ts', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../src/views/JourneyRouteMapScreen.tsx', import.meta.url), 'utf8');
const mapAdapterContract = readFileSync(new URL('../src/map/MapAdapter.ts', import.meta.url), 'utf8');
const mapControls = readFileSync(new URL('../src/components/MapInteractionControls.tsx', import.meta.url), 'utf8');

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

test('the route stroke scale grows with zoom and keeps halo > casing > core at every stop', () => {
  assert.deepEqual([...ROUTE_ZOOM_STOPS], [5, 12, 15, 17]);
  for (const kind of ['halo', 'casing', 'core'] as const) {
    const token = ROUTE_STROKE_TOKENS[kind];
    for (const series of [token.normal, token.selected]) {
      for (let i = 1; i < series.length; i += 1) {
        assert.ok(series[i]! > series[i - 1]!, `${kind} must widen at zoom stop ${i}`);
      }
    }
    for (let i = 0; i < ROUTE_ZOOM_STOPS.length; i += 1) {
      assert.ok(token.selected[i]! > token.normal[i]!, `${kind} selected must outrank normal`);
    }
  }
  for (let i = 0; i < ROUTE_ZOOM_STOPS.length; i += 1) {
    assert.ok(ROUTE_STROKE_TOKENS.halo.normal[i]! > ROUTE_STROKE_TOKENS.casing.normal[i]!);
    assert.ok(ROUTE_STROKE_TOKENS.casing.normal[i]! > ROUTE_STROKE_TOKENS.core.normal[i]!);
  }
  assert.ok(ROUTE_EMPHASIS_TOKENS.dimmedOpacity > 0 && ROUTE_EMPHASIS_TOKENS.dimmedOpacity < 1);
});

test('route reveal is a bounded line-progress gradient over the original path', () => {
  const start = routeRevealGradient('#2D8CFF', 0);
  const middle = routeRevealGradient('#2D8CFF', 0.5);
  const complete = routeRevealGradient('#2D8CFF', 1);
  assert.deepEqual(start.slice(0, 3), ['interpolate', ['linear'], ['line-progress']]);
  assert.ok(middle.includes(0.5), 'the midpoint reveals half the normalized route distance');
  assert.equal(complete.at(-1), '#2D8CFF');
  assert.ok(routeRevealGradient('#2D8CFF', 2).includes(1), 'progress clamps at the end of the route');
});

test('focused route geometry stays crisp at street zoom instead of becoming a broad glowing ribbon', () => {
  const lastStop = ROUTE_ZOOM_STOPS.length - 1;
  assert.ok(ROUTE_STROKE_TOKENS.core.selected[lastStop]! <= 8);
  assert.ok(ROUTE_STROKE_TOKENS.casing.selected[lastStop]! <= 10);
  assert.ok(ROUTE_STROKE_TOKENS.halo.selected[lastStop]! <= 18);
  assert.ok(ROUTE_EMPHASIS_TOKENS.haloOpacity.selected <= 0.3);
  assert.ok(ROUTE_RENDER_TOKENS.haloBlur <= 3);
  for (const theme of ['LIGHT', 'DARK'] as const) {
    assert.ok(WALK_GEOMETRY_TOKENS[theme].width[lastStop]! <= 5.5);
    assert.ok(WALK_GEOMETRY_TOKENS[theme].haloWidth[lastStop]! <= 8);
    assert.ok(WALK_GEOMETRY_TOKENS[theme].estimateWidth[lastStop]! <= 4);
  }
  assert.ok(ROUTE_RENDER_TOKENS.revealGlowWidth[1] <= 15);
  assert.ok(ROUTE_RENDER_TOKENS.revealGlowBlur <= 3);
});

test('stroke expressions interpolate the shared scale with a selected case at every stop', () => {
  for (const kind of ['halo', 'casing', 'core'] as const) {
    const expression = routeStrokeWidthExpression(kind) as unknown[];
    assert.equal(expression[0], 'interpolate');
    assert.deepEqual(expression[1], ['linear']);
    assert.deepEqual(expression[2], ['zoom']);
    const stops = expression.slice(3);
    assert.equal(stops.length, ROUTE_ZOOM_STOPS.length * 2);
    for (let i = 0; i < ROUTE_ZOOM_STOPS.length; i += 1) {
      assert.equal(stops[i * 2], ROUTE_ZOOM_STOPS[i]);
      const caseExpression = stops[i * 2 + 1] as unknown[];
      assert.equal(caseExpression[0], 'case');
      assert.deepEqual(caseExpression[1], ['==', ['get', 'selected'], true]);
      assert.equal(caseExpression[2], ROUTE_STROKE_TOKENS[kind].selected[i]);
      assert.equal(caseExpression[3], ROUTE_STROKE_TOKENS[kind].normal[i]);
    }
  }
});

test('walking geometry keeps contrast on both basemaps and a proportional dash', () => {
  assert.ok(luminance(WALK_GEOMETRY_TOKENS.LIGHT.core) < luminance(WALK_GEOMETRY_TOKENS.DARK.core),
    'light theme needs the deeper trail, dark theme the brighter one');
  assert.ok(luminance(WALK_GEOMETRY_TOKENS.LIGHT.coreSelected) <= luminance(WALK_GEOMETRY_TOKENS.LIGHT.core));
  assert.ok(luminance(WALK_GEOMETRY_TOKENS.DARK.coreSelected) >= luminance(WALK_GEOMETRY_TOKENS.DARK.core));
  for (const theme of ['LIGHT', 'DARK'] as const) {
    const token = WALK_GEOMETRY_TOKENS[theme];
    for (const dash of [token.dash, token.estimateDash]) {
      assert.ok(dash[0] > 0 && dash[1] > 0);
    }
    for (const kind of ['width', 'haloWidth', 'estimateWidth'] as const) {
      for (let i = 1; i < token[kind].length; i += 1) {
        assert.ok(token[kind][i]! > token[kind][i - 1]!);
      }
      const expression = walkWidthExpression(kind) as unknown[];
      assert.equal(expression[0], 'interpolate');
      assert.equal(expression.length, 3 + ROUTE_ZOOM_STOPS.length * 2);
    }
  }
  assert.equal(walkGeometryTokens('MARSHGO_LIGHT'), WALK_GEOMETRY_TOKENS.LIGHT);
  assert.equal(walkGeometryTokens('MARSHGO_DARK'), WALK_GEOMETRY_TOKENS.DARK);
});

test('direction chevrons tighten spacing and grow as the camera zooms in', () => {
  for (let i = 1; i < ROUTE_ZOOM_STOPS.length; i += 1) {
    assert.ok(ROUTE_ARROW_TOKENS.spacing[i]! < ROUTE_ARROW_TOKENS.spacing[i - 1]!);
    assert.ok(ROUTE_ARROW_TOKENS.size[i]! > ROUTE_ARROW_TOKENS.size[i - 1]!);
  }
  assert.ok(ROUTE_ARROW_TOKENS.spacing.every(value => value >= 120), 'direction marks must not crowd the selected geometry');
  assert.ok(ROUTE_ARROW_TOKENS.size.every(value => value <= 0.8), 'direction marks must remain subordinate to the route');
  assert.ok(ROUTE_ARROW_TOKENS.opacity > 0 && ROUTE_ARROW_TOKENS.opacity <= 1);
  for (const kind of ['spacing', 'size'] as const) {
    const expression = routeArrowExpression(kind) as unknown[];
    assert.equal(expression[0], 'interpolate');
    assert.equal(expression.length, 3 + ROUTE_ZOOM_STOPS.length * 2);
    for (let i = 0; i < ROUTE_ZOOM_STOPS.length; i += 1) {
      assert.equal(expression[3 + i * 2], ROUTE_ZOOM_STOPS[i]);
      assert.equal(expression[4 + i * 2], ROUTE_ARROW_TOKENS[kind][i]);
    }
  }
});

test('the reveal shares the camera motion language and fades instead of popping', () => {
  assert.ok(SEGMENT_REVEAL_TOKENS.durationMs >= 620 && SEGMENT_REVEAL_TOKENS.durationMs <= 900);
  assert.ok(SEGMENT_REVEAL_TOKENS.fadeMs > 0 && SEGMENT_REVEAL_TOKENS.fadeMs <= 400);
  assert.ok(SEGMENT_REVEAL_TOKENS.holdMs >= 0);
  assert.ok(CAMERA_ZOOM_STEP_DURATION_MS >= 200 && CAMERA_ZOOM_STEP_DURATION_MS <= 500);
  assert.equal(cameraMotionDuration(CAMERA_ZOOM_STEP_DURATION_MS, true), 0);
});

test('the adapter draws chevrons only on the selected confirmed transit leg', () => {
  const layerAt = adapter.indexOf("id: 'marshgo-route-arrows'");
  assert.ok(layerAt > 0, 'route arrows layer missing');
  const layer = adapter.slice(layerAt, layerAt + 900);
  assert.match(layer, /'symbol-placement': 'line'/);
  assert.match(layer, /\['==', \['get', 'selected'\], true\]/);
  assert.match(layer, /\['!=', \['get', 'isWalk'\], true\]/);
  assert.match(layer, /\['!=', \['get', 'approximate'\], true\]/);
  assert.match(layer, /routeArrowExpression\('spacing'\)/);
  assert.match(layer, /routeArrowExpression\('size'\)/);
  assert.match(adapter, /hasImage\('marshgo-route-arrow'\)/);
});

test('intermediate stops are zoom-gated while key journey waypoints remain visible', () => {
  assert.match(adapter, /id: 'marshgo-waypoints',[\s\S]{0,320}filter: \['!=', \['get', 'kind'\], 'STOP'\]/);
  assert.match(adapter, /id: 'marshgo-waypoints-stops',[\s\S]{0,220}minzoom: STOP_DETAIL_MIN_ZOOM/);
  assert.match(adapter, /import \{ STOP_DETAIL_MIN_ZOOM,/);
  assert.match(adapter, /setPaintProperty\('marshgo-waypoints-stops', 'circle-color'/);
});

test('route and walk layers consume the geometry tokens, not inline literals', () => {
  assert.match(adapter, /routeStrokeWidthExpression\('halo'\)/);
  assert.match(adapter, /routeStrokeWidthExpression\('casing'\)/);
  assert.match(adapter, /routeStrokeWidthExpression\('core'\)/);
  assert.match(adapter, /walkGeometryTokens\(this\.theme\)/);
  assert.match(adapter, /walkWidthExpression\('width'\)/);
  assert.match(adapter, /isWalk: segment\.isWalk/);
  assert.doesNotMatch(adapter, /isWalk: segment\.modeColor ===/,
    'walking style must follow explicit segment semantics, not a palette color');
  assert.match(adapter, /ROUTE_RENDER_TOKENS\.haloBlur/);
  assert.match(adapter, /ROUTE_RENDER_TOKENS\.revealGlowWidth/);
  assert.match(adapter, /setPaintProperty\('marshgo-route-reveal-glow', 'line-opacity', ROUTE_RENDER_TOKENS\.revealGlowOpacity\)/);
  assert.match(adapter, /ROUTE_RENDER_TOKENS\.walkHaloBlur/);
  assert.doesNotMatch(adapter, /'#38BDF8'|'#0EA5E9'|'#0284C7'|'#0369A1'/,
    'walk colors must come from the theme tokens, not hardcoded hex');
});

test('route source ingress validates whole paths before handing geometry to MapLibre', () => {
  assert.match(adapter, /this\.route = sanitizeLineCoordinates\(points\)/);
  assert.match(adapter, /sanitizeLineCoordinates\(segment\.coordinates\)/);
  assert.match(adapter, /const validCoordinates = sanitizeLineCoordinates\(coordinates\)/);
  assert.match(adapter, /if \(position && !isValidCoordinate\(position\.coordinates\)\) position = null/);
  assert.match(adapter, /if \(this\.route\.length < 2\)[\s\S]{0,160}setData\(\{ type: 'FeatureCollection', features: \[\] \}\)/);
  assert.match(adapter, /focusCoordinates\(points: Coordinate\[\][\s\S]{0,130}points\.every\(isValidCoordinate\)/);
  assert.match(adapter, /focus\(point: Coordinate,[\s\S]{0,100}if \(!isValidCoordinate\(point\)\) return/);
  assert.match(adapter, /route\.zones && passengerSegment\.length < 2\) return \[\]/);
});

test('every programmatic camera move shares the entrance easing', () => {
  const fitAt = adapter.indexOf('this.map.fitBounds(');
  assert.ok(fitAt > 0);
  assert.match(adapter.slice(fitAt, fitAt + 400), /easing: cameraEasing\(\)/);
  const zoomAt = adapter.indexOf('zoomBy(delta: number)');
  assert.ok(zoomAt > 0, 'zoomBy missing');
  const zoomBody = adapter.slice(zoomAt, zoomAt + 500);
  assert.match(zoomBody, /CAMERA_ZOOM_STEP_DURATION_MS/);
  assert.match(zoomBody, /easing: cameraEasing\(\)/);
  assert.match(zoomBody, /motionDuration/);
  assert.match(mapAdapterContract, /zoomBy\?\(delta: number\): void/);
});

test('the reveal fades through paint transitions and restores opacity for the next run', () => {
  assert.equal(
    adapter.match(/'line-opacity-transition': \{ duration: SEGMENT_REVEAL_TOKENS\.fadeMs \}/g)?.length,
    2,
    'glow and core route-reveal lines both need a paint fade',
  );
  assert.doesNotMatch(adapter, /'circle-opacity-transition': \{ duration: SEGMENT_REVEAL_TOKENS\.fadeMs \}/);
  assert.match(adapter, /fadeSegmentReveal\(\)/);
  assert.match(adapter, /restoreRevealOpacity\(\)/);
  assert.match(mapAdapterContract, /fadeSegmentReveal\?\(\): void/);
  const fadeAt = adapter.indexOf('fadeSegmentReveal()');
  assert.match(adapter.slice(fadeAt, fadeAt + 400), /motionDuration\(SEGMENT_REVEAL_TOKENS\.fadeMs\) === 0/,
    'reduced motion must skip the fade, not animate it');
});

test('theme switches repaint the walking trail and reveal fallbacks', () => {
  const themeAt = adapter.indexOf('setTheme(theme: MapTheme)');
  assert.ok(themeAt > 0);
  const themeBody = adapter.slice(themeAt);
  assert.match(themeBody, /setPaintProperty\('marshgo-route-walking-trail', 'line-color'/);
  assert.match(themeBody, /setPaintProperty\('marshgo-route-walking-trail-halo', 'line-color'/);
  assert.match(themeBody, /setPaintProperty\('marshgo-route-walking-estimate', 'line-color'/);
  assert.match(adapter, /setPaintProperty\('marshgo-route-reveal-glow', 'line-gradient', routeRevealGradient/);
  assert.match(adapter, /'marshgo-route-reveal', \{ type: 'geojson', lineMetrics: true/);
  assert.doesNotMatch(adapter, /marshgo-route-reveal-head/);
});

test('the screen offers animated zoom controls with honest labels', () => {
  assert.match(screen, /<MapZoomControls\b/, 'the route map composes the canonical zoom pair');
  const zoomButton = mapControls.slice(mapControls.indexOf('function ZoomButton'), mapControls.indexOf('/** Shared vertical zoom pair'));
  assert.match(zoomButton, /direction > 0 \? 'Збільшити масштаб' : 'Зменшити масштаб'/);
  assert.match(zoomButton, /aria-label=\{label\}/);
  assert.match(zoomButton, /map\?\.zoomBy\?\.\(direction\)/);
  assert.match(zoomButton, /disabled=\{!canZoom\}/, 'zoom is disabled until the map can handle it');
  assert.match(mapControls, /const controlClass = '[^']*h-12 w-12/, 'shared zoom targets exceed the 44 px touch floor');
});

test('the segment reveal runs on tokens and cleans up every timer', () => {
  assert.match(screen, /SEGMENT_REVEAL_TOKENS\.durationMs/);
  assert.match(screen, /SEGMENT_REVEAL_TOKENS\.holdMs/);
  assert.match(screen, /SEGMENT_REVEAL_TOKENS\.fadeMs/);
  assert.match(screen, /const ease = cameraEasing\(\)/);
  assert.match(screen, /fadeSegmentReveal\?\.\(\)/);
  assert.doesNotMatch(screen, /const duration = 850/);
  const cleanupAt = screen.indexOf('revealTimersRef.current.forEach(timer => window.clearTimeout(timer));\n      mapAdapter.current?.clearSegmentReveal?.();');
  assert.ok(cleanupAt > 0, 'unmount must clear reveal timers before clearing the reveal');
});

test('the route reveal scout follows the confirmed path and is removed with the reveal', () => {
  assert.match(adapter, /this\.revealPathSampler = prepareRoutePathSampler\(validCoordinates\)/);
  assert.match(adapter, /const sample = this\.revealPathSampler\?\.\(progress\);\s*if \(sample\) this\.updateRevealScout\(sample\)/);
  assert.match(adapter, /new maplibregl\.Marker\(\{ element, anchor: 'center', rotationAlignment: 'map', pitchAlignment: 'map' \}\)/);
  const clearAt = adapter.indexOf('clearSegmentReveal()');
  const clearEnd = adapter.indexOf('\n  /** Animated zoom', clearAt);
  assert.ok(clearAt > 0 && clearEnd > clearAt);
  assert.match(adapter.slice(clearAt, clearEnd), /this\.removeRevealScout\(\)/);
  const destroyAt = adapter.indexOf('destroy() {', clearEnd);
  assert.ok(destroyAt > 0);
  assert.match(adapter.slice(destroyAt, destroyAt + 280), /this\.removeRevealScout\(\)/);
  const styles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(styles, /\.mg-route-scout\.is-fading\s*\{\s*opacity:\s*0/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.mg-route-scout, \.mg-route-scout__arrow\s*\{\s*transition:\s*none/);
});
