import type { ApiJourney } from '../services/productionApi';
import type { ColoredRouteSegment, RouteWaypoint } from './MapAdapter';
import type { Coordinate } from '../../shared/navigation/contracts';
import { journeyLegLabel } from '../views/journeyLegLabel';
import { getTransportModeVisual } from '../design-system/transport/transportModeRegistry';
import { generatePedestrianGeometry } from '../../shared/navigation/pedestrianGeometry';

export const journeyModeColor = (mode: string, transportType?: string) =>
  getTransportModeVisual(mode, transportType).color;

export function formatTransferCount(value: number): string {
  const count = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  const category = new Intl.PluralRules('uk-UA').select(count);
  const noun = category === 'one' ? 'пересадка' : category === 'few' ? 'пересадки' : 'пересадок';
  return `${count} ${noun}`;
}

function validGeometry(points: Array<[number, number]> | null | undefined): Coordinate[] {
  if (!Array.isArray(points)) return [];
  const valid = points.every(point => Array.isArray(point) && point.length === 2
    && Number.isFinite(point[0]) && Number.isFinite(point[1])
    && point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90);
  return valid ? points : [];
}

export type JourneyRouteMapLeg = {
  id: string;
  label: string;
  color: string;
  coordinates: Coordinate[];
  approximate?: boolean;
};

function validCoordinate(point: unknown): point is Coordinate {
  return Array.isArray(point) && point.length === 2
    && Number.isFinite(point[0]) && Number.isFinite(point[1])
    && point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90;
}

export function buildJourneyRouteMapModel(legs: ApiJourney['legs']): {
  legs: JourneyRouteMapLeg[];
  routeSegments: ColoredRouteSegment[];
  routeWaypoints: RouteWaypoint[];
  missingShapeCount: number;
  approximateWalkCount: number;
  approximateMicromobilityCount: number;
} {
  const isEstimatedMicromobility = (leg: ApiJourney['legs'][number]) =>
    (leg.mode === 'BIKE' || leg.mode === 'BICYCLE' || leg.mode === 'SCOOTER'
      || leg.transportType === 'bike' || leg.transportType === 'scooter')
    && (leg.source === 'static-bike-network-estimate' || leg.source === 'gbfs-geofence-scooter-estimate');
  const mappedLegs = legs.flatMap(leg => {
    // End-to-end rental estimates contain only pickup/drop-off coordinates.
    // Treating those two points as a road line invents a route shape, so keep
    // the endpoints as waypoints and let the details card carry the estimate.
    if (isEstimatedMicromobility(leg)) return [];
    let coordinates = validGeometry(leg.routeGeometry);

    // If leg has intermediate stops (e.g. railway stations or transit stops), use them to build route shape
    if (coordinates.length < 2 && leg.stops && leg.stops.length >= 2) {
      const stopCoords = leg.stops
        .map(s => s.coordinates as Coordinate | undefined)
        .filter(validCoordinate);
      if (stopCoords.length >= 2) coordinates = stopCoords;
    }

    // If coordinates still missing, construct from origin and destination
    if (coordinates.length < 2 && validCoordinate(leg.origin?.coordinates) && validCoordinate(leg.destination?.coordinates)) {
      if (leg.mode === 'WALK') {
        coordinates = generatePedestrianGeometry(leg.origin.coordinates, leg.destination.coordinates);
      } else if (leg.origin.coordinates[0] !== leg.destination.coordinates[0] || leg.origin.coordinates[1] !== leg.destination.coordinates[1]) {
        coordinates = [leg.origin.coordinates, leg.destination.coordinates];
      }
    }

    // Ensure pedestrian walks always follow realistic street geometry everywhere
    if (leg.mode === 'WALK' && coordinates.length === 2 && validCoordinate(coordinates[0]) && validCoordinate(coordinates[1])) {
      coordinates = generatePedestrianGeometry(coordinates[0], coordinates[1]);
    }

    const approximate = leg.mode === 'WALK' && coordinates.length <= 2;
    return coordinates.length >= 2 ? [{
      id: leg.id,
      label: `${journeyLegLabel(leg.mode, leg.transportType)}${leg.routeName ? ` ${leg.routeName}` : ''}`,
      color: journeyModeColor(leg.mode, leg.transportType),
      coordinates,
      ...(approximate ? { approximate: true } : {}),
    }] : [];
  });
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
  const mappedLegIds = new Set(mappedLegs.map(leg => leg.id));
  return {
    legs: mappedLegs,
    routeSegments: mappedLegs.map(({ id, coordinates, color, approximate }) => ({
      id,
      coordinates,
      modeColor: color,
      ...(approximate ? { approximate: true } : {}),
    })),
    routeWaypoints,
    missingShapeCount: legs.filter(leg => leg.mode !== 'WALK' && !mappedLegIds.has(leg.id)).length,
    approximateWalkCount: mappedLegs.filter(leg => leg.approximate).length,
    approximateMicromobilityCount: legs.filter(isEstimatedMicromobility).length,
  };
}
