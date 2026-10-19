import * as maplibregl from 'maplibre-gl';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import type { Coordinate } from '../../shared/navigation/contracts';
import type { CameraMode, ColoredRouteSegment, FocusedTransitMapOverlay, LiveTransitPosition, MapAdapter, MapStatus, MapTheme, RouteFitPadding, RouteWaypoint, ScreenPoint } from './MapAdapter';
import { mapStyleTokens } from './style/tokens';
import { Protocol } from 'pmtiles';
import type { FillLayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { isBasemapConfigured, PERSPECTIVE_PITCH, satelliteAttribution, satelliteTiles, styleForLayer, type MapLayer, type MapPerspective } from './mapMode';
import { TransportLayerController, type TransportLayerId } from './transportLayers';
import { getMapDisplayPreferences, type MapDisplayPreferences } from './mapLayerPreferences';
import { configuredMapStyleUrl } from './mapConfig';
import { journeySegmentsForFocus, visibleJourneyWaypoints } from './focusMode';
import { nearestRouteHitIds } from './routeHitTesting';

const pmtilesProtocol = new Protocol();
let pmtilesProtocolRegistered = false;

function transitGlyph(kind: 'bus' | 'tram' | 'trolleybus' | 'train' | 'minibus'): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return new ImageData(64, 64);
  context.fillStyle = '#FFFFFF';
  if (kind === 'tram') {
    context.fillRect(30, 5, 4, 11);
    context.fillRect(22, 12, 20, 3);
  } else if (kind === 'trolleybus') {
    context.fillRect(22, 3, 3, 15); context.fillRect(39, 3, 3, 15);
    context.beginPath(); context.moveTo(21, 5); context.lineTo(15, 1); context.lineTo(17, 0); context.lineTo(25, 4); context.fill();
    context.beginPath(); context.moveTo(41, 5); context.lineTo(49, 1); context.lineTo(47, 0); context.lineTo(39, 4); context.fill();
  } else if (kind === 'train') {
    context.fillRect(17, 6, 30, 38);
    context.fillRect(13, 13, 4, 25); context.fillRect(47, 13, 4, 25);
  } else if (kind === 'minibus') {
    context.fillRect(18, 11, 28, 31);
  } else {
    context.fillRect(15, 7, 34, 37);
  }
  context.fillStyle = '#0B2034';
  if (kind === 'train') {
    context.fillRect(22, 12, 20, 10); context.fillRect(22, 26, 20, 5);
  } else {
    context.fillRect(21, 13, 22, 10); context.fillRect(21, 27, 8, 7); context.fillRect(35, 27, 8, 7);
  }
  context.fillStyle = '#FFFFFF';
  context.beginPath(); context.arc(23, 46, 4, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.arc(41, 46, 4, 0, Math.PI * 2); context.fill();
  return context.getImageData(0, 0, 64, 64);
}

function transitIconName(transportType: string): string {
  const normalized = transportType.toLocaleLowerCase('en-US');
  if (normalized.includes('tram')) return 'marshgo-transit-tram';
  if (normalized.includes('trolley')) return 'marshgo-transit-trolleybus';
  if (normalized.includes('train') || normalized.includes('rail')) return 'marshgo-transit-train';
  if (normalized.includes('minibus') || normalized.includes('marshrutka')) return 'marshgo-transit-minibus';
  return 'marshgo-transit-bus';
}

export class MapLibreAdapter implements MapAdapter {
  private map: MapLibreMap;
  private status: MapStatus = 'loading';
  private route: Coordinate[] = [];
  private routeSegments: ColoredRouteSegment[] | null = null;
  private activeRouteSegmentId: string | null = null;
  private routeInteractionBound = false;
  private vehicle: Coordinate | null = null;
  private waypoints: RouteWaypoint[] = [];
  private cameraMode: CameraMode = 'OVERVIEW';
  private cameraRequestSequence = 0;
  private styleSwapSequence = 0;
  private theme: MapTheme = 'MARSHGO_LIGHT';
  private seenTileError = false;
  private layer: MapLayer = 'simple';
  private perspective: MapPerspective = '2d';
  private baseStyle: string | StyleSpecification;
  private transport: TransportLayerController | null = null;
  private transportDisplayPreferences: MapDisplayPreferences = getMapDisplayPreferences();
  private heading: number | null = null;
  private marker: maplibregl.Marker | null = null;
  private liveTransitMarker: maplibregl.Marker | null = null;
  private liveTransitElement: HTMLDivElement | null = null;
  private focusedTransitOverlay: FocusedTransitMapOverlay | null = null;
  /** Lets the UI highlight the "my location" button while the camera follows the driver. */
  onCameraModeChange: (mode: CameraMode) => void = () => undefined;
  onRouteSegmentSelect: (id: string) => void = () => undefined;
  onRouteSegmentAmbiguous?: (ids: string[], point: ScreenPoint) => void;
  private transportLayers: ReadonlySet<TransportLayerId> = new Set();
  /** Shown when a layer needs a closer zoom or fails to load. */
  onTransportHint: (message: string | null) => void = () => undefined;

  constructor(container: HTMLElement, style: string | StyleSpecification, private readonly onStatus: (status: MapStatus) => void, private readonly hasBasemap: boolean, private readonly styleUrls?: Partial<Record<MapTheme, string>>, initialTheme: MapTheme = 'MARSHGO_LIGHT') {
    this.theme = initialTheme;
    this.baseStyle = style;
    if (!pmtilesProtocolRegistered) { maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile); pmtilesProtocolRegistered = true; }
    maplibregl.setWorkerUrl(mapLibreWorkerUrl);
    container.dataset.marshgoMapRenderer = 'maplibre';
    container.dataset.marshgoMapIdle = 'false';
    container.dataset.marshgoCameraRequestId = '0';
    container.dataset.marshgoCameraSettledId = '0';
    container.dataset.marshgoCameraMoving = 'false';
    this.map = new maplibregl.Map({ container, style, logoPosition: 'bottom-left', center: [30.5234, 50.4501], zoom: 5, pitchWithRotate: true, dragRotate: true, touchPitch: true, cooperativeGestures: false });
    this.map.on('render', () => { container.dataset.marshgoMapIdle = 'false'; });
    this.map.on('resize', () => { container.dataset.marshgoMapIdle = 'false'; });
    this.map.on('idle', () => { container.dataset.marshgoMapIdle = 'true'; });
    this.map.on('movestart', () => { container.dataset.marshgoCameraMoving = 'true'; });
    this.map.on('moveend', () => {
      const center = this.map.getCenter();
      container.dataset.marshgoCameraZoom = this.map.getZoom().toFixed(2);
      container.dataset.marshgoCameraCenter = `${center.lng.toFixed(6)},${center.lat.toFixed(6)}`;
      container.dataset.marshgoCameraBearing = this.map.getBearing().toFixed(2);
      container.dataset.marshgoCameraSettledId = String(this.cameraRequestSequence);
      container.dataset.marshgoCameraMoving = 'false';
    });
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

  private markCameraRequest() {
    this.cameraRequestSequence += 1;
    this.map.getContainer().dataset.marshgoCameraRequestId = String(this.cameraRequestSequence);
  }

  private publish(status: MapStatus) { this.status = this.seenTileError && status === 'available' ? 'degraded' : status; this.onStatus(this.status); }
  private basemapConfigured() {
    return isBasemapConfigured(this.layer, this.hasBasemap, Boolean(satelliteTiles && satelliteAttribution));
  }
  private themeForLayer(layer: MapLayer, theme: MapTheme = this.theme): MapTheme {
    void layer;
    const dark = theme.endsWith('_DARK');
    return dark ? 'MARSHGO_DARK' : 'MARSHGO_LIGHT';
  }
  private installLayers() {
    const colors = mapStyleTokens[this.theme];
    this.map.getContainer().dataset.marshgoMapLayer = this.layer;
    if (this.layer === 'satellite') this.installSatelliteOverlay();
    if (this.perspective === '3d') this.install3DBuildings();
    else this.remove3DBuildings();
    if (!this.map.getSource('marshgo-route')) this.map.addSource('marshgo-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-vehicle')) this.map.addSource('marshgo-vehicle', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-waypoints')) this.map.addSource('marshgo-waypoints', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-transit-context')) this.map.addSource('marshgo-transit-context', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-transit-fleet')) this.map.addSource('marshgo-transit-fleet', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const transitImages = [
      ['marshgo-transit-bus', 'bus'], ['marshgo-transit-minibus', 'minibus'],
      ['marshgo-transit-tram', 'tram'], ['marshgo-transit-trolleybus', 'trolleybus'], ['marshgo-transit-train', 'train'],
    ] as const;
    for (const [name, kind] of transitImages) if (!this.map.hasImage(name)) this.map.addImage(name, transitGlyph(kind), { pixelRatio: 2 });
    const confirmedRouteFilter = ['!=', ['get', 'approximate'], true] as maplibregl.FilterSpecification;
    if (!this.map.getLayer('marshgo-transit-context')) this.map.addLayer({
      id: 'marshgo-transit-context', type: 'line', source: 'marshgo-transit-context',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'modeColor'], 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.5, 15, 5], 'line-opacity': 0.27 },
    });
    if (!this.map.getLayer('marshgo-route-halo')) this.map.addLayer({ id: 'marshgo-route-halo', type: 'line', source: 'marshgo-route', filter: confirmedRouteFilter, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['coalesce', ['get', 'modeColor'], colors.route], 'line-width': ['interpolate', ['linear'], ['zoom'], 5, ['case', ['==', ['get', 'selected'], true], 18, 10], 15, ['case', ['==', ['get', 'selected'], true], 34, 22]], 'line-opacity': ['case', ['==', ['get', 'selected'], true], 0.78, ['==', ['get', 'dimmed'], true], 0.035, 0.2], 'line-blur': 7 } });
    if (!this.map.getLayer('marshgo-route-casing')) this.map.addLayer({ id: 'marshgo-route-casing', type: 'line', source: 'marshgo-route', filter: confirmedRouteFilter, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colors.routeCasing, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, ['case', ['==', ['get', 'selected'], true], 8, 5], 15, ['case', ['==', ['get', 'selected'], true], 17, 13]], 'line-opacity': ['case', ['==', ['get', 'dimmed'], true], 0.34, 0.96] } });
    if (!this.map.getLayer('marshgo-route')) this.map.addLayer({ id: 'marshgo-route', type: 'line', source: 'marshgo-route', filter: confirmedRouteFilter, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['coalesce', ['get', 'modeColor'], colors.route], 'line-width': ['interpolate', ['linear'], ['zoom'], 5, ['case', ['==', ['get', 'selected'], true], 5.5, 3], 15, ['case', ['==', ['get', 'selected'], true], 12, 8]], 'line-opacity': ['case', ['==', ['get', 'dimmed'], true], 0.38, 1] } });
    if (!this.map.getLayer('marshgo-route-walking-estimate')) this.map.addLayer({
      id: 'marshgo-route-walking-estimate', type: 'line', source: 'marshgo-route',
      filter: ['==', ['get', 'approximate'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'modeColor'], '#91A6BB'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3, 15, 6],
        'line-opacity': ['case', ['==', ['get', 'dimmed'], true], 0.38, 0.9],
        'line-dasharray': [1.15, 1.8],
      },
    });
    // A separate transparent hit layer gives route segments a 44 px touch
    // target without altering their real geometry or visible line width.
    if (!this.map.getLayer('marshgo-route-hit-target')) this.map.addLayer({
      id: 'marshgo-route-hit-target', type: 'line', source: 'marshgo-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': 'rgba(0,0,0,0)', 'line-width': 44, 'line-opacity': 0.01 },
    });
    if (!this.routeInteractionBound && this.map.getLayer('marshgo-route-hit-target')) {
      this.routeInteractionBound = true;
      this.map.on('click', 'marshgo-route-hit-target', (event) => {
        const ids = [...new Set((event.features ?? []).flatMap(feature => {
          const id = feature.properties?.segmentId;
          return typeof id === 'string' && id.length > 0 ? [id] : [];
        }))];
        const candidates = ids.flatMap(id => {
          const segment = this.routeSegments?.find(item => item.id === id);
          return segment ? [{ id, coordinates: segment.coordinates }] : [];
        });
        const nearestIds = nearestRouteHitIds(event.point, candidates, coordinate => this.map.project(coordinate));
        if (nearestIds.length > 1 && this.onRouteSegmentAmbiguous) this.onRouteSegmentAmbiguous(nearestIds, event.point);
        else if (nearestIds[0]) this.onRouteSegmentSelect(nearestIds[0]);
      });
      this.map.on('mouseenter', 'marshgo-route-hit-target', () => { this.map.getCanvas().style.cursor = 'pointer'; });
      this.map.on('mouseleave', 'marshgo-route-hit-target', () => { this.map.getCanvas().style.cursor = ''; });
    }
    if (!this.map.getLayer('marshgo-waypoints')) this.map.addLayer({ id: 'marshgo-waypoints', type: 'circle', source: 'marshgo-waypoints', paint: { 'circle-radius': ['match', ['get', 'kind'], 'STOP', 4, 'TRANSFER', 6, 'SELF_LOCATION', 7, 'OTHER_LOCATION', 7, 8], 'circle-color': ['match', ['get', 'kind'], 'PICKUP', colors.pickup, 'DROPOFF', colors.dropoff, 'STOP', '#D6E4F3', 'TRANSFER', '#FFFFFF', 'SELF_LOCATION', '#0878F9', 'OTHER_LOCATION', '#8B5CF6', colors.route], 'circle-stroke-color': ['match', ['get', 'kind'], 'TRANSFER', '#1687FF', 'SELF_LOCATION', '#FFFFFF', 'OTHER_LOCATION', '#FFFFFF', colors.routeCasing], 'circle-stroke-width': ['match', ['get', 'kind'], 'STOP', 1.5, 'SELF_LOCATION', 2.5, 'OTHER_LOCATION', 2.5, 3] } });
    if (!this.map.getLayer('marshgo-transit-fleet-halo')) this.map.addLayer({
      id: 'marshgo-transit-fleet-halo', type: 'circle', source: 'marshgo-transit-fleet',
      paint: { 'circle-radius': ['case', ['==', ['get', 'emphasized'], true], 15, 8], 'circle-color': ['get', 'modeColor'],
        'circle-opacity': ['case', ['==', ['get', 'emphasized'], true], 0.42, 0.13], 'circle-blur': 0.35 },
    });
    if (!this.map.getLayer('marshgo-transit-fleet')) this.map.addLayer({
      id: 'marshgo-transit-fleet', type: 'circle', source: 'marshgo-transit-fleet',
      paint: { 'circle-radius': ['case', ['==', ['get', 'emphasized'], true], 13, 8], 'circle-color': ['get', 'modeColor'],
        'circle-opacity': ['case', ['==', ['get', 'emphasized'], true], 0.96, 0.44], 'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': ['case', ['==', ['get', 'emphasized'], true], 2.5, 1.25] },
    });
    if (!this.map.getLayer('marshgo-transit-fleet-icon')) this.map.addLayer({
      id: 'marshgo-transit-fleet-icon', type: 'symbol', source: 'marshgo-transit-fleet',
      layout: { 'icon-image': ['get', 'iconName'], 'icon-size': ['case', ['==', ['get', 'emphasized'], true], 0.38, 0.23],
        'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-opacity': ['case', ['==', ['get', 'emphasized'], true], 1, 0.58] },
    });
    if (!this.map.getLayer('marshgo-vehicle-halo')) this.map.addLayer({ id: 'marshgo-vehicle-halo', type: 'circle', source: 'marshgo-vehicle', paint: { 'circle-radius': 13, 'circle-color': colors.vehicle, 'circle-opacity': 0.2 } });
    if (!this.map.getLayer('marshgo-vehicle')) this.map.addLayer({ id: 'marshgo-vehicle', type: 'circle', source: 'marshgo-vehicle', paint: { 'circle-radius': 8, 'circle-color': colors.vehicle, 'circle-stroke-color': colors.routeCasing, 'circle-stroke-width': 3 } });
    // The DOM puck (rotating arrow) replaces the old circle dot; the source stays for consumers of its data.
    for (const id of ['marshgo-vehicle-halo', 'marshgo-vehicle']) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', 'none');
    this.transport?.reinstall();
    // The camera perspective is independent of the selected basemap.
    const desiredPitch = this.perspective === '3d' ? PERSPECTIVE_PITCH : 0;
    if (Math.abs(this.map.getPitch() - desiredPitch) > 1) this.map.easeTo({ pitch: desiredPitch, duration: 500, essential: true });
    this.updateRouteSource();
    this.updateFocusedTransitOverlay();
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
    if (this.perspective !== '3d' || !this.map.isStyleLoaded() || this.map.getLayer('marshgo-buildings-3d')) return;
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
    this.routeSegments = null;
    this.clearRouteSegmentDiagnostics();
    this.map.getContainer().dataset.marshgoRoutePointCount = String(points.length);
    this.map.getContainer().dataset.marshgoRouteSegmentCount = String(points.length >= 2 ? 1 : 0);
    this.updateRouteSource();
  }
  setRouteSegments(segments: ColoredRouteSegment[]) {
    this.routeSegments = segments.filter(segment => segment.coordinates.length >= 2);
    this.route = this.routeSegments.flatMap(segment => segment.coordinates);
    this.updateRouteSegmentDiagnostics();
    this.map.getContainer().dataset.marshgoRoutePointCount = String(this.route.length);
    this.map.getContainer().dataset.marshgoRouteSegmentCount = String(this.routeSegments.length);
    const activeColor = this.routeSegments.find(segment => segment.id === this.activeRouteSegmentId)?.modeColor;
    if (activeColor) this.map.getContainer().dataset.marshgoActiveRouteSegmentColor = activeColor;
    else delete this.map.getContainer().dataset.marshgoActiveRouteSegmentColor;
    this.updateRouteSource();
  }
  setActiveRouteSegment(id: string | null) {
    this.activeRouteSegmentId = id;
    const container = this.map.getContainer();
    const activeSegment = this.routeSegments?.find(segment => segment.id === id);
    if (id) {
      container.dataset.marshgoActiveRouteSegmentId = id;
      if (activeSegment) container.dataset.marshgoActiveRouteSegmentColor = activeSegment.modeColor;
      else delete container.dataset.marshgoActiveRouteSegmentColor;
    } else {
      delete container.dataset.marshgoActiveRouteSegmentId;
      delete container.dataset.marshgoActiveRouteSegmentColor;
    }
    this.updateRouteSegmentDiagnostics();
    this.updateRouteSource();
    this.updateWaypointsSource();
  }
  private updateRouteSegmentDiagnostics() {
    const segments = this.routeSegments;
    if (!segments) {
      this.clearRouteSegmentDiagnostics();
      return;
    }
    const mapSegments = journeySegmentsForFocus(segments, this.activeRouteSegmentId);
    const container = this.map.getContainer();
    container.dataset.marshgoSelectedRouteSegmentCount = String(mapSegments.filter(segment => segment.selected).length);
    container.dataset.marshgoDimmedRouteSegmentCount = String(mapSegments.filter(segment => segment.dimmed).length);
  }
  private clearRouteSegmentDiagnostics() {
    const container = this.map.getContainer();
    delete container.dataset.marshgoSelectedRouteSegmentCount;
    delete container.dataset.marshgoDimmedRouteSegmentCount;
  }
  focusRouteSegment(id: string, padding: RouteFitPadding = {}) {
    const segment = this.routeSegments?.find(item => item.id === id);
    if (!segment || segment.coordinates.length < 2) return false;
    this.cameraMode = 'FREE';
    this.map.getContainer().dataset.marshgoFocusedRouteSegmentId = id;
    this.fitCoordinates(segment.coordinates, padding, 17);
    return true;
  }
  focusCoordinates(points: Coordinate[], padding: RouteFitPadding = {}, maxZoom = 15) {
    if (points.length === 1) { this.focus(points[0], maxZoom); return; }
    this.cameraMode = 'FREE';
    this.fitCoordinates(points, padding, maxZoom);
  }
  private updateRouteSource() {
    const source = this.map.getSource('marshgo-route') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    if (this.routeSegments) {
      const mapSegments = journeySegmentsForFocus(this.routeSegments, this.activeRouteSegmentId);
      source.setData({ type: 'FeatureCollection', features: mapSegments.map(segment => ({
        type: 'Feature' as const,
        properties: { modeColor: segment.modeColor, segmentId: segment.id ?? '', approximate: segment.approximate === true,
          selected: segment.selected, dimmed: segment.dimmed },
        geometry: { type: 'LineString' as const, coordinates: segment.coordinates },
      })) });
      return;
    }
    source.setData({ type: 'Feature', properties: { selected: true, dimmed: false }, geometry: { type: 'LineString', coordinates: this.route } });
  }
  setVehicle(point: Coordinate, heading?: number | null) {
    this.vehicle = point;
    if (typeof heading === 'number' && Number.isFinite(heading)) this.heading = heading;
    const source = this.map.getSource('marshgo-vehicle') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: point } });
    this.updateMarker(point);
    if (this.cameraMode === 'FOLLOW_HEADING' || this.cameraMode === 'FOLLOW') this.followCamera(900);
  }

  /** A separate marker for an exact, timestamp-verified public-transport journey position. */
  setLiveTransitPosition(position: LiveTransitPosition | null) {
    if (!position) {
      this.liveTransitMarker?.remove();
      this.liveTransitMarker = null;
      this.liveTransitElement = null;
      delete this.map.getContainer().dataset.marshgoLiveTransitUpdatedAt;
      return;
    }
    if (!this.liveTransitElement) {
      this.liveTransitElement = document.createElement('div');
      this.liveTransitElement.className = 'marshgo-transit-live-marker';
      this.liveTransitElement.setAttribute('role', 'img');
      const dot = document.createElement('span');
      dot.setAttribute('aria-hidden', 'true');
      this.liveTransitElement.append(dot);
      this.liveTransitMarker = new maplibregl.Marker({ element: this.liveTransitElement, anchor: 'center' }).addTo(this.map);
    }
    this.liveTransitElement.setAttribute('aria-label', `${position.label}: GPS оновлено ${position.updatedAt}`);
    this.liveTransitElement.title = `${position.label} · GPS ${position.updatedAt}`;
    this.liveTransitElement.style.backgroundColor = position.color;
    this.liveTransitElement.style.border = '3px solid white';
    this.liveTransitElement.style.boxShadow = `0 0 0 3px ${position.color}66,0 0 20px ${position.color}cc`;
    Object.assign(this.liveTransitElement.style, { width: '30px', height: '30px', borderRadius: '50%', display: 'grid', placeItems: 'center' });
    const child = this.liveTransitElement.firstElementChild as HTMLElement | null;
    if (child) Object.assign(child.style, { width: '8px', height: '8px', borderRadius: '50%', background: '#fff' });
    this.liveTransitMarker?.setLngLat(position.coordinates);
    this.map.getContainer().dataset.marshgoLiveTransitUpdatedAt = position.updatedAt;
  }

  /** Draw the selected public-transit line context and its fresh fleet as batched GeoJSON. */
  setFocusedTransitOverlay(overlay: FocusedTransitMapOverlay | null) {
    this.focusedTransitOverlay = overlay;
    this.updateFocusedTransitOverlay();
  }

  private updateFocusedTransitOverlay() {
    const lineSource = this.map.getSource('marshgo-transit-context') as maplibregl.GeoJSONSource | undefined;
    const fleetSource = this.map.getSource('marshgo-transit-fleet') as maplibregl.GeoJSONSource | undefined;
    const overlay = this.focusedTransitOverlay;
    lineSource?.setData({ type: 'FeatureCollection', features: (overlay?.lineRoutes ?? []).filter(route => route.coordinates.length >= 2).map(route => ({
      type: 'Feature' as const,
      properties: { modeColor: overlay?.color ?? '#1687FF', direction: route.direction, routeId: route.id },
      geometry: { type: 'LineString' as const, coordinates: route.coordinates },
    })) });
    const iconName = transitIconName(overlay?.transportType ?? 'bus');
    fleetSource?.setData({ type: 'FeatureCollection', features: (overlay?.vehicles ?? []).filter(vehicle => vehicle.coordinates.every(Number.isFinite)).map(vehicle => ({
      type: 'Feature' as const,
      properties: { id: vehicle.id, modeColor: overlay?.color ?? '#1687FF', iconName, emphasized: vehicle.emphasized, updatedAt: vehicle.updatedAt },
      geometry: { type: 'Point' as const, coordinates: vehicle.coordinates },
    })) });
    const container = this.map.getContainer();
    container.dataset.marshgoTransitFleetCount = String(overlay?.vehicles.length ?? 0);
    container.dataset.marshgoTransitFleetEmphasizedCount = String(overlay?.vehicles.filter(vehicle => vehicle.emphasized).length ?? 0);
    container.dataset.marshgoTransitLineDirectionCount = String(overlay?.lineRoutes.length ?? 0);
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
    const tilt = this.perspective === '3d' ? PERSPECTIVE_PITCH : 0;
    this.markCameraRequest();
    this.map.easeTo({
      center: this.vehicle, zoom: Math.max(this.map.getZoom(), 17), pitch: tilt,
      bearing: this.heading ?? this.map.getBearing(),
      padding: { top: Math.round(clientHeight * 0.32), bottom: Math.round(clientHeight * 0.08), left: 0, right: 0 },
      duration, essential: true,
    });
  }
  setWaypoints(points: RouteWaypoint[]) {
    this.waypoints = points;
    this.updateWaypointsSource();
  }
  private updateWaypointsSource() {
    const source = this.map.getSource('marshgo-waypoints') as maplibregl.GeoJSONSource | undefined;
    const points = visibleJourneyWaypoints(this.waypoints, this.activeRouteSegmentId);
    source?.setData({ type: 'FeatureCollection', features: points.map(({ coordinate, kind, segmentIds }) => ({ type: 'Feature' as const, properties: { kind, segmentIds: segmentIds ?? [] }, geometry: { type: 'Point' as const, coordinates: coordinate } })) });
  }
  fitRoute(overrides: RouteFitPadding = {}) {
    const points = this.route.length >= 2 ? this.route : this.waypoints.map(point => point.coordinate);
    if (points.length === 0) return;
    delete this.map.getContainer().dataset.marshgoFocusedRouteSegmentId;
    if (points.length === 1) { this.focus(points[0], 14); return; }
    this.cameraMode = 'OVERVIEW';
    this.fitCoordinates(points, overrides, 15);
  }
  private fitCoordinates(points: Coordinate[], overrides: RouteFitPadding, maxZoom: number) {
    const lngs = points.map((point) => point[0]); const lats = points.map((point) => point[1]);
    // Full-screen navigation reserves room for its overlays; small previews must scale the padding down or MapLibre rejects the fit.
    const { clientWidth, clientHeight } = this.map.getContainer();
    const top = Math.min(clientHeight * 0.25, overrides.top ?? Math.min(110, clientHeight * 0.2));
    const padding = {
      top,
      right: Math.min(clientWidth * 0.15, overrides.right ?? Math.min(32, clientWidth * 0.1)),
      // Overlay sheets can cover more than half of a route screen. Honor the
      // requested safe-area while keeping MapLibre's combined vertical padding
      // strictly smaller than the viewport.
      bottom: Math.min(Math.max(0, clientHeight - top - 1), overrides.bottom ?? Math.min(270, clientHeight * 0.2)),
      left: Math.min(clientWidth * 0.15, overrides.left ?? Math.min(32, clientWidth * 0.1)),
    };
    this.markCameraRequest();
    this.map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
      padding,
      duration: 520,
      maxZoom,
      ...(typeof overrides.bearing === 'number' && Number.isFinite(overrides.bearing) ? { bearing: overrides.bearing } : {}),
    });
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
    this.layer = layer;
    this.theme = this.themeForLayer(layer);
    const style = this.styleUrls?.[this.theme] ?? styleForLayer(layer, configuredMapStyleUrl, this.theme.endsWith('_DARK')) ?? this.baseStyle;
    this.baseStyle = style;
    // A full style swap also removes custom sources/layers such as satellite imagery;
    // installLayers() restores route, transport, vehicle and rental overlays afterwards.
    const center = this.map.getCenter();
    const camera = { center: [center.lng, center.lat] as [number, number], zoom: this.map.getZoom(), bearing: this.map.getBearing(), pitch: this.map.getPitch(), padding: this.map.getPadding() };
    const styleSwap = ++this.styleSwapSequence;
    this.map.once('style.load', () => {
      if (styleSwap !== this.styleSwapSequence) return;
      if ((this.cameraMode === 'FOLLOW' || this.cameraMode === 'FOLLOW_HEADING') && this.vehicle) {
        this.map.jumpTo({
          ...camera,
          center: this.vehicle,
          zoom: Math.max(camera.zoom, 17),
          bearing: this.heading ?? camera.bearing,
          pitch: this.perspective === '3d' ? PERSPECTIVE_PITCH : 0,
        });
        return;
      }
      this.map.jumpTo(camera);
    });
    this.map.setStyle(style, { diff: false });
  }
  setPerspective(perspective: MapPerspective) {
    if (perspective === this.perspective) return;
    this.perspective = perspective;
    if (perspective === '2d') this.remove3DBuildings();
    else this.install3DBuildings();
    this.map.easeTo({ pitch: perspective === '3d' ? PERSPECTIVE_PITCH : 0, duration: 500, essential: true });
  }
  /** 2D information layers (metro, buses, bikes, ...). Passing an empty set removes them and stops their polling. */
  setTransportLayers(layers: ReadonlySet<TransportLayerId>) {
    this.transportLayers = layers;
    if (layers.size === 0 && !this.transport) return;
    this.transport ??= new TransportLayerController(this.map, (message) => this.onTransportHint(message), this.transportDisplayPreferences);
    this.transport.apply(layers);
  }
  setTransportDisplayPreferences(preferences: MapDisplayPreferences) {
    this.transportDisplayPreferences = preferences;
    this.transport?.setDisplayPreferences(preferences);
  }
  focus(point: Coordinate, zoom = 13) { this.cameraMode = 'FREE'; this.markCameraRequest(); this.map.easeTo({ center: point, zoom, duration: 600, essential: true }); }
  setCameraMode(mode: CameraMode) { this.setCameraModeInternal(mode); }
  setTheme(theme: MapTheme) {
    const nextTheme = this.themeForLayer(this.layer, theme);
    const changed = this.theme !== nextTheme;
    this.theme = nextTheme;
    const style = this.styleUrls?.[this.theme] ?? (configuredMapStyleUrl ? styleForLayer(this.layer, configuredMapStyleUrl, this.theme.endsWith('_DARK')) : null);
    if (changed && style) { this.baseStyle = style; this.map.setStyle(style); return; }
    this.applySatellitePalette();
    const colors = mapStyleTokens[this.theme];
    if (this.map.getLayer('marshgo-background')) this.map.setPaintProperty('marshgo-background', 'background-color', colors.background);
    if (!this.map.getLayer('marshgo-route')) return;
    this.map.setPaintProperty('marshgo-route-halo', 'line-color', ['coalesce', ['get', 'modeColor'], colors.route]);
    this.map.setPaintProperty('marshgo-route-casing', 'line-color', colors.routeCasing);
    this.map.setPaintProperty('marshgo-route', 'line-color', ['coalesce', ['get', 'modeColor'], colors.route]);
    this.map.setPaintProperty('marshgo-waypoints', 'circle-color', ['match', ['get', 'kind'], 'PICKUP', colors.pickup, 'DROPOFF', colors.dropoff, 'SELF_LOCATION', '#0878F9', 'OTHER_LOCATION', '#8B5CF6', colors.route]);
    this.map.setPaintProperty('marshgo-waypoints', 'circle-stroke-color', colors.routeCasing);
    this.map.setPaintProperty('marshgo-vehicle-halo', 'circle-color', colors.vehicle);
    this.map.setPaintProperty('marshgo-vehicle', 'circle-color', colors.vehicle);
    this.map.setPaintProperty('marshgo-vehicle', 'circle-stroke-color', colors.routeCasing);
    if (this.map.getLayer('marshgo-buildings-3d')) this.map.setPaintProperty('marshgo-buildings-3d', 'fill-extrusion-color', this.theme.endsWith('_DARK') ? '#29415E' : '#D5E2EE');
    if (this.map.getLayer('marshgo-background')) this.map.setPaintProperty('marshgo-background', 'background-color', colors.background);
  }
  retry() { this.seenTileError = false; this.publish(this.basemapConfigured() ? 'loading' : 'unconfigured'); if (this.basemapConfigured()) this.map.setStyle(this.map.getStyle(), { diff: false }); else this.map.triggerRepaint(); }
  destroy() {
    this.marker?.remove();
    this.liveTransitMarker?.remove();
    this.transport?.destroy();
    this.map.remove();
  }
  getStatus() { return this.status; }
}
