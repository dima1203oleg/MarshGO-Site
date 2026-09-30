import type { LocationFix, MatchedLocation, RouteResult } from '../../shared/navigation/contracts';
import { decodePolyline6, projectOnRoute } from '../../shared/navigation/geometry';
import type { MapMatchingProvider } from '../../shared/navigation/extensions';

/** Deterministic local route projection for rendering; server matching remains authoritative for business decisions. */
export class BasicRouteMapMatchingProvider implements MapMatchingProvider {
  async match(fixes: LocationFix[], context: { route: RouteResult }): Promise<{ location: MatchedLocation; confidence: number; provider: string }> {
    const fix = fixes.at(-1);
    if (!fix) throw new Error('MAP_MATCH_FAILED');
    const projection = projectOnRoute([fix.longitude, fix.latitude], decodePolyline6(context.route.geometry.value));
    const confidence = Math.max(0, Math.min(1, Math.exp(-projection.distance / 60)));
    const provider = 'route-projection-v1';
    return {
      provider,
      confidence,
      location: {
        ...fix, longitude: projection.coordinate[0], latitude: projection.coordinate[1],
        confidence, distanceFromRouteMeters: projection.distance,
        // Normalize geometric progress to the provider's road-distance total. Encoded
        // shape length can differ slightly from the routed distance returned by OSRM.
        distanceAlongRouteMeters: projection.total > 0
          ? projection.along / projection.total * context.route.distanceMeters
          : 0,
        matchingProvider: provider,
      },
    };
  }
}
