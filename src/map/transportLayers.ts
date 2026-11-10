import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import * as maplibregl from 'maplibre-gl';
import { productionApi, type GeoJsonCollection, type TransportLayerResponse } from '../services/productionApi';
import { getTransportModeVisual } from '../design-system/transport/transportModeRegistry';
import { lineTypesFor, microTypesFor, transportLayerList, type TransportLayerId } from './transportLayerConfig';
import { getMapDisplayPreferences, getTransportLayerVisibility, type MapDisplayPreferences } from './mapLayerPreferences';
import { layerProvenanceNotice, publishVehicleQuality, summarizeVehicleQuality, tagVehicleQuality, vehicleQualityWord } from './transportQuality';
export { cityTransportLayerIds, lineTypesFor, microTypesFor, transportLayerList } from './transportLayerConfig';
export type { TransportLayerId } from './transportLayerConfig';

/**
 * 2D information layers. They are MapLibre sources/layers (no DOM markers), loaded per viewport and only for the layers the user switched on.
 * Static geometry is cached on the server for hours; vehicle positions are polled every 15 s only while a line layer is visible.
 */
// ---- selection store ----
const STORAGE_KEY = 'marshgo.map.transport-layers.v1';
const hiddenLayerIds: TransportLayerId[] = ['PUBLIC_TRANSPORT', 'CITY_TRAIN', 'FUNICULAR', 'STOPS', 'RENTAL_POINTS'];
const validLayerIds = new Set<TransportLayerId>([...transportLayerList.map((item) => item.id), ...hiddenLayerIds]);
function restoreSelectedLayers(): Set<TransportLayerId> {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(values) ? values.filter((value): value is TransportLayerId => typeof value === 'string' && validLayerIds.has(value as TransportLayerId)) : []);
  } catch { return new Set(); }
}
/**
 * Whether this browser has ever recorded a layer choice. "Never chosen" and "chosen: nothing" are different
 * states: only the first one lets the transport map switch the city's layers on by itself, while an explicit
 * empty choice is respected on every later visit.
 */
