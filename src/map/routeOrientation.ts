import type { Coordinate } from '../../shared/navigation/contracts';

/** Returns a small map rotation that makes the route's end-to-end direction horizontal. */
export function routeBearingForHorizontalFit(points: readonly Coordinate[]): number {
  if (points.length < 2) return 0;
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || first.every((value, index) => value === last[index])) return 0;

  const radians = Math.PI / 180;
  const startLat = first[1] * radians;
  const endLat = last[1] * radians;
  const deltaLng = (last[0] - first[0]) * radians;
  const y = Math.sin(deltaLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);
  const direction = (Math.atan2(y, x) / radians + 360) % 360;
  // MapLibre rotates screen coordinates by the camera bearing. Match the
  // route's screen angle (east=0°, south=90°) so its vertical delta becomes 0.
  const bearing = ((direction % 180) + 180) % 180 - 90;
  return Math.round(bearing * 100) / 100;
}
