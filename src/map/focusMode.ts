import type { TransportLayerId } from './transportLayerConfig';
import type { ColoredRouteSegment, RouteWaypoint } from './MapAdapter';

/** Suppress secondary live/map overlays in navigation focus mode without changing saved layer choices. */
export function visibleTransportLayers(layers: ReadonlySet<TransportLayerId>, focusMode: boolean): ReadonlySet<TransportLayerId> {
  return focusMode ? new Set() : new Set(layers);
}

/** In overview show the whole itinerary; on selection highlight that leg and dim the rest as context. */
export function journeySegmentsForFocus(segments: readonly ColoredRouteSegment[], activeId: string | null): Array<ColoredRouteSegment & { selected: boolean; dimmed: boolean }> {
  // A leg can be selectable in the sheet without having geometry (rental estimates carry only
  // pickup/drop-off points). Returning nothing used to blank the entire itinerary, which reads as a
  // broken map; an unmatchable focus is an overview, because that is still the truth we have.
  if (!activeId || !segments.some(segment => segment.id === activeId)) {
    return segments.map(segment => ({ ...segment, selected: true, dimmed: false }));
  }
  return segments.map(segment => ({ ...segment, selected: segment.id === activeId, dimmed: segment.id !== activeId }));
}

/** Keep only stops and endpoints belonging to the focused leg; unscoped points are overview-only. */
export function visibleJourneyWaypoints(points: readonly RouteWaypoint[], activeId: string | null): RouteWaypoint[] {
  if (!activeId) return [...points];
  return points.filter(point => point.segmentIds?.includes(activeId));
}
