import type { Coordinate } from '../../shared/navigation/contracts';

const EARTH_RADIUS_METERS = 6_371_008.8;
const DEGREES_TO_RADIANS = Math.PI / 180;

export type PreparedRoutePreviewPath = {
  coordinates: Coordinate[];
  cumulativeMeters: number[];
  bearings: number[];
  totalMeters: number;
  turnCount: number;
};

export type RoutePreviewSample = { coordinate: Coordinate; bearing: number; distanceMeters: number; segmentIndex: number };

function validCoordinate(point: unknown): point is Coordinate {
  return Array.isArray(point) && point.length === 2
    && Number.isFinite(point[0]) && Number.isFinite(point[1])
    && point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90;
}

function longitudeDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function distanceBetweenCoordinates(a: Coordinate, b: Coordinate): number {
  const lat1 = a[1] * DEGREES_TO_RADIANS;
  const lat2 = b[1] * DEGREES_TO_RADIANS;
  const dLat = lat2 - lat1;
  const dLon = longitudeDelta(a[0], b[0]) * DEGREES_TO_RADIANS;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routePreviewAnchorsMatch(path: PreparedRoutePreviewPath, start: Coordinate, end: Coordinate, toleranceMeters = 15): boolean {
  if (!validCoordinate(start) || !validCoordinate(end) || !Number.isFinite(toleranceMeters) || toleranceMeters < 0) return false;
  return distanceBetweenCoordinates(path.coordinates[0]!, start) <= toleranceMeters
    && distanceBetweenCoordinates(path.coordinates.at(-1)!, end) <= toleranceMeters;
}

export function reverseRoutePreviewPath(path: PreparedRoutePreviewPath): PreparedRoutePreviewPath | null {
  return prepareRoutePreviewPath([...path.coordinates].reverse());
}

/** Closest point on a local projected route polyline, returned as along-route meters. */
export function nearestRoutePreviewDistance(path: PreparedRoutePreviewPath, point: Coordinate): number {
  if (!validCoordinate(point)) return 0;
  const latitudeScale = Math.max(0.01, Math.cos(point[1] * DEGREES_TO_RADIANS));
  const project = (coordinate: Coordinate): [number, number] => [
    longitudeDelta(point[0], coordinate[0]) * DEGREES_TO_RADIANS * EARTH_RADIUS_METERS * latitudeScale,
    (coordinate[1] - point[1]) * DEGREES_TO_RADIANS * EARTH_RADIUS_METERS,
  ];
  const origin = [0, 0] as const;
  let closestDistanceSquared = Infinity;
  let closestAlongRoute = 0;
  for (let index = 0; index < path.coordinates.length - 1; index += 1) {
    const a = project(path.coordinates[index]!);
    const b = project(path.coordinates[index + 1]!);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy;
    const fraction = lengthSquared > 0
      ? Math.max(0, Math.min(1, ((origin[0] - a[0]) * dx + (origin[1] - a[1]) * dy) / lengthSquared))
      : 0;
    const x = a[0] + dx * fraction;
    const y = a[1] + dy * fraction;
    const distanceSquared = x * x + y * y;
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared;
      closestAlongRoute = path.cumulativeMeters[index]! + (path.cumulativeMeters[index + 1]! - path.cumulativeMeters[index]!) * fraction;
    }
  }
  return closestAlongRoute;
}

function bearingBetween(a: Coordinate, b: Coordinate): number {
  const lat1 = a[1] * DEGREES_TO_RADIANS;
  const lat2 = b[1] * DEGREES_TO_RADIANS;
  const dLon = longitudeDelta(a[0], b[0]) * DEGREES_TO_RADIANS;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) / DEGREES_TO_RADIANS + 360) % 360;
}

function shortestBearingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** Build a cumulative-distance index. A long unexplained jump is not treated as a road. */
export function prepareRoutePreviewPath(
  input: readonly Coordinate[],
  maxUnverifiedGapMeters = 1_500,
): PreparedRoutePreviewPath | null {
  if (!Array.isArray(input) || input.some(point => !validCoordinate(point))) return null;
  const coordinates = input.filter((point, index) => index === 0 || distanceBetweenCoordinates(input[index - 1]!, point) > 0.25);
  if (coordinates.length < 2) return null;

  const cumulativeMeters = [0];
  const bearings: number[] = [];
  for (let index = 1; index < coordinates.length; index += 1) {
    const from = coordinates[index - 1]!;
    const to = coordinates[index]!;
    const distance = distanceBetweenCoordinates(from, to);
    if (!Number.isFinite(distance) || distance <= 0 || distance > maxUnverifiedGapMeters) return null;
    cumulativeMeters.push(cumulativeMeters[index - 1]! + distance);
    bearings.push(bearingBetween(from, to));
  }
  const totalMeters = cumulativeMeters.at(-1)!;
  if (totalMeters < 1) return null;
  const turnCount = bearings.slice(1).reduce((count, bearing, index) =>
    count + (Math.abs(shortestBearingDelta(bearings[index]!, bearing)) >= 30 ? 1 : 0), 0);
  return { coordinates, cumulativeMeters, bearings, totalMeters, turnCount };
}

