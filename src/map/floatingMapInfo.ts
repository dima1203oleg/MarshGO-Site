import type { Coordinate } from '../../shared/navigation/contracts';
import type { ApiJourney } from '../services/productionApi';
import type { FloatingMapInfo } from './MapAdapter';
import { formatJourneyDistance, formatJourneyDuration } from '../views/journeyResultPresentation';
import { journeyLegLabel } from '../views/journeyLegLabel';

type JourneyLeg = ApiJourney['legs'][number];

function validCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2
    && Number.isFinite(value[0]) && Number.isFinite(value[1])
    && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

/** Use a coordinate supplied by the itinerary; never interpolate a decorative anchor. */
function anchorForLeg(leg: JourneyLeg): Coordinate | null {
  const geometry = Array.isArray(leg.routeGeometry) ? leg.routeGeometry.filter(validCoordinate) : [];
  if (geometry.length) return geometry[Math.floor((geometry.length - 1) / 2)] ?? null;
  return validCoordinate(leg.origin.coordinates) ? leg.origin.coordinates : null;
}

export function floatingInfoForLeg(leg: JourneyLeg): FloatingMapInfo | null {
  const coordinates = anchorForLeg(leg);
  if (!coordinates) return null;
  const baseLabel = journeyLegLabel(leg.mode, leg.transportType);
  const title = leg.routeName ? `${baseLabel} ${leg.routeName}` : baseLabel;
  const detail = [
    formatJourneyDuration(leg.durationSeconds),
    typeof leg.distanceMeters === 'number' && Number.isFinite(leg.distanceMeters)
      ? formatJourneyDistance(leg.distanceMeters)
      : null,
  ].filter((value): value is string => Boolean(value)).join(' · ');
  return { id: `stage:${leg.id}`, kind: 'stage', coordinates, title, ...(detail ? { detail } : {}) };
}

export function floatingInfoForStop(
  id: string,
  kind: 'Посадка' | 'Висадка' | 'Зупинка',
  name: string,
  coordinates: Coordinate,
): FloatingMapInfo | null {
  if (!validCoordinate(coordinates) || !name.trim()) return null;
  return {
    id: `stop:${id}`,
    kind: kind === 'Посадка' ? 'boarding' : kind === 'Висадка' ? 'alighting' : 'stop',
    coordinates,
    title: kind,
    detail: name.trim(),
  };
}

export function floatingInfoForTransfer(
  id: string,
  coordinates: Coordinate,
  waitSeconds: number,
): FloatingMapInfo | null {
  if (!validCoordinate(coordinates)) return null;
  return {
    id: `transfer:${id}`,
    kind: 'transfer',
    coordinates,
    title: 'Пересадка',
    detail: waitSeconds > 0 ? `${formatJourneyDuration(waitSeconds)} очікування` : 'Місце пересадки',
  };
}
