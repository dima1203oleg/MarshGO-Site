// ТЗ-MG-VIZ-4 client half: turn the server's zone split into MapLibre features and
// turn the five verified vehicle priority levels into style properties.
// Nothing here guesses geometry: a zone exists only when the server sliced the
// exact line it also published.
import type { Coordinate } from '../../shared/navigation/contracts';

export type TransitZone = 'A' | 'B' | 'C';

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

export type FocusedApproachVehicle = {
  id: string;
  coordinates: Coordinate;
  updatedAt: string;
  approachingBoarding: boolean;
  emphasized: boolean;
  remainingStops: number | null;
  etaSeconds?: number | null;
  etaConfidence?: 'OBSERVED' | 'PREDICTED' | 'NONE';
  approachEvidence?: null | {
    source: 'OBSERVED_PROGRESS' | 'TRIP_UPDATE_PREDICTION';
    predictedArrivalAt?: string;
    remainingStops?: number;
  };
  priority?: VehiclePriority | null;
};

/** Keep the browser's live-position cutoff aligned with the server telemetry contract. */
export const LIVE_VEHICLE_DISPLAY_MAX_AGE_MS = 90_000;
export const LIVE_VEHICLE_DISPLAY_MAX_FUTURE_SKEW_MS = 30_000;
export const MAX_FOCUSED_APPROACH_VEHICLES = 3;

export function isFreshVehicleForDisplay(vehicle: Pick<FocusedApproachVehicle, 'coordinates' | 'updatedAt'>, nowMs = Date.now()): boolean {
  const timestamp = Date.parse(vehicle.updatedAt);
  const age = nowMs - timestamp;
  const [longitude, latitude] = vehicle.coordinates;
  return Number.isFinite(timestamp)
    && age >= -LIVE_VEHICLE_DISPLAY_MAX_FUTURE_SKEW_MS
    && age <= LIVE_VEHICLE_DISPLAY_MAX_AGE_MS
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
}

/** The server's current contract carries a future predictedArrivalAt in approachEvidence instead of etaConfidence. */
export function etaConfidenceForDisplay(vehicle: Pick<FocusedApproachVehicle, 'etaSeconds' | 'etaConfidence' | 'approachEvidence'>, nowMs = Date.now()): 'OBSERVED' | 'PREDICTED' | 'NONE' {
  if (!Number.isFinite(vehicle.etaSeconds) || (vehicle.etaSeconds ?? 0) <= 0) return 'NONE';
  if (vehicle.etaConfidence === 'OBSERVED' || vehicle.etaConfidence === 'PREDICTED') return vehicle.etaConfidence;
  const predictedArrival = vehicle.approachEvidence?.predictedArrivalAt;
  const predictedAtMs = predictedArrival ? Date.parse(predictedArrival) : Number.NaN;
  return Number.isFinite(predictedAtMs) && predictedAtMs > nowMs ? 'PREDICTED' : 'NONE';
}

/**
 * Keep only server-verified approaches and cap their focused presentation at three.
 * The evidence fields mirror the server's selection ordering; proximity is never inferred here.
 */
export function focusedApproachVehiclesFor<T extends FocusedApproachVehicle>(vehicles: readonly T[], nowMs = Date.now()): T[] {
  const candidates = vehicles.filter(vehicle => vehicle.approachingBoarding
    && vehicle.priority?.reason !== 'stale_position'
    && isFreshVehicleForDisplay(vehicle, nowMs));
  const hasEvidence = candidates.some(vehicle => vehicle.approachEvidence != null);
  const eligible = hasEvidence ? candidates : candidates.filter(vehicle => vehicle.emphasized);
  return eligible.sort((a, b) => {
    const aEvidence = a.approachEvidence?.source;
    const bEvidence = b.approachEvidence?.source;
    if (aEvidence && bEvidence && aEvidence !== bEvidence) return aEvidence === 'OBSERVED_PROGRESS' ? -1 : 1;
    if (a.emphasized !== b.emphasized) return a.emphasized ? -1 : 1;
    const aStops = a.approachEvidence?.remainingStops ?? a.remainingStops ?? Number.MAX_SAFE_INTEGER;
    const bStops = b.approachEvidence?.remainingStops ?? b.remainingStops ?? Number.MAX_SAFE_INTEGER;
    if (aEvidence === 'OBSERVED_PROGRESS' || bEvidence === 'OBSERVED_PROGRESS' || (!aEvidence && !bEvidence)) {
      if (aStops !== bStops) return aStops - bStops;
    }
    const aEta = etaConfidenceForDisplay(a, nowMs) !== 'NONE' ? a.etaSeconds! : Number.MAX_SAFE_INTEGER;
    const bEta = etaConfidenceForDisplay(b, nowMs) !== 'NONE' ? b.etaSeconds! : Number.MAX_SAFE_INTEGER;
    return aEta - bEta || a.id.localeCompare(b.id);
  }).slice(0, MAX_FOCUSED_APPROACH_VEHICLES);
}

/**
 * Starting tokens from the approved concept. Widths are zoom-interpolated so the
 * three zones keep their proportions at every scale instead of only at one zoom.
 */
