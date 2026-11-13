import type { Coordinate } from '../../shared/navigation/contracts';
import type { CameraMoveEffort } from './cameraMotion';

/** Use the measured point-cloud fit for an explicit bearing; zero is north-up, not “unchanged”. */
export function shouldUsePointCloudFit(points: readonly Coordinate[], bearing: number | undefined): boolean {
  return typeof bearing === 'number' && Number.isFinite(bearing)
    && (bearing !== 0 || points.length >= 2);
}

/** Shortest absolute turn between two compass bearings, in degrees (0..180). */
export function shortestBearingDelta(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.abs(((to - from) % 360 + 540) % 360 - 180);
}

/** Great-circle distance between two coordinates in metres. */
function haversineMeters(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * sinDLon * sinDLon;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Effort of a camera move from the current pose to a target pose. Missing target
 * fields contribute zero, so a pure zoom step or a pure pan still adapts. Feeds
 * adaptiveCameraDuration so the glide character matches the distance travelled.
 */
export function cameraMoveEffort(
  current: { center: Coordinate; zoom: number; bearing: number },
  target: { center?: Coordinate; zoom?: number; bearing?: number },
): CameraMoveEffort {
  return {
    distanceMeters: target.center ? haversineMeters(current.center, target.center) : 0,
    zoomDelta: typeof target.zoom === 'number' && Number.isFinite(target.zoom) ? target.zoom - current.zoom : 0,
    bearingDelta: typeof target.bearing === 'number' ? shortestBearingDelta(current.bearing, target.bearing) : 0,
  };
}

/**
 * Compass bearing (0–360°, clockwise from north) of the dominant direction of a
 * polyline, pointing from its first vertex towards its last. Passing it to
 * `fitBounds` turns the map so a selected leg runs up the screen and uses the
 * taller viewport edge instead of being squeezed sideways.
 */
export function principalBearing(points: readonly Coordinate[]): number | null {
  if (points.length < 2) return null;
  const meanLat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  const latScale = Math.cos(meanLat * Math.PI / 180);
  // Local metric plane: x = east, y = north.
  const xs = points.map(point => point[0] * latScale);
  const ys = points.map(point => point[1]);
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const dx = xs[index]! - meanX;
    const dy = ys[index]! - meanY;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  if (xx + yy === 0) return null;
  // Principal axis of the point cloud, in radians from the east axis.
  const axis = 0.5 * Math.atan2(2 * xy, xx - yy);
  let east = Math.cos(axis);
  let north = Math.sin(axis);
  const first = points[0]!;
  const last = points.at(-1)!;
  const travelEast = (last[0] - first[0]) * latScale;
  const travelNorth = last[1] - first[1];
  // The axis has no head or tail; orient it along the actual direction of travel.
  if (east * travelEast + north * travelNorth < 0) {
    east = -east;
    north = -north;
  }
  return (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
}

/**
 * Turns a leg into the orientation that fills the map band it actually has.
 * An expanded bottom sheet leaves a wide, short strip, so the leg must run
 * left-to-right across the full visible width instead of up a height it cannot use.
 * Map bearing is subtracted from true azimuth, hence `travel - 90°` to lie east on screen.
 */
export function segmentBearingForViewport(
  travelBearing: number | null,
  visibleWidth: number,
  visibleHeight: number,
): number {
  if (travelBearing === null || !Number.isFinite(travelBearing)) return 0;
  if (!(visibleWidth > 0) || !(visibleHeight > 0)) return travelBearing;
  return visibleWidth >= visibleHeight
    ? (travelBearing - 90 + 360) % 360
    : travelBearing;
}

export type RotatedFitCamera = { center: Coordinate; zoom: number };

/** Keep bearing optimization aligned with the segment-focus camera zoom ceiling. */
export const SEGMENT_FOCUS_MAX_ZOOM = 17;

function toMercator(point: Coordinate): [number, number] {
  const lat = Math.max(-85.0511287798, Math.min(85.0511287798, point[1]));
  const sin = Math.sin(lat * Math.PI / 180);
  return [(point[0] + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)];
}

function fromMercator(x: number, y: number): Coordinate {
  return [x * 360 - 180, Math.atan(Math.sinh(2 * Math.PI * (0.5 - y))) * 180 / Math.PI];
}

/**
 * Camera that fits the *rotated point cloud* into the padded strip. MapLibre's
 * `fitBounds` rotates the corners of the lat/lng bounding box instead, so a
 * diagonal leg becomes a diamond: on a 350×118 strip it zooms out until the
 * diamond fits and the leg itself covers barely half the width. Fitting the
 * actual points first keeps the selected leg across the full strip.
 */
export function cameraForRotatedPoints(
  points: readonly Coordinate[],
  bearing: number,
  availableWidth: number,
  availableHeight: number,
  currentZoom: number,
  maxZoom: number,
): RotatedFitCamera | null {
  if (points.length < 2 || !(availableWidth > 0) || !(availableHeight > 0)) return null;
  if (!Number.isFinite(bearing) || !Number.isFinite(currentZoom)) return null;
  const angle = -bearing * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    const [x, y] = toMercator(point);
    const rotatedX = x * cos - y * sin;
    const rotatedY = x * sin + y * cos;
    if (rotatedX < minX) minX = rotatedX;
    if (rotatedX > maxX) maxX = rotatedX;
    if (rotatedY < minY) minY = rotatedY;
    if (rotatedY > maxY) maxY = rotatedY;
  }
  const worldSize = 512 * 2 ** currentZoom;
  const scale = Math.min(
    availableWidth / Math.max(1e-9, (maxX - minX) * worldSize),
    availableHeight / Math.max(1e-9, (maxY - minY) * worldSize),
  );
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const inverse = bearing * Math.PI / 180;
  const inverseCos = Math.cos(inverse);
  const inverseSin = Math.sin(inverse);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    center: fromMercator(
      centerX * inverseCos - centerY * inverseSin,
      centerX * inverseSin + centerY * inverseCos,
    ),
    zoom: Math.min(currentZoom + Math.log2(scale), maxZoom),
  };
}

