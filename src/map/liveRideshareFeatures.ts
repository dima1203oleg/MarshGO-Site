import type { Coordinate } from '../../shared/navigation/contracts';
import type { LiveRideshareApproachRoute, LiveRidesharePosition } from './MapAdapter';

/** Keep only booking-scoped positions inside the rendezvous retention window. */
export function freshRidesharePositions(positions: readonly LiveRidesharePosition[], now = Date.now()): LiveRidesharePosition[] {
  return positions.flatMap((position) => {
    const [longitude, latitude] = position.coordinates;
    const age = now - Date.parse(position.capturedAt);
    if (!position.id || !Number.isFinite(longitude) || !Number.isFinite(latitude)
      || Math.abs(longitude) > 180 || Math.abs(latitude) > 90
      || !Number.isFinite(age) || age < -30_000 || age > 300_000) return [];
    // Even if an upstream flag is stale or inconsistent, never render an old fix as live.
    const freshness = position.freshness === 'LIVE' && age <= 90_000 ? 'LIVE' : 'STALE';
    return [{ ...position, coordinates: [longitude, latitude] as Coordinate, freshness }];
  });
}

/** Accept only a recent provider road route tied to a fresh driver fix. */
export function freshRideshareApproachRoute(route: LiveRideshareApproachRoute | null, now = Date.now()): LiveRideshareApproachRoute | null {
  if (!route || route.provider !== 'osrm' || !route.id || route.coordinates.length < 2
    || !Number.isFinite(route.distanceMeters) || route.distanceMeters <= 0
    || !Number.isFinite(route.durationSeconds) || route.durationSeconds <= 0) return null;
  const fixAge = now - Date.parse(route.vehicleCapturedAt);
  const routeAge = now - Date.parse(route.calculatedAt);
  if (!Number.isFinite(fixAge) || fixAge < -30_000 || fixAge > 90_000
    || !Number.isFinite(routeAge) || routeAge < -30_000 || routeAge > 60_000) return null;
  const coordinates = route.coordinates;
  if (coordinates.some(([longitude, latitude]) => !Number.isFinite(longitude) || !Number.isFinite(latitude)
    || Math.abs(longitude) > 180 || Math.abs(latitude) > 90)) return null;
  return { ...route, coordinates };
}
