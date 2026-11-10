export type RouteSheetSnap = 'peek' | 'collapsed' | 'half' | 'expanded';
export type RouteSheetLogicalState = 'PEEK' | 'COMPACT' | 'MEDIUM' | 'FULL';
export type RouteSheetHeights = Record<RouteSheetSnap, number>;

export const ROUTE_SHEET_SNAPS: readonly RouteSheetSnap[] = ['peek', 'collapsed', 'half', 'expanded'];

// The fixed app tab bar is 57 px of chrome plus its bottom safe-area padding:
// 1 px border, 8 px top padding and a 48 px control row. Keep the route sheet
// above it in immersive map states so the CTA and every tab remain reachable.
export const ROUTE_TABBAR_CHROME_HEIGHT = 57;

export function routeTabbarInset(safeAreaBottom = 0): number {
  const safeArea = Number.isFinite(safeAreaBottom) ? Math.max(0, Math.min(64, safeAreaBottom)) : 0;
  return ROUTE_TABBAR_CHROME_HEIGHT + Math.max(7.2, safeArea);
}

export function routeSheetAvailableViewportHeight(viewportHeight: number, safeAreaBottom = 0, reserveBottomNavigation = false): number {
  const viewport = Number.isFinite(viewportHeight) ? Math.max(320, viewportHeight) : 844;
  return Math.max(320, viewport - (reserveBottomNavigation ? routeTabbarInset(safeAreaBottom) : 0));
}

export function routeSheetViewportHeights(viewportHeight: number, safeAreaBottom = 0, reserveBottomNavigation = false): RouteSheetHeights {
  const availableHeight = routeSheetAvailableViewportHeight(viewportHeight, safeAreaBottom, reserveBottomNavigation);
  // When the sheet floats above the persistent tab bar, that bar already owns
  // the device safe area. Adding it to the sheet detents would create a blank band.
  return routeSheetHeights(availableHeight, reserveBottomNavigation ? 0 : safeAreaBottom);
}

export const ROUTE_SHEET_LOGICAL_LABELS: Readonly<Record<RouteSheetSnap, RouteSheetLogicalState>> = {
  peek: 'PEEK',
  collapsed: 'COMPACT',
  half: 'MEDIUM',
  expanded: 'FULL',
};

/**
 * Compact shared snap points for route preview and active navigation. The
 * compact states add only the device's actual bottom safe area, once.
 */
export function routeSheetHeights(viewportHeight: number, safeAreaBottom = 0): RouteSheetHeights {
  const viewport = Number.isFinite(viewportHeight) ? Math.max(320, viewportHeight) : 844;
  const safeArea = Number.isFinite(safeAreaBottom) ? Math.max(0, Math.min(64, safeAreaBottom)) : 0;
  const expanded = Math.min(840, viewport * 0.9, Math.max(220, viewport - 172));
  const halfRatio = viewport < 700 ? 0.5 : 0.45;
  const half = Math.min(expanded - 44, 420, Math.max(245, Math.round(viewport * halfRatio)) + safeArea);
  const collapsedContent = Math.min(half - safeArea - 28, 280, Math.max(178, Math.round(viewport * 0.2)));
  const peekContent = Math.min(collapsedContent - 24, 196, Math.max(146, Math.round(viewport * 0.18)));
  const collapsed = collapsedContent + safeArea;
  const peek = peekContent + safeArea;
  return { peek, collapsed, half, expanded };
}

export function routeSheetSafeAreaInset(): number {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 0;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue('--mg-safe-area-bottom');
  const inset = Number.parseFloat(value);
  return Number.isFinite(inset) ? inset : 0;
}

/** Keeps FULL content-sized when possible while preserving a short map band and scroll access for long itineraries. */
export function routeSheetExpandedFitHeight(viewportHeight: number, safeAreaBottom: number, requiredHeight: number): number {
  const heights = routeSheetHeights(viewportHeight, safeAreaBottom);
  const required = Number.isFinite(requiredHeight) ? Math.ceil(requiredHeight) : heights.expanded;
  return Math.min(heights.expanded, Math.max(heights.half + 24, required));
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