function circularBearingDistance(a: number, b: number): number {
  return Math.abs(((a - b) % 360 + 540) % 360 - 180);
}

function orientedBearingForAxis(axis: number, preferredBearing: number): number {
  const normalizedAxis = ((axis % 180) + 180) % 180;
  const forward = normalizedAxis;
  const reverse = (normalizedAxis + 180) % 360;
  return circularBearingDistance(forward, preferredBearing) <= circularBearingDistance(reverse, preferredBearing)
    ? forward
    : reverse;
}

/**
 * Find the rotation that gives this geometry the largest readable fit in the
 * currently visible map rectangle. The coarse sweep includes diagonal as well
 * as horizontal/vertical alignments; a local refinement avoids wasting pixels.
 */
export function maximizeFitBearing(
  points: readonly Coordinate[],
  visibleWidth: number,
  visibleHeight: number,
  preferredBearing: number,
  maxZoom = SEGMENT_FOCUS_MAX_ZOOM,
): number {
  const validPoints = points.filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (validPoints.length < 2 || !(visibleWidth > 0) || !(visibleHeight > 0) || !Number.isFinite(preferredBearing)) {
    return Number.isFinite(preferredBearing) ? ((preferredBearing % 360) + 360) % 360 : 0;
  }

  const preferred = ((preferredBearing % 360) + 360) % 360;
  const projectedPoints = validPoints.map(toMercator);
  const fitZoom = (axis: number) => {
    const angle = -axis * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of projectedPoints) {
      const rotatedX = x * cos - y * sin;
      const rotatedY = x * sin + y * cos;
      if (rotatedX < minX) minX = rotatedX;
      if (rotatedX > maxX) maxX = rotatedX;
      if (rotatedY < minY) minY = rotatedY;
      if (rotatedY > maxY) maxY = rotatedY;
    }
    const scale = Math.min(
      visibleWidth / Math.max(1e-9, (maxX - minX) * 512),
      visibleHeight / Math.max(1e-9, (maxY - minY) * 512),
    );
    return Number.isFinite(scale) && scale > 0 ? Math.min(Math.log2(scale), maxZoom) : Number.NEGATIVE_INFINITY;
  };
  let bestAxis = preferred % 180;
  let bestZoom = fitZoom(bestAxis);
  let bestAlignment = circularBearingDistance(orientedBearingForAxis(bestAxis, preferred), preferred);
  const consider = (axis: number) => {
    const normalized = ((axis % 180) + 180) % 180;
    const zoom = fitZoom(normalized);
    const alignment = circularBearingDistance(orientedBearingForAxis(normalized, preferred), preferred);
    if (zoom > bestZoom + 0.005 || (Math.abs(zoom - bestZoom) <= 0.005 && alignment < bestAlignment)) {
      bestAxis = normalized;
      bestZoom = zoom;
      bestAlignment = alignment;
    }
  };

  const coarseStep = 3;
  for (let axis = 0; axis < 180; axis += coarseStep) consider(axis);
  const coarseBest = bestAxis;
  for (let offset = -coarseStep; offset <= coarseStep; offset += 0.25) consider(coarseBest + offset);
  return orientedBearingForAxis(bestAxis, preferred);
}

/** Longest side of the points' bounding box, in metres. */
export function extentMeters(points: readonly Coordinate[]): number {
  if (points.length === 0) return 0;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    west = Math.min(west, point[0]);
    south = Math.min(south, point[1]);
    east = Math.max(east, point[0]);
    north = Math.max(north, point[1]);
  }
  if (!Number.isFinite(west)) return 0;
  const latScale = Math.cos(((south + north) / 2) * Math.PI / 180);
  return Math.max((east - west) * 111_320 * latScale, (north - south) * 110_540);
}
