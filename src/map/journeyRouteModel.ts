import type { ApiJourney } from '../services/productionApi';
import type { ColoredRouteSegment } from './MapAdapter';
import type { Coordinate } from '../../shared/navigation/contracts';
import { journeyLegLabel } from '../views/journeyLegLabel';
import { getTransportModeVisual } from '../design-system/transport/transportModeRegistry';

export const journeyModeColor = (mode: string, transportType?: string) =>
  getTransportModeVisual(mode, transportType).color;

export function formatTransferCount(value: number): string {
  const count = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  const category = new Intl.PluralRules('uk-UA').select(count);
  const noun = category === 'one' ? 'пересадка' : category === 'few' ? 'пересадки' : 'пересадок';
  return `${count} ${noun}`;
}

function validGeometry(points: Array<[number, number]> | undefined): Coordinate[] {
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
  routeWaypoints: Array<{ coordinate: Coordinate; kind: string }>;
  missingShapeCount: number;
  approximateWalkCount: number;
} {
  const mappedLegs = legs.flatMap(leg => {
    let coordinates = validGeometry(leg.routeGeometry);
    let approximate = false;
    if (coordinates.length < 2 && leg.mode === 'WALK'
      && (leg.source === 'walking-estimate' || leg.source === 'straight-line-estimate')
      && validCoordinate(leg.origin?.coordinates) && validCoordinate(leg.destination?.coordinates)
      && (leg.origin.coordinates[0] !== leg.destination.coordinates[0] || leg.origin.coordinates[1] !== leg.destination.coordinates[1])) {
      coordinates = [leg.origin.coordinates, leg.destination.coordinates];
      approximate = true;
    }
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
  const waypointCandidates: Array<{ coordinate: Coordinate; kind: string }> = [];
  if (validPoint(firstPoint)) waypointCandidates.push({ coordinate: firstPoint, kind: 'PICKUP' });
  legs.forEach((leg, index) => {
    if (index > 0 && validPoint(leg.origin?.coordinates)) waypointCandidates.push({ coordinate: leg.origin.coordinates, kind: 'TRANSFER' });
    if (leg.stops?.length) for (const stop of leg.stops) {
      if (validPoint(stop.coordinates)) waypointCandidates.push({ coordinate: stop.coordinates, kind: 'STOP' });
    }
  });
  if (validPoint(lastPoint)) waypointCandidates.push({ coordinate: lastPoint, kind: 'DROPOFF' });
  const waypointsByCoordinate = new Map<string, { coordinate: Coordinate; kind: string }>();
  for (const waypoint of waypointCandidates) {
    const { coordinate, kind } = waypoint;
    const key = `${coordinate[0].toFixed(6)},${coordinate[1].toFixed(6)}`;
    const previous = waypointsByCoordinate.get(key);
    if (!previous || (kind === 'PICKUP' || kind === 'DROPOFF')) waypointsByCoordinate.set(key, waypoint);
  }
  const routeWaypoints = [...waypointsByCoordinate.values()];
  const mappedLegIds = new Set(mappedLegs.map(leg => leg.id));
  return {
    legs: mappedLegs,
    routeSegments: mappedLegs.map(({ id, coordinates, color, approximate }) => ({ id, coordinates, modeColor: color,
      ...(approximate ? { approximate: true } : {}) })),
    routeWaypoints,
    missingShapeCount: legs.filter(leg => leg.mode !== 'WALK' && !mappedLegIds.has(leg.id)).length,
    approximateWalkCount: mappedLegs.filter(leg => leg.approximate).length,
  };
}
