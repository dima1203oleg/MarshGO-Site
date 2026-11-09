import type { Coordinate } from '../../shared/navigation/contracts';

/**
 * Smooth movement for a timestamp-verified journey vehicle (ТЗ §6). The marker
 * glides between two fresh GPS fixes instead of teleporting, but a stale fix, a
 * long silence or a noise spike is never animated as real motion — it jumps, so
 * the passenger is never shown a vehicle "driving" through data we do not trust.
 */
export const VEHICLE_GLIDE_MAX_AGE_MS = 90_000;
export const VEHICLE_GLIDE_MAX_GAP_MS = 20_000;
export const VEHICLE_GLIDE_MAX_JUMP_METERS = 400;

/** Age of a fix in ms, or null when the stamp is unparseable. */
export function vehicleFixAgeMs(updatedAt: string, now: number): number | null {
  const stamp = Date.parse(updatedAt);
  return Number.isFinite(stamp) ? Math.max(0, now - stamp) : null;
}

export function isFreshVehicleFix(updatedAt: string, now: number, maxAgeMs = VEHICLE_GLIDE_MAX_AGE_MS): boolean {
  const age = vehicleFixAgeMs(updatedAt, now);
  return age !== null && age <= maxAgeMs;
}

/** Great-circle distance between two coordinates in metres. */
export function vehicleDistanceMeters(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * sinDLon * sinDLon;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type VehicleGlideInput = {
  fromUpdatedAt: string;
  toUpdatedAt: string;
  distanceMeters: number;
  now: number;
  reducedMotion: boolean;
};

/**
 * Glide only when both fixes are fresh, time moves forward across a short gap,
 * and the displacement is a plausible drive rather than a teleport. Anything
 * else jumps to the truth we have instead of inventing motion.
 */
export function shouldGlideVehicle(input: VehicleGlideInput): boolean {
  if (input.reducedMotion) return false;
  if (!isFreshVehicleFix(input.fromUpdatedAt, input.now) || !isFreshVehicleFix(input.toUpdatedAt, input.now)) return false;
  const fromStamp = Date.parse(input.fromUpdatedAt);
  const toStamp = Date.parse(input.toUpdatedAt);
  const gap = toStamp - fromStamp;
  if (!Number.isFinite(gap) || gap <= 0 || gap > VEHICLE_GLIDE_MAX_GAP_MS) return false;
  if (!Number.isFinite(input.distanceMeters) || input.distanceMeters <= 0 || input.distanceMeters > VEHICLE_GLIDE_MAX_JUMP_METERS) return false;
  return true;
}

/** Linear interpolation along the short straight line between two nearby fixes. */
export function interpolateVehicleCoordinate(from: Coordinate, to: Coordinate, progress: number): Coordinate {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

/**
 * Settle before the next fix arrives: use most of the update gap, bounded so a
 * long silence never produces a crawl and a tiny gap still reads as a glide.
 */
export function vehicleGlideDuration(gapMs: number): number {
  if (!Number.isFinite(gapMs) || gapMs <= 0) return 240;
  return Math.round(Math.min(1200, Math.max(240, gapMs * 0.85)) / 10) * 10;
}