import type { ApiRendezvous, ApiRendezvousApproaches } from '../services/productionApi';
import type { ColoredRouteSegment, LiveRidesharePosition, RouteWaypoint } from '../map/MapAdapter';

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


/** Show only validated, provider-routed approaches returned by the server. */
export function rendezvousApproachRoutes(value: ApiRendezvousApproaches | null): ColoredRouteSegment[] {
  if (!value) return [];
  const routes: ColoredRouteSegment[] = [];
  const candidates = [
    { id: 'driver-approach', approach: value.driver.approach, modeColor: '#2563eb' },
    { id: 'passenger-approach', approach: value.passenger.approach, modeColor: '#7c3aed' },
  ];
  for (const { id, approach, modeColor } of candidates) {
    if (approach.status !== 'ROUTED' || !Array.isArray(approach.geometry) || approach.geometry.length < 2) continue;
    const valid = approach.geometry.every((point) => Array.isArray(point) && point.length === 2
      && Number.isFinite(point[0]) && Math.abs(point[0]) <= 180
      && Number.isFinite(point[1]) && Math.abs(point[1]) <= 90);
    if (valid) routes.push({ id, coordinates: approach.geometry, modeColor });
  }
  return routes;
}

export type LiveRendezvousOverlay = { positions: LiveRidesharePosition[]; routes: ColoredRouteSegment[] };

function distanceMeters(a: [number, number], b: [number, number]) {
  const radians = Math.PI / 180;
  const dLat = (b[1] - a[1]) * radians;
  const dLon = (b[0] - a[0]) * radians;
  const lat1 = a[1] * radians;
  const lat2 = b[1] * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

/** Validate the server's consent-gated routes against each exact GPS fix before drawing either side. */
export function liveRendezvousOverlay(value: ApiRendezvousApproaches | null, now = Date.now()): LiveRendezvousOverlay {
  if (!value || !validPoint(value.pickup.coordinates)) return { positions: [], routes: [] };
  const positions: LiveRidesharePosition[] = [];
  const routes: ColoredRouteSegment[] = [];
  const candidates = [
    { participant: 'driver' as const, id: `${value.rendezvousId}:driver`, color: '#2563eb', side: value.driver },
    { participant: 'passenger' as const, id: `${value.rendezvousId}:passenger`, color: '#7c3aed', side: value.passenger },
  ];
  for (const { participant, id, color, side } of candidates) {
    const location = side.location;
    if (!location || location.freshness !== 'LIVE' || !validPoint(location.coordinates) || !Number.isFinite(location.accuracyMeters) || location.accuracyMeters > 100) continue;
    const locationAge = now - Date.parse(location.capturedAt);
    if (!Number.isFinite(locationAge) || locationAge < -30_000 || locationAge > 90_000) continue;
    positions.push({ id, participant, coordinates: location.coordinates, capturedAt: location.capturedAt, freshness: 'LIVE' });

    const approach = side.approach;
    const routeAge = approach.calculatedAt ? now - Date.parse(approach.calculatedAt) : NaN;
    if (approach.status !== 'ROUTED' || !approach.calculatedAt || !Number.isFinite(routeAge) || routeAge < -30_000 || routeAge > 60_000
      || !Array.isArray(approach.geometry) || approach.geometry.length < 2
      || !approach.geometry.every(validPoint)) continue;
    const first = approach.geometry[0]!;
    const last = approach.geometry.at(-1)!;
    if (distanceMeters(first, location.coordinates) > 200 || distanceMeters(last, value.pickup.coordinates) > 200) continue;
    routes.push({ id: `${participant}-approach`, coordinates: approach.geometry, modeColor: color });
  }
  return { positions, routes };
}
