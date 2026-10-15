import type { ApiNavigationSession } from '../services/productionApi';
import { boundsOf, encodePolyline6 } from '../../shared/navigation/geometry';
import { routeResultSchema, type RouteResult } from '../../shared/navigation/contracts';

/** Keep server-sourced turn instructions attached to the same normalized route consumed by the navigation store. */
export function canonicalRoute(session: ApiNavigationSession): RouteResult {
  const points = session.route ?? [];
  return routeResultSchema.parse({
    id: session.id,
    provider: 'marshgo-routing',
    geometry: { encoding: 'polyline6', value: encodePolyline6(points) },
    bounds: boundsOf(points),
    distanceMeters: session.route_distance_m ?? 0,
    durationSeconds: session.route_duration_s ?? 0,
    durationWithoutTrafficSeconds: session.route_duration_s ?? 0,
    trafficAware: false,
    legs: [{ distanceMeters: session.route_distance_m ?? 0, durationSeconds: session.route_duration_s ?? 0 }],
    maneuvers: session.maneuvers ?? [],
    confidence: 'BASELINE',
    calculatedAt: session.started_at,
    routeVersion: session.route_version,
  });
}
