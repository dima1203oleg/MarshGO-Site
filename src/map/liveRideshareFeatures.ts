import type { Coordinate } from '../../shared/navigation/contracts';
import type { LiveRidesharePosition } from './MapAdapter';

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
