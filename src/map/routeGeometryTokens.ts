import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { MapTheme } from './MapAdapter';

/**
 * Інтелектуальна система геометрії маршруту: one stroke scale for every route
 * layer. Stops run overview (z5) → city (z12) → street (z15) → segment focus
 * (z17), so widths keep their proportions while the camera glides instead of
 * clamping at the first focus zoom. z5/z15 anchors match the approved canvas.
 */
export const ROUTE_ZOOM_STOPS = [5, 12, 15, 17] as const;

type ZoomStops = readonly [number, number, number, number];

export const ROUTE_STROKE_TOKENS: {
  halo: { normal: ZoomStops; selected: ZoomStops };
  casing: { normal: ZoomStops; selected: ZoomStops };
  core: { normal: ZoomStops; selected: ZoomStops };
} = {
  // Keep the selected leg legible without turning it into a wide ribbon that
  // hides parallel streets. At z17 the visible core is 8 px and its casing is
  // 10 px; the halo is restrained and painted separately below.
  halo: { normal: [6, 9, 13, 15], selected: [9, 13, 16, 18] },
  casing: { normal: [3.5, 5.5, 7.5, 9], selected: [4.5, 6.5, 8.5, 10] },
  core: { normal: [2, 3, 4, 5], selected: [3, 4, 5.5, 8] },
};

export const ROUTE_EMPHASIS_TOKENS = {
  dimmedOpacity: 0.4,
  haloOpacity: { normal: 0.12, selected: 0.3, dimmed: 0.025 },
  casingOpacity: { normal: 0.98, dimmed: 0.35 },
} as const;

export const ROUTE_RENDER_TOKENS = {
  haloBlur: 3,
  revealGlowWidth: [9, 15] as const,
  revealGlowOpacity: 0.48,
  revealGlowBlur: 3,
  revealCoreWidth: [2.5, 4.5] as const,
  revealHeadHaloRadius: [5, 12] as const,
  revealHeadCoreRadius: [3.5, 6] as const,
  revealHeadStrokeWidth: 1.5,
  walkHaloBlur: 2.5,
} as const;

/** Selected-aware width expression built from the shared scale — no magic numbers in layers. */
export function routeStrokeWidthExpression(kind: keyof typeof ROUTE_STROKE_TOKENS): ExpressionSpecification {
  const token = ROUTE_STROKE_TOKENS[kind];
  const stops = ROUTE_ZOOM_STOPS.flatMap((zoom, index) => [
    zoom,
    ['case', ['==', ['get', 'selected'], true], token.selected[index]!, token.normal[index]!],
  ]);
  return ['interpolate', ['linear'], ['zoom'], ...stops] as unknown as ExpressionSpecification;
}

/**
 * Walking is a first-class geometry, not a transit afterthought: the trail keeps
 * a readable contrast on both basemaps (deep sky on light, bright sky on dark)
 * and the dash stays proportional to the stroke at every zoom.
 */
export const WALK_GEOMETRY_TOKENS: Record<'LIGHT' | 'DARK', {
  core: string;
  coreSelected: string;
  halo: string;
  haloSelected: string;
  estimate: string;
  dash: [number, number];
  estimateDash: [number, number];
  width: ZoomStops;
  haloWidth: ZoomStops;
  estimateWidth: ZoomStops;
}> = {
  LIGHT: {
    core: '#0284C7', coreSelected: '#0369A1', halo: '#075985', haloSelected: '#0C4A6E', estimate: '#0284C7',
    dash: [0.8, 1.05], estimateDash: [1.15, 1.8],
    width: [2.5, 3.5, 4.5, 5.5], haloWidth: [4.5, 5.5, 6.5, 8], estimateWidth: [2, 2.5, 3, 3.5],
  },
  DARK: {
    core: '#38BDF8', coreSelected: '#7DD3FC', halo: '#0EA5E9', haloSelected: '#38BDF8', estimate: '#38BDF8',
    dash: [0.8, 1.05], estimateDash: [1.15, 1.8],
    width: [2.5, 3.5, 4.5, 5.5], haloWidth: [4.5, 5.5, 6.5, 8], estimateWidth: [2, 2.5, 3, 3.5],
  },
};

export function walkGeometryTokens(theme: MapTheme) {
  return WALK_GEOMETRY_TOKENS[theme.endsWith('_DARK') ? 'DARK' : 'LIGHT'];
}

export function walkWidthExpression(kind: 'width' | 'haloWidth' | 'estimateWidth'): ExpressionSpecification {
  const stops = WALK_GEOMETRY_TOKENS.LIGHT[kind];
  return ['interpolate', ['linear'], ['zoom'],
    ...ROUTE_ZOOM_STOPS.flatMap((zoom, index) => [zoom, stops[index]!]),
  ] as unknown as ExpressionSpecification;
}

/**
 * Direction chevrons only on the selected confirmed transit leg: the passenger
 * reads the travel direction at a glance without arrow clutter on siblings.
 * Spacing tightens as the camera zooms in so the rhythm stays even on screen.
 */
export const ROUTE_ARROW_TOKENS = {
  // These values align one-to-one with ROUTE_ZOOM_STOPS. Keeping only the
  // style values here prevents the zoom stops from being mistaken for sizes.
  spacing: [280, 220, 170, 145] as const,
  size: [0.38, 0.5, 0.62, 0.72] as const,
  opacity: 0.82,
} as const;

export function routeArrowExpression(kind: 'spacing' | 'size'): ExpressionSpecification {
  const values = ROUTE_ARROW_TOKENS[kind];
  return ['interpolate', ['linear'], ['zoom'],
    ...ROUTE_ZOOM_STOPS.flatMap((zoom, index) => [zoom, values[index]!]),
  ] as unknown as ExpressionSpecification;
}

/** One motion language with the camera: entrance easing, then a graceful fade instead of a pop. */
export const SEGMENT_REVEAL_TOKENS = { durationMs: 850, holdMs: 400, fadeMs: 260 } as const;
