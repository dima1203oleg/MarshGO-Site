import type { Coordinate } from '../../shared/navigation/contracts';
import { distanceMeters } from './cinematicRouteEngine';

/**
 * HyperFlight — the cinematic preview camera that flies a light marker along a
 * segment's REAL polyline, turn by turn, and docks precisely at the next
 * segment's start. Everything here is pure geometry + timing so it can be unit
 * tested in plain node and driven by a single requestAnimationFrame loop.
 *
 * It never invents positions: the path is the itinerary's own verified shape.
 * «Далі» runs this preview; it does not touch any real GPS progress.
 */

export type FlightKind = 'walk' | 'transit';

export interface FlightPath {
  readonly points: readonly Coordinate[];
  readonly cumulative: readonly number[];
  readonly totalMeters: number;
  /** Exact point at an arc-length distance (clamped to the path). */
  pointAt(meters: number): Coordinate;
  /** Point at a 0..1 fraction of the total arc length. */
  fractionPoint(fraction: number): Coordinate;
  /** Travel bearing (deg, 0=N clockwise) of the tangent at a distance. */
  bearingAt(meters: number): number;
  /** The revealed sub-polyline from the start up to a 0..1 fraction. */
  sliceTo(fraction: number): Coordinate[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-arc interpolation between compass bearings so a turn never spins the long way. */
export function lerpBearing(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return (a + delta * clamp01(t) + 360) % 360;
}

function bearingBetween(from: Coordinate, to: Coordinate): number {
  const rad = Math.PI / 180;
  const y = Math.sin((to[0] - from[0]) * rad) * Math.cos(to[1] * rad);
  const x = Math.cos(from[1] * rad) * Math.sin(to[1] * rad)
    - Math.sin(from[1] * rad) * Math.cos(to[1] * rad) * Math.cos((to[0] - from[0]) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export function buildFlightPath(coordinates: readonly Coordinate[]): FlightPath | null {
  // A malformed interior point is a real geometry gap. Dropping it would join
  // its neighbours with a straight edge that the provider never supplied.
  if (coordinates.length < 2 || coordinates.some(point => !point
    || !Number.isFinite(point[0]) || !Number.isFinite(point[1])
    || point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90)) return null;
  const points = [...coordinates];
  const cumulative: number[] = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceMeters(points[index - 1]!, points[index]!);
    cumulative.push(total);
  }
  if (total <= 0) return null;

  const locate = (meters: number): { index: number; ratio: number } => {
    const target = Math.max(0, Math.min(total, meters));
    let index = 1;
    while (index < cumulative.length - 1 && cumulative[index]! < target) index += 1;
    const start = cumulative[index - 1]!;
    const span = cumulative[index]! - start;
    return { index, ratio: span > 0 ? (target - start) / span : 0 };
  };

  const pointAt = (meters: number): Coordinate => {
    const { index, ratio } = locate(meters);
    const from = points[index - 1]!;
    const to = points[index]!;
    return [lerp(from[0], to[0], ratio), lerp(from[1], to[1], ratio)];
  };

  return {
    points,
    cumulative,
    totalMeters: total,
    pointAt,
    fractionPoint: (fraction) => pointAt(clamp01(fraction) * total),
    bearingAt: (meters) => {
      // Look slightly ahead of the tangent so the camera anticipates the curve
      // instead of snapping exactly at each polyline vertex.
      const behind = pointAt(meters - 6);
      const ahead = pointAt(meters + 14);
      return bearingBetween(behind, ahead);
    },
    sliceTo: (fraction) => {
      const target = clamp01(fraction) * total;
      if (target <= 0) return [points[0]!];
      if (target >= total) return [...points];
      const { index } = locate(target);
      const result = points.slice(0, index);
      result.push(pointAt(target));
      return result;
    },
  };
}

/** A path flown backwards for «Назад»: same real geometry, reversed direction. */
export function reverseFlightPath(path: FlightPath): FlightPath | null {
  return buildFlightPath([...path.points].reverse());
}

/**
 * Adaptive cinematic duration: long enough to read the geometry, short enough
 * to feel like a flight. Walking is slower and closer; transit covers ground fast.
 */
export function flightDurationMs(totalMeters: number, kind: FlightKind): number {
  const meters = Math.max(0, totalMeters);
  if (kind === 'walk') return Math.round(Math.max(1900, Math.min(5200, 1500 + meters / 26 * 1000)));
  return Math.round(Math.max(2400, Math.min(7000, 1700 + meters / 115 * 1000)));
}

// Trapezoidal velocity profile: accelerate, cruise, decelerate. The area under
// the curve is normalised to 1 so fraction(1) === 1 exactly, and velocity is
// continuous at both knots (no jerk at the accel/cruise/decel hand-offs).
const ACCEL = 0.18;
const DECEL = 0.28;
const CRUISE = 1 - ACCEL - DECEL;
const PEAK = 1 / (CRUISE + ACCEL / 2 + DECEL / 2);

/** Normalised 0..1 arc-length fraction for an elapsed time under the flight profile. */
export function flightFractionAt(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  const t = clamp01(elapsedMs / durationMs);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < ACCEL) return PEAK * (t * t) / (2 * ACCEL);
  if (t < 1 - DECEL) return PEAK * (ACCEL / 2 + (t - ACCEL));
  const u = t - (1 - DECEL);
  return PEAK * (ACCEL / 2 + CRUISE + u - (u * u) / (2 * DECEL));
}

/** Instantaneous normalised velocity — exposed so tests can prove continuity. */
export function flightVelocityAt(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const t = clamp01(elapsedMs / durationMs);
  if (t < ACCEL) return PEAK * t / ACCEL;
  if (t < 1 - DECEL) return PEAK;
  return PEAK * (1 - (t - (1 - DECEL)) / DECEL);
}

export interface CinematicCameraFrame {
  /** Camera look-at point, biased ahead of the marker so the road ahead is visible. */
  center: Coordinate;
  /** The light marker's exact position on the geometry. */
  marker: Coordinate;
  bearing: number;
  zoom: number;
  pitch: number;
}

export interface CinematicFrameOptions {
  kind: FlightKind;
  /** Zoom the camera starts from (the current map zoom), for a smooth zoom-in. */
  startZoom?: number;
  perspective?: '2d' | '3d';
  perspectiveBoost?: number;
}

const cruiseZoom = (kind: FlightKind) => (kind === 'walk' ? 18.3 : 17.5);
const dockZoom = (kind: FlightKind) => (kind === 'walk' ? 18.0 : 17.1);
const cruisePitch = (kind: FlightKind) => (kind === 'walk' ? 54 : 58);

/**
 * The camera frame at a flight fraction. The marker rides the real geometry;
 * the camera looks a little ahead, rotates into the upcoming curve, tilts into
 * 3D while cruising and eases upright as it docks at the transfer.
 */
export function cinematicCameraFrame(path: FlightPath, fraction: number, options: CinematicFrameOptions): CinematicCameraFrame {
  const f = clamp01(fraction);
  const total = path.totalMeters;
  const marker = path.fractionPoint(f);
  const lookaheadMeters = Math.min(options.kind === 'walk' ? 28 : 80, total * 0.085) * (1 - f);
  const center = path.pointAt(f * total + lookaheadMeters);
  const bearing = path.bearingAt(Math.min(total, f * total + 18));

  const startZoom = options.startZoom ?? cruiseZoom(options.kind) - 1.2;
  const boost = options.perspectiveBoost ?? 0;
  // Ease zoom in over the accel phase, then settle to the docking zoom over decel.
  const accelPhase = clamp01(f / 0.22);
  const decelPhase = clamp01((f - 0.78) / 0.22);
  const zoomIn = lerp(startZoom, cruiseZoom(options.kind), easeOutCubic(accelPhase));
  const zoom = lerp(zoomIn, dockZoom(options.kind), easeOutCubic(decelPhase));
  // Pitch rises into the cruise and relaxes a little for a readable docking.
  const pitchIn = easeOutCubic(clamp01(f / 0.14));
  const pitchOut = easeOutCubic(decelPhase);
  const pitch = options.perspective === '3d'
    ? lerp(lerp(28, cruisePitch(options.kind), pitchIn), 44, pitchOut) + boost * pitchIn * (1 - pitchOut)
    : 0;

  return { center, marker, bearing, zoom, pitch };
}

function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) ** 3;
}

/**
 * Precision Docking: the settled camera at the exact end of the flown segment
 * (= the next segment's start), already turned toward the next leg's direction.
 */
export function dockCameraFrame(path: FlightPath, nextPath: FlightPath | null, kind: FlightKind, perspective: '2d' | '3d' = '2d'): CinematicCameraFrame {
  const end = path.fractionPoint(1);
  const connected = nextPath && distanceMeters(end, nextPath.fractionPoint(0)) <= 5;
  const bearing = connected ? nextPath.bearingAt(24) : path.bearingAt(path.totalMeters);
  return { center: end, marker: end, bearing, zoom: dockZoom(kind), pitch: perspective === '3d' ? 44 : 0 };
}

export type CalloutStage = 'enter' | 'hold' | 'exit' | 'gone';

export const TRANSFER_CALLOUT_TIMING = { enter: 420, hold: 4000, exit: 840 } as const;

export function calloutStageAt(elapsedMs: number): CalloutStage {
  const { enter, hold, exit } = TRANSFER_CALLOUT_TIMING;
  if (elapsedMs < enter) return 'enter';
  if (elapsedMs < enter + hold) return 'hold';
  if (elapsedMs < enter + hold + exit) return 'exit';
  return 'gone';
}
