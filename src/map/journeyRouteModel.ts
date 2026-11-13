import type { ApiJourney } from '../services/productionApi';
import type { ColoredRouteSegment, RouteWaypoint } from './MapAdapter';
import type { Coordinate } from '../../shared/navigation/contracts';
import { journeyLegLabel } from '../views/journeyLegLabel';
import { getTransportModeVisual } from '../design-system/transport/transportModeRegistry';
import { greatCircleDistanceMeters, isValidCoordinate, sanitizeLineCoordinates } from './lineGeometry';

export const journeyModeColor = (mode: string, transportType?: string) =>
  getTransportModeVisual(mode, transportType).color;

export function formatTransferCount(value: number): string {
  const count = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  const category = new Intl.PluralRules('uk-UA').select(count);
  const noun = category === 'one' ? 'пересадка' : category === 'few' ? 'пересадки' : 'пересадок';
  return `${count} ${noun}`;
}

/**
 * Adjacent confirmed legs meet at the same physical stop, but providers round
 * coordinates differently, leaving a sub-metre notch between two round caps at
 * street zoom. Snap only that rounding noise so the join reads as one continuous
 * ribbon. A real gap or a dashed estimate is never bridged (§12.2: no fake roads).
 */
export const ROUTE_JOIN_SNAP_TOLERANCE_M = 1.5;

function validGeometry(points: Array<[number, number]> | null | undefined): Coordinate[] {
  return sanitizeLineCoordinates(points);
}

export type JourneyRouteMapLeg = {
  id: string;
  label: string;
  color: string;
  coordinates: Coordinate[];
  approximate?: boolean;
};

/** Estimated endpoint chords are not a confirmed path and must not be drawn as one. */
export function confirmedJourneySegments(segments: readonly ColoredRouteSegment[]): ColoredRouteSegment[] {
  return segments.filter(segment => segment.approximate !== true);
}

function validCoordinate(point: unknown): point is Coordinate {
  return isValidCoordinate(point);
}

