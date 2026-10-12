import type { ApiJourney } from '../services/productionApi';
import type { ColoredRouteSegment } from './MapAdapter';
import type { Coordinate } from '../../shared/navigation/contracts';
import { journeyLegLabel } from '../views/journeyLegLabel';

const MODE_COLORS: Record<string, string> = {
  BUS: '#1687FF', URBAN_BUS: '#1687FF', MINIBUS: '#F59E0B', MARSHRUTKA: '#F59E0B',
  TROLLEYBUS: '#10A884', TRAM: '#EF4444', METRO: '#8B5CF6', RAIL: '#7C3AED',
  COMMUNITY: '#0EA5E9', COMMUNITY_DEMAND: '#0EA5E9', TAXI: '#F59E0B', TRANSFER: '#0EA5E9',
  BIKE: '#10A884', BICYCLE: '#10A884', SCOOTER: '#8B5CF6', WALK: '#94A3B8',
};

const colorForMode = (mode: string, transportType?: string) =>
  MODE_COLORS[transportType?.toUpperCase() ?? ''] ?? MODE_COLORS[mode.toUpperCase()] ?? '#1687FF';

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
      color: colorForMode(leg.mode, leg.transportType),
      coordinates,
    }] : [];
  });
  const firstPoint = shapedLegs[0]?.coordinates[0];
  const finalCoordinates = shapedLegs.at(-1)?.coordinates;
  const lastPoint = finalCoordinates?.[finalCoordinates.length - 1];
  const shapedLegIds = new Set(shapedLegs.map(leg => leg.id));
  return {
    legs: shapedLegs,
    routeSegments: shapedLegs.map(({ coordinates, color }) => ({ coordinates, modeColor: color })),
    routeWaypoints: firstPoint && lastPoint
      ? [{ coordinate: firstPoint, kind: 'PICKUP' }, { coordinate: lastPoint, kind: 'DROPOFF' }]
      : [],
    missingShapeCount: legs.filter(leg => leg.mode !== 'WALK' && !shapedLegIds.has(leg.id)).length,
  };
}
