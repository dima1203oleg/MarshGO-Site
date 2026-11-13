export type RouteSheetSnap = 'peek' | 'collapsed' | 'half' | 'expanded';
export type RouteSheetLogicalState = 'PEEK' | 'COMPACT' | 'MEDIUM' | 'FULL';
export type RouteSheetHeights = Record<RouteSheetSnap, number>;

export const ROUTE_SHEET_SNAPS: readonly RouteSheetSnap[] = ['peek', 'collapsed', 'half', 'expanded'];

export const ROUTE_SHEET_LOGICAL_LABELS: Readonly<Record<RouteSheetSnap, RouteSheetLogicalState>> = {
  peek: 'PEEK',
  collapsed: 'COMPACT',
  half: 'MEDIUM',
  expanded: 'FULL',
};

/**
 * Snap points match the approved 4-position route-sheet composition:
 * - peek (PEEK, 168–176 px) leaves the maximum map view with only handle,
 *   total duration, total fare, a swipeable stage ribbon and CTA;
 * - collapsed (COMPACT) keeps the departure/arrival summary, ribbon and CTA;
 * - half (MEDIUM) adds concise stage context while keeping the map interactive;
 * - expanded (FULL) shows scrollable per-segment details while preserving the
 *   sheet-aware camera fit's map strip on standard mobile viewports.
 */
export function routeSheetHeights(viewportHeight: number): RouteSheetHeights {
  const viewport = Number.isFinite(viewportHeight) ? Math.max(320, viewportHeight) : 844;
  const half = Math.min(430, Math.max(260, viewport * 0.375), viewport * 0.7);
  const expanded = Math.max(half + 24, Math.min(840, viewport * 0.9, Math.max(0, viewport - 172)));
  const collapsed = Math.min(300, Math.max(220, Math.round(viewport * 0.28)));
  const peek = Math.min(collapsed - 36, Math.max(168, Math.min(176, Math.round(viewport * 0.18))));
  return { peek, collapsed, half, expanded };
}

/** Fit the compact detent to its visible content while keeping all four snaps distinct. */
export function fitCollapsedRouteSheetHeight(heights: RouteSheetHeights, contentHeight: number | null): number {
  if (contentHeight === null || !Number.isFinite(contentHeight) || contentHeight <= 0) return heights.collapsed;
  return Math.min(heights.collapsed, Math.max(200, heights.peek + 24, Math.ceil(contentHeight)));
}

/** Fit the medium detent to the route cards when they fit; long itineraries keep a scrollable list. */
export function fitMediumRouteSheetHeight(heights: RouteSheetHeights, contentHeight: number | null): number {
  if (contentHeight === null || !Number.isFinite(contentHeight) || contentHeight <= 0) return heights.half;
  return Math.min(heights.half, Math.max(heights.collapsed + 24, Math.ceil(contentHeight)));
}

/** Keep the full detent large enough to remain distinct, but no taller than its content or viewport cap. */
export function fitExpandedRouteSheetHeight(heights: RouteSheetHeights, contentHeight: number | null): number {
  if (contentHeight === null || !Number.isFinite(contentHeight) || contentHeight <= 0) return heights.expanded;
  return Math.min(heights.expanded, Math.max(heights.half + 24, Math.ceil(contentHeight)));
}

export function nearestRouteSheetSnap(
  height: number,
  heights: RouteSheetHeights,
  choices: readonly RouteSheetSnap[] = ROUTE_SHEET_SNAPS,
): RouteSheetSnap {
  return choices.reduce((nearest, candidate) =>
    Math.abs(heights[candidate] - height) < Math.abs(heights[nearest] - height) ? candidate : nearest,
  choices[0]!);
}

/** Recover a sheet left between snap points when its pointer stream is interrupted. */
export function recoverRouteSheetDrag(height: number, heights: RouteSheetHeights): { snap: RouteSheetSnap; height: number } {
  const snap = nearestRouteSheetSnap(height, heights);
  return { snap, height: heights[snap] };
}

/** Positive velocity means an upward finger swipe; negative means downward. */
export function settleRouteSheetSnap(
  height: number,
  velocity: number,
  heights: RouteSheetHeights,
  velocityThreshold = 0.45,
  gestureStartHeight = height,
  choices: readonly RouteSheetSnap[] = ROUTE_SHEET_SNAPS,
): RouteSheetSnap {
  const nearest = nearestRouteSheetSnap(height, heights, choices);
  const startSnap = nearestRouteSheetSnap(gestureStartHeight, heights, choices);
  const startIndex = choices.indexOf(startSnap);
  // A coalesced pointer event can make the last-frame velocity disagree with
  // the actual drag direction. The displacement is authoritative when there
  // was meaningful movement; velocity only breaks ties for a stationary fling.
  const displacement = height - gestureStartHeight;
  const direction = Math.abs(displacement) > 1 ? Math.sign(displacement) : Math.sign(velocity);
  if (direction === 0) return nearest;
  const adjacent = direction > 0
    ? choices[Math.min(choices.length - 1, startIndex + 1)]!
    : choices[Math.max(0, startIndex - 1)]!;
  if (adjacent === startSnap) return startSnap;
  const transitionThreshold = Math.abs(heights[adjacent] - heights[startSnap]) * 0.25;
  if (Math.abs(velocity) < velocityThreshold && Math.abs(displacement) < transitionThreshold) return nearest;
  return adjacent;
}

/**
 * Coalesces high-frequency pointermove height updates into a single DOM write
 * per animation frame so the MapLibre canvas underneath is not forced to relayout
 * multiple times per frame.
 */
export function createFrameWriter(
  write: (value: number) => void,
  request: (callback: () => void) => number = typeof requestAnimationFrame === 'function'
    ? (callback) => requestAnimationFrame(callback)
    : (callback) => setTimeout(callback, 16) as unknown as number,
  cancel: (handle: number) => void = typeof cancelAnimationFrame === 'function'
    ? (handle) => cancelAnimationFrame(handle)
    : (handle) => clearTimeout(handle),
): { schedule: (value: number) => void; flush: () => void; discard: () => void } {
  let pending: number | null = null;
  let handle: number | null = null;
  const run = () => {
    handle = null;
    if (pending === null) return;
    const value = pending;
    pending = null;
    write(value);
  };
  return {
    schedule(value: number) {
      pending = value;
      if (handle === null) handle = request(run);
    },
    flush() {
      if (handle !== null) { cancel(handle); handle = null; }
      run();
    },
    discard() {
      if (handle !== null) cancel(handle);
      handle = null;
      pending = null;
    },
  };
}

export function routeSheetTransition(dragging: boolean, reducedMotion: boolean, property = 'height'): string {
  return dragging || reducedMotion ? 'none' : `${property} var(--mg-dur-base) var(--mg-ease-entrance)`;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function subscribeReducedMotion(listener: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onChange = (event: MediaQueryListEvent) => listener(event.matches);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
