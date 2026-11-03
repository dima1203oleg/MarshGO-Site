import type { Coordinate } from '../../shared/navigation/contracts';

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
