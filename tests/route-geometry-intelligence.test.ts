import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ROUTE_ARROW_TOKENS,
  ROUTE_EMPHASIS_TOKENS,
  ROUTE_STROKE_TOKENS,
  ROUTE_ZOOM_STOPS,
  SEGMENT_REVEAL_TOKENS,
  WALK_GEOMETRY_TOKENS,
  routeArrowExpression,
  routeStrokeWidthExpression,
  walkGeometryTokens,
  walkWidthExpression,
} from '../src/map/routeGeometryTokens';
import { CAMERA_ZOOM_STEP_DURATION_MS, cameraMotionDuration } from '../src/map/cameraMotion';

const adapter = readFileSync(new URL('../src/map/MapLibreAdapter.ts', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../src/views/JourneyRouteMapScreen.tsx', import.meta.url), 'utf8');
const mapAdapterContract = readFileSync(new URL('../src/map/MapAdapter.ts', import.meta.url), 'utf8');

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
    assert.ok(ROUTE_ARROW_TOKENS.spacing[i * 2 + 1]! < ROUTE_ARROW_TOKENS.spacing[(i - 1) * 2 + 1]!);
    assert.ok(ROUTE_ARROW_TOKENS.size[i * 2 + 1]! > ROUTE_ARROW_TOKENS.size[(i - 1) * 2 + 1]!);
  }
  assert.ok(ROUTE_ARROW_TOKENS.opacity > 0 && ROUTE_ARROW_TOKENS.opacity <= 1);
  for (const kind of ['spacing', 'size'] as const) {
    const expression = routeArrowExpression(kind) as unknown[];
    assert.equal(expression[0], 'interpolate');
    assert.equal(expression.length, 3 + ROUTE_ZOOM_STOPS.length * 2);
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

test('route and walk layers consume the geometry tokens, not inline literals', () => {
  assert.match(adapter, /routeStrokeWidthExpression\('halo'\)/);
  assert.match(adapter, /routeStrokeWidthExpression\('casing'\)/);
  assert.match(adapter, /routeStrokeWidthExpression\('core'\)/);
  assert.match(adapter, /walkGeometryTokens\(this\.theme\)/);
  assert.match(adapter, /walkWidthExpression\('width'\)/);
  assert.doesNotMatch(adapter, /'#38BDF8'|'#0EA5E9'|'#0284C7'|'#0369A1'/,
    'walk colors must come from the theme tokens, not hardcoded hex');
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
  assert.match(adapter, /'line-opacity-transition': \{ duration: SEGMENT_REVEAL_TOKENS\.fadeMs \}/);
  assert.match(adapter, /'circle-opacity-transition': \{ duration: SEGMENT_REVEAL_TOKENS\.fadeMs \}/);
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
  assert.match(themeBody, /setPaintProperty\('marshgo-route-reveal-glow', 'line-color'/);
});

test('the screen offers animated zoom controls with honest labels', () => {
  assert.match(screen, /aria-label="Збільшити масштаб"/);
  assert.match(screen, /aria-label="Зменшити масштаб"/);
  assert.match(screen, /zoomBy\?\.\(1\)/);
  assert.match(screen, /zoomBy\?\.\(-1\)/);
  const plusAt = screen.indexOf('aria-label="Збільшити масштаб"');
  assert.match(screen.slice(plusAt, plusAt + 400), /h-11 w-11/, 'zoom targets keep the 44 px floor');
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