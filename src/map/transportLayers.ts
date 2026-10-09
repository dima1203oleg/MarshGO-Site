import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import * as maplibregl from 'maplibre-gl';
import { productionApi, type GeoJsonCollection } from '../services/productionApi';
import { microTypesFor, type TransportLayerId } from './transportLayerConfig';
export { microTypesFor, transportLayerList } from './transportLayerConfig';
export type { TransportLayerId } from './transportLayerConfig';

/**
 * 2D information layers. They are MapLibre sources/layers (no DOM markers), loaded per viewport and only for the layers the user switched on.
 * Static geometry is cached on the server for hours; vehicle positions are polled every 15 s only while a line layer is visible.
 */
// ---- selection store (all layers are off by default) ----
const selected = new Set<TransportLayerId>();
const listeners = new Set<(layers: ReadonlySet<TransportLayerId>) => void>();
export const getTransportLayers = (): ReadonlySet<TransportLayerId> => new Set(selected);
export function toggleTransportLayer(id: TransportLayerId) {
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  listeners.forEach((listener) => listener(getTransportLayers()));
}
export function clearTransportLayers() { selected.clear(); listeners.forEach((listener) => listener(getTransportLayers())); }
export function subscribeTransportLayers(listener: (layers: ReadonlySet<TransportLayerId>) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

// ---- what each selection asks the server for ----
export function lineTypesFor(layers: ReadonlySet<TransportLayerId>): string[] {
  const types = new Set<string>();
  if (layers.has('PUBLIC_TRANSPORT')) ['bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'city_train', 'funicular'].forEach((type) => types.add(type));
  if (layers.has('BUS')) { types.add('bus'); types.add('marshrutka'); }
  if (layers.has('TRAM')) types.add('tram');
  if (layers.has('TROLLEYBUS')) types.add('trolleybus');
  if (layers.has('METRO')) types.add('metro');
  if (layers.has('CITY_TRAIN')) types.add('city_train');
  if (layers.has('FUNICULAR')) types.add('funicular');
  return [...types];
}
export function stopTypesFor(layers: ReadonlySet<TransportLayerId>): string[] {
  const lines = lineTypesFor(layers);
  return lines.length ? lines : ['bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'city_train', 'funicular'];
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

const colors: Record<string, string> = { bus: '#1789F4', marshrutka: '#6366F1', trolleybus: '#16A34A', tram: '#E11D48', metro: '#7C3AED', city_train: '#0F766E', funicular: '#B45309', other: '#64748B' };
const empty: GeoJsonCollection = { type: 'FeatureCollection', features: [] };
const SOURCES = { routes: 'mg-t-routes', stops: 'mg-t-stops', vehicles: 'mg-t-vehicles', micro: 'mg-t-micro' } as const;
const lineColor = ['match', ['get', 'transport'], 'bus', colors.bus, 'marshrutka', colors.marshrutka, 'trolleybus', colors.trolleybus, 'tram', colors.tram, 'metro', colors.metro, 'city_train', colors.city_train, 'funicular', colors.funicular, colors.other] as never;

export class TransportLayerController {
  private enabled: ReadonlySet<TransportLayerId> = new Set();
  private data: Record<keyof typeof SOURCES, GeoJsonCollection> = { routes: empty, stops: empty, vehicles: empty, micro: empty };
  private aborters = new Map<string, AbortController>();
  private moveTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private popup: maplibregl.Popup | null = null;
  private readonly onMove = () => { if (this.moveTimer) clearTimeout(this.moveTimer); this.moveTimer = setTimeout(() => void this.refresh(), 350); };
  private readonly onVisibility = () => { if (document.visibilityState === 'visible') void this.refreshVehicles(); };

  constructor(private readonly map: MapLibreMap, private readonly onHint: (message: string | null) => void) {}

  private hasGlyphs() { return Boolean(this.map.getStyle()?.glyphs); }

  /** Called whenever the user's selection changes (an empty set removes everything and stops all polling). */
  apply(layers: ReadonlySet<TransportLayerId>) {
    this.enabled = layers;
    if (layers.size === 0) { this.teardown(); this.onHint(null); return; }
    this.install();
    this.map.off('moveend', this.onMove); this.map.on('moveend', this.onMove);
    document.removeEventListener('visibilitychange', this.onVisibility); document.addEventListener('visibilitychange', this.onVisibility);
    this.restartPolling();
    void this.refresh();
  }

  /** A style change (2D ↔ 3D ↔ satellite) drops custom sources; rebuild them from the cached data without refetching. */
  reinstall() { if (this.enabled.size) { this.install(); this.pushData(); } }

  destroy() { this.teardown(); }

  private teardown() {
    this.map.off('moveend', this.onMove);
    this.map.off('click', 'mg-t-routes', this.onRouteClick);
    for (const layer of ['mg-t-vehicles', 'mg-t-stops', 'mg-t-micro-points']) this.map.off('click', layer, this.onClick);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.moveTimer) clearTimeout(this.moveTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null; this.moveTimer = null;
    this.aborters.forEach((controller) => controller.abort()); this.aborters.clear();
    this.popup?.remove(); this.popup = null;
    this.data = { routes: empty, stops: empty, vehicles: empty, micro: empty };
    for (const id of ['mg-t-micro-count', 'mg-t-micro-clusters', 'mg-t-micro-points', 'mg-t-vehicle-label', 'mg-t-vehicles', 'mg-t-stop-label', 'mg-t-stops', 'mg-t-route-label', 'mg-t-routes']) if (this.map.getLayer(id)) this.map.removeLayer(id);
    for (const id of Object.values(SOURCES)) if (this.map.getSource(id)) this.map.removeSource(id);
    this.map.getContainer().dataset.marshgoTransportLayers = '';
  }

  private pushData() { for (const key of Object.keys(SOURCES) as Array<keyof typeof SOURCES>) (this.map.getSource(SOURCES[key]) as GeoJSONSource | undefined)?.setData(this.data[key] as never); }

  private install() {
    const map = this.map;
    if (!map.isStyleLoaded()) return; // reinstall() runs again on style.load
    map.getContainer().dataset.marshgoTransportLayers = [...this.enabled].join(',');
    const add = (id: string, cluster = false) => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty as never, ...(cluster ? { cluster: true, clusterRadius: 44, clusterMaxZoom: 15 } : {}) }); };
    add(SOURCES.routes); add(SOURCES.stops); add(SOURCES.vehicles); add(SOURCES.micro, true);
    const glyphs = this.hasGlyphs();
    const before = map.getLayer('marshgo-route-casing') ? 'marshgo-route-casing' : undefined; // transport layers sit under the user's own route
    if (!map.getLayer('mg-t-routes')) map.addLayer({ id: 'mg-t-routes', type: 'line', source: SOURCES.routes, minzoom: minZoom.routes, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': lineColor, 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 4] } }, before);
    if (glyphs && !map.getLayer('mg-t-route-label')) map.addLayer({ id: 'mg-t-route-label', type: 'symbol', source: SOURCES.routes, minzoom: 13, layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': lineColor, 'text-halo-color': '#fff', 'text-halo-width': 2 } }, before);
    if (!map.getLayer('mg-t-stops')) map.addLayer({ id: 'mg-t-stops', type: 'circle', source: SOURCES.stops, minzoom: minZoom.stops, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 17, 7], 'circle-color': '#ffffff', 'circle-stroke-color': '#0E1F35', 'circle-stroke-width': 1.5 } }, before);
    if (glyphs && !map.getLayer('mg-t-stop-label')) map.addLayer({ id: 'mg-t-stop-label', type: 'symbol', source: SOURCES.stops, minzoom: 15.5, layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#0E1F35', 'text-halo-color': '#fff', 'text-halo-width': 2 } }, before);
    if (!map.getLayer('mg-t-vehicles')) map.addLayer({ id: 'mg-t-vehicles', type: 'circle', source: SOURCES.vehicles, minzoom: minZoom.vehicles, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 9], 'circle-color': lineColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
    if (glyphs && !map.getLayer('mg-t-vehicle-label')) map.addLayer({ id: 'mg-t-vehicle-label', type: 'symbol', source: SOURCES.vehicles, minzoom: 14, layout: { 'text-field': ['get', 'route'], 'text-size': 10, 'text-offset': [0, -1.4], 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': false }, paint: { 'text-color': '#0E1F35', 'text-halo-color': '#fff', 'text-halo-width': 2 } });
    if (!map.getLayer('mg-t-micro-clusters')) map.addLayer({ id: 'mg-t-micro-clusters', type: 'circle', source: SOURCES.micro, minzoom: minZoom.micro, filter: ['has', 'point_count'], paint: { 'circle-color': '#0EA5E9', 'circle-opacity': 0.85, 'circle-radius': ['step', ['get', 'point_count'], 14, 25, 18, 100, 24], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
    if (glyphs && !map.getLayer('mg-t-micro-count')) map.addLayer({ id: 'mg-t-micro-count', type: 'symbol', source: SOURCES.micro, minzoom: minZoom.micro, filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#fff' } });
    if (!map.getLayer('mg-t-micro-points')) map.addLayer({ id: 'mg-t-micro-points', type: 'circle', source: SOURCES.micro, minzoom: minZoom.micro, filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 6, 'circle-color': ['match', ['get', 'kind'], 'scooter', '#F59E0B', 'carsharing', '#1789F4', 'station', '#64748B', '#16A34A'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
    for (const layer of ['mg-t-vehicles', 'mg-t-stops', 'mg-t-micro-points']) { map.off('click', layer, this.onClick); map.on('click', layer, this.onClick); }
    map.off('click', 'mg-t-routes', this.onRouteClick); map.on('click', 'mg-t-routes', this.onRouteClick);
  }

  private readonly onClick = (event: MapMouseEvent & { features?: Array<{ properties: Record<string, unknown>; geometry: { type: string; coordinates?: unknown } }> }) => {
    const feature = event.features?.[0]; if (!feature) return;
    const properties = feature.properties; const node = document.createElement('div'); node.style.cssText = 'font:600 12px system-ui;color:#0E1F35;max-width:220px';
    const title = document.createElement('div');
    const detail = document.createElement('div'); detail.style.cssText = 'font-weight:500;color:#64748B;margin-top:2px';
    const names: Record<string, string> = { bus: 'Автобус', marshrutka: 'Маршрутка', trolleybus: 'Тролейбус', tram: 'Трамвай', metro: 'Метро', city_train: 'Міська електричка', funicular: 'Фунікулер', scooter: 'Електросамокат', bike: 'Велосипед', carsharing: 'Каршерінг', station: 'Пункт прокату' };
    if (properties.route !== undefined) {
      title.textContent = `${names[String(properties.transport)] ?? 'Транспорт'}${properties.route ? ` №${properties.route}` : ''}`;
      const timestamp = typeof properties.updatedAt === 'string' ? Date.parse(properties.updatedAt) : NaN;
      const age = Number.isFinite(timestamp) ? Math.max(0, Math.round((Date.now() - timestamp) / 1000)) : null;
      const speed = typeof properties.speed === 'number' ? `${Math.round(properties.speed * 3.6)} км/год` : '';
      detail.textContent = [age === null ? '' : `оновлено ${age} с тому`, speed].filter(Boolean).join(' · ');
    }
    else if (properties.kind) { title.textContent = String(properties.name ?? names[String(properties.kind)] ?? 'Мікромобільність'); detail.textContent = [properties.provider, properties.available !== null && properties.available !== undefined ? `доступно: ${properties.available}` : ''].filter(Boolean).join(' · '); }
    else {
      title.textContent = String(properties.name ?? 'Зупинка');
      const routes = properties.routes ? `Маршрути: ${String(properties.routes)}` : '';
      const types = String(properties.transports ?? '').split(',').map((type) => names[type] ?? type).join(', ');
      detail.textContent = [routes, types].filter(Boolean).join(' · ');
    }
    node.append(title, detail);
    this.popup?.remove();
    const coordinates = feature.geometry.coordinates as [number, number];
    this.popup = new maplibregl.Popup({ closeButton: true, offset: 12 }).setLngLat(coordinates).setDOMContent(node).addTo(this.map);
  };

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

  private async load(key: keyof typeof SOURCES, task: (signal: AbortSignal) => Promise<GeoJsonCollection>) {
    this.aborters.get(key)?.abort();
    const controller = new AbortController(); this.aborters.set(key, controller);
    try {
      const collection = await task(controller.signal);
      if (controller.signal.aborted) return;
      this.data[key] = collection;
      (this.map.getSource(SOURCES[key]) as GeoJSONSource | undefined)?.setData(collection as never);
    } catch (error) {
      if (!controller.signal.aborted && !(error instanceof DOMException)) this.onHint('Не вдалося завантажити частину шарів. Спробуйте ще раз.');
    }
  }

  private clear(key: keyof typeof SOURCES) { this.aborters.get(key)?.abort(); this.data[key] = empty; (this.map.getSource(SOURCES[key]) as GeoJSONSource | undefined)?.setData(empty as never); }

  async refresh() {
    if (this.enabled.size === 0) return;
    const zoom = this.map.getZoom(); const bounds = this.bounds();
    const lines = lineTypesFor(this.enabled); const micro = microTypesFor(this.enabled);
    const hints: string[] = [];
    this.onHint(null);
    const tasks: Array<Promise<void>> = [];
    if (lines.length) {
      if (zoom >= minZoom.routes) tasks.push(this.load('routes', (signal) => productionApi.transportRoutes(viewportBbox(bounds, maxSpan.routes), lines, signal)));
      else { this.clear('routes'); hints.push('лінії'); }
      if (zoom >= minZoom.vehicles) tasks.push(this.refreshVehicles()); else { this.clear('vehicles'); }
    } else { this.clear('routes'); this.clear('vehicles'); }
    if (this.enabled.has('STOPS')) {
      if (zoom >= minZoom.stops) tasks.push(this.load('stops', (signal) => productionApi.transportStops(viewportBbox(bounds, maxSpan.stops), stopTypesFor(this.enabled), signal)));
      else { this.clear('stops'); hints.push('зупинки'); }
    } else this.clear('stops');
    if (micro.length) {
      if (zoom >= minZoom.micro) tasks.push(this.load('micro', (signal) => productionApi.transportMicromobility(viewportBbox(bounds, maxSpan.micro), micro, signal)));
      else { this.clear('micro'); hints.push('велосипеди, самокати й каршерінг'); }
    } else this.clear('micro');
    if (hints.length) this.onHint(`Наблизьте карту, щоб побачити: ${hints.join(', ')}.`);
    await Promise.all(tasks);
  }

  async refreshVehicles() {
    const lines = lineTypesFor(this.enabled);
    if (!lines.length || this.map.getZoom() < minZoom.vehicles || document.visibilityState !== 'visible') return;
    await this.load('vehicles', (signal) => productionApi.transportVehicles(viewportBbox(this.bounds(), maxSpan.vehicles), lines, signal));
  }

  private restartPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = lineTypesFor(this.enabled).length ? setInterval(() => void this.refreshVehicles(), 15_000) : null;
  }
}
