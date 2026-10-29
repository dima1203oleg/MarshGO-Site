export type RouteSheetSnap = 'collapsed' | 'half' | 'expanded';
export type RouteSheetHeights = Record<RouteSheetSnap, number>;

/** Heights leave a stable map window at the top and keep the compact summary usable. */
export function routeSheetHeights(viewportHeight: number): RouteSheetHeights {
  const viewport = Number.isFinite(viewportHeight) ? Math.max(320, viewportHeight) : 844;
  const expanded = Math.min(840, viewport * 0.88, Math.max(0, viewport - 112));
  const half = Math.min(660, Math.max(224, viewport * 0.66), Math.max(160, expanded - 48));
  const collapsed = Math.min(246, Math.max(200, viewport * 0.29), Math.max(112, half - 48));
  return { collapsed, half, expanded };
}

export function nearestRouteSheetSnap(height: number, heights: RouteSheetHeights): RouteSheetSnap {
  const choices: RouteSheetSnap[] = ['collapsed', 'half', 'expanded'];
  return choices.reduce((nearest, candidate) =>
    Math.abs(heights[candidate] - height) < Math.abs(heights[nearest] - height) ? candidate : nearest,
  'collapsed');
}

/** Positive velocity means an upward finger swipe; negative means downward. */
export function settleRouteSheetSnap(
  height: number,
  velocity: number,
  heights: RouteSheetHeights,
  velocityThreshold = 0.45,
): RouteSheetSnap {
  if (Math.abs(velocity) < velocityThreshold) return nearestRouteSheetSnap(height, heights);
  const choices: RouteSheetSnap[] = ['collapsed', 'half', 'expanded'];
  if (velocity > 0) return choices.find(snap => heights[snap] > height + 1) ?? 'expanded';
  return [...choices].reverse().find(snap => heights[snap] < height - 1) ?? 'collapsed';
}
