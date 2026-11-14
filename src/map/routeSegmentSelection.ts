export type RouteMapTapAction = 'focus' | 'select';

/** A map tap refocuses an active segment; it must not clear route context. */
export function routeMapTapAction(activeSegmentId: string | null, tappedSegmentId: string): RouteMapTapAction {
  return activeSegmentId === tappedSegmentId ? 'focus' : 'select';
}
