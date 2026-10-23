export type RouteSheetSnap = 'collapsed' | 'half' | 'expanded';
export type RouteSheetHeights = Record<RouteSheetSnap, number>;

/** Heights leave a stable map window at the top and keep the compact summary usable. */
export function routeSheetHeights(viewportHeight: number): RouteSheetHeights {
  const viewport = Number.isFinite(viewportHeight) ? Math.max(320, viewportHeight) : 844;
  // The expanded route-detail mockup keeps a compact map band above the sheet.
  // Keep at least 112 CSS pixels visible; the segment list scrolls inside the
  // sheet so a tall panel does not hide any itinerary details.
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
  startingSnap?: RouteSheetSnap,
  velocityThreshold = 0.45,
): RouteSheetSnap {
  if (Math.abs(velocity) < velocityThreshold) return nearestRouteSheetSnap(height, heights);
  const choices: RouteSheetSnap[] = ['collapsed', 'half', 'expanded'];
  const currentIndex = startingSnap ? choices.indexOf(startingSnap) : choices.indexOf(nearestRouteSheetSnap(height, heights));
  if (velocity > 0) return choices[Math.min(choices.length - 1, currentIndex + 1)];
  return choices[Math.max(0, currentIndex - 1)];
}
