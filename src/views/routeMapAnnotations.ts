import type { Coordinate } from '../../shared/navigation/contracts';
import type { MapAnnotation } from '../map/MapAdapter';
import type { ApiJourney, ApiJourneyLive } from '../services/productionApi';
import { formatJourneyDistance, formatJourneyDuration } from './journeyResultPresentation';
import { journeyLegLabel } from './journeyLegLabel';

type Leg = ApiJourney['legs'][number];
type LiveSegment = ApiJourneyLive['segments'][number];

const TRANSIT_MODES = new Set(['BUS', 'MINIBUS', 'TROLLEYBUS', 'TRAM', 'METRO', 'RAIL', 'FERRY', 'FUNICULAR']);
const TRANSIT_TYPES = new Set(['bus', 'marshrutka', 'intercity_bus', 'train', 'suburban_train', 'city_train', 'tram', 'trolleybus', 'metro']);

export function isTransitLeg(leg: Leg): boolean {
  return TRANSIT_MODES.has(leg.mode) || TRANSIT_TYPES.has(leg.transportType ?? '');
}

export function primaryTransitLeg(legs: readonly Leg[], preferredId?: string | null): Leg | null {
  const preferred = preferredId ? legs.find(leg => leg.id === preferredId && isTransitLeg(leg)) : undefined;
  return preferred ?? legs.find(isTransitLeg) ?? null;
}

export function formatSegmentCount(value: number): string {
  const count = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const noun = new Intl.PluralRules('uk-UA').select(count) === 'one' ? 'сегмент'
    : new Intl.PluralRules('uk-UA').select(count) === 'few' ? 'сегменти' : 'сегментів';
  return `${count} ${noun}`;
}

export function formatStopCount(value: number): string {
  const count = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const category = new Intl.PluralRules('uk-UA').select(count);
  const noun = category === 'one' ? 'зупинка' : category === 'few' ? 'зупинки' : 'зупинок';
  return `${count} ${noun}`;
}

function validCoordinate(point: unknown): point is Coordinate {
  return Array.isArray(point) && point.length === 2
    && Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function midpoint(coordinates: readonly Coordinate[] | null | undefined): Coordinate | null {
  if (!coordinates || coordinates.length < 2) return null;
  let walked = 0;
  const segments: number[] = [];
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const from = coordinates[index]!;
    const to = coordinates[index + 1]!;
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    segments.push(length);
    walked += length;
  }
  if (walked === 0) return coordinates[Math.floor(coordinates.length / 2)]!;
  let target = walked / 2;
  for (let index = 0; index < segments.length; index += 1) {
    if (target <= segments[index]!) {
      const ratio = segments[index] === 0 ? 0 : target / segments[index]!;
      const from = coordinates[index]!;
      const to = coordinates[index + 1]!;
      return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
    }
    target -= segments[index]!;
  }
  return coordinates.at(-1)!;
}

function legGeometry(leg: Leg): Coordinate[] {
  const geometry = Array.isArray(leg.routeGeometry) ? leg.routeGeometry.filter(validCoordinate) : [];
  if (geometry.length >= 2) return geometry;
  return [leg.origin.coordinates, leg.destination.coordinates].filter(validCoordinate);
}

function routeLabel(leg: Leg, live: LiveSegment | undefined): string {
  return leg.routeName ?? live?.lineRoutes?.[0]?.name ?? journeyLegLabel(leg.mode, leg.transportType);
}

function directionTermini(direction: string | undefined): [string | null, string | null] {
  if (!direction || !direction.includes('→')) return [null, null];
  const [from, to] = direction.split('→').map(part => part.trim());
  return [from || null, to || null];
}

/**
 * Labels drawn on top of the route map. Every label comes from an itinerary
 * field or from the live overlay; nothing is placed on a guessed coordinate.
 */
