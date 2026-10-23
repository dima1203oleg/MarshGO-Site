import type { ApiRendezvous } from '../services/productionApi';
import type { RouteWaypoint } from '../map/MapAdapter';

const terminalStates = new Set(['BOARDING', 'COMPLETED', 'CANCELLED', 'EXPIRED']);

export type RendezvousPickupDistance = { state: 'LIVE'; straightLineMeters: number } | { state: 'STALE' | 'UNAVAILABLE' };

function validPoint(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2
    && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180
    && Number.isFinite(value[1]) && Math.abs(value[1]) <= 90;
}

/** A straight-line estimate is useful for proximity, but it is never a route distance or ETA. */
export function rendezvousDistanceToPickup(session: ApiRendezvous, participant: 'driver' | 'passenger'): RendezvousPickupDistance {
  if (!session.locationSharingEnabled || !session.currentParticipantConsent || !session.otherParticipantConsent || terminalStates.has(session.state)
    || !validPoint(session.pickup.coordinates)) return { state: 'UNAVAILABLE' };
  const location = session.locations[participant];
  if (location?.freshness === 'STALE') return { state: 'STALE' };
  if (!location || location.freshness !== 'LIVE' || !validPoint(location.coordinates)) return { state: 'UNAVAILABLE' };

  const radians = Math.PI / 180;
  const [pickupLongitude, pickupLatitude] = session.pickup.coordinates;
  const [longitude, latitude] = location.coordinates;
  const latitudeDelta = (latitude - pickupLatitude) * radians;
  const longitudeDelta = (longitude - pickupLongitude) * radians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(pickupLatitude * radians) * Math.cos(latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  const straightLineMeters = 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Number.isFinite(straightLineMeters) ? { state: 'LIVE', straightLineMeters } : { state: 'UNAVAILABLE' };
}

/** Return pickup plus only fresh participant locations; never infer a route between points. */
export function rendezvousMapPoints(session: ApiRendezvous, currentUserIsDriver: boolean): RouteWaypoint[] {
  const points: RouteWaypoint[] = [];
  if (validPoint(session.pickup.coordinates)) points.push({ coordinate: session.pickup.coordinates, kind: 'PICKUP' });
  if (!session.locationSharingEnabled || !session.currentParticipantConsent || !session.otherParticipantConsent || terminalStates.has(session.state)) return points;

  const viewer = currentUserIsDriver ? 'driver' : 'passenger';
  for (const participant of ['driver', 'passenger'] as const) {
    const location = session.locations[participant];
    if (!location || location.freshness !== 'LIVE' || !validPoint(location.coordinates)) continue;
    points.push({
      coordinate: location.coordinates,
      kind: participant === viewer ? 'SELF_LOCATION' : 'OTHER_LOCATION',
    });
  }
  return points;
}
