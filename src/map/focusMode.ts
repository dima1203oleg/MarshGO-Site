import type { TransportLayerId } from './transportLayerConfig';
import type { ColoredRouteSegment, RouteWaypoint } from './MapAdapter';

/** Suppress secondary live/map overlays in navigation focus mode without changing saved layer choices. */
export function visibleTransportLayers(layers: ReadonlySet<TransportLayerId>, focusMode: boolean): ReadonlySet<TransportLayerId> {
  return focusMode ? new Set() : new Set(layers);
}

/** In overview show the whole itinerary; on selection show only that leg on the base route layer. */
export function journeySegmentsForFocus(segments: readonly ColoredRouteSegment[], activeId: string | null): Array<ColoredRouteSegment & { selected: boolean; dimmed: boolean }> {
  if (!activeId) return segments.map(segment => ({ ...segment, selected: true, dimmed: false }));
  const selected = segments.find(segment => segment.id === activeId);
  return selected ? [{ ...selected, selected: true, dimmed: false }] : [];
}

/** Keep only stops and endpoints belonging to the focused leg; unscoped points are overview-only. */
export function visibleJourneyWaypoints(points: readonly RouteWaypoint[], activeId: string | null): RouteWaypoint[] {
  if (!activeId) return [...points];
  return points.filter(point => point.segmentIds?.includes(activeId));
}
