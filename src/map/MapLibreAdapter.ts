import * as maplibregl from 'maplibre-gl';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import type { Coordinate } from '../../shared/navigation/contracts';
import type { CameraMode, MapAdapter, MapStatus, MapTheme } from './MapAdapter';
import { mapStyleTokens } from './style/tokens';
import { Protocol } from 'pmtiles';
import { mapLayers, mapModes, styleForLayer, transitAttribution, transitTiles, type MapLayer, type MapMode } from './mapMode';
import { configuredMapStyleUrl } from './mapConfig';

const pmtilesProtocol = new Protocol();
let pmtilesProtocolRegistered = false;

export class MapLibreAdapter implements MapAdapter {
  private map: MapLibreMap;
  private status: MapStatus = 'loading';
  private route: Coordinate[] = [];
  private vehicle: Coordinate | null = null;
  private waypoints: Array<{ coordinate: Coordinate; kind: string }> = [];
  private cameraMode: CameraMode = 'OVERVIEW';
  private theme: MapTheme = 'MARSHGO_NAVIGATION_LIGHT';
  private seenTileError = false;
  private mode: MapMode = 'google';
  private layer: MapLayer = 'standard';

  constructor(container: HTMLElement, style: string | StyleSpecification, private readonly onStatus: (status: MapStatus) => void, private readonly hasBasemap: boolean, private readonly styleUrls?: Partial<Record<MapTheme, string>>, initialTheme: MapTheme = 'MARSHGO_NAVIGATION_LIGHT') {
    this.theme = initialTheme;
    if (!pmtilesProtocolRegistered) { maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile); pmtilesProtocolRegistered = true; }
    maplibregl.setWorkerUrl(mapLibreWorkerUrl);
    container.dataset.marshgoMapRenderer = 'maplibre';
    this.map = new maplibregl.Map({ container, style, logoPosition: 'bottom-left', center: [30.5234, 50.4501], zoom: 5, pitchWithRotate: true, dragRotate: true, touchPitch: true, cooperativeGestures: false });
    this.map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false, visualizePitch: true }), 'bottom-right');
    this.map.on('load', () => { this.installLayers(); container.dataset.marshgoMapReady = 'true'; this.publish(this.hasBasemap ? 'available' : 'unconfigured'); });
    this.map.on('style.load', () => { this.installLayers(); container.dataset.marshgoMapReady = 'true'; if (this.hasBasemap && !this.map.getSource('marshgo-basemap') && this.status !== 'failed') this.publish('available'); });
    this.map.on('error', (event) => {
      const mapError = event as typeof event & { sourceId?: string };
      container.dataset.marshgoMapError = event.error?.message ?? 'MapLibre resource error';
      if (mapError.sourceId === 'marshgo-basemap') { this.seenTileError = true; this.publish('degraded'); }
      else if (this.status === 'loading') this.publish('failed');
    });
    this.map.on('sourcedata', (event) => { if (event.sourceId === 'marshgo-basemap' && event.isSourceLoaded && !this.seenTileError) this.publish('available'); });
    this.map.on('dragstart', () => { this.cameraMode = 'FREE'; });
    this.map.on('zoomstart', () => { if (this.cameraMode === 'FOLLOW_HEADING') this.cameraMode = 'FREE'; });
  }

  private publish(status: MapStatus) { this.status = this.seenTileError && status === 'available' ? 'degraded' : status; this.onStatus(this.status); }
  private installLayers() {
    const colors = { ...mapStyleTokens[this.theme], route: mapModes[this.mode].route, routeCasing: mapModes[this.mode].casing };
    this.map.getContainer().dataset.marshgoMapLayer = this.layer;
    if (this.layer === 'transit' && transitTiles.length > 0 && !this.map.getSource('marshgo-transit')) {
      this.map.addSource('marshgo-transit', { type: 'raster', tiles: transitTiles, tileSize: 256, maxzoom: 19, attribution: transitAttribution });
      this.map.addLayer({ id: 'marshgo-transit', type: 'raster', source: 'marshgo-transit', paint: { 'raster-opacity': 0.9 } });
    }
    if (!this.map.getSource('marshgo-route')) this.map.addSource('marshgo-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-vehicle')) this.map.addSource('marshgo-vehicle', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-waypoints')) this.map.addSource('marshgo-waypoints', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getLayer('marshgo-route-casing')) this.map.addLayer({ id: 'marshgo-route-casing', type: 'line', source: 'marshgo-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colors.routeCasing, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 5 * mapModes[this.mode].width, 15, 13 * mapModes[this.mode].width], 'line-opacity': 0.92 } });
    if (!this.map.getLayer('marshgo-route')) this.map.addLayer({ id: 'marshgo-route', type: 'line', source: 'marshgo-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colors.route, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3 * mapModes[this.mode].width, 15, 8 * mapModes[this.mode].width], 'line-opacity': 0.98 } });
    if (!this.map.getLayer('marshgo-waypoints')) this.map.addLayer({ id: 'marshgo-waypoints', type: 'circle', source: 'marshgo-waypoints', paint: { 'circle-radius': 8, 'circle-color': ['match', ['get', 'kind'], 'PICKUP', colors.pickup, 'DROPOFF', colors.dropoff, colors.route], 'circle-stroke-color': colors.routeCasing, 'circle-stroke-width': 3 } });
    if (!this.map.getLayer('marshgo-vehicle-halo')) this.map.addLayer({ id: 'marshgo-vehicle-halo', type: 'circle', source: 'marshgo-vehicle', paint: { 'circle-radius': 13, 'circle-color': colors.vehicle, 'circle-opacity': 0.2 } });
    if (!this.map.getLayer('marshgo-vehicle')) this.map.addLayer({ id: 'marshgo-vehicle', type: 'circle', source: 'marshgo-vehicle', paint: { 'circle-radius': 8, 'circle-color': colors.vehicle, 'circle-stroke-color': colors.routeCasing, 'circle-stroke-width': 3 } });
    this.setRoute(this.route);
    if (this.vehicle) this.setVehicle(this.vehicle);
    this.setWaypoints(this.waypoints);
  }

  setRoute(points: Coordinate[]) {
    this.route = points;
    this.map.getContainer().dataset.marshgoRoutePointCount = String(points.length);
    const source = this.map.getSource('marshgo-route') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } });
  }
  setVehicle(point: Coordinate) {
    this.vehicle = point;
    const source = this.map.getSource('marshgo-vehicle') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: point } });
    if (this.cameraMode === 'FOLLOW_HEADING' || this.cameraMode === 'FOLLOW') this.map.easeTo({ center: point, duration: 450, essential: true });
  }
  setWaypoints(points: Array<{ coordinate: Coordinate; kind: string }>) {
    this.waypoints = points;
    const source = this.map.getSource('marshgo-waypoints') as maplibregl.GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: points.map(({ coordinate, kind }) => ({ type: 'Feature' as const, properties: { kind }, geometry: { type: 'Point' as const, coordinates: coordinate } })) });
  }
  fitRoute() {
    if (this.route.length < 2) return;
    const lngs = this.route.map((point) => point[0]); const lats = this.route.map((point) => point[1]);
    this.cameraMode = 'OVERVIEW';
    // Full-screen navigation reserves room for its overlays; small previews must scale the padding down or MapLibre rejects the fit.
    const { clientWidth, clientHeight } = this.map.getContainer();
    const padding = { top: Math.min(110, clientHeight * 0.2), right: Math.min(32, clientWidth * 0.1), bottom: Math.min(270, clientHeight * 0.2), left: Math.min(32, clientWidth * 0.1) };
    this.map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding, duration: 600, maxZoom: 15 });
  }
  recenter(point?: Coordinate) {
    const center = point ?? this.vehicle;
    if (!center) { this.fitRoute(); return; }
    this.cameraMode = 'FOLLOW_HEADING';
    this.map.easeTo({ center, zoom: Math.max(this.map.getZoom(), 15), pitch: mapModes[this.mode].pitch || 50, duration: 650, essential: true });
  }
  setMode(mode: MapMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    const style = styleForLayer(this.layer, mode, configuredMapStyleUrl);
    if (style) { this.map.setStyle(style); return; }
    if (!this.map.getLayer('marshgo-route')) return;
    const { route, casing, width } = mapModes[mode];
    this.map.setPaintProperty('marshgo-route', 'line-color', route);
    this.map.setPaintProperty('marshgo-route-casing', 'line-color', casing);
    this.map.setPaintProperty('marshgo-route', 'line-width', ['interpolate', ['linear'], ['zoom'], 5, 3 * width, 15, 8 * width]);
    this.map.setPaintProperty('marshgo-route-casing', 'line-width', ['interpolate', ['linear'], ['zoom'], 5, 5 * width, 15, 13 * width]);
  }
  setLayer(layer: MapLayer) {
    if (layer === this.layer) return;
    this.layer = layer;
    const style = styleForLayer(layer, this.mode, configuredMapStyleUrl);
    if (style) this.map.setStyle(style);
    else if (layer === 'standard') this.map.setStyle(this.map.getStyle());
    this.map.easeTo({ pitch: mapLayers[layer].pitch, duration: 700, essential: true });
  }
  setCameraMode(mode: CameraMode) { this.cameraMode = mode; }
  setTheme(theme: MapTheme) {
    const changed = this.theme !== theme;
    this.theme = theme;
    const style = this.styleUrls?.[theme];
    if (changed && style) { this.map.setStyle(style); return; }
    if (!this.map.getLayer('marshgo-route')) return;
    const colors = mapStyleTokens[theme];
    this.map.setPaintProperty('marshgo-route-casing', 'line-color', colors.routeCasing);
    this.map.setPaintProperty('marshgo-route', 'line-color', colors.route);
    this.map.setPaintProperty('marshgo-waypoints', 'circle-color', ['match', ['get', 'kind'], 'PICKUP', colors.pickup, 'DROPOFF', colors.dropoff, colors.route]);
    this.map.setPaintProperty('marshgo-waypoints', 'circle-stroke-color', colors.routeCasing);
    this.map.setPaintProperty('marshgo-vehicle-halo', 'circle-color', colors.vehicle);
    this.map.setPaintProperty('marshgo-vehicle', 'circle-color', colors.vehicle);
    this.map.setPaintProperty('marshgo-vehicle', 'circle-stroke-color', colors.routeCasing);
    if (this.map.getLayer('marshgo-background')) this.map.setPaintProperty('marshgo-background', 'background-color', colors.background);
  }
  retry() { this.seenTileError = false; this.publish(this.hasBasemap ? 'loading' : 'unconfigured'); if (this.hasBasemap) this.map.setStyle(this.map.getStyle()); else this.map.triggerRepaint(); }
  destroy() { this.map.remove(); }
  getStatus() { return this.status; }
}
