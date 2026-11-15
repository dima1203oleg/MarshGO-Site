import type { Coordinate } from '../../shared/navigation/contracts';
import { distanceMeters } from './cinematicRouteEngine';

/**
 * Fleet motion helpers — smooth, honest movement of confirmed live vehicles
 * along the provider's actual transport geometry between two verified fixes.
 * No position is extrapolated beyond the last confirmed sample; we only
 * interpolate ALONG the published line, and the tangent gives the marker heading.
 */

export interface ApproachingVehicle {
  id: string;
  coordinates: Coordinate;
  updatedAt: string;
  approachingBoarding: boolean;
  emphasized: boolean;
  etaSeconds?: number | null;
  etaConfidence?: 'OBSERVED' | 'PREDICTED' | 'NONE';
  bearing?: number | null;
}

/**
 * Up to three genuinely suitable approaching vehicles with a CONFIRMED ETA.
 * The emphasized (on-board / primary) vehicle always leads; the rest sort by ETA.
 * Vehicles without a confirmed ETA are never shown as "approaching".
 */
export function selectApproachingVehicles<T extends ApproachingVehicle>(vehicles: readonly T[], limit = 3): T[] {
  const confirmed = vehicles.filter(vehicle =>
    vehicle.approachingBoarding
    && typeof vehicle.etaSeconds === 'number'
    && Number.isFinite(vehicle.etaSeconds)
    && vehicle.etaConfidence !== 'NONE');
  return [...confirmed]
    .sort((a, b) => {
      if (a.emphasized !== b.emphasized) return a.emphasized ? -1 : 1;
      return (a.etaSeconds ?? Infinity) - (b.etaSeconds ?? Infinity);
    })
    .slice(0, Math.max(0, limit));
}

interface Projection {
  meters: number;
  point: Coordinate;
  segmentIndex: number;
}

/** Project a point onto a polyline, returning the arc-length of the closest point. */
export function projectOntoLine(point: Coordinate, line: readonly Coordinate[]): Projection | null {
  if (line.length < 2) return null;
  const latScale = Math.cos(point[1] * Math.PI / 180);
  const toXY = (c: Coordinate): [number, number] => [c[0] * 111_320 * latScale, c[1] * 110_540];
  const [px, py] = toXY(point);
  let best: Projection | null = null;
  let bestDist = Infinity;
  let walked = 0;
  for (let index = 0; index < line.length - 1; index += 1) {
    const a = line[index]!;
    const b = line[index + 1]!;
    const [ax, ay] = toXY(a);
    const [bx, by] = toXY(b);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const segmentLength = distanceMeters(a, b);
    const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    const dist = (px - cx) ** 2 + (py - cy) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = {
        meters: walked + segmentLength * t,
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        segmentIndex: index,
      };
    }
    walked += segmentLength;
  }
  return best;
}

function bearingBetween(from: Coordinate, to: Coordinate): number {
  const rad = Math.PI / 180;
  const y = Math.sin((to[0] - from[0]) * rad) * Math.cos(to[1] * rad);
  const x = Math.cos(from[1] * rad) * Math.sin(to[1] * rad)
    - Math.sin(from[1] * rad) * Math.cos(to[1] * rad) * Math.cos((to[0] - from[0]) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export interface FleetSample {
  coordinates: Coordinate;
  bearing: number;
}

/** Travel bearing of the polyline tangent nearest a confirmed fix — rotates the marker into the real road direction. */
export function bearingAlongLineAt(point: Coordinate, line: readonly Coordinate[] | null): number | null {
  if (!line || line.length < 2) return null;
  const projection = projectOntoLine(point, line);
  if (!projection) return null;
  const from = line[projection.segmentIndex]!;
  const to = line[projection.segmentIndex + 1] ?? from;
  if (from[0] === to[0] && from[1] === to[1]) return null;
  return bearingBetween(from, to);
}

/**
 * Interpolate a vehicle from one confirmed fix to the next ALONG the line, so it
 * follows every curve instead of cutting across blocks. Falls back to a straight
 * hop (with a real bearing) only when no line geometry is published.
 */
export function interpolateAlongLine(
  line: readonly Coordinate[] | null,
  from: Coordinate,
  to: Coordinate,
  t: number,
): FleetSample {
  const ratio = Math.max(0, Math.min(1, t));
  if (!line || line.length < 2) {
    return {
      coordinates: [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio],
      bearing: bearingBetween(from, to),
    };
  }
  const start = projectOntoLine(from, line);
  const end = projectOntoLine(to, line);
  if (!start || !end) {
    return { coordinates: [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio], bearing: bearingBetween(from, to) };
  }
  const target = start.meters + (end.meters - start.meters) * ratio;
  let walked = 0;
  for (let index = 0; index < line.length - 1; index += 1) {
    const a = line[index]!;
    const b = line[index + 1]!;
    const length = distanceMeters(a, b);
    if (walked + length >= target || index === line.length - 2) {
      const local = length > 0 ? Math.max(0, Math.min(1, (target - walked) / length)) : 0;
      const point: Coordinate = [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local];
      const ahead: Coordinate = [a[0] + (b[0] - a[0]) * Math.min(1, local + 0.05), a[1] + (b[1] - a[1]) * Math.min(1, local + 0.05)];
      return { coordinates: point, bearing: bearingBetween(point, ahead[0] === point[0] && ahead[1] === point[1] ? b : ahead) };
    }
    walked += length;
  }
  return { coordinates: line.at(-1)!, bearing: bearingBetween(line.at(-2)!, line.at(-1)!) };
}
