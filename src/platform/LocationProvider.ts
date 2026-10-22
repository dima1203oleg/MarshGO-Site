import { locationFixSchema, type LocationFix } from '../../shared/navigation/contracts';

export type LocationOptions = { enableHighAccuracy?: boolean; maximumAgeMs?: number; timeoutMs?: number };
export type LocationProviderStatus = 'IDLE' | 'ACTIVE' | 'UNAVAILABLE' | 'PERMISSION_DENIED';
export interface LocationProvider {
  start(options?: LocationOptions): Promise<void>;
  stop(): Promise<void>;
  subscribe(listener: (fix: LocationFix) => void): () => void;
  status(): LocationProviderStatus;
}

/**
 * WebKit has exposed GeolocationPosition.timestamp in microseconds in some
 * browser and WKWebView versions, while Chromium and Firefox expose epoch
 * milliseconds. Normalize the unusually large value before constructing a Date.
 */
export function geolocationTimestampToIso(timestamp: number): string | null {
  const timestampMs = timestamp > 100_000_000_000_000 ? timestamp / 1000 : timestamp;
  if (!Number.isFinite(timestampMs) || timestampMs <= 0 || timestampMs > 8_640_000_000_000_000) return null;
  return new Date(timestampMs).toISOString();
}

/**
 * Browsers can report unavailable optional GPS measurements as NaN. Preserve
 * the valid coordinates and omit only those optional measurements, so one
 * unsupported heading/speed value cannot discard an otherwise good GPS fix.
 */
export function geolocationPositionToFix(position: GeolocationPosition) {
  const { coords } = position;
  const optionalNumber = (value: number | null, isValid: (candidate: number) => boolean) =>
    value !== null && Number.isFinite(value) && isValid(value) ? value : undefined;
  const altitudeMeters = optionalNumber(coords.altitude, () => true);
  const altitudeAccuracyMeters = optionalNumber(coords.altitudeAccuracy, value => value >= 0);
  const headingDegrees = optionalNumber(coords.heading, value => value >= 0 && value <= 360);
  const speedMps = optionalNumber(coords.speed, value => value >= 0 && value <= 150);
  return locationFixSchema.safeParse({
    longitude: coords.longitude,
    latitude: coords.latitude,
    accuracyMeters: coords.accuracy,
    ...(altitudeMeters === undefined ? {} : { altitudeMeters }),
    ...(altitudeAccuracyMeters === undefined ? {} : { altitudeAccuracyMeters }),
    ...(headingDegrees === undefined ? {} : { headingDegrees }),
    ...(speedMps === undefined ? {} : { speedMps }),
    capturedAtClient: geolocationTimestampToIso(position.timestamp),
    source: 'gps',
  });
}

/** Foreground Web Geolocation adapter, also used by Capacitor WKWebView. */
export class WebGeolocationProvider implements LocationProvider {
  private watchId: number | null = null;
  private state: LocationProviderStatus = 'IDLE';
  private listeners = new Set<(fix: LocationFix) => void>();
  async start(options: LocationOptions = {}) {
    if (!('geolocation' in navigator)) { this.state = 'UNAVAILABLE'; throw new Error('GPS_UNAVAILABLE'); }
    if (this.watchId !== null) return;
    this.state = 'ACTIVE';
    this.watchId = navigator.geolocation.watchPosition((position) => {
      const parsed = this.toFix(position);
      if (parsed.success) for (const listener of this.listeners) listener(parsed.data);
    }, (error) => { this.state = error.code === error.PERMISSION_DENIED ? 'PERMISSION_DENIED' : 'UNAVAILABLE'; }, {
      enableHighAccuracy: options.enableHighAccuracy ?? true, maximumAge: options.maximumAgeMs ?? 5000, timeout: options.timeoutMs ?? 20000,
    });
  }
  getCurrentFix(options: LocationOptions = {}): Promise<LocationFix> {
    if (!('geolocation' in navigator)) return Promise.reject(new Error('GPS_UNAVAILABLE'));
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition((position) => {
      const parsed = this.toFix(position);
      if (parsed.success) resolve(parsed.data); else reject(new Error('GPS_INVALID_FIX'));
    }, (error) => reject(new Error(error.code === error.PERMISSION_DENIED ? 'GPS_PERMISSION_DENIED' : 'GPS_UNAVAILABLE')), {
      enableHighAccuracy: options.enableHighAccuracy ?? true, maximumAge: options.maximumAgeMs ?? 0, timeout: options.timeoutMs ?? 25000,
    }));
  }
  private toFix(position: GeolocationPosition) {
    return geolocationPositionToFix(position);
  }
  async stop() { if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId); this.watchId = null; this.state = 'IDLE'; }
  subscribe(listener: (fix: LocationFix) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  status() { return this.state; }
}

export type LocationPipelineResult = { accepted: true; fix: LocationFix } | { accepted: false; code: 'GPS_LOW_ACCURACY' | 'GPS_STALE' | 'GPS_INVALID_FIX' | 'GPS_TELEPORT_DETECTED' };
/** Stateless validation primitive; caller supplies authoritative time for deterministic replay. */
export function validateLocationFix(fix: LocationFix, nowMs: number, previous?: LocationFix): LocationPipelineResult {
  const parsed = locationFixSchema.safeParse(fix);
  if (!parsed.success) return { accepted: false, code: 'GPS_INVALID_FIX' };
  if (fix.accuracyMeters > 100) return { accepted: false, code: 'GPS_LOW_ACCURACY' };
  const ageMs = nowMs - Date.parse(fix.capturedAtClient);
  if (!Number.isFinite(ageMs) || ageMs < -120_000 || ageMs > 60_000) return { accepted: false, code: 'GPS_STALE' };
  if (previous) {
    const elapsed = (Date.parse(fix.capturedAtClient) - Date.parse(previous.capturedAtClient)) / 1000;
    if (elapsed <= 0) return { accepted: false, code: 'GPS_STALE' };
    const rad = Math.PI / 180; const dLat = (fix.latitude - previous.latitude) * rad; const dLon = (fix.longitude - previous.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(previous.latitude * rad) * Math.cos(fix.latitude * rad) * Math.sin(dLon / 2) ** 2;
    const distance = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
    const maxSpeed = Math.max(fix.speedMps ?? 0, previous.speedMps ?? 0, 55);
    if (distance > maxSpeed * elapsed + fix.accuracyMeters + previous.accuracyMeters) return { accepted: false, code: 'GPS_TELEPORT_DETECTED' };
  }
  return { accepted: true, fix: parsed.data };
}
