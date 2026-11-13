// ТЗ-MG-VIZ-4 client half: turn the server's zone split into MapLibre features and
// turn the five verified vehicle priority levels into style properties.
// Nothing here guesses geometry: a zone exists only when the server sliced the
// exact line it also published.
import type { Coordinate } from '../../shared/navigation/contracts';
import { greatCircleDistanceMeters, interpolateGreatCircle, isValidCoordinate, sanitizeLineCoordinates } from './lineGeometry';

export type TransitZone = 'A' | 'B' | 'C';

/** Intermediate stop markers are noise at city overview scale; reveal them only on close inspection. */
export const STOP_DETAIL_MIN_ZOOM = 12.5;

export type TransitZoneGeometry = {
  boardingShapeIndex: number;
  alightingShapeIndex: number | null;
  beforeBoarding: Coordinate[] | null;
  passengerSegment: Coordinate[];
  afterAlighting: Coordinate[] | null;
  snapMeters: number;
};

export type VehiclePriorityLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

/** The reason is server-verified evidence, never a client-side guess. */
export type VehiclePriority = {
  level: VehiclePriorityLevel;
  reason: 'at_boarding_stop' | 'eta_under_3_minutes' | 'approaching_boarding_stop' | 'approaching_without_eta'
    | 'behind_boarding_stop' | 'opposite_direction' | 'direction_unverified' | 'not_serving_boarding_stop'
    | 'other_route' | 'stale_position';
};

/**
 * Starting tokens from the approved concept. Widths are zoom-interpolated so the
 * three zones keep their proportions at every scale instead of only at one zoom.
 */
export const ZONE_LINE_TOKENS: Record<TransitZone, { width: [number, number]; opacity: number }> = {
  A: { width: [1.5, 2.5], opacity: 0.4 },
  B: { width: [5.5, 7.5], opacity: 1 },
  C: { width: [1.25, 2], opacity: 0.2 },
};

export const ZONE_GLOW_TOKENS = { width: [8.5, 11.5] as [number, number], opacity: 0.2, blur: 3 } as const;

/** L4 is at the stop, L3 arrives within three minutes, L2 approaches, L1 is the same line but irrelevant, L0 is background. */
export const VEHICLE_PRIORITY_TOKENS: Record<VehiclePriorityLevel, { radius: number; haloRadius: number; opacity: number; haloOpacity: number; iconSize: number }> = {
  L4: { radius: 13, haloRadius: 19, opacity: 1, haloOpacity: 0.5, iconSize: 0.42 },
  L3: { radius: 12, haloRadius: 16, opacity: 0.98, haloOpacity: 0.44, iconSize: 0.38 },
  L2: { radius: 11, haloRadius: 14, opacity: 0.92, haloOpacity: 0.3, iconSize: 0.33 },
  L1: { radius: 8, haloRadius: 9, opacity: 0.55, haloOpacity: 0.12, iconSize: 0.24 },
  L0: { radius: 6, haloRadius: 0, opacity: 0.34, haloOpacity: 0, iconSize: 0.2 },
};

/**
 * Zones A and C are drawn only for a full published line; a leg-only fallback has
 * no known geometry outside the passenger's own ride, so inventing it would draw
 * road the vehicle never runs.
 */
export function zoneFeaturesFor(
  zones: TransitZoneGeometry | null | undefined,
  geometryScope: 'full_route' | 'leg_only' | undefined,
): Array<{ zone: TransitZone; coordinates: Coordinate[] }> {
  if (!zones) return [];
  const passenger = sanitizeLineCoordinates(zones.passengerSegment);
  if (passenger.length < 2) return [];
  const features: Array<{ zone: TransitZone; coordinates: Coordinate[] }> = [{ zone: 'B', coordinates: passenger }];
  if (geometryScope === 'leg_only') return features;
  const before = sanitizeLineCoordinates(zones.beforeBoarding);
  const after = sanitizeLineCoordinates(zones.afterAlighting);
  if (before.length >= 2) features.unshift({ zone: 'A', coordinates: before });
  if (after.length >= 2) features.push({ zone: 'C', coordinates: after });
  return features;
}

/** Focused passenger view draws only the verified boarding-to-alighting slice. */
export function passengerZoneFeaturesFor(
  zones: TransitZoneGeometry | null | undefined,
  geometryScope: 'full_route' | 'leg_only' | undefined,
): Array<{ zone: TransitZone; coordinates: Coordinate[] }> {
  return zoneFeaturesFor(zones, geometryScope).filter(feature => feature.zone === 'B');
}

