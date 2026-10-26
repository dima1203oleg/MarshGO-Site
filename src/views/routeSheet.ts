export type RouteSheetSnap = 'collapsed' | 'half' | 'expanded';
export type RouteSheetHeights = Record<RouteSheetSnap, number>;

/** Half snap reserves roughly half of the viewport for the map; expanded keeps a map strip visible. */
export function routeSheetHeights(viewportHeight: number): RouteSheetHeights {
  const viewport = Number.isFinite(viewportHeight) ? Math.max(320, viewportHeight) : 844;
  const expanded = Math.min(840, viewport * 0.88, Math.max(0, viewport - 112));
  const half = Math.min(660, Math.max(224, viewport * 0.5), Math.max(160, expanded - 48));
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
  gestureStartHeight = height,
): RouteSheetSnap {
  const choices: RouteSheetSnap[] = ['collapsed', 'half', 'expanded'];
  const nearest = nearestRouteSheetSnap(height, heights);
  const startSnap = nearestRouteSheetSnap(gestureStartHeight, heights);
  const startIndex = choices.indexOf(startSnap);
  // A coalesced pointer event can make the last-frame velocity disagree with
  // the actual drag direction. The displacement is authoritative when there
  // was meaningful movement; velocity only breaks ties for a stationary fling.
  const displacement = height - gestureStartHeight;
  const direction = Math.abs(displacement) > 1 ? Math.sign(displacement) : Math.sign(velocity);
  if (direction === 0) return nearest;
  const adjacent = direction > 0
    ? choices[Math.min(choices.length - 1, startIndex + 1)]
    : choices[Math.max(0, startIndex - 1)];
  if (adjacent === startSnap) return startSnap;
  const transitionThreshold = Math.abs(heights[adjacent] - heights[startSnap]) * 0.25;
  if (Math.abs(velocity) < velocityThreshold && Math.abs(displacement) < transitionThreshold) return nearest;
  return adjacent;
}