export function buildJourneyRouteMapModel(legs: ApiJourney['legs']): {
  legs: JourneyRouteMapLeg[];
  routeSegments: ColoredRouteSegment[];
  routeWaypoints: RouteWaypoint[];
  missingShapeCount: number;
  missingWalkingShapeCount: number;
  approximateWalkCount: number;
  approximateMicromobilityCount: number;
} {
  const isEstimatedMicromobility = (leg: ApiJourney['legs'][number]) => {
    const isMicromobility = leg.mode === 'BIKE' || leg.mode === 'BICYCLE' || leg.mode === 'SCOOTER'
      || leg.transportType === 'bike' || leg.transportType === 'scooter';
    const source = leg.source?.toLowerCase() ?? '';
    const accuracy = leg.routeAccuracy?.toUpperCase();
    if (!isMicromobility || accuracy === 'SOURCE_GEOMETRY' || accuracy === 'VERIFIED') return false;
    return accuracy === 'STRAIGHT_LINE_ESTIMATE' || accuracy === 'ESTIMATED'
      || source.includes('estimate') || source.startsWith('gbfs-') || source === 'micromobility';
  };
  const mappedLegs = legs.flatMap((leg, sourceIndex) => {
    const estimatedMicromobility = isEstimatedMicromobility(leg);
    let coordinates = validGeometry(leg.routeGeometry);
    // Only an explicit routing provider/feed proves street geometry. Legacy `walking` and
    // `transfer-walk` legs come from a synthetic city grid, not a pedestrian graph.
    // Keep them visible as dashed estimates, never as exact street trajectories.
    const approximateSource = /estimate|straight-line|^(walking|transfer-walk)$/i.test(leg.source ?? '')
      || /^(STRAIGHT_LINE_ESTIMATE|ESTIMATED)$/i.test(leg.routeAccuracy ?? '')
      || leg.geometrySource === 'walking-estimate';
    const source = leg.source?.toLowerCase() ?? '';
    const confirmedWalkingGeometry = /^(SOURCE_GEOMETRY|VERIFIED)$/i.test(leg.routeAccuracy ?? '')
      || ['osrm-foot-route', 'gtfs-pathway', 'gtfs-pathways', 'pedestrian-router'].includes(source);
    let approximate = (leg.mode === 'WALK' && (approximateSource || !confirmedWalkingGeometry)) || estimatedMicromobility;
    // Inventory feeds and static rental networks provide endpoints, not a rideable
    // street route. Keep that estimate visible as a dashed chord rather than hiding
    // the segment or implying a verified cycling path.
    // The fallback also keeps walking legs visible when the API omits an unverified
    // synthetic street-grid shape; routed geometry from a provider remains untouched.
    if (coordinates.length < 2 && (leg.mode === 'WALK' || estimatedMicromobility)
      && validCoordinate(leg.origin?.coordinates) && validCoordinate(leg.destination?.coordinates)
      && (leg.origin.coordinates[0] !== leg.destination.coordinates[0] || leg.origin.coordinates[1] !== leg.destination.coordinates[1])) {
      coordinates = [leg.origin.coordinates, leg.destination.coordinates];
      approximate = true;
    }
    return coordinates.length >= 2 ? [{
      sourceIndex,
      leg: {
        id: leg.id,
        label: `${journeyLegLabel(leg.mode, leg.transportType)}${leg.routeName ? ` ${leg.routeName}` : ''}`,
        color: journeyModeColor(leg.mode, leg.transportType),
        isWalk: leg.mode === 'WALK',
        coordinates,
        ...(approximate ? { approximate: true } : {}),
      },
    }] : [];
  });
  for (let index = 0; index < mappedLegs.length - 1; index++) {
    const earlierEntry = mappedLegs[index]!;
    const laterEntry = mappedLegs[index + 1]!;
    // A missing shape is a real unknown section, not permission to connect the
    // surrounding geometries. Only consecutive itinerary legs may share a join.
    if (laterEntry.sourceIndex !== earlierEntry.sourceIndex + 1) continue;
    const earlier = earlierEntry.leg;
    const later = laterEntry.leg;
    if (earlier.approximate || later.approximate) continue;
    if (earlier.coordinates.length < 2 || later.coordinates.length < 2) continue;
    const tail = earlier.coordinates.at(-1)!;
    const head = later.coordinates[0]!;
    const gap = greatCircleDistanceMeters(tail, head);
    if (gap > 0 && gap <= ROUTE_JOIN_SNAP_TOLERANCE_M) {
      earlier.coordinates = [...earlier.coordinates.slice(0, -1), head];
    }
  }
  const validPoint = validCoordinate;
  const firstPoint = legs[0]?.origin?.coordinates;
  const lastPoint = legs.at(-1)?.destination?.coordinates;
  const waypointCandidates: RouteWaypoint[] = [];
  if (validPoint(firstPoint) && legs[0]) waypointCandidates.push({ coordinate: firstPoint, kind: 'PICKUP', segmentIds: [legs[0].id] });
  legs.forEach((leg, index) => {
    if (index > 0 && validPoint(leg.origin?.coordinates)) waypointCandidates.push({
      coordinate: leg.origin.coordinates,
      kind: 'TRANSFER',
      segmentIds: [legs[index - 1]!.id, leg.id],
    });
    if (leg.stops?.length) for (const stop of leg.stops) {
      if (validPoint(stop.coordinates)) waypointCandidates.push({ coordinate: stop.coordinates, kind: 'STOP', segmentIds: [leg.id] });
    }
  });
  if (validPoint(lastPoint) && legs.at(-1)) waypointCandidates.push({ coordinate: lastPoint, kind: 'DROPOFF', segmentIds: [legs.at(-1)!.id] });
  const waypointsByCoordinate = new Map<string, RouteWaypoint>();
  const kindPriority: Record<string, number> = { PICKUP: 4, DROPOFF: 4, TRANSFER: 3, STOP: 2 };
  for (const waypoint of waypointCandidates) {
    const { coordinate, kind } = waypoint;
    const key = `${coordinate[0].toFixed(6)},${coordinate[1].toFixed(6)}`;
    const previous = waypointsByCoordinate.get(key);
    if (!previous) waypointsByCoordinate.set(key, { ...waypoint, segmentIds: [...(waypoint.segmentIds ?? [])] });
    else {
      previous.segmentIds = [...new Set([...(previous.segmentIds ?? []), ...(waypoint.segmentIds ?? [])])];
      if ((kindPriority[kind] ?? 0) > (kindPriority[previous.kind] ?? 0)) previous.kind = kind;
    }
  }
  const routeWaypoints = [...waypointsByCoordinate.values()];
  const renderedLegs = mappedLegs.map(({ leg }) => leg);
  const mappedLegIds = new Set(renderedLegs.map(leg => leg.id));
  return {
    legs: renderedLegs,
    routeSegments: renderedLegs.map(({ id, coordinates, color, isWalk, approximate }) => ({
      id,
      coordinates,
      modeColor: color,
      isWalk,
      ...(approximate ? { approximate: true } : {}),
    })),
    routeWaypoints,
    missingShapeCount: legs.filter(leg => leg.mode !== 'WALK' && !mappedLegIds.has(leg.id)).length,
    missingWalkingShapeCount: legs.filter(leg => leg.mode === 'WALK' && !mappedLegIds.has(leg.id)).length,
    approximateWalkCount: renderedLegs.filter(leg => leg.approximate).length,
    approximateMicromobilityCount: legs.filter(isEstimatedMicromobility).length,
  };
}