/** Restrict passenger camera context to verified ridden geometry. */
export function passengerContextLines(routes: ReadonlyArray<{
  coordinates: Coordinate[];
  geometryScope?: 'full_route' | 'leg_only';
  zones?: TransitZoneGeometry | null;
}>): Coordinate[][] {
  return routes.flatMap(route => {
    const line = sanitizeLineCoordinates(route.zones ? route.zones.passengerSegment : route.geometryScope === 'leg_only' ? route.coordinates : null);
    return line.length >= 2 ? [line] : [];
  });
}

/** Server marks at most three evidence-backed approaches; reject expired or malformed fixes. */
export function focusedApproachVehicles<T extends { emphasized: boolean; updatedAt: string; coordinates: Coordinate }>(vehicles: readonly T[], now = Date.now()): T[] {
  return vehicles.filter(vehicle => {
    const stamp = Date.parse(vehicle.updatedAt);
    const age = now - stamp;
    return vehicle.emphasized === true && isValidCoordinate(vehicle.coordinates)
      && Number.isFinite(stamp) && age >= -30_000 && age <= 90_000;
  }).slice(0, 3);
}

/** Next time the focused fleet must be re-evaluated, or null when it is empty. */
export function focusedFleetNextExpiry(vehicles: readonly { emphasized: boolean; updatedAt: string; coordinates: Coordinate }[], now: number): number | null {
  const visible = focusedApproachVehicles(vehicles, now);
  return visible.length ? Math.min(...visible.map(vehicle => Date.parse(vehicle.updatedAt) + 90_001)) : null;
}

export function priorityLevelOf(vehicle: { priority?: VehiclePriority | null; emphasized?: boolean }): VehiclePriorityLevel {
  const level = vehicle.priority?.level;
  if (level === 'L0' || level === 'L1' || level === 'L2' || level === 'L3' || level === 'L4') return level;
  // A server without the priority field still sends the verified top approaches.
  return vehicle.emphasized ? 'L2' : 'L1';
}

export type ZoneArrow = { coordinates: Coordinate; bearingDegrees: number; zone: TransitZone };

const ARROW_SPACING_METERS = 320;
const ARROW_MAX_PER_ZONE = 3;
/** Compass bearing from a to b, so an arrow glyph pointing north rotates into the real travel direction. */
function forwardBearingDegrees(a: Coordinate, b: Coordinate): number {
  const radians = Math.PI / 180;
  const y = Math.sin((b[0] - a[0]) * radians) * Math.cos(b[1] * radians);
  const x = Math.cos(a[1] * radians) * Math.sin(b[1] * radians)
    - Math.sin(a[1] * radians) * Math.cos(b[1] * radians) * Math.cos((b[0] - a[0]) * radians);
  return (Math.atan2(y, x) / radians + 360) % 360;
}

function arrowAt(coordinates: readonly Coordinate[], distanceMeters: number): Omit<ZoneArrow, 'zone'> | null {
  let walked = 0;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const from = coordinates[index]!;
    const to = coordinates[index + 1]!;
    const length = greatCircleDistanceMeters(from, to);
    if (length === 0) continue;
    if (walked + length >= distanceMeters) {
      const ratio = (distanceMeters - walked) / length;
      return {
        coordinates: interpolateGreatCircle(from, to, ratio),
        bearingDegrees: forwardBearingDegrees(from, to),
      };
    }
    walked += length;
  }
  return null;
}

/**
 * Direction chevrons follow the published geometry and the order of its vertices,
 * which is the vehicle's actual direction of travel — never the left-to-right
 * position of the line on screen.
 */
export function zoneArrowsFor(zones: ReadonlyArray<{ zone: TransitZone; coordinates: Coordinate[] }>): ZoneArrow[] {
  const arrows: ZoneArrow[] = [];
  for (const entry of zones) {
    if (entry.coordinates.length < 2) continue;
    let total = 0;
    const coordinates = sanitizeLineCoordinates(entry.coordinates);
    if (coordinates.length < 2) continue;
    for (let index = 0; index < coordinates.length - 1; index += 1) total += greatCircleDistanceMeters(coordinates[index]!, coordinates[index + 1]!);
    const count = Math.min(ARROW_MAX_PER_ZONE, Math.floor(total / ARROW_SPACING_METERS));
    for (let i = 1; i <= count; i += 1) {
      const arrow = arrowAt(coordinates, (total * i) / (count + 1));
      if (arrow) arrows.push({ ...arrow, zone: entry.zone });
    }
  }
  return arrows;
}
