import type { TransportLayerId } from './transportLayerConfig';
import type { ColoredRouteSegment, RouteWaypoint } from './MapAdapter';

/** Suppress secondary live/map overlays in navigation focus mode without changing saved layer choices. */
export function visibleTransportLayers(layers: ReadonlySet<TransportLayerId>, focusMode: boolean): ReadonlySet<TransportLayerId> {
  return focusMode ? new Set() : new Set(layers);
}

function suppressItineraryContext(segment: ColoredRouteSegment): boolean {
  const mode = segment.mode?.toLocaleUpperCase('en-US');
  const transport = segment.transportType?.toLocaleLowerCase('en-US');
  return mode === 'BUS' || mode === 'MINIBUS' || mode === 'MARSHRUTKA'
    || transport === 'bus' || transport === 'minibus' || transport === 'marshrutka';
}

/** Bus/minibus focus shows only that corridor; ordinary focus keeps other itinerary legs dimmed. */
export function journeySegmentsForFocus(segments: readonly ColoredRouteSegment[], activeId: string | null): Array<ColoredRouteSegment & { selected: boolean; dimmed: boolean }> {
  if (!activeId) return segments.map(segment => ({ ...segment, selected: true, dimmed: false }));
  if (!segments.some(segment => segment.id === activeId)) return [];
  const activeSegment = segments.find(segment => segment.id === activeId)!;
  if (suppressItineraryContext(activeSegment)) {
    return [{ ...activeSegment, selected: true, dimmed: false }];
  }
  return segments.map(segment => ({
    ...segment,
    selected: segment.id === activeId,
    dimmed: segment.id !== activeId,
  }));
}

/** Keep only stops and endpoints belonging to the focused leg; unscoped points are overview-only. */
export function visibleJourneyWaypoints(points: readonly RouteWaypoint[], activeId: string | null): RouteWaypoint[] {
  if (!activeId) return [...points];
  return points.filter(point => point.segmentIds?.includes(activeId));
}