function interpolateMercatorLine(a: Coordinate, b: Coordinate, progress: number): Coordinate {
  const t = Math.max(0, Math.min(1, progress));
  if (t === 0) return a;
  if (t === 1) return b;
  const latitudeLimit = 85.05112878;
  const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + Math.max(-latitudeLimit, Math.min(latitudeLimit, latitude)) * DEGREES_TO_RADIANS / 2));
  const inverseMercatorY = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / DEGREES_TO_RADIANS;
  const x1 = a[0];
  const x2 = a[0] + longitudeDelta(a[0], b[0]);
  const longitude = x1 + (x2 - x1) * t;
  const latitude = inverseMercatorY(mercatorY(a[1]) + (mercatorY(b[1]) - mercatorY(a[1])) * t);
  return [((longitude + 540) % 360) - 180, latitude];
}

function segmentAtDistance(path: PreparedRoutePreviewPath, distanceMeters: number): number {
  let low = 0;
  let high = path.cumulativeMeters.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (path.cumulativeMeters[middle]! < distanceMeters) low = middle + 1;
    else high = middle;
  }
  const isVertex = low < path.bearings.length && Math.abs(path.cumulativeMeters[low]! - distanceMeters) < 0.001;
  return Math.max(0, Math.min(path.bearings.length - 1, isVertex ? low : low - 1));
}

export function sampleRoutePreviewPath(path: PreparedRoutePreviewPath, distanceMeters: number): RoutePreviewSample {
  const distance = Math.max(0, Math.min(path.totalMeters, Number.isFinite(distanceMeters) ? distanceMeters : 0));
  if (distance === 0) return { coordinate: path.coordinates[0]!, bearing: path.bearings[0]!, distanceMeters: 0, segmentIndex: 0 };
  if (distance === path.totalMeters) {
    return { coordinate: path.coordinates.at(-1)!, bearing: path.bearings.at(-1)!, distanceMeters: path.totalMeters, segmentIndex: path.bearings.length - 1 };
  }
  const segmentIndex = segmentAtDistance(path, distance);
  const segmentStart = path.cumulativeMeters[segmentIndex]!;
  const segmentLength = path.cumulativeMeters[segmentIndex + 1]! - segmentStart;
  const progress = segmentLength > 0 ? (distance - segmentStart) / segmentLength : 0;
  return {
    coordinate: interpolateMercatorLine(path.coordinates[segmentIndex]!, path.coordinates[segmentIndex + 1]!, progress),
    bearing: path.bearings[segmentIndex]!,
    distanceMeters: distance,
    segmentIndex,
  };
}

/** Return only source vertices and interpolated ends inside a route portion. */
export function sliceRoutePreviewPath(path: PreparedRoutePreviewPath, startMeters: number, endMeters: number): Coordinate[] {
  const start = Math.max(0, Math.min(path.totalMeters, startMeters));
  const end = Math.max(start, Math.min(path.totalMeters, endMeters));
  const first = sampleRoutePreviewPath(path, start);
  const last = sampleRoutePreviewPath(path, end);
  const points: Coordinate[] = [first.coordinate];
  for (let index = first.segmentIndex + 1; index < path.coordinates.length - 1; index += 1) {
    const vertexDistance = path.cumulativeMeters[index]!;
    if (vertexDistance > start && vertexDistance < end) points.push(path.coordinates[index]!);
  }
  if (distanceBetweenCoordinates(points.at(-1)!, last.coordinate) > 0.25) points.push(last.coordinate);
  return points;
}

/** Acceleration, a steady middle section, then controlled docking. */
export function routePreviewEasedProgress(progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  if (t <= 0.18) return 0.12 * (t / 0.18) ** 2;
  if (t >= 0.82) {
    const approach = (t - 0.82) / 0.18;
    return 0.88 + 0.12 * (1 - (1 - approach) ** 2);
  }
  return 0.12 + 0.76 * ((t - 0.18) / 0.64);
}

export function routePreviewDurationMs(path: PreparedRoutePreviewPath, reducedMotion = false): number {
  if (reducedMotion) return 0;
  const distance = path.totalMeters;
  const base = distance < 120 ? 500
    : distance < 500 ? 650
      : distance < 1_500 ? 900
        : distance < 4_000 ? 1_250
          : distance < 12_000 ? 1_750
            : 2_250;
  return Math.max(450, Math.min(2_800, base + Math.min(450, path.turnCount * 70)));
}
