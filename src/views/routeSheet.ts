export type RouteSheetSnap = 'collapsed' | 'half' | 'expanded';
export type RouteSheetHeights = Record<RouteSheetSnap, number>;

export const ROUTE_SHEET_SNAPS: readonly RouteSheetSnap[] = ['collapsed', 'half', 'expanded'];

/**
 * Snap points match the approved route-sheet composition:
 * - collapsed keeps the summary and segment ribbon, so the map keeps the
 *   lower part of the screen for the origin/destination context;
 * - half is the canonical view: duration, price, ribbon and the single
 *   primary action, exactly one screenful with no inner scrolling;
 * - expanded adds the scrollable per-segment details while always leaving a
 *   map strip at the top.
 */
export function routeSheetHeights(viewportHeight: number): RouteSheetHeights {
  const viewport = Number.isFinite(viewportHeight) ? Math.max(320, viewportHeight) : 844;
  const expanded = Math.min(840, viewport * 0.9, Math.max(0, viewport - 172));
  const half = Math.min(430, Math.max(300, viewport * 0.375));
  const collapsed = Math.min(300, Math.max(248, viewport * 0.3), Math.max(180, half - 44));
  return { collapsed, half, expanded };
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
 * A pointermove stream on iOS arrives several times per displayed frame, and every unthrottled write
 * to the sheet's height forces the MapLibre canvas underneath to relayout. This coalesces the newest
 * value into a single write per animation frame and drops the ones the finger already superseded.
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

/** Live reading of the OS setting; the sheet uses it to drop its own easing without a CSS !important. */
/**
 * The sheet's snap curve from one place. During a drag there is nothing to interpolate — the
 * finger *is* the animation — and under reduced motion a detent change must land instantly.
 * The transition lives in the React style prop, and an inline style cannot be overridden by the
 * CSS prefers-reduced-motion guard without !important, so the preference is folded in here.
 */
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
