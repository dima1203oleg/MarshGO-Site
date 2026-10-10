import * as maplibregl from 'maplibre-gl';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import type { Coordinate } from '../../shared/navigation/contracts';
import type { CameraMode, MapAdapter, MapStatus, MapTheme } from './MapAdapter';
import { mapStyleTokens } from './style/tokens';
import { Protocol } from 'pmtiles';
import type { FillLayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { mapLayers, satelliteAttribution, satelliteTiles, styleForLayer, type MapLayer } from './mapMode';
import { TransportLayerController, type TransportLayerId } from './transportLayers';
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
  private theme: MapTheme = 'MARSHGO_3D_LIGHT';
  private seenTileError = false;
  private layer: MapLayer = 'simple';
  private transport: TransportLayerController | null = null;
  private heading: number | null = null;
  private marker: maplibregl.Marker | null = null;
  /** Lets the UI highlight the "my location" button while the camera follows the driver. */
  onCameraModeChange: (mode: CameraMode) => void = () => undefined;
  private transportLayers: ReadonlySet<TransportLayerId> = new Set();
  /** Shown when a layer needs a closer zoom or fails to load. */
  onTransportHint: (message: string | null) => void = () => undefined;

  constructor(container: HTMLElement, style: string | StyleSpecification, private readonly onStatus: (status: MapStatus) => void, private readonly hasBasemap: boolean, private readonly styleUrls?: Partial<Record<MapTheme, string>>, initialTheme: MapTheme = 'MARSHGO_3D_LIGHT') {
    this.theme = initialTheme;
    if (!pmtilesProtocolRegistered) { maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile); pmtilesProtocolRegistered = true; }
    maplibregl.setWorkerUrl(mapLibreWorkerUrl);
    container.dataset.marshgoMapRenderer = 'maplibre';
    this.map = new maplibregl.Map({ container, style, logoPosition: 'bottom-left', center: [30.5234, 50.4501], zoom: 5, pitchWithRotate: true, dragRotate: true, touchPitch: true, cooperativeGestures: false });
    this.map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false, visualizePitch: true }), 'bottom-right');
    this.map.on('load', () => { this.installLayers(); container.dataset.marshgoMapReady = 'true'; this.publish(this.basemapConfigured() ? 'available' : 'unconfigured'); });
    this.map.on('style.load', () => { this.installLayers(); container.dataset.marshgoMapReady = 'true'; if (this.basemapConfigured() && !this.map.getSource('marshgo-basemap') && this.status !== 'failed') this.publish('available'); });
    this.map.on('error', (event) => {
      const mapError = event as typeof event & {
        sourceId?: string;
        error?: typeof event.error & { sourceId?: string; status?: number; statusCode?: number; url?: string };
      };
      container.dataset.marshgoMapError = event.error?.message ?? 'MapLibre resource error';
      const failedBasemapResource = mapError.sourceId === 'marshgo-basemap' || mapError.sourceId === 'marshgo-satellite'
        || mapError.error?.sourceId === 'marshgo-basemap' || mapError.error?.sourceId === 'marshgo-satellite'
        || (this.hasBasemap && (
          this.status === 'available'
          || (mapError.error?.status ?? mapError.error?.statusCode ?? 0) >= 400
          || /(?:tile|raster|\.png\b)/i.test(`${mapError.error?.url ?? ''} ${event.error?.message ?? ''}`)
        ));
      if (failedBasemapResource) {
        this.seenTileError = true;
        this.publish(this.status === 'available' || this.status === 'degraded' ? 'degraded' : 'failed');
      }
      else if (this.status === 'loading') this.publish('failed');
    });
    this.map.on('sourcedata', (event) => {
      if ((event.sourceId !== 'marshgo-basemap' && event.sourceId !== 'marshgo-satellite') || !event.isSourceLoaded) return;
      this.publish(this.seenTileError ? 'degraded' : 'available');
    });
    // Only the user's own gestures leave follow mode; our camera animations (zoom, bearing) must not.
    const userGesture = (event: { originalEvent?: unknown }) => { if (event.originalEvent && this.cameraMode !== 'FREE') this.setCameraModeInternal('FREE'); };
    this.map.on('dragstart', userGesture);
    this.map.on('zoomstart', userGesture);
    this.map.on('rotatestart', userGesture);
    this.map.on('pitchstart', userGesture);
  }

  private publish(status: MapStatus) { this.status = this.seenTileError && status === 'available' ? 'degraded' : status; this.onStatus(this.status); }
  private basemapConfigured() { return this.hasBasemap && (this.layer !== 'satellite' || Boolean(satelliteTiles && satelliteAttribution)); }
  private themeForLayer(layer: MapLayer, theme: MapTheme = this.theme): MapTheme {
    const dark = theme.endsWith('_DARK');
    if (layer === 'threeD') return dark ? 'MARSHGO_3D_DARK' : 'MARSHGO_3D_LIGHT';
    return dark ? 'MARSHGO_DARK' : 'MARSHGO_LIGHT';
  }
  private installLayers() {
    const colors = mapStyleTokens[this.theme];
    this.map.getContainer().dataset.marshgoMapLayer = this.layer;
    if (this.layer === 'satellite') this.installSatelliteOverlay();
    if (this.layer === 'threeD') this.install3DBuildings();
    else this.remove3DBuildings();
    if (!this.map.getSource('marshgo-route')) this.map.addSource('marshgo-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-vehicle')) this.map.addSource('marshgo-vehicle', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-waypoints')) this.map.addSource('marshgo-waypoints', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getLayer('marshgo-route-halo')) this.map.addLayer({ id: 'marshgo-route-halo', type: 'line', source: 'marshgo-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colors.route, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 10, 15, 22], 'line-opacity': 0.2, 'line-blur': 5 } });
    if (!this.map.getLayer('marshgo-route-casing')) this.map.addLayer({ id: 'marshgo-route-casing', type: 'line', source: 'marshgo-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colors.routeCasing, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 5, 15, 13], 'line-opacity': 0.92 } });
    if (!this.map.getLayer('marshgo-route')) this.map.addLayer({ id: 'marshgo-route', type: 'line', source: 'marshgo-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colors.route, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3, 15, 8], 'line-opacity': 0.98 } });
    if (!this.map.getLayer('marshgo-waypoints')) this.map.addLayer({ id: 'marshgo-waypoints', type: 'circle', source: 'marshgo-waypoints', paint: { 'circle-radius': 8, 'circle-color': ['match', ['get', 'kind'], 'PICKUP', colors.pickup, 'DROPOFF', colors.dropoff, colors.route], 'circle-stroke-color': colors.routeCasing, 'circle-stroke-width': 3 } });
    if (!this.map.getLayer('marshgo-vehicle-halo')) this.map.addLayer({ id: 'marshgo-vehicle-halo', type: 'circle', source: 'marshgo-vehicle', paint: { 'circle-radius': 13, 'circle-color': colors.vehicle, 'circle-opacity': 0.2 } });
    if (!this.map.getLayer('marshgo-vehicle')) this.map.addLayer({ id: 'marshgo-vehicle', type: 'circle', source: 'marshgo-vehicle', paint: { 'circle-radius': 8, 'circle-color': colors.vehicle, 'circle-stroke-color': colors.routeCasing, 'circle-stroke-width': 3 } });
    // The DOM puck (rotating arrow) replaces the old circle dot; the source stays for consumers of its data.
    for (const id of ['marshgo-vehicle-halo', 'marshgo-vehicle']) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', 'none');
    this.transport?.reinstall();
    // 3D mode keeps its tilt after every style load (a style swap resets the camera on some browsers).
    if (this.layer === 'threeD' && Math.abs(this.map.getPitch() - mapLayers.threeD.pitch) > 1) this.map.easeTo({ pitch: mapLayers.threeD.pitch, duration: 500, essential: true });
    this.setRoute(this.route);
    if (this.vehicle) this.setVehicle(this.vehicle);
    this.setWaypoints(this.waypoints);
  }

  /** Keep vector roads and labels above the imagery; dim land/building fills to reveal the satellite base. */
  private installSatelliteOverlay() {
    if (this.layer !== 'satellite' || !this.map.isStyleLoaded()) return;
    if (!satelliteTiles || !satelliteAttribution) {
      this.onTransportHint('Супутникові знімки недоступні: не налаштовано ліцензоване джерело карти.');
      this.publish('unconfigured');
      return;
    }
    if (!this.map.getSource('marshgo-satellite')) this.map.addSource('marshgo-satellite', {
      type: 'raster', tiles: [satelliteTiles], tileSize: 256, maxzoom: 19,
      attribution: satelliteAttribution,
    });
    for (const layer of this.map.getStyle().layers ?? []) {
      if (layer.id.startsWith('marshgo-')) continue;
      if (layer.type === 'background') this.map.setPaintProperty(layer.id, 'background-opacity', 0);
      else if (layer.type === 'fill') this.map.setPaintProperty(layer.id, 'fill-opacity', /water/i.test(`${layer.id} ${layer['source-layer'] ?? ''}`) ? 0.28 : 0.1);
      else if (layer.type === 'line' && !/(road|street|transport|bridge|tunnel|rail)/i.test(`${layer.id} ${layer['source-layer'] ?? ''}`)) this.map.setPaintProperty(layer.id, 'line-opacity', 0.22);
    }
    if (!this.map.getLayer('marshgo-satellite')) {
      const firstLayerId = this.map.getStyle().layers?.[0]?.id;
      this.map.addLayer({
        id: 'marshgo-satellite', type: 'raster', source: 'marshgo-satellite',
        paint: { 'raster-opacity': 1 },
      }, firstLayerId);
    }
    this.applySatellitePalette();
  }

  private applySatellitePalette() {
    if (!this.map.getLayer('marshgo-satellite')) return;
    const dark = this.theme.endsWith('_DARK');
    this.map.setPaintProperty('marshgo-satellite', 'raster-opacity', dark ? 0.94 : 1);
    this.map.setPaintProperty('marshgo-satellite', 'raster-brightness-min', dark ? 0.02 : 0);
    this.map.setPaintProperty('marshgo-satellite', 'raster-brightness-max', dark ? 0.74 : 1);
    this.map.setPaintProperty('marshgo-satellite', 'raster-saturation', dark ? -0.55 : 0);
  }

  /** Extrude only the existing vector building source; no separate 3D model assets are loaded. */
  private install3DBuildings() {
    if (this.layer !== 'threeD' || !this.map.isStyleLoaded() || this.map.getLayer('marshgo-buildings-3d')) return;
    const layers = this.map.getStyle().layers ?? [];
    const building = layers.find((layer): layer is FillLayerSpecification =>
      layer.type === 'fill' && /building/i.test(`${layer.id} ${layer['source-layer'] ?? ''}`),
    );
    if (!building || !building.source || !building['source-layer']) return;
    const labels = layers.find((layer) => layer.type === 'symbol' && layer.layout?.['text-field']);
    this.map.addLayer({
      id: 'marshgo-buildings-3d', type: 'fill-extrusion', source: building.source,
      'source-layer': building['source-layer'], ...(building.filter ? { filter: building.filter } : {}),
      minzoom: Math.max(14, building.minzoom ?? 14),
      paint: {
        'fill-extrusion-color': this.theme.endsWith('_DARK') ? '#29415E' : '#D5E2EE',
        'fill-extrusion-height': ['coalesce', ['to-number', ['get', 'render_height']], ['to-number', ['get', 'height']], 8],
        'fill-extrusion-base': ['coalesce', ['to-number', ['get', 'render_min_height']], ['to-number', ['get', 'min_height']], 0],
        'fill-extrusion-opacity': 0.82,
        'fill-extrusion-vertical-gradient': true,
      },
    }, labels?.id);
  }

  private remove3DBuildings() {
    if (this.map.getLayer('marshgo-buildings-3d')) this.map.removeLayer('marshgo-buildings-3d');
  }

  setRoute(points: Coordinate[]) {
    this.route = points;
    this.map.getContainer().dataset.marshgoRoutePointCount = String(points.length);
    const source = this.map.getSource('marshgo-route') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } });
  }
  setVehicle(point: Coordinate, heading?: number | null) {
    this.vehicle = point;
    if (typeof heading === 'number' && Number.isFinite(heading)) this.heading = heading;
    const source = this.map.getSource('marshgo-vehicle') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: point } });
    this.updateMarker(point);
    if (this.cameraMode === 'FOLLOW_HEADING' || this.cameraMode === 'FOLLOW') this.followCamera(900);
  }

  /** The driver's puck: a blue arrow that points where the car is heading, lying flat on the (tilted) road like in Apple Maps. */
  private updateMarker(point: Coordinate) {
    if (!this.marker) {
      const element = document.createElement('div');
      element.className = 'marshgo-puck';
      element.setAttribute('aria-hidden', 'true');
      element.innerHTML = '<span class="marshgo-puck__halo"></span><svg viewBox="0 0 40 40" class="marshgo-puck__arrow"><circle cx="20" cy="20" r="17" fill="#fff"/><circle cx="20" cy="20" r="13.5" fill="#1789F4"/><path d="M20 9 L28 28 L20 23.5 L12 28 Z" fill="#fff"/></svg>';
      this.marker = new maplibregl.Marker({ element, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(point).addTo(this.map);
    } else this.marker.setLngLat(point);
    this.marker.setRotation(this.heading ?? 0);
    this.map.getContainer().dataset.marshgoVehicleHeading = this.heading === null ? '' : String(Math.round(this.heading));
  }

  private setCameraModeInternal(mode: CameraMode) {
    this.cameraMode = mode;
    this.map.getContainer().dataset.marshgoCameraMode = mode;
    this.onCameraModeChange(mode);
  }

  /** Apple-Maps style follow camera: close zoom, tilted in 3D, map rotated to the driving direction, the car low on screen. */
  private followCamera(duration: number) {
    if (!this.vehicle) return;
    const { clientHeight } = this.map.getContainer();
    const tilt = this.layer === 'threeD' ? mapLayers.threeD.pitch : 0;
    this.map.easeTo({
      center: this.vehicle, zoom: Math.max(this.map.getZoom(), 17), pitch: tilt,
      bearing: this.heading ?? this.map.getBearing(),
      padding: { top: Math.round(clientHeight * 0.32), bottom: Math.round(clientHeight * 0.08), left: 0, right: 0 },
      duration, essential: true,
    });
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
    if (point) this.vehicle = point;
    if (!this.vehicle) { this.fitRoute(); return; }
    this.updateMarker(this.vehicle);
    this.setCameraModeInternal('FOLLOW_HEADING');
    this.followCamera(1100);
  }

  setLayer(layer: MapLayer) {
    if (layer === this.layer) return;
    if (layer !== 'threeD') this.remove3DBuildings();
    this.layer = layer;
    this.theme = this.themeForLayer(layer);
    const style = layer === 'satellite'
      ? this.styleUrls?.[this.themeForLayer('simple')] ?? styleForLayer(layer, configuredMapStyleUrl, this.theme.endsWith('_DARK'))
      : this.styleUrls?.[this.theme] ?? styleForLayer(layer, configuredMapStyleUrl, this.theme.endsWith('_DARK'));
    if (style) this.map.setStyle(style);
    else if (layer === 'satellite' && this.map.isStyleLoaded()) this.installSatelliteOverlay();
    else if (layer === 'simple') this.map.setStyle(this.map.getStyle());
    if (layer === 'threeD' && this.map.isStyleLoaded()) this.install3DBuildings();
    this.map.easeTo({ pitch: mapLayers[layer].pitch, duration: 700, essential: true });
  }
  /** 2D information layers (metro, buses, bikes, ...). Passing an empty set removes them and stops their polling. */
  setTransportLayers(layers: ReadonlySet<TransportLayerId>) {
    this.transportLayers = layers;
    if (layers.size === 0 && !this.transport) return;
    this.transport ??= new TransportLayerController(this.map, (message) => this.onTransportHint(message));
    this.transport.apply(layers);
  }
  focus(point: Coordinate, zoom = 13) { this.cameraMode = 'FREE'; this.map.easeTo({ center: point, zoom, duration: 600, essential: true }); }
  setCameraMode(mode: CameraMode) { this.setCameraModeInternal(mode); }
  setTheme(theme: MapTheme) {
    const nextTheme = this.themeForLayer(this.layer, theme);
    const changed = this.theme !== nextTheme;
    this.theme = nextTheme;
    const style = this.layer === 'satellite'
      ? this.styleUrls?.[this.themeForLayer('simple', theme)] ?? styleForLayer(this.layer, configuredMapStyleUrl, this.theme.endsWith('_DARK'))
      : this.styleUrls?.[this.theme];
    if (changed && style) { this.map.setStyle(style); return; }
    this.applySatellitePalette();
    if (!this.map.getLayer('marshgo-route')) return;
    const colors = mapStyleTokens[this.theme];
    this.map.setPaintProperty('marshgo-route-halo', 'line-color', colors.route);
    this.map.setPaintProperty('marshgo-route-casing', 'line-color', colors.routeCasing);
    this.map.setPaintProperty('marshgo-route', 'line-color', colors.route);
    this.map.setPaintProperty('marshgo-waypoints', 'circle-color', ['match', ['get', 'kind'], 'PICKUP', colors.pickup, 'DROPOFF', colors.dropoff, colors.route]);
    this.map.setPaintProperty('marshgo-waypoints', 'circle-stroke-color', colors.routeCasing);
    this.map.setPaintProperty('marshgo-vehicle-halo', 'circle-color', colors.vehicle);
    this.map.setPaintProperty('marshgo-vehicle', 'circle-color', colors.vehicle);
    this.map.setPaintProperty('marshgo-vehicle', 'circle-stroke-color', colors.routeCasing);
    if (this.map.getLayer('marshgo-buildings-3d')) this.map.setPaintProperty('marshgo-buildings-3d', 'fill-extrusion-color', this.theme.endsWith('_DARK') ? '#29415E' : '#D5E2EE');
    if (this.map.getLayer('marshgo-background')) this.map.setPaintProperty('marshgo-background', 'background-color', colors.background);
  }
  retry() { this.seenTileError = false; this.publish(this.basemapConfigured() ? 'loading' : 'unconfigured'); if (this.basemapConfigured()) this.map.setStyle(this.map.getStyle(), { diff: false }); else this.map.triggerRepaint(); }
  destroy() { this.marker?.remove(); this.transport?.destroy(); this.map.remove(); }
  getStatus() { return this.status; }
}
