import type { ApiJourney } from '../services/productionApi';
import type { ColoredRouteSegment } from './MapAdapter';
import type { Coordinate } from '../../shared/navigation/contracts';
import { journeyLegLabel } from '../views/journeyLegLabel';

const MODE_COLORS: Record<string, string> = {
  BUS: '#1687FF', URBAN_BUS: '#1687FF', MINIBUS: '#FF9A32', MARSHRUTKA: '#FF9A32',
  TROLLEYBUS: '#00C2A0', TRAM: '#F43F7B', METRO: '#5B5DF2', RAIL: '#5B5DF2',
  COMMUNITY: '#A855F7', COMMUNITY_DEMAND: '#A855F7', TAXI: '#FFB020', TRANSFER: '#52B8FF',
  CARSHARING: '#8CBF26', CAR_RENTAL: '#8CBF26', BIKE: '#20B86A', BICYCLE: '#20B86A',
  SCOOTER: '#00C59A', FERRY: '#0891B2', FUNICULAR: '#64748B', WALK: '#91A6BB',
};

export const journeyModeColor = (mode: string, transportType?: string) =>
  MODE_COLORS[transportType?.toUpperCase() ?? ''] ?? MODE_COLORS[mode.toUpperCase()] ?? '#1687FF';

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
};

export function buildJourneyRouteMapModel(legs: ApiJourney['legs']): {
  legs: JourneyRouteMapLeg[];
  routeSegments: ColoredRouteSegment[];
  routeWaypoints: Array<{ coordinate: Coordinate; kind: string }>;
  missingShapeCount: number;
} {
  const shapedLegs = legs.flatMap(leg => {
    const coordinates = validGeometry(leg.routeGeometry);
    return coordinates.length >= 2 ? [{
      id: leg.id,
      label: `${journeyLegLabel(leg.mode, leg.transportType)}${leg.routeName ? ` ${leg.routeName}` : ''}`,
      color: journeyModeColor(leg.mode, leg.transportType),
      coordinates,
    }] : [];
  });
  const validPoint = (point: unknown): point is Coordinate => Array.isArray(point) && point.length === 2
    && Number.isFinite(point[0]) && Number.isFinite(point[1])
    && point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90;
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
  const shapedLegIds = new Set(shapedLegs.map(leg => leg.id));
  return {
    legs: shapedLegs,
    routeSegments: shapedLegs.map(({ id, coordinates, color }) => ({ id, coordinates, modeColor: color })),
    routeWaypoints,
    missingShapeCount: legs.filter(leg => leg.mode !== 'WALK' && !shapedLegIds.has(leg.id)).length,
  };
}