export const ZONE_LINE_TOKENS: Record<TransitZone, { width: [number, number]; opacity: number }> = {
  A: { width: [2.5, 3.5], opacity: 0.45 },
  B: { width: [6, 9], opacity: 1 },
  C: { width: [2, 2.5], opacity: 0.25 },
};

/** L4 is at the stop, L3 has a confirmed sub-three-minute ETA, L2 is approaching, L1 is unrelated, L0 is stale/background. */
export const VEHICLE_PRIORITY_TOKENS: Record<VehiclePriorityLevel, { radius: number; haloRadius: number; opacity: number; haloOpacity: number; iconSize: number }> = {
  L4: { radius: 13, haloRadius: 19, opacity: 1, haloOpacity: 0.5, iconSize: 0.42 },
  L3: { radius: 12, haloRadius: 16, opacity: 0.84, haloOpacity: 0.38, iconSize: 0.38 },
  L2: { radius: 10, haloRadius: 13, opacity: 0.54, haloOpacity: 0.2, iconSize: 0.31 },
  L1: { radius: 7, haloRadius: 8, opacity: 0.4, haloOpacity: 0.08, iconSize: 0.23 },
  L0: { radius: 6, haloRadius: 0, opacity: 0.3, haloOpacity: 0, iconSize: 0.2 },
};

/**
 * Zones A and C are drawn only for a full published line; a leg-only fallback has
 * no known geometry outside the passenger's own ride, so inventing it would draw
 * road the vehicle never runs.
 */
export function zoneFeaturesFor(
  zones: TransitZoneGeometry | null | undefined,
  geometryScope: 'full_route' | 'leg_only' | undefined,
  passengerFocused = false,
): Array<{ zone: TransitZone; coordinates: Coordinate[] }> {
  if (!zones) return [];
  const features: Array<{ zone: TransitZone; coordinates: Coordinate[] }> = [
    { zone: 'B', coordinates: zones.passengerSegment },
  ];
  if (passengerFocused) return features.filter((feature) => feature.coordinates.length >= 2);
  if (geometryScope === 'leg_only') return features;
  if (zones.beforeBoarding && zones.beforeBoarding.length >= 2) features.unshift({ zone: 'A', coordinates: zones.beforeBoarding });
  if (zones.afterAlighting && zones.afterAlighting.length >= 2) features.push({ zone: 'C', coordinates: zones.afterAlighting });
  return features.filter((feature) => feature.coordinates.length >= 2);
}

export function priorityLevelOf(vehicle: {
  priority?: VehiclePriority | null;
  priorityLevel?: VehiclePriorityLevel;
  emphasized?: boolean;
  approachingBoarding?: boolean;
  remainingStops?: number | null;
  etaSeconds?: number | null;
  etaConfidence?: 'OBSERVED' | 'PREDICTED' | 'NONE';
  approachEvidence?: FocusedApproachVehicle['approachEvidence'];
}): VehiclePriorityLevel {
  const level = vehicle.priority?.level;
  if (level === 'L0' || level === 'L1' || level === 'L2' || level === 'L3' || level === 'L4') return level;
  const mappedLevel = vehicle.priorityLevel;
  if (mappedLevel === 'L0' || mappedLevel === 'L1' || mappedLevel === 'L2' || mappedLevel === 'L3' || mappedLevel === 'L4') return mappedLevel;
  if (vehicle.priority?.reason === 'stale_position') return 'L0';
  if (vehicle.approachEvidence?.source === 'OBSERVED_PROGRESS'
    && (vehicle.approachEvidence.remainingStops ?? vehicle.remainingStops) === 0) return 'L4';
  const etaIsConfirmed = etaConfidenceForDisplay(vehicle) !== 'NONE';
  if (vehicle.approachingBoarding && etaIsConfirmed && (vehicle.etaSeconds ?? Number.POSITIVE_INFINITY) <= 180) return 'L3';
  // The server has already matched the trip, direction, boarding stop and approach evidence.
  if (vehicle.approachingBoarding || vehicle.emphasized) return 'L2';
  return 'L1';
}

export type ZoneArrow = { coordinates: Coordinate; bearingDegrees: number; zone: TransitZone };

const ARROW_SPACING_METERS = 320;
const ARROW_MAX_PER_ZONE = 3;
const EARTH_RADIUS_METERS = 6_371_000;

function metersBetween(a: Coordinate, b: Coordinate): number {
  const radians = Math.PI / 180;
  const dLat = (b[1] - a[1]) * radians;
  const dLon = (b[0] - a[0]) * radians;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(x)));
}

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
    const length = metersBetween(from, to);
    if (length === 0) continue;
    if (walked + length >= distanceMeters) {
      const ratio = (distanceMeters - walked) / length;
      return {
        coordinates: [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio],
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
    for (let index = 0; index < entry.coordinates.length - 1; index += 1) total += metersBetween(entry.coordinates[index]!, entry.coordinates[index + 1]!);
    const count = Math.min(ARROW_MAX_PER_ZONE, Math.floor(total / ARROW_SPACING_METERS));
    for (let i = 1; i <= count; i += 1) {
      const arrow = arrowAt(entry.coordinates, (total * i) / (count + 1));
      if (arrow) arrows.push({ ...arrow, zone: entry.zone });
    }
  }
  return arrows;
}