export function buildRouteMapAnnotations({
  journey,
  live,
  preferredLegId,
}: {
  journey: ApiJourney;
  live: ApiJourneyLive | null;
  preferredLegId?: string | null;
}): MapAnnotation[] {
  const annotations: MapAnnotation[] = [];
  const legs = journey.legs;
  const transit = primaryTransitLeg(legs, preferredLegId);
  const liveSegment = transit ? live?.segments.find(segment => segment.legId === transit.id) : undefined;
  const liveLine = liveSegment?.lineRoutes?.find(route => route.zones?.passengerSegment?.length) ?? liveSegment?.lineRoutes?.[0];
  const name = transit ? routeLabel(transit, liveSegment) : '';

  legs.forEach((leg, index) => {
    if (leg.mode !== 'WALK') return;
    const point = midpoint(legGeometry(leg));
    if (!point) return;
    const first = index === 0;
    const last = index === legs.length - 1;
    const parts = [formatJourneyDuration(leg.durationSeconds)];
    if (typeof leg.distanceMeters === 'number' && Number.isFinite(leg.distanceMeters)) parts.push(formatJourneyDistance(leg.distanceMeters));
    annotations.push({
      id: `walk:${leg.id}`,
      kind: 'WALK',
      coordinates: point,
      title: 'Пішки',
      detail: parts.join(' · '),
      tone: first ? 'green' : last ? 'blue' : 'neutral',
    });
  });

  if (transit) {
    annotations.push({
      id: `boarding:${transit.id}`,
      kind: 'BOARDING',
      coordinates: transit.origin.coordinates,
      title: 'Посадка',
      detail: transit.origin.name,
      tone: 'green',
    });
    annotations.push({
      id: `alighting:${transit.id}`,
      kind: 'ALIGHTING',
      coordinates: transit.destination.coordinates,
      title: 'Висадка',
      detail: transit.destination.name,
      tone: 'blue',
    });
  }

  if (transit && liveSegment && liveLine) {
    const [terminusFrom, terminusTo] = directionTermini(liveLine.direction);
    const before = liveLine.zones?.beforeBoarding;
    const after = liveLine.zones?.afterAlighting;
    if (liveLine.geometryScope !== 'leg_only') {
      if (before?.length && terminusFrom) {
        annotations.push({
          id: `terminus:start:${liveLine.id}`,
          kind: 'TERMINUS',
          coordinates: before[0]!,
          title: 'Кінцева',
          detail: terminusFrom,
          tone: 'neutral',
        });
        const routePoint = midpoint(before);
        if (routePoint) annotations.push({ id: `route:before:${liveLine.id}`, kind: 'ROUTE', coordinates: routePoint, title: name, tone: 'purple' });
      }
      if (after?.length && terminusTo) {
        annotations.push({
          id: `terminus:end:${liveLine.id}`,
          kind: 'TERMINUS',
          coordinates: after.at(-1)!,
          title: 'Кінцева',
          detail: terminusTo,
          tone: 'neutral',
        });
        const routePoint = midpoint(after);
        if (routePoint) annotations.push({ id: `route:after:${liveLine.id}`, kind: 'ROUTE', coordinates: routePoint, title: name, tone: 'purple' });
      }
    }
  }

  for (const vehicle of liveSegment?.vehicles ?? []) {
    if (!validCoordinate(vehicle.coordinates)) continue;
    const level = vehicle.priority?.level;
    const eta = typeof vehicle.etaSeconds === 'number' && Number.isFinite(vehicle.etaSeconds) && vehicle.etaSeconds > 0
      && (vehicle.etaConfidence ?? 'NONE') !== 'NONE'
      ? vehicle.etaSeconds
      : null;
    if (!eta && !vehicle.emphasized && level !== 'L2' && level !== 'L3' && level !== 'L4') continue;
    annotations.push({
      id: `vehicle:${vehicle.id}`,
      kind: 'VEHICLE',
      coordinates: vehicle.coordinates,
      title: name,
      ...(eta ? { detail: `≈ ${formatJourneyDuration(eta)}` } : vehicle.approachingBoarding ? { detail: 'наближається' } : {}),
      tone: 'purple',
    });
  }

  return annotations;
}
