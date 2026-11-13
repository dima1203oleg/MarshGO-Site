import type { Coordinate } from '../../shared/navigation/contracts';

const EARTH_RADIUS_METERS = 6_371_000;

/** Runtime guard for untrusted provider/API coordinates at the rendering edge. */
export function isValidCoordinate(point: unknown): point is Coordinate {
  return Array.isArray(point) && point.length === 2
    && typeof point[0] === 'number' && Number.isFinite(point[0]) && point[0] >= -180 && point[0] <= 180
    && typeof point[1] === 'number' && Number.isFinite(point[1]) && point[1] >= -90 && point[1] <= 90;
}

/**
 * Accept only complete LineStrings. Filtering bad vertices would connect the
 * neighbors on either side and silently draw a route the provider never sent.
 * Consecutive exact duplicates are dropped because they add no visible path and
 * can destabilize tangent/arrow placement. Input arrays are never mutated.
 */
export function sanitizeLineCoordinates(input: unknown): Coordinate[] {
  if (!Array.isArray(input) || input.length < 2 || !input.every(isValidCoordinate)) return [];
  const result: Coordinate[] = [];
  for (const point of input as Coordinate[]) {
    const previous = result.at(-1);
    if (previous?.[0] === point[0] && previous[1] === point[1]) continue;
    result.push([point[0], point[1]]);
  }
  return result.length >= 2 ? result : [];
}

export function greatCircleDistanceMeters(from: Coordinate, to: Coordinate): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (to[1] - from[1]) * radians;
  const longitudeDelta = (to[0] - from[0]) * radians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(from[1] * radians) * Math.cos(to[1] * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Interpolate on the shortest great-circle arc, including across the antimeridian. */
export function interpolateGreatCircle(from: Coordinate, to: Coordinate, fraction: number): Coordinate {
  const t = Math.max(0, Math.min(1, fraction));
  if (t === 0) return [from[0], from[1]];
  if (t === 1) return [to[0], to[1]];
  const radians = Math.PI / 180;
  const lat1 = from[1] * radians;
  const lon1 = from[0] * radians;
  const lat2 = to[1] * radians;
  const lon2 = to[0] * radians;
  const delta = 2 * Math.asin(Math.min(1, Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
  )));
  if (delta < 1e-10 || Math.abs(Math.sin(delta)) < 1e-12) {
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  }
  const startWeight = Math.sin((1 - t) * delta) / Math.sin(delta);
  const endWeight = Math.sin(t * delta) / Math.sin(delta);
  const x = startWeight * Math.cos(lat1) * Math.cos(lon1) + endWeight * Math.cos(lat2) * Math.cos(lon2);
  const y = startWeight * Math.cos(lat1) * Math.sin(lon1) + endWeight * Math.cos(lat2) * Math.sin(lon2);
  const z = startWeight * Math.sin(lat1) + endWeight * Math.sin(lat2);
  return [Math.atan2(y, x) / radians, Math.atan2(z, Math.hypot(x, y)) / radians];
}

/** Point halfway along the actual polyline by traveled ground distance. */
export function lineMidpointByDistance(input: unknown): Coordinate | null {
  const coordinates = sanitizeLineCoordinates(input);
  if (coordinates.length < 2) return null;
  const lengths = coordinates.slice(1).map((point, index) => greatCircleDistanceMeters(coordinates[index]!, point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  let remaining = total / 2;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index]!;
    if (remaining <= length) {
      const from = coordinates[index]!;
      const to = coordinates[index + 1]!;
      const ratio = length > 0 ? remaining / length : 0;
      return interpolateGreatCircle(from, to, ratio);
    }
    remaining -= length;
  }
  return coordinates.at(-1) ?? null;
}