export const hasStoredLayerChoice = (): boolean => { try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return true; } };
const selected = restoreSelectedLayers();
const listeners = new Set<(layers: ReadonlySet<TransportLayerId>) => void>();
export const getTransportLayers = (): ReadonlySet<TransportLayerId> => new Set(selected);
function publishSelection() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected])); } catch { /* The in-memory selection still applies. */ }
  listeners.forEach((listener) => listener(getTransportLayers()));
}
export function toggleTransportLayer(id: TransportLayerId) {
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  publishSelection();
}
export function setTransportLayers(ids: readonly TransportLayerId[], enabled: boolean) {
  // Only a real change may be stored and broadcast. The availability probe calls this with the layers it
  // cannot serve, and on a first visit that list is switched off while nothing is switched on: persisting
  // that no-op would write "[]" and destroy the "the visitor has never chosen anything yet" signal.
  const changed = ids.filter((id) => selected.has(id) !== enabled);
  if (!changed.length) return;
  changed.forEach((id) => (enabled ? selected.add(id) : selected.delete(id)));
  publishSelection();
}
export function clearTransportLayers() { selected.clear(); publishSelection(); }
export function subscribeTransportLayers(listener: (layers: ReadonlySet<TransportLayerId>) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

// ---- what each selection asks the server for ----
export function stopTypesFor(layers: ReadonlySet<TransportLayerId>): string[] {
  const lines = lineTypesFor(layers);
  return lines.length ? lines : ['bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'train', 'suburban', 'city_train', 'funicular'];
}
// ---- level of detail: below these zooms a layer is not requested at all ----
export const minZoom = { routes: 10, vehicles: 11, stops: 13, micro: 12 } as const;
const maxSpan = { routes: 2, vehicles: 2, stops: 0.5, micro: 0.6 } as const;

/** Viewport box as "west,south,east,north", shrunk around the centre when it exceeds what the server serves in one request. */
export function viewportBbox(bounds: { west: number; south: number; east: number; north: number }, span: number): string {
  const clamp = (low: number, high: number) => { const middle = (low + high) / 2; return high - low > span ? [middle - span / 2, middle + span / 2] : [low, high]; };
  const [west, east] = clamp(bounds.west, bounds.east); const [south, north] = clamp(bounds.south, bounds.north);
  return [west, south, east, north].map((value) => value.toFixed(5)).join(',');
}

/** Only the trust levels that actually move can be followed; a timetable dot has no live position to keep in view. */
export const isFollowableQuality = (quality: unknown): boolean => quality === 'live' || quality === 'estimated';

export function distanceMetersBetween(a: [number, number], b: [number, number]): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The nearest stop among the ones already loaded. The stops layer only covers the current viewport,
 * so the caller must never present this as the stop of the vehicle's route or as a walking route.
 */
export function nearestStopTo(stops: GeoJsonCollection, point: [number, number]): { name: string; distanceMeters: number; coordinates: [number, number] } | null {
  let best: { name: string; distanceMeters: number; coordinates: [number, number] } | null = null;
  for (const feature of stops.features) {
    if (feature.geometry.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) continue;
    const coordinates = feature.geometry.coordinates.slice(0, 2) as [number, number];
    if (!coordinates.every(Number.isFinite)) continue;
    const distance = Math.round(distanceMetersBetween(point, coordinates));
    if (best === null || distance < best.distanceMeters) best = { name: String(feature.properties.name ?? 'Зупинка'), distanceMeters: distance, coordinates };
  }
  return best;
}

const colors: Record<string, string> = {
  bus: getTransportModeVisual('BUS').color,
  marshrutka: getTransportModeVisual('MINIBUS').color,
  trolleybus: getTransportModeVisual('TROLLEYBUS').color,
  tram: getTransportModeVisual('TRAM').color,
  metro: getTransportModeVisual('METRO').color,
  city_train: getTransportModeVisual('TRAIN', 'city_train').color,
  funicular: getTransportModeVisual('FUNICULAR').color,
  other: getTransportModeVisual('UNKNOWN').color,
};
const empty: GeoJsonCollection = { type: 'FeatureCollection', features: [] };
const SOURCES = { routes: 'mg-t-routes', stops: 'mg-t-stops', vehicles: 'mg-t-vehicles', micro: 'mg-t-micro', zones: 'mg-t-micro-zones' } as const;
const lineColor = ['match', ['get', 'transport'], 'bus', colors.bus, 'marshrutka', colors.marshrutka, 'trolleybus', colors.trolleybus, 'tram', colors.tram, 'metro', colors.metro, 'train', getTransportModeVisual('TRAIN').color, 'suburban', getTransportModeVisual('TRAIN').color, 'city_train', colors.city_train, 'funicular', colors.funicular, colors.other] as never;

/**
 * A city-wide view draws every route of every operator at once, so anything that reads as a solid
 * stroke turns into a knot. Lines start as a whisper and only gain weight once the viewport is
 * small enough that a single corridor owns a few pixels.
 */
const routeOpacity = ['interpolate', ['linear'], ['zoom'], 10, 0.14, 12, 0.26, 14, 0.46, 16, 0.72] as never;
const routeWidth = ['interpolate', ['linear'], ['zoom'], 10, 0.7, 13, 1.3, 15, 2.2, 17, 3.2] as never;

/**
 * A position is only as good as its proof, so the halo around a vehicle carries the telemetry
 * level (tagVehicleQuality) instead of a decorative glow: blue = live GPS, amber = estimated,
 * red = stale, slate = timetable, grey = unverified.
 */
const TRUST_COLOR = ['#2563EB', '#F59E0B', '#DC2626', '#64748B', '#94A3B8'] as const;
const vehicleRadius = ['interpolate', ['linear'], ['zoom'], 11, 4.5, 16, 10] as never;
/** MapLibre rejects `['+', <zoom expression>, n]` for circle-radius by silently dropping the layer, so the halo grades on its own. */
const vehicleHaloRadius = ['interpolate', ['linear'], ['zoom'], 11, 11, 16, 17] as never;
const qualityColor = ['match', ['get', 'mgQuality'], 'live', TRUST_COLOR[0], 'estimated', TRUST_COLOR[1], 'stale', TRUST_COLOR[2], 'scheduled', TRUST_COLOR[3], TRUST_COLOR[4]] as never;
const qualityOpacity = ['match', ['get', 'mgQuality'], 'live', 0.4, 'estimated', 0.32, 'stale', 0.3, 'scheduled', 0.16, 0.12] as never;
const dimUnverified = ['match', ['get', 'mgQuality'], 'live', 1, 'estimated', 1, 'scheduled', 1, 'stale', 0.55, 0.5] as never;

const STATIC_CACHE_TTL_MS = 600_000;
const STATIC_CACHE_LIMIT = 8;

export class TransportLayerController {
  private enabled: ReadonlySet<TransportLayerId> = new Set();
  private data: Record<keyof typeof SOURCES, GeoJsonCollection> = { routes: empty, stops: empty, vehicles: empty, micro: empty, zones: empty };
  private aborters = new Map<string, AbortController>();
  private requested = new Map<keyof typeof SOURCES, string>();
  /** What the server admitted about each painted layer, kept so a hint survives a cached replay. */
  private notices = new Map<keyof typeof SOURCES, string>();
  /** Only geometry that does not move is replayable; vehicle, scooter and geofence positions are always refetched. */
  private readonly cacheable = new Set<keyof typeof SOURCES>(['routes', 'stops']);
  private cache = new Map<string, { response: TransportLayerResponse; at: number }>();
  private moveTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private popup: maplibregl.Popup | null = null;
  /** The vehicle whose camera the user asked to hold; dropped as soon as the source stops reporting it. */
  private followVehicleId: string | null = null;
  private readonly onMove = () => { if (this.moveTimer) clearTimeout(this.moveTimer); this.moveTimer = setTimeout(() => void this.refresh(), 350); };
  private readonly onVisibility = () => { if (document.visibilityState === 'visible') void this.refreshVehicles(); };

  constructor(private readonly map: MapLibreMap, private readonly onHint: (message: string | null) => void, private display: MapDisplayPreferences = getMapDisplayPreferences()) {}

  private hasGlyphs() { return Boolean(this.map.getStyle()?.glyphs); }

  /** Called whenever the user's selection changes (an empty set removes everything and stops all polling). */
  apply(layers: ReadonlySet<TransportLayerId>) {
    this.enabled = layers;
    if (layers.size === 0) { this.teardown(); this.onHint(null); return; }
    this.install();
    this.map.off('moveend', this.onMove); this.map.on('moveend', this.onMove);
    document.removeEventListener('visibilitychange', this.onVisibility); document.addEventListener('visibilitychange', this.onVisibility);
    this.restartPolling();
    this.applyDisplayPreferences();
    void this.refresh();
  }

  setDisplayPreferences(preferences: MapDisplayPreferences) {
    this.display = preferences;
    this.applyDisplayPreferences();
    this.restartPolling();
    if (this.enabled.size) void this.refresh();
  }

  private applyDisplayPreferences() {
    const visibility = getTransportLayerVisibility(this.display, this.enabled);
    for (const [id, enabled] of Object.entries(visibility)) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', enabled ? 'visible' : 'none');
  }

  /** A basemap or theme change drops custom sources; rebuild them from cached data without refetching. */
  reinstall() { if (this.enabled.size) { this.install(); this.pushData(); this.applyDisplayPreferences(); } }

  /** Leaving the map frees the memory; switching every layer off only stops the requests, so the geometry survives the next toggle. */
  destroy() { this.teardown(); this.cache.clear(); }

  private teardown() {
    this.map.off('moveend', this.onMove);
    this.map.off('click', 'mg-t-routes', this.onRouteClick);
    for (const layer of ['mg-t-vehicles', 'mg-t-stops', 'mg-t-micro-points', 'mg-t-micro-zones-fill']) this.map.off('click', layer, this.onClick);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.moveTimer) clearTimeout(this.moveTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null; this.moveTimer = null;
    this.aborters.forEach((controller) => controller.abort()); this.aborters.clear(); this.requested.clear();
    this.popup?.remove(); this.popup = null;
    this.data = { routes: empty, stops: empty, vehicles: empty, micro: empty, zones: empty };
    this.notices.clear();
    this.followVehicleId = null;
    publishVehicleQuality(null);
    for (const id of ['mg-t-micro-zones-outline', 'mg-t-micro-zones-fill', 'mg-t-micro-count', 'mg-t-micro-clusters', 'mg-t-micro-points', 'mg-t-vehicle-label', 'mg-t-vehicles', 'mg-t-vehicle-halo', 'mg-t-stop-label', 'mg-t-stops', 'mg-t-route-label', 'mg-t-routes']) if (this.map.getLayer(id)) this.map.removeLayer(id);
    for (const id of Object.values(SOURCES)) if (this.map.getSource(id)) this.map.removeSource(id);
    this.map.getContainer().dataset.marshgoTransportLayers = '';
  }

  private pushData() { for (const key of Object.keys(SOURCES) as Array<keyof typeof SOURCES>) (this.map.getSource(SOURCES[key]) as GeoJSONSource | undefined)?.setData(this.data[key] as never); }

  private install() {
    const map = this.map;
    if (!map.isStyleLoaded()) return; // reinstall() runs again on style.load
    map.getContainer().dataset.marshgoTransportLayers = [...this.enabled].join(',');
    const add = (id: string, cluster = false) => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty as never, ...(cluster ? { cluster: true, clusterRadius: 44, clusterMaxZoom: 15 } : {}) }); };
    add(SOURCES.routes); add(SOURCES.stops); add(SOURCES.vehicles); add(SOURCES.micro, true); add(SOURCES.zones);
    const glyphs = this.hasGlyphs();
    const before = map.getLayer('marshgo-route-casing') ? 'marshgo-route-casing' : undefined; // transport layers sit under the user's own route
    if (!map.getLayer('mg-t-routes')) map.addLayer({ id: 'mg-t-routes', type: 'line', source: SOURCES.routes, minzoom: minZoom.routes, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': lineColor, 'line-opacity': routeOpacity, 'line-width': routeWidth } }, before);
    if (glyphs && !map.getLayer('mg-t-route-label')) map.addLayer({ id: 'mg-t-route-label', type: 'symbol', source: SOURCES.routes, minzoom: 13, layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': lineColor, 'text-halo-color': '#fff', 'text-halo-width': 2 } }, before);
    if (!map.getLayer('mg-t-stops')) map.addLayer({ id: 'mg-t-stops', type: 'circle', source: SOURCES.stops, minzoom: minZoom.stops, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 17, 7], 'circle-color': '#ffffff', 'circle-stroke-color': '#0E1F35', 'circle-stroke-width': 1.5 } }, before);
    if (glyphs && !map.getLayer('mg-t-stop-label')) map.addLayer({ id: 'mg-t-stop-label', type: 'symbol', source: SOURCES.stops, minzoom: 15.5, layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#0E1F35', 'text-halo-color': '#fff', 'text-halo-width': 2 } }, before);
    if (!map.getLayer('mg-t-vehicle-halo')) map.addLayer({ id: 'mg-t-vehicle-halo', type: 'circle', source: SOURCES.vehicles, minzoom: minZoom.vehicles, paint: { 'circle-radius': vehicleHaloRadius, 'circle-color': qualityColor, 'circle-opacity': qualityOpacity, 'circle-blur': 0.48 } });
    if (!map.getLayer('mg-t-vehicles')) map.addLayer({ id: 'mg-t-vehicles', type: 'circle', source: SOURCES.vehicles, minzoom: minZoom.vehicles, paint: { 'circle-radius': vehicleRadius, 'circle-color': lineColor, 'circle-opacity': dimUnverified, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 } });
    if (glyphs && !map.getLayer('mg-t-vehicle-label')) map.addLayer({ id: 'mg-t-vehicle-label', type: 'symbol', source: SOURCES.vehicles, minzoom: 14, layout: { 'text-field': ['get', 'route'], 'text-size': 10.5, 'text-offset': [0, -1.45], 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': false }, paint: { 'text-color': '#0E1F35', 'text-halo-color': '#ffffff', 'text-halo-width': 2.5 } });
    if (!map.getLayer('mg-t-micro-clusters')) map.addLayer({ id: 'mg-t-micro-clusters', type: 'circle', source: SOURCES.micro, minzoom: minZoom.micro, filter: ['has', 'point_count'], paint: { 'circle-color': '#0EA5E9', 'circle-opacity': 0.85, 'circle-radius': ['step', ['get', 'point_count'], 14, 25, 18, 100, 24], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
    if (glyphs && !map.getLayer('mg-t-micro-count')) map.addLayer({ id: 'mg-t-micro-count', type: 'symbol', source: SOURCES.micro, minzoom: minZoom.micro, filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#fff' } });
    if (!map.getLayer('mg-t-micro-points')) map.addLayer({ id: 'mg-t-micro-points', type: 'circle', source: SOURCES.micro, minzoom: minZoom.micro, filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': ['match', ['get', 'kind'], 'station', 4.5, 'carsharing', 7, 'scooter', 6, 6], 'circle-color': ['match', ['get', 'kind'], 'scooter', getTransportModeVisual('SCOOTER').color, 'carsharing', getTransportModeVisual('CARSHARING').color, 'station', '#64748B', getTransportModeVisual('BIKE').color], 'circle-opacity': ['case', ['==', ['get', 'availability'], 'UNAVAILABLE'], 0.4, ['==', ['get', 'availability'], 'AVAILABLE'], 1, 0.8], 'circle-stroke-color': '#fff', 'circle-stroke-width': ['match', ['get', 'kind'], 'station', 1.5, 2] } });
    if (!map.getLayer('mg-t-micro-zones-fill')) map.addLayer({ id: 'mg-t-micro-zones-fill', type: 'fill', source: SOURCES.zones, minzoom: minZoom.micro, paint: { 'fill-color': ['case', ['==', ['get', 'rideEndAllowed'], false], '#F43F5E', ['==', ['get', 'rideEndAllowed'], true], '#10B981', '#64748B'], 'fill-opacity': 0.15 } });
    if (!map.getLayer('mg-t-micro-zones-outline')) map.addLayer({ id: 'mg-t-micro-zones-outline', type: 'line', source: SOURCES.zones, minzoom: minZoom.micro, paint: { 'line-color': ['case', ['==', ['get', 'rideEndAllowed'], false], '#F43F5E', ['==', ['get', 'rideEndAllowed'], true], '#10B981', '#64748B'], 'line-width': 1.5, 'line-opacity': 0.8 } });
    for (const layer of ['mg-t-vehicles', 'mg-t-stops', 'mg-t-micro-points', 'mg-t-micro-zones-fill']) { map.off('click', layer, this.onClick); map.on('click', layer, this.onClick); }
    map.off('click', 'mg-t-routes', this.onRouteClick); map.on('click', 'mg-t-routes', this.onRouteClick);
  }

  private readonly onClick = (event: MapMouseEvent & { features?: Array<{ properties: Record<string, unknown>; geometry: { type: string; coordinates?: unknown } }> }) => {
    const feature = event.features?.[0]; if (!feature) return;
    const properties = feature.properties; const node = document.createElement('div'); node.style.cssText = 'font:600 12px system-ui;color:#0E1F35;max-width:220px';
    let providerLink: HTMLAnchorElement | null = null;
    let vehicleActions: HTMLElement | null = null;
    const title = document.createElement('div');
    const detail = document.createElement('div'); detail.style.cssText = 'font-weight:500;color:#64748B;margin-top:2px';
    const names: Record<string, string> = { city_train: 'Міська електричка', funicular: 'Фунікулер', station: 'Пункт прокату' };
    const modeLabel = (mode: unknown) => {
      const key = String(mode ?? '');
      return names[key] ?? getTransportModeVisual(key, key).label;
    };
    if (properties.route !== undefined) {
      title.textContent = `${modeLabel(properties.transport)}${properties.route ? ` №${properties.route}` : ''}`;
      const timestamp = typeof properties.updatedAt === 'string' ? Date.parse(properties.updatedAt) : NaN;
      const age = Number.isFinite(timestamp) ? Math.max(0, Math.round((Date.now() - timestamp) / 1000)) : null;
      const speed = typeof properties.speed === 'number' ? `${Math.round(properties.speed * 3.6)} км/год` : '';
      detail.textContent = [vehicleQualityWord(properties), age === null ? '' : `оновлено ${age} с тому`, speed].filter(Boolean).join(' · ');
      const point = feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)
        ? feature.geometry.coordinates.slice(0, 2) as [number, number] : null;
      vehicleActions = this.vehicleActions(properties, point);
    }
    else if (properties.kind) {
      const kind = String(properties.kind);
      title.textContent = String(properties.name ?? (kind === 'station' || kind === 'rental_location' ? names.station : kind === 'geofence' ? 'Зона руху самоката' : modeLabel(kind)));
      const yesNoUnknown = (value: unknown, yes: string, no: string) => value === true ? yes : value === false ? no : 'не підтверджено';
      const updatedAt = typeof properties.updatedAt === 'string' ? properties.updatedAt : typeof properties.sourceUpdatedAt === 'string' ? properties.sourceUpdatedAt : null;
      const updated = updatedAt && Number.isFinite(Date.parse(updatedAt)) ? `дані ${Math.max(0, Math.round((Date.now() - Date.parse(updatedAt)) / 1000))} с тому` : properties.availabilityStatus === 'STATIC' ? 'статична точка' : 'свіжість невідома';
      const price = properties.pricing && typeof properties.pricing === 'object' ? properties.pricing as Record<string, unknown> : null;
      const currency = price && typeof price.currency === 'string' ? price.currency : 'валюта невідома';
      const basePrice = price && typeof price.basePrice === 'number' ? `${price.basePrice} ${currency}` : '';
      const minuteRates = price && Array.isArray(price.perMinutePricing) ? price.perMinutePricing.flatMap((raw) => {
        if (!raw || typeof raw !== 'object') return [];
        const rate = raw as Record<string, unknown>;
        return typeof rate.rate === 'number' && typeof rate.interval === 'number' ? [`${rate.rate} ${currency}/${rate.interval} с`] : [];
      }) : [];
      const priceLabel = price ? `тариф ${[basePrice, ...minuteRates].filter(Boolean).join(' + ') || 'умови не деталізовані'}` : '';
      const rules = kind === 'geofence'
        ? `старт: ${yesNoUnknown(properties.rideStartAllowed, 'дозволено', 'заборонено')} · повернення: ${yesNoUnknown(properties.rideEndAllowed, 'дозволено', 'заборонено')} · рух: ${yesNoUnknown(properties.rideThroughAllowed, 'дозволено', 'заборонено')}`
        : `взяття: ${yesNoUnknown(properties.pickupAllowed, 'дозволено', 'заборонено')} · повернення: ${yesNoUnknown(properties.dropoffAllowed, 'дозволено', 'заборонено')}`;
      const availability = kind === 'geofence' ? '' : properties.availability === 'AVAILABLE' ? 'зараз доступний' : properties.availability === 'UNAVAILABLE' ? 'зараз недоступний' : 'наявність невідома';
      detail.textContent = [properties.provider, properties.address, availability, properties.batteryPercent === null || properties.batteryPercent === undefined ? '' : `заряд ${properties.batteryPercent}%`, properties.available !== null && properties.available !== undefined ? `доступно: ${properties.available}` : '', properties.capacity ? `місткість ${properties.capacity}` : '', priceLabel, rules, updated].filter(Boolean).join(' · ');
      const uris = properties.rentalUris && typeof properties.rentalUris === 'object' ? properties.rentalUris as Record<string, unknown> : null;
      const urlValue = [uris?.web, uris?.ios, uris?.android].find((value) => typeof value === 'string' && value.startsWith('https://'));
      if (urlValue) {
        try {
          const url = new URL(String(urlValue));
          if (['zelectra.app.link', 'zelectra.rideatom.com'].includes(url.hostname)) {
            providerLink = document.createElement('a'); providerLink.href = url.toString(); providerLink.target = '_blank'; providerLink.rel = 'noopener noreferrer'; providerLink.textContent = 'Відкрити сервіс оренди'; providerLink.style.cssText = 'display:inline-block;margin-top:6px;color:#2563EB;font-weight:700';
          }
        } catch { /* Ignore malformed provider links. */ }
      }
    }
    else {
      title.textContent = String(properties.name ?? 'Зупинка');
      const routes = properties.routes ? `Маршрути: ${String(properties.routes)}` : '';
      const types = String(properties.transports ?? '').split(',').map((type) => modeLabel(type)).join(', ');
      detail.textContent = [routes, types].filter(Boolean).join(' · ');
    }
    node.append(title, detail);
    if (vehicleActions) node.append(vehicleActions);
    if (providerLink) node.append(providerLink);
    this.popup?.remove();
    const coordinates = feature.geometry.type === 'Point' ? feature.geometry.coordinates as [number, number] : [event.lngLat.lng, event.lngLat.lat] as [number, number];
    // closeOnMove defaults to true, which would dismiss the card the instant its own action eases the camera
    this.popup = new maplibregl.Popup({ closeButton: true, offset: 12, closeOnMove: false }).setLngLat(coordinates).setDOMContent(node).addTo(this.map);
  };

  /**
   * The two actions the live-map contract asks a vehicle to offer. Both are refused rather than faked:
   * a timetable dot has nothing to follow, and stops outside the loaded viewport simply are not known yet.
   */
  private vehicleActions(properties: Record<string, unknown>, point: [number, number] | null): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:9px';
    const id = typeof properties.id === 'string' ? properties.id : null;
    const follow = this.mapActionButton(this.followVehicleId === id ? 'Припинити стежити' : 'Стежити', true);
    if (id === null || point === null || !isFollowableQuality(properties.mgQuality)) {
      this.disableAction(follow, properties.mgQuality === 'stale'
        ? 'Позиція застаріла — стежити ні за чим'
        : 'Борт без живого GPS — стеження недоступне');
    } else {
      follow.addEventListener('click', () => {
        if (this.followVehicleId === id) {
          this.followVehicleId = null;
          follow.textContent = 'Стежити';
          return;
        }
        this.followVehicleId = id;
        follow.textContent = 'Припинити стежити';
        this.map.easeTo({ center: point, duration: 500 });
      });
    }
    const nearest = point === null ? null : nearestStopTo(this.data.stops, point);
    const toStop = this.mapActionButton(nearest ? `До найближчої зупинки · ${nearest.distanceMeters} м` : 'До найближчої зупинки', false);
    if (nearest === null || point === null) {
      this.disableAction(toStop, 'Зупинки ще не завантажені в полі зору — наблизьте мапу');
    } else {
      toStop.addEventListener('click', () => {
        this.map.easeTo({ center: nearest.coordinates, duration: 600 });
        this.onHint(`Найближча зупинка в полі зору — ${nearest.name}, приблизно ${nearest.distanceMeters} м. Це відстань, а не маршрут пішки.`);
      });
    }
    row.append(follow, toStop);
    return row;
  }

  private mapActionButton(label: string, primary: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('data-testid', 'map-vehicle-action');
      button.style.cssText = `min-height:44px;padding:0 13px;border-radius:13px;font:700 12px system-ui;cursor:pointer;border:1px solid ${primary ? 'transparent' : 'var(--mg-border-medium)'};background:${primary ? 'var(--mg-action)' : 'var(--mg-surface-primary)'};color:${primary ? '#FFFFFF' : 'var(--mg-ink-primary)'}`;
    return button;
  }

  private disableAction(button: HTMLButtonElement, reason: string) {
    button.disabled = true;
    button.title = reason;
    button.style.cursor = 'not-allowed';
    button.style.opacity = '.5';
  }

  /** A followed vehicle is only worth the camera while the source keeps reporting it. */
  private trackFollowedVehicle() {
    const id = this.followVehicleId;
    if (id === null) return;
    const feature = this.data.vehicles.features.find((item) => item.properties.id === id);
    if (!feature || feature.geometry.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) {
      this.followVehicleId = null;
      this.onHint('Борт зник із живого джерела — стеження вимкнено.');
      return;
    }
    const coordinates = feature.geometry.coordinates.slice(0, 2) as [number, number];
    this.map.easeTo({ center: coordinates, duration: 1_200 });
    this.popup?.setLngLat(coordinates);
  }

  private readonly onRouteClick = (event: MapMouseEvent & { features?: Array<{ properties: Record<string, unknown> }> }) => {
    const properties = event.features?.[0]?.properties;
    if (!properties) return;
    const node = document.createElement('div'); node.style.cssText = 'font:600 12px system-ui;color:#0E1F35;max-width:240px';
    const title = document.createElement('div'); title.textContent = `Маршрут ${String(properties.name ?? '')}`;
    const detail = document.createElement('div'); detail.style.cssText = 'font-weight:500;color:#64748B;margin-top:3px';
    detail.textContent = [properties.direction, properties.provider, properties.stopCount ? `${properties.stopCount} зупинок` : ''].filter(Boolean).join(' · ');
    node.append(title, detail);
    this.popup?.remove();
    this.popup = new maplibregl.Popup({ closeButton: true, offset: 12 }).setLngLat(event.lngLat).setDOMContent(node).addTo(this.map);
  };

  private bounds() { const b = this.map.getBounds(); return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }; }

  private paint(key: keyof typeof SOURCES, collection: GeoJsonCollection) {
    this.data[key] = collection;
    (this.map.getSource(SOURCES[key]) as GeoJSONSource | undefined)?.setData(collection as never);
    if (key === 'vehicles') this.trackFollowedVehicle();
  }

  /** Painting is the one place that knows both the geometry and the server's account of what it could not serve. */
  private publish(key: keyof typeof SOURCES, response: TransportLayerResponse) {
    const collection = key === 'vehicles' ? tagVehicleQuality(response.collection) : response.collection;
    this.paint(key, collection);
    if (key === 'vehicles') publishVehicleQuality(summarizeVehicleQuality(collection));
    else {
      const notice = layerProvenanceNotice(key, { featureCount: collection.features.length, failedProviderCount: response.failedProviderCount, truncated: response.truncated });
      if (notice) this.notices.set(key, notice); else this.notices.delete(key);
    }
  }

  private remember(cacheKey: string | null, response: TransportLayerResponse) {
    if (!cacheKey) return;
    this.cache.set(cacheKey, { response, at: Date.now() });
    if (this.cache.size > STATIC_CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value as string);
  }

  private async load(key: keyof typeof SOURCES, task: (signal: AbortSignal) => Promise<TransportLayerResponse>, signature?: string) {
    if (signature && this.requested.get(key) === signature) return;
    const cacheKey = signature && this.cacheable.has(key) ? `${key}|${signature}` : null;
    const fresh = cacheKey ? this.cache.get(cacheKey) : undefined;
    if (cacheKey && fresh && Date.now() - fresh.at < STATIC_CACHE_TTL_MS) {
      this.requested.set(key, signature as string);
      this.publish(key, fresh.response);
      return;
    }
    this.aborters.get(key)?.abort();
    if (signature) this.requested.set(key, signature);
    const controller = new AbortController(); this.aborters.set(key, controller);
    try {
      const response = await task(controller.signal);
      if (controller.signal.aborted) return;
      this.publish(key, response);
      this.remember(cacheKey, response);
    } catch (error) {
      if (signature && this.requested.get(key) === signature) this.requested.delete(key);
      if (!controller.signal.aborted && !(error instanceof DOMException)) this.notices.set(key, 'Не вдалося завантажити частину шарів. Спробуйте ще раз.');
    }
  }

  private clear(key: keyof typeof SOURCES) { this.requested.delete(key); this.aborters.get(key)?.abort(); this.notices.delete(key); this.data[key] = empty; (this.map.getSource(SOURCES[key]) as GeoJSONSource | undefined)?.setData(empty as never); if (key === 'vehicles') { this.followVehicleId = null; publishVehicleQuality(null); } }

  async refresh() {
    if (this.enabled.size === 0) return;
    const zoom = this.map.getZoom(); const bounds = this.bounds();
    const lines = lineTypesFor(this.enabled); const micro = microTypesFor(this.enabled);
    const hints: string[] = [];
    this.onHint(null);
    const tasks: Array<Promise<void>> = [];
    if (lines.length) {
      if (this.display.routeLines && zoom >= minZoom.routes) { const bbox = viewportBbox(bounds, maxSpan.routes); tasks.push(this.load('routes', (signal) => productionApi.transportRoutes(bbox, lines, signal), `${bbox}|${lines.join(',')}`)); }
      else { this.clear('routes'); if (this.display.routeLines) hints.push('лінії'); }
      if (this.display.liveVehicles && zoom >= minZoom.vehicles) tasks.push(this.refreshVehicles()); else { this.clear('vehicles'); }
    } else { this.clear('routes'); this.clear('vehicles'); }
    if (this.enabled.has('STOPS')) {
      if (zoom >= minZoom.stops) { const bbox = viewportBbox(bounds, maxSpan.stops); const types = stopTypesFor(this.enabled); tasks.push(this.load('stops', (signal) => productionApi.transportStops(bbox, types, signal), `${bbox}|${types.join(',')}`)); }
      else { this.clear('stops'); hints.push('зупинки'); }
    } else this.clear('stops');
    if (micro.length) {
      if (zoom >= minZoom.micro) {
        const bbox = viewportBbox(bounds, maxSpan.micro);
        tasks.push(this.load('micro', (signal) => productionApi.transportMicromobility(bbox, micro, signal), `${bbox}|${micro.join(',')}`));
        if (micro.includes('scooter')) tasks.push(this.load('zones', (signal) => productionApi.transportMicromobilityGeofences(bbox, signal), bbox));
        else this.clear('zones');
      } else { this.clear('micro'); this.clear('zones'); hints.push('велосипеди, самокати й каршерінг'); }
    } else { this.clear('micro'); this.clear('zones'); }
    await Promise.all(tasks);
    this.publishHint(hints);
  }

  /** One banner at a time: needing a closer zoom is more actionable than a layer with no coverage. */
  private publishHint(zoomHints: string[]) {
    if (zoomHints.length) { this.onHint(`Наблизьте карту, щоб побачити: ${zoomHints.join(', ')}.`); return; }
    const notices = [...this.notices.values()];
    this.onHint(notices.length ? notices.join(' ') : null);
  }

  async refreshVehicles() {
    const lines = lineTypesFor(this.enabled);
    if (!this.display.liveVehicles || !lines.length || this.map.getZoom() < minZoom.vehicles || document.visibilityState !== 'visible') return;
    await this.load('vehicles', (signal) => productionApi.transportVehicles(viewportBbox(this.bounds(), maxSpan.vehicles), lines, signal));
  }

  private restartPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = this.display.liveVehicles && lineTypesFor(this.enabled).length ? setInterval(() => void this.refreshVehicles(), 15_000) : null;
  }
}
