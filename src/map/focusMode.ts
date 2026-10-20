import type { TransportLayerId } from './transportLayerConfig';
import type { ColoredRouteSegment, RouteWaypoint } from './MapAdapter';

/** Suppress secondary live/map overlays in navigation focus mode without changing saved layer choices. */
export function visibleTransportLayers(layers: ReadonlySet<TransportLayerId>, focusMode: boolean): ReadonlySet<TransportLayerId> {
  return focusMode ? new Set() : new Set(layers);
}

/** In overview show the whole itinerary; on selection show only that journey leg.
 * Scheduled-line context and live vehicles are rendered in their own overlay so
 * hiding unrelated journey legs does not hide the selected transit line. */
export function journeySegmentsForFocus(segments: readonly ColoredRouteSegment[], activeId: string | null): Array<ColoredRouteSegment & { selected: boolean; dimmed: boolean }> {
  if (!activeId) return segments.map(segment => ({ ...segment, selected: true, dimmed: false }));
  const active = segments.find(segment => segment.id === activeId);
  return active ? [{ ...active, selected: true, dimmed: false }] : [];
}

/** Keep only stops and endpoints belonging to the focused leg; unscoped points are overview-only. */
export function visibleJourneyWaypoints(points: readonly RouteWaypoint[], activeId: string | null): RouteWaypoint[] {
  if (!activeId) return [...points];
  return points.filter(point => point.segmentIds?.includes(activeId));
}
