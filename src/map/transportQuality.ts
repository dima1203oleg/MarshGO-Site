import type { GeoJsonCollection } from '../services/productionApi';
import type { TransportTelemetryStatus } from '../design-system/ui/StatusBadge';

/**
 * ТЗ-MG-TRANSPORT-12 forbids presenting vehicle positions as live without proof of freshness.
 * The server labels each feature; when it does not (older build), the client falls back to the
 * provider timestamp and the same freshness window the server uses, and never invents a level.
 */
export const LIVE_POSITION_MAX_AGE_MS = 90_000;

export type VehicleQuality = { status: TransportTelemetryStatus; label: string; vehicleCount: number; oldestAgeMs: number | null };

const SERVER_LEVELS: { readonly [level: string]: TransportTelemetryStatus } = {
  LIVE: 'live', SCHEDULED: 'scheduled', ESTIMATED: 'estimated', STALE: 'stale', UNKNOWN: 'unavailable',
};
/** Worst-first, so a mixed view is described by its least fresh marker. */
const SEVERITY: readonly TransportTelemetryStatus[] = ['stale', 'unavailable', 'estimated', 'scheduled', 'live'];
const QUALITY_WORD: { readonly [status in TransportTelemetryStatus]: string } = {
  live: 'жива позиція', stale: 'застаріла позиція', estimated: 'позиція без мітки часу', scheduled: 'за розкладом', unavailable: 'якість не підтверджена',
};

type Properties = Record<string, unknown>;

/** Age of the position in ms, or null when the feed carries no verifiable stamp. */
export function vehiclePositionAgeMs(properties: Properties, now = Date.now()): number | null {
  const reported = properties.positionAgeMs;
  if (typeof reported === 'number' && Number.isFinite(reported) && reported >= 0) return reported;
  const stamp = typeof properties.updatedAt === 'string' ? Date.parse(properties.updatedAt) : Number.NaN;
  return Number.isFinite(stamp) ? Math.max(0, now - stamp) : null;
}

export function vehicleQualityLevel(properties: Properties, now = Date.now()): { status: TransportTelemetryStatus; ageMs: number | null } {
  const labelled = SERVER_LEVELS[String(properties.dataQuality ?? '')];
  const ageMs = vehiclePositionAgeMs(properties, now);
  if (labelled) return { status: labelled, ageMs };
  return { status: ageMs === null ? 'estimated' : ageMs <= LIVE_POSITION_MAX_AGE_MS ? 'live' : 'stale', ageMs };
}

/** Shown in the marker popup: the same words as the map badge, so the two never disagree. */
export function vehicleQualityWord(properties: Properties, now = Date.now()): string {
  return QUALITY_WORD[vehicleQualityLevel(properties, now).status];
}

export function summarizeVehicleQuality(collection: GeoJsonCollection, now = Date.now()): VehicleQuality {
  const levels = collection.features.map((feature) => vehicleQualityLevel(feature.properties ?? {}, now));
  const ages = levels.map((level) => level.ageMs).filter((age): age is number => age !== null);
  const oldestAgeMs = ages.length ? Math.max(...ages) : null;
  const vehicleCount = levels.length;
  const status = SEVERITY.find((candidate) => levels.some((level) => level.status === candidate)) ?? 'unavailable';
  const seconds = oldestAgeMs === null ? null : Math.round(oldestAgeMs / 1000);
  const label = status === 'live' ? `Live GPS · на карті ${vehicleCount} позначок`
    : status === 'stale' ? `Дані застаріли · найдавніша ${seconds} с`
    : status === 'estimated' ? `Без мітки часу · на карті ${vehicleCount} позначок`
    : 'Немає борту у видимій області';
  return { status, label, vehicleCount, oldestAgeMs };
}

/**
 * MapLibre paint expressions cannot re-run the freshness rules, so the level is stamped on the
 * feature once here — the halo a passenger sees and the words in the popup always agree.
 */
export function tagVehicleQuality(collection: GeoJsonCollection, now = Date.now()): GeoJsonCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      properties: { ...feature.properties, mgQuality: vehicleQualityLevel(feature.properties ?? {}, now).status },
    })),
  };
}

/**
 * A silent layer is indistinguishable from a broken one, so the map says what the server actually
 * reported. Nothing is inferred here: a failure is only named when the server counted a provider,
 * and a viewport that is simply empty stays quiet instead of alarming the passenger.
 */
export type StaticLayerKey = 'routes' | 'stops' | 'micro' | 'zones';
export type LayerProvenance = { featureCount: number; failedProviderCount: number; truncated: boolean };
const LAYER_WORD: Record<StaticLayerKey, string> = {
  routes: 'лінії маршрутів', stops: 'зупинки', micro: 'прокат велосипедів і самокатів', zones: 'зони руху прокату',
};

export function layerProvenanceNotice(key: StaticLayerKey, provenance: LayerProvenance): string | null {
  const word = LAYER_WORD[key];
  if (provenance.featureCount === 0) {
    return provenance.failedProviderCount > 0
      ? `Транспортні дані недоступні: «${word}» — не відповів жоден провайдер (${provenance.failedProviderCount}).`
      : null;
  }
  if (provenance.failedProviderCount > 0) return `«${word}»: показано не всі дані — не відповіли провайдери (${provenance.failedProviderCount}).`;
  if (provenance.truncated) return `«${word}»: область надто щільна, показано не всі об'єкти.`;
  return null;
}

// ---- badge store: the map publishes, the transport view renders (mirrors the layer-selection store) ----
let current: VehicleQuality | null = null;
const listeners = new Set<(quality: VehicleQuality | null) => void>();
export const getVehicleQuality = (): VehicleQuality | null => current;
export function publishVehicleQuality(quality: VehicleQuality | null) {
  current = quality;
  listeners.forEach((listener) => listener(quality));
}
export function subscribeVehicleQuality(listener: (quality: VehicleQuality | null) => void) {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}
