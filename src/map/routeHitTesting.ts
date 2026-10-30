import type { Coordinate } from '../../shared/navigation/contracts';

export type ScreenPoint = { x: number; y: number };
export type RouteHitCandidate = { id: string; coordinates: readonly Coordinate[] };

function distanceToSegment(point: ScreenPoint, start: ScreenPoint, end: ScreenPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const fraction = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + fraction * dx), point.y - (start.y + fraction * dy));
}

/** Return the closest rendered candidate, or all candidates within the ambiguity tolerance. */
export function nearestRouteHitIds(
  point: ScreenPoint,
  candidates: readonly RouteHitCandidate[],
  project: (coordinate: Coordinate) => ScreenPoint,
  ambiguityTolerancePx = 3,
): string[] {
  const distances = candidates.map(candidate => {
    let distance = Number.POSITIVE_INFINITY;
    for (let index = 1; index < candidate.coordinates.length; index += 1) {
      const start = project(candidate.coordinates[index - 1]!);
      const end = project(candidate.coordinates[index]!);
      distance = Math.min(distance, distanceToSegment(point, start, end));
    }
    return { id: candidate.id, distance };
  }).sort((a, b) => a.distance - b.distance);

  if (!distances.length) return [];
  const nearest = distances[0]!.distance;
  if (!Number.isFinite(nearest)) return distances.map(item => item.id);
  return distances.filter(item => item.distance - nearest <= ambiguityTolerancePx).map(item => item.id);
}
