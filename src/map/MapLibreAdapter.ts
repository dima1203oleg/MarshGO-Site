import * as maplibregl from 'maplibre-gl';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import type { Coordinate } from '../../shared/navigation/contracts';
import type { CameraMode, ColoredRouteSegment, FocusedTransitMapOverlay, LiveTransitPosition, MapAdapter, MapAnnotation, MapStatus, MapTheme, RouteFitPadding, RouteWaypoint, ScreenPoint } from './MapAdapter';
import { transitDirectionOffsetPx } from './MapAdapter';
import { mapStyleTokens } from './style/tokens';
import { Protocol } from 'pmtiles';
import type { ExpressionSpecification, FillLayerSpecification, LineLayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { STOP_DETAIL_MIN_ZOOM, VEHICLE_PRIORITY_TOKENS, ZONE_GLOW_TOKENS, ZONE_LINE_TOKENS, priorityLevelOf, zoneArrowsFor, passengerZoneFeaturesFor, type TransitZone, type VehiclePriorityLevel } from './transportVisualZones';
import { isBasemapConfigured, PERSPECTIVE_PITCH, satelliteAttribution, satelliteTiles, styleForLayer, type MapLayer, type MapPerspective } from './mapMode';
import { TransportLayerController, type TransportLayerId } from './transportLayers';
import { getMapDisplayPreferences, type MapDisplayPreferences } from './mapLayerPreferences';
import { configuredMapDarkStyleUrl, configuredMapStyleUrl } from './mapConfig';
import { journeySegmentsForFocus, visibleJourneyWaypoints } from './focusMode';
import { nearestRouteHitIds } from './routeHitTesting';
import { placeJourneyLabels } from './routeLabelPlacement';
import { cameraEasing, cameraMotionDuration, adaptiveCameraDuration, CAMERA_FOCUS_DURATION_MS, CAMERA_ZOOM_STEP_DURATION_MS, claimCameraForUserGesture } from './cameraMotion';
import { ROUTE_EMPHASIS_TOKENS, ROUTE_RENDER_TOKENS, SEGMENT_REVEAL_TOKENS, routeArrowExpression, routeStrokeWidthExpression, walkGeometryTokens, walkWidthExpression, ROUTE_ARROW_TOKENS } from './routeGeometryTokens';
import { measureProjectedFocus } from './routeFocusMeasurement';
import { cameraForRotatedPoints, cameraMoveEffort } from './routeCameraFocus';
import { shouldGlideVehicle, interpolateVehicleCoordinate, vehicleDistanceMeters, vehicleGlideDuration } from './vehicleMotion';
import { isValidCoordinate, sanitizeLineCoordinates } from './lineGeometry';

const pmtilesProtocol = new Protocol();
let pmtilesProtocolRegistered = false;

function transitGlyph(kind: 'bus' | 'tram' | 'trolleybus' | 'train' | 'minibus'): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new ImageData(64, 64);

  ctx.clearRect(0, 0, 64, 64);
  ctx.save();

  // Helper for rounded rectangles with fallback
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  };

  if (kind === 'tram') {
    // Pantograph
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(32, 14); ctx.lineTo(32, 9);
    ctx.moveTo(22, 9); ctx.lineTo(42, 9);
    ctx.moveTo(27, 9); ctx.lineTo(32, 4); ctx.lineTo(37, 9);
    ctx.stroke();

    // Body
    ctx.fillStyle = '#FFFFFF';
    roundRect(16, 15, 32, 38, 7);
    ctx.fill();

    // Front Windshield
    ctx.fillStyle = '#0B2034';
    roundRect(20, 20, 24, 12, 3);
    ctx.fill();

    // Side windows / headlights
    ctx.fillStyle = '#0B2034';
    roundRect(20, 36, 10, 6, 2);
    roundRect(34, 36, 10, 6, 2);

    // Front headlights
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(22, 47, 2.5, 0, Math.PI * 2);
    ctx.arc(42, 47, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'trolleybus') {
    // Trolley poles
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(28, 14); ctx.lineTo(16, 3);
    ctx.moveTo(36, 14); ctx.lineTo(48, 3);
    ctx.stroke();

    // Body
    ctx.fillStyle = '#FFFFFF';
    roundRect(16, 15, 32, 38, 7);
    ctx.fill();

    // Front Windshield
    ctx.fillStyle = '#0B2034';
    roundRect(20, 20, 24, 13, 3);
    ctx.fill();

    // Route number indicator
    ctx.fillStyle = '#327FC3';
    roundRect(26, 16, 12, 3, 1.5);
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(22, 47, 2.5, 0, Math.PI * 2);
    ctx.arc(42, 47, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Bumper
    ctx.fillStyle = '#0B2034';
    roundRect(24, 46, 16, 3, 1.5);
    ctx.fill();
  } else if (kind === 'train') {
    // Train body with aerodynamic roof
    ctx.fillStyle = '#FFFFFF';
    roundRect(17, 12, 30, 42, 8);
    ctx.fill();

    // Aerodynamic windshield
    ctx.fillStyle = '#0B2034';
    roundRect(21, 18, 22, 12, 4);
    ctx.fill();

    // Train stripes / grill
    ctx.fillStyle = '#E11D48';
    roundRect(21, 34, 22, 4, 1);
    ctx.fill();

    // High beam & lower headlights
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(32, 15, 2, 0, Math.PI * 2);
    ctx.arc(23, 46, 2.5, 0, Math.PI * 2);
    ctx.arc(41, 46, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'minibus') {
    // Minibus / Marshrutka: slightly more compact and rounded
    ctx.fillStyle = '#FFFFFF';
    roundRect(18, 16, 28, 36, 6);
    ctx.fill();

    // Windshield
    ctx.fillStyle = '#0B2034';
    roundRect(21, 21, 22, 11, 2.5);
    ctx.fill();

    // Yellow route display
    ctx.fillStyle = '#F59E0B';
    roundRect(25, 17, 14, 3, 1);
    ctx.fill();

    // Headlights & bumper
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(23, 46, 2.2, 0, Math.PI * 2);
    ctx.arc(41, 46, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0B2034';
    roundRect(26, 45, 12, 3, 1);
    ctx.fill();
  } else {
    // Standard City Bus
    ctx.fillStyle = '#FFFFFF';
    roundRect(16, 14, 32, 40, 7);
    ctx.fill();

    // Windshield
    ctx.fillStyle = '#0B2034';
    roundRect(20, 20, 24, 14, 3);
    ctx.fill();

    // Route display board
    ctx.fillStyle = '#10B981';
    roundRect(24, 15, 16, 3.5, 1.5);
    ctx.fill();

    // Headlights & bumper
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(21, 47, 2.5, 0, Math.PI * 2);
    ctx.arc(43, 47, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0B2034';
    roundRect(25, 46, 14, 3, 1.5);
    ctx.fill();
  }

  ctx.restore();
  return ctx.getImageData(0, 0, 64, 64);
}

function transitIconName(transportType: string): string {
  const normalized = transportType.toLocaleLowerCase('en-US');
  if (normalized.includes('tram')) return 'marshgo-transit-tram';
  if (normalized.includes('trolley')) return 'marshgo-transit-trolleybus';
  if (normalized.includes('train') || normalized.includes('rail')) return 'marshgo-transit-train';
  if (normalized.includes('minibus') || normalized.includes('marshrutka')) return 'marshgo-transit-minibus';
  return 'marshgo-transit-bus';
}

/** A north-pointing chevron; the layer rotates it by the real travel bearing of the geometry. */
function zoneArrowGlyph(): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = 44; canvas.height = 44;
  const context = canvas.getContext('2d');
  if (!context) return new ImageData(44, 44);
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(22, 9); context.lineTo(33, 27); context.lineTo(22, 21); context.lineTo(11, 27);
  context.closePath();
  context.lineWidth = 7;
  context.strokeStyle = '#0B2034';
  context.stroke();
  context.fillStyle = '#FFFFFF';
  context.fill();
  return context.getImageData(0, 0, 44, 44);
}

function priorityExpression(key: 'radius' | 'haloRadius' | 'opacity' | 'haloOpacity' | 'iconSize'): ExpressionSpecification {
  const value = (level: VehiclePriorityLevel) => VEHICLE_PRIORITY_TOKENS[level][key];
  return ['match', ['get', 'priorityLevel'],
    'L0', value('L0'), 'L1', value('L1'), 'L2', value('L2'), 'L3', value('L3'), 'L4', value('L4'),
    value('L1')] as unknown as ExpressionSpecification;
}

export class MapLibreAdapter implements MapAdapter {
  private map: MapLibreMap;
  private status: MapStatus = 'loading';
  private route: Coordinate[] = [];
  private routeSegments: ColoredRouteSegment[] | null = null;
  private activeRouteSegmentId: string | null = null;
  /** The reveal layers fade out in place; the next reveal must restore their opacity first. */
  private revealFaded = false;
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
  private liveTransitPrev: { coordinates: Coordinate; updatedAt: string } | null = null;
  private liveTransitGlideRaf: number | null = null;
  private journeyLabelMarkers = new Map<string, { marker: maplibregl.Marker; key: string }>();
  /** Last label feed; placement is recomputed from it whenever the camera settles. */
  private journeyLabelInput: MapAnnotation[] = [];
  private focusedTransitOverlay: FocusedTransitMapOverlay | null = null;
  /** Coordinates of the last camera fit, measured against the visible band after each settle. */
  private lastFitPoints: Coordinate[] = [];
  /** MapLibre's fitBounds consumes and drops its padding, so the intended band is recorded here. */
  private lastFitPadding: { top: number; right: number; bottom: number; left: number } = { top: 0, right: 0, bottom: 0, left: 0 };
  /** Lets the UI highlight the "my location" button while the camera follows the driver. */
  onCameraModeChange: (mode: CameraMode) => void = () => undefined;
  /** Trackpad and mouse-wheel input never arrives with an originalEvent on a camera event. */
  private readonly wheelGestureListener = () => { this.setCameraModeInternal('FREE'); };
  onRouteSegmentSelect: (id: string) => void = () => undefined;
  onRouteSegmentAmbiguous?: (ids: string[], point: ScreenPoint) => void;
  onCameraMove?: () => void;
  private transportLayers: ReadonlySet<TransportLayerId> = new Set();
  /** Shown when a layer needs a closer zoom or fails to load. */
  onTransportHint: (message: string | null) => void = () => undefined;

  constructor(container: HTMLElement, style: string | StyleSpecification, private readonly onStatus: (status: MapStatus) => void, private readonly hasBasemap: boolean, private readonly styleUrls?: Partial<Record<MapTheme, string | StyleSpecification>>, initialTheme: MapTheme = 'MARSHGO_LIGHT') {
    this.theme = initialTheme;
    this.baseStyle = style;
    if (!pmtilesProtocolRegistered) { maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile); pmtilesProtocolRegistered = true; }
    maplibregl.setWorkerUrl(mapLibreWorkerUrl);
    container.dataset.marshgoMapRenderer = 'maplibre';
    container.dataset.marshgoMapIdle = 'false';
    container.dataset.marshgoCameraRequestId = '0';
    container.dataset.marshgoCameraSettledId = '0';
    container.dataset.marshgoCameraMoving = 'false';
    // Phones with dpr 2.5–3 shade 6–9× the pixels of a dpr-2 frame; the extra
    // sharpness is invisible under a map, the GPU cost is not.
    const pixelRatio = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2);
    this.map = new maplibregl.Map({ container, style, logoPosition: 'bottom-left', attributionControl: { compact: true }, center: [30.5234, 50.4501], zoom: 5, dragPan: true, touchZoomRotate: true, pitchWithRotate: true, dragRotate: true, touchPitch: true, cooperativeGestures: false, pixelRatio });
    // MapLibre opens the compact attribution until the first drag, and the credit
    // only appears once the style/sources arrive. Collapse it as soon as those
    // land (idempotent); tapping the ⓘ still reveals the full attribution.
    const collapseAttribution = () => {
      container.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show');
    };
    // Every style/source update can repopulate the credit and re-open the bar,
    // so follow those events until the first idle, then stop listening and let
    // the user toggle it freely.
    this.map.on('styledata', collapseAttribution);
    this.map.on('sourcedata', collapseAttribution);
    this.map.once('idle', () => {
      collapseAttribution();
      this.map.off('styledata', collapseAttribution);
      this.map.off('sourcedata', collapseAttribution);
    });
    this.map.on('render', () => { container.dataset.marshgoMapIdle = 'false'; });
    this.map.on('resize', () => { container.dataset.marshgoMapIdle = 'false'; });
    this.map.on('idle', () => { container.dataset.marshgoMapIdle = 'true'; });
    this.map.on('movestart', () => { container.dataset.marshgoCameraMoving = 'true'; });
    this.map.on('move', () => { this.onCameraMove?.(); });
    this.map.on('moveend', () => {
      const center = this.map.getCenter();
      container.dataset.marshgoCameraZoom = this.map.getZoom().toFixed(2);
      container.dataset.marshgoCameraCenter = `${center.lng.toFixed(6)},${center.lat.toFixed(6)}`;
      container.dataset.marshgoCameraBearing = this.map.getBearing().toFixed(2);
      const pad = this.map.getPadding();
      container.dataset.marshgoCameraPadding = `${pad.top},${pad.right},${pad.bottom},${pad.left}`;
      container.dataset.marshgoCameraSettledId = String(this.cameraRequestSequence);
      container.dataset.marshgoCameraMoving = 'false';
      this.publishFocusMeasure();
    });
    // Callout de-cluttering lives in screen space, so a zoom or pan changes which
    // labels compete for it. Recompute once per camera settle — never per frame;
    // the id-keyed reconciliation below keeps existing DOM nodes untouched.
    this.map.on('moveend', () => { if (this.journeyLabelInput.length) this.applyJourneyLabels(); });
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
    const userGesture = (event: { originalEvent?: unknown }) => {
      // Ownership only: MapLibre cancels an in-flight focus glide itself the moment a handler becomes
      // active, and a map.stop() here would reset the pinch and delete the flick's momentum.
      claimCameraForUserGesture(event.originalEvent, () => this.setCameraModeInternal('FREE'));
    };
    this.map.on('dragstart', userGesture);
    this.map.on('zoomstart', userGesture);
    this.map.on('rotatestart', userGesture);
    this.map.on('pitchstart', userGesture);
    // Scroll zoom fires its camera events without an originalEvent, so a trackpad would read as one
    // of our own animations. The DOM wheel is unambiguously the rider's input.
    container.addEventListener('wheel', this.wheelGestureListener, { passive: true });
  }

  private markCameraRequest() {
    this.cameraRequestSequence += 1;
    this.map.getContainer().dataset.marshgoCameraRequestId = String(this.cameraRequestSequence);
  }

  /**
   * Publishes the projected last-fit geometry against the padded (visible) map
   * rect, so acceptance can assert "the focused object is actually on screen"
   * instead of trusting the padding numbers alone.
   */
  private publishFocusMeasure() {
    const container = this.map.getContainer();
    if (this.lastFitPoints.length === 0) {
      delete container.dataset.marshgoFocusMeasure;
      return;
    }
    const { clientWidth, clientHeight } = container;
    const { top, right, bottom, left } = this.lastFitPadding;
    const rect = {
      left,
      top,
      right: clientWidth - right,
      bottom: clientHeight - bottom,
    };
    const measure = measureProjectedFocus(this.lastFitPoints.map(point => this.map.project(point)), rect);
    container.dataset.marshgoFocusMeasure = JSON.stringify({
      ...measure,
      rect,
      viewport: { width: clientWidth, height: clientHeight },
      requestId: this.cameraRequestSequence,
    });
  }

  private motionDuration(durationMs: number): number {
    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return cameraMotionDuration(durationMs, reducedMotion);
  }

  /** Distance/zoom/turn-aware glide so a short hop snaps and a cross-city move glides (ТЗ §7). */
  private glideDuration(baseMs: number, target: { center?: Coordinate; zoom?: number; bearing?: number } = {}): number {
    const center = this.map.getCenter();
    const effort = cameraMoveEffort(
      { center: [center.lng, center.lat], zoom: this.map.getZoom(), bearing: this.map.getBearing() },
      target,
    );
    return this.motionDuration(adaptiveCameraDuration(baseMs, effort));
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
    const walk = walkGeometryTokens(this.theme);
    this.map.getContainer().dataset.marshgoMapLayer = this.layer;
    if (this.layer === 'satellite') this.installSatelliteOverlay();
    if (this.perspective === '3d') this.install3DBuildings();
    else this.remove3DBuildings();
    if (!this.map.getSource('marshgo-route')) this.map.addSource('marshgo-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-route-reveal')) this.map.addSource('marshgo-route-reveal', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-route-reveal-head')) this.map.addSource('marshgo-route-reveal-head', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-vehicle')) this.map.addSource('marshgo-vehicle', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-waypoints')) this.map.addSource('marshgo-waypoints', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-transit-context')) this.map.addSource('marshgo-transit-context', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-transit-fleet')) this.map.addSource('marshgo-transit-fleet', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-transit-zones')) this.map.addSource('marshgo-transit-zones', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getSource('marshgo-transit-zone-arrows')) this.map.addSource('marshgo-transit-zone-arrows', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const transitImages = [
      ['marshgo-transit-bus', 'bus'], ['marshgo-transit-minibus', 'minibus'],
      ['marshgo-transit-tram', 'tram'], ['marshgo-transit-trolleybus', 'trolleybus'], ['marshgo-transit-train', 'train'],
    ] as const;
    for (const [name, kind] of transitImages) if (!this.map.hasImage(name)) this.map.addImage(name, transitGlyph(kind), { pixelRatio: 2 });
    if (!this.map.hasImage('marshgo-zone-arrow')) this.map.addImage('marshgo-zone-arrow', zoneArrowGlyph(), { pixelRatio: 2 });
    if (!this.map.hasImage('marshgo-route-arrow')) this.map.addImage('marshgo-route-arrow', zoneArrowGlyph(), { pixelRatio: 2 });
    const confirmedRouteFilter = ['all', ['!=', ['get', 'approximate'], true], ['!=', ['get', 'isWalk'], true]] as maplibregl.FilterSpecification;
    if (!this.map.getLayer('marshgo-transit-context')) this.map.addLayer({
      id: 'marshgo-transit-context', type: 'line', source: 'marshgo-transit-context',
      // A line whose zones are known is drawn by the zone layers instead, so the
      // same geometry never gets two overlapping strokes.
      filter: ['!=', ['get', 'hasZones'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'modeColor'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.5, 15, 5],
        'line-opacity': 0.32,
        // Separate opposing directions at screen scale. Keep the provider's
        // geographic coordinates untouched; the selected itinerary stays centered.
        'line-offset': ['get', 'directionOffsetPx'],
      },
    });
    const zoneLineLayer = (id: string, zone: TransitZone): LineLayerSpecification => ({
      id, type: 'line', source: 'marshgo-transit-zones',
      filter: ['==', ['get', 'zone'], zone],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'modeColor'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, ZONE_LINE_TOKENS[zone].width[0], 15, ZONE_LINE_TOKENS[zone].width[1]],
        'line-opacity': ZONE_LINE_TOKENS[zone].opacity,
        'line-offset': ['get', 'directionOffsetPx'],
      },
    });
    if (!this.map.getLayer('marshgo-transit-zone-before')) this.map.addLayer(zoneLineLayer('marshgo-transit-zone-before', 'A'));
    if (!this.map.getLayer('marshgo-transit-zone-after')) this.map.addLayer(zoneLineLayer('marshgo-transit-zone-after', 'C'));
    if (!this.map.getLayer('marshgo-transit-zone-ride-glow')) this.map.addLayer({
      id: 'marshgo-transit-zone-ride-glow', type: 'line', source: 'marshgo-transit-zones',
      filter: ['==', ['get', 'zone'], 'B'] as maplibregl.FilterSpecification,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'modeColor'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, ZONE_GLOW_TOKENS.width[0], 15, ZONE_GLOW_TOKENS.width[1]],
        'line-opacity': ZONE_GLOW_TOKENS.opacity,
        'line-blur': ZONE_GLOW_TOKENS.blur,
        'line-offset': ['get', 'directionOffsetPx'],
      },
    });
    if (!this.map.getLayer('marshgo-route-halo')) this.map.addLayer({
      id: 'marshgo-route-halo',
      type: 'line',
      source: 'marshgo-route',
      filter: confirmedRouteFilter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'modeColor'], colors.route],
        'line-width': routeStrokeWidthExpression('halo'),
        'line-opacity': ['case', ['==', ['get', 'selected'], true], ROUTE_EMPHASIS_TOKENS.haloOpacity.selected, ['==', ['get', 'dimmed'], true], ROUTE_EMPHASIS_TOKENS.haloOpacity.dimmed, ROUTE_EMPHASIS_TOKENS.haloOpacity.normal],
        'line-blur': ROUTE_RENDER_TOKENS.haloBlur,
      },
    });
    if (!this.map.getLayer('marshgo-route-casing')) this.map.addLayer({
      id: 'marshgo-route-casing',
      type: 'line',
      source: 'marshgo-route',
      filter: confirmedRouteFilter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.routeCasing,
        'line-width': routeStrokeWidthExpression('casing'),
        'line-opacity': ['case', ['==', ['get', 'dimmed'], true], ROUTE_EMPHASIS_TOKENS.casingOpacity.dimmed, ROUTE_EMPHASIS_TOKENS.casingOpacity.normal],
      },
    });
    if (!this.map.getLayer('marshgo-route')) this.map.addLayer({
      id: 'marshgo-route',
      type: 'line',
      source: 'marshgo-route',
      filter: confirmedRouteFilter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'modeColor'], colors.route],
        'line-width': routeStrokeWidthExpression('core'),
        'line-opacity': ['case', ['==', ['get', 'dimmed'], true], ROUTE_EMPHASIS_TOKENS.dimmedOpacity, 1.0],
      },
    });
    // Direction chevrons ride the selected confirmed transit leg only; walking
    // keeps its dashed trail and dimmed siblings stay arrow-free.
    if (!this.map.getLayer('marshgo-route-arrows')) this.map.addLayer({
      id: 'marshgo-route-arrows', type: 'symbol', source: 'marshgo-route',
      filter: ['all', ['==', ['get', 'selected'], true], ['!=', ['get', 'isWalk'], true], ['!=', ['get', 'approximate'], true]] as maplibregl.FilterSpecification,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': routeArrowExpression('spacing'),
        'icon-image': 'marshgo-route-arrow',
        'icon-size': routeArrowExpression('size'),
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-opacity': ROUTE_ARROW_TOKENS.opacity },
    });
    if (!this.map.getLayer('marshgo-route-reveal-glow')) this.map.addLayer({
      id: 'marshgo-route-reveal-glow',
      type: 'line',
      source: 'marshgo-route-reveal',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'modeColor'], colors.route],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, ROUTE_RENDER_TOKENS.revealGlowWidth[0], 15, ROUTE_RENDER_TOKENS.revealGlowWidth[1]],
        'line-opacity': ROUTE_RENDER_TOKENS.revealGlowOpacity,
        'line-opacity-transition': { duration: SEGMENT_REVEAL_TOKENS.fadeMs },
        'line-blur': ROUTE_RENDER_TOKENS.revealGlowBlur,
      },
    });
    if (!this.map.getLayer('marshgo-route-reveal-core')) this.map.addLayer({
      id: 'marshgo-route-reveal-core',
      type: 'line',
      source: 'marshgo-route-reveal',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, ROUTE_RENDER_TOKENS.revealCoreWidth[0], 15, ROUTE_RENDER_TOKENS.revealCoreWidth[1]],
        'line-opacity': 0.95,
        'line-opacity-transition': { duration: SEGMENT_REVEAL_TOKENS.fadeMs },
      },
    });
    if (!this.map.getLayer('marshgo-route-reveal-head-glow')) this.map.addLayer({
      id: 'marshgo-route-reveal-head-glow',
      type: 'circle',
      source: 'marshgo-route-reveal-head',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, ROUTE_RENDER_TOKENS.revealHeadHaloRadius[0], 15, ROUTE_RENDER_TOKENS.revealHeadHaloRadius[1]],
        'circle-color': ['coalesce', ['get', 'modeColor'], colors.route],
        'circle-blur': 0.6,
        'circle-opacity': 0.85,
        'circle-opacity-transition': { duration: SEGMENT_REVEAL_TOKENS.fadeMs },
      },
    });
    if (!this.map.getLayer('marshgo-route-reveal-head-core')) this.map.addLayer({
      id: 'marshgo-route-reveal-head-core',
      type: 'circle',
      source: 'marshgo-route-reveal-head',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, ROUTE_RENDER_TOKENS.revealHeadCoreRadius[0], 15, ROUTE_RENDER_TOKENS.revealHeadCoreRadius[1]],
        'circle-color': '#FFFFFF',
        'circle-opacity': 1,
        'circle-opacity-transition': { duration: SEGMENT_REVEAL_TOKENS.fadeMs },
        'circle-stroke-color': ['coalesce', ['get', 'modeColor'], colors.route],
        'circle-stroke-width': ROUTE_RENDER_TOKENS.revealHeadStrokeWidth,
      },
    });
    if (!this.map.getLayer('marshgo-route-walking-estimate')) this.map.addLayer({
      id: 'marshgo-route-walking-estimate', type: 'line', source: 'marshgo-route',
      filter: ['==', ['get', 'approximate'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'modeColor'], walk.estimate],
        'line-width': walkWidthExpression('estimateWidth'),
        'line-opacity': ['case', ['==', ['get', 'dimmed'], true], 0.45, 0.95],
        'line-dasharray': walk.estimateDash,
      },
    });
    if (!this.map.getLayer('marshgo-route-walking-trail-halo')) this.map.addLayer({
      id: 'marshgo-route-walking-trail-halo', type: 'line', source: 'marshgo-route',
      filter: ['all', ['==', ['get', 'isWalk'], true], ['!=', ['get', 'approximate'], true]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['==', ['get', 'selected'], true], walk.haloSelected, walk.halo],
        'line-width': walkWidthExpression('haloWidth'),
        'line-opacity': ['case', ['==', ['get', 'selected'], true], 0.85, 0.55],
        'line-blur': ROUTE_RENDER_TOKENS.walkHaloBlur,
      },
    });
    if (!this.map.getLayer('marshgo-route-walking-trail')) this.map.addLayer({
      id: 'marshgo-route-walking-trail', type: 'line', source: 'marshgo-route',
      filter: ['all', ['==', ['get', 'isWalk'], true], ['!=', ['get', 'approximate'], true]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['==', ['get', 'selected'], true], walk.coreSelected, walk.core],
        'line-width': walkWidthExpression('width'),
        'line-opacity': ['case', ['==', ['get', 'dimmed'], true], 0.5, 1.0],
        // Scale dash lengths with line width so the walking path does not collapse
        // into sub-pixel dots at low zoom levels.
        'line-dasharray': walk.dash,
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
    if (!this.map.getLayer('marshgo-waypoints-halo')) this.map.addLayer({
      id: 'marshgo-waypoints-halo',
      type: 'circle',
      source: 'marshgo-waypoints',
      filter: ['in', ['get', 'kind'], ['literal', ['PICKUP', 'DROPOFF', 'TRANSFER', 'SELF_LOCATION', 'OTHER_LOCATION']]],
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          10, ['match', ['get', 'kind'], 'PICKUP', 14, 'DROPOFF', 14, 'TRANSFER', 11, 12],
          15, ['match', ['get', 'kind'], 'PICKUP', 22, 'DROPOFF', 22, 'TRANSFER', 17, 18],
        ] as unknown as ExpressionSpecification,
        'circle-color': ['match', ['get', 'kind'],
          'PICKUP', colors.pickup,
          'DROPOFF', colors.dropoff,
          'TRANSFER', '#327FC3',
          'SELF_LOCATION', '#0878F9',
          'OTHER_LOCATION', '#8B5CF6',
          colors.route,
        ] as unknown as ExpressionSpecification,
        'circle-opacity': 0.38,
        'circle-blur': 0.6,
      },
    });
    if (!this.map.getLayer('marshgo-waypoints')) this.map.addLayer({
      id: 'marshgo-waypoints',
      type: 'circle',
      source: 'marshgo-waypoints',
      // Pickup, drop-off and transfer points remain visible at every scale.
      // Intermediate stops use their own zoom-gated layer below.
      filter: ['!=', ['get', 'kind'], 'STOP'],
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          10, ['match', ['get', 'kind'], 'STOP', 1.5, 'TRANSFER', 5, 'SELF_LOCATION', 6.5, 'OTHER_LOCATION', 6.5, 7.5],
          13, ['match', ['get', 'kind'], 'STOP', 2.5, 'TRANSFER', 6, 'SELF_LOCATION', 7.5, 'OTHER_LOCATION', 7.5, 8.5],
          16, ['match', ['get', 'kind'], 'STOP', 4.5, 'TRANSFER', 7.5, 'SELF_LOCATION', 8.5, 'OTHER_LOCATION', 8.5, 9.5],
        ] as unknown as ExpressionSpecification,
        'circle-opacity': [
          'interpolate', ['linear'], ['zoom'],
          10, ['match', ['get', 'kind'], 'STOP', 0.45, 1.0],
          13, ['match', ['get', 'kind'], 'STOP', 0.75, 1.0],
          15, 1.0,
        ] as unknown as ExpressionSpecification,
        'circle-color': ['match', ['get', 'kind'],
          'PICKUP', colors.pickup,
          'DROPOFF', colors.dropoff,
          'STOP', '#F8FAFC',
          'TRANSFER', '#FFFFFF',
          'SELF_LOCATION', '#0878F9',
          'OTHER_LOCATION', '#8B5CF6',
          colors.route,
        ] as unknown as ExpressionSpecification,
        'circle-stroke-color': ['match', ['get', 'kind'],
          'STOP', '#475569',
          'TRANSFER', '#327FC3',
          'SELF_LOCATION', '#FFFFFF',
          'OTHER_LOCATION', '#FFFFFF',
          '#FFFFFF',
        ] as unknown as ExpressionSpecification,
        'circle-stroke-width': [
          'interpolate', ['linear'], ['zoom'],
          10, ['match', ['get', 'kind'], 'STOP', 0.8, 'TRANSFER', 2, 2.5],
          14, ['match', ['get', 'kind'], 'STOP', 1.5, 'TRANSFER', 2.5, 3],
        ] as unknown as ExpressionSpecification,
      },
    });
    if (!this.map.getLayer('marshgo-waypoints-stops')) this.map.addLayer({
      id: 'marshgo-waypoints-stops',
      type: 'circle',
      source: 'marshgo-waypoints',
      minzoom: STOP_DETAIL_MIN_ZOOM,
      filter: ['==', ['get', 'kind'], 'STOP'],
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          10, 1.5,
          13, 2.5,
          16, 4.5,
        ],
        'circle-opacity': [
          'interpolate', ['linear'], ['zoom'],
          10, 0.45,
          13, 0.75,
          15, 1.0,
        ],
        'circle-color': '#F8FAFC',
        'circle-stroke-color': '#475569',
        'circle-stroke-width': [
          'interpolate', ['linear'], ['zoom'],
          10, 0.8,
          14, 1.5,
        ],
      },
    });
    if (!this.map.getLayer('marshgo-transit-zone-arrows')) this.map.addLayer({
      id: 'marshgo-transit-zone-arrows', type: 'symbol', source: 'marshgo-transit-zone-arrows',
      layout: {
        'icon-image': 'marshgo-zone-arrow',
        'icon-size': ['match', ['get', 'zone'], 'B', 0.42, 0.34] as unknown as ExpressionSpecification,
        'icon-rotation-alignment': 'map',
        'icon-rotate': ['get', 'bearingDegrees'] as unknown as ExpressionSpecification,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-opacity': ['match', ['get', 'zone'], 'B', 0.95, 0.6] as unknown as ExpressionSpecification },
    });
    if (!this.map.getLayer('marshgo-transit-fleet-halo')) this.map.addLayer({
      id: 'marshgo-transit-fleet-halo', type: 'circle', source: 'marshgo-transit-fleet',
      paint: { 'circle-radius': priorityExpression('haloRadius'), 'circle-color': ['get', 'modeColor'],
        'circle-opacity': priorityExpression('haloOpacity'), 'circle-blur': 0.35 },
    });
    if (!this.map.getLayer('marshgo-transit-fleet')) this.map.addLayer({
      id: 'marshgo-transit-fleet', type: 'circle', source: 'marshgo-transit-fleet',
      paint: { 'circle-radius': priorityExpression('radius'), 'circle-color': ['get', 'modeColor'],
        'circle-opacity': priorityExpression('opacity'), 'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': ['match', ['get', 'priorityLevel'], 'L4', 2.5, 'L3', 2.25, 'L2', 2, 1.25] as unknown as ExpressionSpecification },
    });
    if (!this.map.getLayer('marshgo-transit-fleet-icon')) this.map.addLayer({
      id: 'marshgo-transit-fleet-icon', type: 'symbol', source: 'marshgo-transit-fleet',
      layout: { 'icon-image': ['get', 'iconName'], 'icon-size': priorityExpression('iconSize'),
        'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-opacity': priorityExpression('opacity') },
    });
    if (!this.map.getLayer('marshgo-vehicle-halo')) this.map.addLayer({ id: 'marshgo-vehicle-halo', type: 'circle', source: 'marshgo-vehicle', paint: { 'circle-radius': 13, 'circle-color': colors.vehicle, 'circle-opacity': 0.2 } });
    if (!this.map.getLayer('marshgo-vehicle')) this.map.addLayer({ id: 'marshgo-vehicle', type: 'circle', source: 'marshgo-vehicle', paint: { 'circle-radius': 8, 'circle-color': colors.vehicle, 'circle-stroke-color': colors.routeCasing, 'circle-stroke-width': 3 } });
    // The DOM puck (rotating arrow) replaces the old circle dot; the source stays for consumers of its data.
    for (const id of ['marshgo-vehicle-halo', 'marshgo-vehicle']) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', 'none');
    this.transport?.reinstall();
    // The camera perspective is independent of the selected basemap.
    const desiredPitch = this.perspective === '3d' ? PERSPECTIVE_PITCH : 0;
    if (Math.abs(this.map.getPitch() - desiredPitch) > 1) this.map.easeTo({ pitch: desiredPitch, duration: this.motionDuration(500), easing: cameraEasing(), essential: true });
    this.updateRouteSource();
    this.updateFocusedTransitOverlay();
    if (this.vehicle) this.setVehicle(this.vehicle);
    this.setWaypoints(this.waypoints);
  }

  /** Keep vector roads and labels above the imagery; dim land/building fills to reveal the satellite base. */
  private installSatelliteOverlay() {
    if (this.layer !== 'satellite') return;
    if (!this.map.isStyleLoaded()) {
      // setStyle() fires 'style.load' before every style resource is ready, so an immediate
      // install would silently do nothing and the passenger would see the scheme map twice.
      this.map.once('idle', () => this.installSatelliteOverlay());
      return;
    }
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
    this.map.setPaintProperty('marshgo-satellite', 'raster-brightness-max', dark ? 0.62 : 1);
    this.map.setPaintProperty('marshgo-satellite', 'raster-contrast', dark ? 0.15 : 0);
    this.map.setPaintProperty('marshgo-satellite', 'raster-saturation', dark ? -0.3 : 0);
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
    this.route = sanitizeLineCoordinates(points);
    this.routeSegments = null;
    this.clearRouteSegmentDiagnostics();
    this.map.getContainer().dataset.marshgoRoutePointCount = String(this.route.length);
    this.map.getContainer().dataset.marshgoRouteSegmentCount = String(this.route.length >= 2 ? 1 : 0);
    this.updateRouteSource();
  }
  setRouteSegments(segments: ColoredRouteSegment[]) {
    this.routeSegments = segments.flatMap(segment => {
      const coordinates = sanitizeLineCoordinates(segment.coordinates);
      return coordinates.length >= 2 ? [{ ...segment, coordinates }] : [];
    });
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
    container.dataset.marshgoRouteSegmentCount = String(mapSegments.length);
    container.dataset.marshgoRoutePointCount = String(mapSegments.reduce((count, segment) => count + segment.coordinates.length, 0));
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
    this.lastFitPoints = segment.coordinates;
    this.fitCoordinates(segment.coordinates, padding, 17);
    return true;
  }
  focusCoordinates(points: Coordinate[], padding: RouteFitPadding = {}, maxZoom = 15) {
    if (points.length === 0 || !points.every(isValidCoordinate)) return;
    this.cameraMode = 'FREE';
    this.lastFitPoints = points;
    this.fitCoordinates(points, padding, maxZoom);
  }
  project(coordinate: Coordinate): ScreenPoint | null {
    if (!this.map) return null;
    try {
      const p = this.map.project([coordinate[0], coordinate[1]]);
      return { x: p.x, y: p.y };
    } catch {
      return null;
    }
  }
  revealSegmentProgress(coordinates: Coordinate[], color: string) {
    const lineSource = this.map.getSource('marshgo-route-reveal') as maplibregl.GeoJSONSource | undefined;
    const headSource = this.map.getSource('marshgo-route-reveal-head') as maplibregl.GeoJSONSource | undefined;
    if (!lineSource) return;
    if (this.revealFaded) {
      this.restoreRevealOpacity();
      this.revealFaded = false;
    }
    const validCoordinates = sanitizeLineCoordinates(coordinates);
    if (validCoordinates.length < 2) {
      lineSource.setData({ type: 'FeatureCollection', features: [] });
      headSource?.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    lineSource.setData({
      type: 'Feature',
      properties: { modeColor: color },
      geometry: { type: 'LineString', coordinates: validCoordinates },
    });
    if (headSource) {
      const tip = validCoordinates.at(-1)!;
      headSource.setData({
        type: 'Feature',
        properties: { modeColor: color },
        geometry: { type: 'Point', coordinates: tip },
      });
    }
  }
  /** Fade the reveal in place (paint transitions) instead of popping it out of existence. */
  fadeSegmentReveal() {
    if (this.motionDuration(SEGMENT_REVEAL_TOKENS.fadeMs) === 0) { this.clearSegmentReveal(); return; }
    if (!this.map.getLayer('marshgo-route-reveal-glow')) return;
    this.revealFaded = true;
    this.map.setPaintProperty('marshgo-route-reveal-glow', 'line-opacity', 0);
    this.map.setPaintProperty('marshgo-route-reveal-core', 'line-opacity', 0);
    this.map.setPaintProperty('marshgo-route-reveal-head-glow', 'circle-opacity', 0);
    this.map.setPaintProperty('marshgo-route-reveal-head-core', 'circle-opacity', 0);
  }
  private restoreRevealOpacity() {
    if (!this.map.getLayer('marshgo-route-reveal-glow')) return;
    this.map.setPaintProperty('marshgo-route-reveal-glow', 'line-opacity', ROUTE_RENDER_TOKENS.revealGlowOpacity);
    this.map.setPaintProperty('marshgo-route-reveal-core', 'line-opacity', 0.95);
    this.map.setPaintProperty('marshgo-route-reveal-head-glow', 'circle-opacity', 0.85);
    this.map.setPaintProperty('marshgo-route-reveal-head-core', 'circle-opacity', 1);
  }
  clearSegmentReveal() {
    const lineSource = this.map.getSource('marshgo-route-reveal') as maplibregl.GeoJSONSource | undefined;
    const headSource = this.map.getSource('marshgo-route-reveal-head') as maplibregl.GeoJSONSource | undefined;
    if (lineSource) lineSource.setData({ type: 'FeatureCollection', features: [] });
    if (headSource) headSource.setData({ type: 'FeatureCollection', features: [] });
    if (this.revealFaded) {
      this.restoreRevealOpacity();
      this.revealFaded = false;
    }
  }
  /** Animated zoom step for the map chrome; MapLibre clamps at the style limits. */
  zoomBy(delta: number) {
    if (!Number.isFinite(delta) || delta === 0) return;
    this.markCameraRequest();
    this.map.easeTo({
      zoom: this.map.getZoom() + delta,
      duration: this.motionDuration(CAMERA_ZOOM_STEP_DURATION_MS),
      easing: cameraEasing(),
      essential: true,
    });
  }
  private updateRouteSource() {
    const source = this.map.getSource('marshgo-route') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    if (this.routeSegments) {
      const mapSegments = journeySegmentsForFocus(this.routeSegments, this.activeRouteSegmentId);
      source.setData({ type: 'FeatureCollection', features: mapSegments.map(segment => ({
        type: 'Feature' as const,
        properties: { modeColor: segment.modeColor, segmentId: segment.id ?? '', approximate: segment.approximate === true,
          isWalk: segment.isWalk, selected: segment.selected, dimmed: segment.dimmed },
        geometry: { type: 'LineString' as const, coordinates: segment.coordinates },
      })) });
      return;
    }
    if (this.route.length < 2) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    source.setData({ type: 'Feature', properties: { selected: true, dimmed: false }, geometry: { type: 'LineString', coordinates: this.route } });
  }
  setVehicle(point: Coordinate, heading?: number | null) {
    if (!isValidCoordinate(point)) return;
    this.vehicle = point;
    if (typeof heading === 'number' && Number.isFinite(heading)) this.heading = heading;
    const source = this.map.getSource('marshgo-vehicle') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: point } });
    this.updateMarker(point);
    if (this.cameraMode === 'FOLLOW_HEADING' || this.cameraMode === 'FOLLOW') this.followCamera(900);
  }

  /** A separate marker for an exact, timestamp-verified public-transport journey position. */
  setLiveTransitPosition(position: LiveTransitPosition | null) {
    if (position && !isValidCoordinate(position.coordinates)) position = null;
    if (!position) {
      this.cancelLiveTransitGlide();
      this.liveTransitMarker?.remove();
      this.liveTransitMarker = null;
      this.liveTransitElement = null;
      this.liveTransitPrev = null;
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
    this.cancelLiveTransitGlide();
    const prev = this.liveTransitPrev;
    const now = Date.now();
    const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prev && this.liveTransitMarker && shouldGlideVehicle({
      fromUpdatedAt: prev.updatedAt,
      toUpdatedAt: position.updatedAt,
      distanceMeters: vehicleDistanceMeters(prev.coordinates, position.coordinates),
      now,
      reducedMotion,
    })) {
      const gapMs = Date.parse(position.updatedAt) - Date.parse(prev.updatedAt);
      this.glideLiveTransit(prev.coordinates, position.coordinates, vehicleGlideDuration(gapMs));
    } else {
      this.liveTransitMarker?.setLngLat(position.coordinates);
    }
    this.liveTransitPrev = { coordinates: position.coordinates, updatedAt: position.updatedAt };
    this.map.getContainer().dataset.marshgoLiveTransitUpdatedAt = position.updatedAt;
  }

  private cancelLiveTransitGlide() {
    if (this.liveTransitGlideRaf !== null) {
      cancelAnimationFrame(this.liveTransitGlideRaf);
      this.liveTransitGlideRaf = null;
    }
  }

  /** Glide the verified journey marker between two fresh fixes; jumps are handled by the caller. */
  private glideLiveTransit(from: Coordinate, to: Coordinate, durationMs: number) {
    const start = performance.now();
    const ease = cameraEasing();
    const step = (now: number) => {
      if (!this.liveTransitMarker) { this.liveTransitGlideRaf = null; return; }
      const progress = durationMs > 0 ? Math.min(1, (now - start) / durationMs) : 1;
      this.liveTransitMarker.setLngLat(interpolateVehicleCoordinate(from, to, ease(progress)));
      if (progress < 1) this.liveTransitGlideRaf = requestAnimationFrame(step);
      else this.liveTransitGlideRaf = null;
    };
    this.liveTransitGlideRaf = requestAnimationFrame(step);
  }

  /**
   * Boarding/alighting, walk, terminus, line and vehicle labels for the route
   * sheet. Each label is an anchored DOM callout rather than a map symbol layer,
   * because screen-sized pills must stay upright and legible at every zoom.
   */
  setJourneyLabels(labels: MapAnnotation[] | null) {
    // Keep the last feed so a later camera settle can re-place the same labels.
    this.journeyLabelInput = (labels ?? []).filter(label => isValidCoordinate(label?.coordinates));
    this.applyJourneyLabels();
  }

  private applyJourneyLabels() {
    const entries = this.journeyLabelInput;
    const container = this.map.getContainer();
    const viewport = { width: container.clientWidth, height: container.clientHeight };
    // Priority de-clutter (BOARDING/ALIGHTING > TERMINUS > WALK > ROUTE > VEHICLE):
    // a label whose estimated box overlaps a higher-priority one is suppressed
    // entirely instead of printed on top of it. Nothing is hidden dishonestly — a
    // suppressed walk callout still shows its duration and distance in the
    // matching segment row of the bottom sheet.
    const placed = placeJourneyLabels(
      entries,
      label => {
        const point = this.map.project(label.coordinates as [number, number]);
        return Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x, y: point.y } : null;
      },
      viewport,
    );
    container.dataset.marshgoJourneyLabelCount = String(placed.length);
    const seen = new Set<string>();
    for (const { annotation: label, anchor } of placed) {
      seen.add(label.id);
      // The anchor is part of the key: panning an end chip from one half of the
      // screen to the other legitimately rebuilds the marker with a new anchor.
      const key = `${label.kind}:${label.tone ?? ''}:${label.title}:${label.detail ?? ''}:${label.coordinates[0].toFixed(5)},${label.coordinates[1].toFixed(5)}:${anchor}`;
      const existing = this.journeyLabelMarkers.get(label.id);
      if (existing?.key === key) continue;
      existing?.marker.remove();
      const marker = new maplibregl.Marker({
        element: this.buildJourneyLabelElement(label),
        anchor,
        pitchAlignment: 'viewport',
        rotationAlignment: 'viewport',
      }).setLngLat(label.coordinates).addTo(this.map);
      this.journeyLabelMarkers.set(label.id, { marker, key });
    }
    for (const [id, entry] of this.journeyLabelMarkers) {
      if (seen.has(id)) continue;
      entry.marker.remove();
      this.journeyLabelMarkers.delete(id);
    }
  }

  private buildJourneyLabelElement(label: MapAnnotation): HTMLElement {
    const element = document.createElement('div');
    element.className = `mg-map-label mg-map-label--${label.kind.toLowerCase()}${label.tone ? ` mg-map-label--tone-${label.tone}` : ''}`;
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', [label.title, label.detail].filter(Boolean).join(', '));

    const title = document.createElement('span');
    title.className = 'mg-map-label__title';
    title.textContent = label.title;
    const detail = label.detail ? document.createElement('span') : null;
    if (detail) {
      detail.className = 'mg-map-label__detail';
      detail.textContent = label.detail ?? '';
    }

    if (label.kind === 'WALK') {
      const glyph = document.createElement('span');
      glyph.className = 'mg-map-label__glyph';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9.8 8.1 7 22h2.1l1.9-7.4 2.3 2.1V22h2v-6.6l-2.2-2 .7-3.3 1.7 2.9 2.8 1.3.8-1.9-2.5-1.1-1.9-3.4c-.4-.8-1.3-1.2-2.2-1h-1.4L8.7 9.5l-.9 3.7 2 .5.6-3.2 1.3-.4Z"/></svg>';
      const body = document.createElement('span');
      body.className = 'mg-map-label__body';
      body.append(title);
      if (detail) body.append(detail);
      element.append(glyph, body);
      return element;
    }

    if (label.kind === 'BOARDING' || label.kind === 'ALIGHTING') {
      element.append(title);
      if (detail) {
        detail.className = 'mg-map-label__caption';
        element.append(detail);
      }
      return element;
    }

    if (label.kind === 'TERMINUS') {
      const caption = document.createElement('span');
      caption.className = 'mg-map-label__kicker';
      caption.textContent = label.title;
      if (detail) {
        title.textContent = label.detail ?? '';
        title.className = 'mg-map-label__title mg-map-label__title--strong';
      }
      element.append(caption, title);
      return element;
    }

    if (label.kind === 'VEHICLE') {
      const badge = document.createElement('span');
      badge.className = 'mg-map-label__callout';
      badge.textContent = label.title;
      const pin = document.createElement('span');
      pin.className = 'mg-map-label__pin';
      pin.setAttribute('aria-hidden', 'true');
      element.append(badge, pin);
      if (detail) {
        detail.className = 'mg-map-label__eta';
        element.append(detail);
      }
      return element;
    }

    const badge = document.createElement('span');
    badge.className = 'mg-map-label__callout';
    badge.textContent = label.title;
    const pin = document.createElement('span');
    pin.className = 'mg-map-label__pin';
    pin.setAttribute('aria-hidden', 'true');
    element.append(badge, pin);
    if (detail) element.append(detail);
    return element;
  }

  /** Metric scale bar derived from the live camera, never a decorative constant. */
  getScaleLabel(maxPixels = 88): { label: string; widthPx: number } | null {
    const latitude = this.map.getCenter().lat;
    const metersPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / 2 ** this.map.getZoom();
    if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return null;
    const raw = metersPerPixel * maxPixels;
    const base = 10 ** Math.floor(Math.log10(raw));
    const step = [5, 2, 1].find(option => option * base <= raw) ?? 1;
    const meters = step * base;
    return {
      label: meters >= 1000
        ? `${(meters / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км`
        : `${Math.round(meters)} м`,
      widthPx: Math.max(18, Math.round(meters / metersPerPixel)),
    };
  }

  /** Draw the selected public-transit line context and its fresh fleet as batched GeoJSON. */
  setFocusedTransitOverlay(overlay: FocusedTransitMapOverlay | null) {
    this.focusedTransitOverlay = overlay ? {
      ...overlay,
      lineRoutes: overlay.lineRoutes.flatMap(route => {
        const coordinates = sanitizeLineCoordinates(route.coordinates);
        if (coordinates.length < 2) return [];
        const beforeBoarding = sanitizeLineCoordinates(route.zones?.beforeBoarding);
        const passengerSegment = sanitizeLineCoordinates(route.zones?.passengerSegment);
        const afterAlighting = sanitizeLineCoordinates(route.zones?.afterAlighting);
        // If the provider supplied zone metadata, its passenger slice is the
        // authority for a focused overlay. Never fall back to the full route
        // after a malformed B shape, which would expose unvalidated A/C geometry.
        if (route.zones && passengerSegment.length < 2) return [];
        // A full line without a verified passenger slice cannot be displayed as the ride.
        if (!route.zones && route.geometryScope !== 'leg_only') return [];
        const zones = route.zones ? {
          ...route.zones,
          beforeBoarding: beforeBoarding.length >= 2 ? beforeBoarding : null,
          passengerSegment,
          afterAlighting: afterAlighting.length >= 2 ? afterAlighting : null,
        } : route.zones;
        return [{ ...route, coordinates, zones }];
      }),
      vehicles: overlay.vehicles.filter(vehicle => isValidCoordinate(vehicle.coordinates)),
    } : null;
    this.updateFocusedTransitOverlay();
  }

  private updateFocusedTransitOverlay() {
    const lineSource = this.map.getSource('marshgo-transit-context') as maplibregl.GeoJSONSource | undefined;
    const fleetSource = this.map.getSource('marshgo-transit-fleet') as maplibregl.GeoJSONSource | undefined;
    const zonesSource = this.map.getSource('marshgo-transit-zones') as maplibregl.GeoJSONSource | undefined;
    const arrowsSource = this.map.getSource('marshgo-transit-zone-arrows') as maplibregl.GeoJSONSource | undefined;
    const overlay = this.focusedTransitOverlay;
    const modeColor = overlay?.color ?? '#327FC3';
    const routes = (overlay?.lineRoutes ?? []).filter(route => route.coordinates.length >= 2);
    const zonesForRoute = routes.map(route => passengerZoneFeaturesFor(route.zones, route.geometryScope));
    lineSource?.setData({ type: 'FeatureCollection', features: routes.map((route, index) => ({
      type: 'Feature' as const,
      properties: {
        modeColor, direction: route.direction, routeId: route.id,
        directionId: route.directionId ?? null,
        directionOffsetPx: transitDirectionOffsetPx(route.directionId, index),
        hasZones: zonesForRoute[index]!.length > 0,
      },
      geometry: { type: 'LineString' as const, coordinates: route.coordinates },
    })) });
    const zoneFeatures = routes.flatMap((route, index) => {
      const directionOffsetPx = transitDirectionOffsetPx(route.directionId, index);
      return zonesForRoute[index]!.map(zone => ({
        type: 'Feature' as const,
        properties: { zone: zone.zone, modeColor, routeId: route.id, directionOffsetPx },
        geometry: { type: 'LineString' as const, coordinates: zone.coordinates },
      }));
    });
    zonesSource?.setData({ type: 'FeatureCollection', features: zoneFeatures });
    const arrowFeatures = routes.flatMap((route, index) => zoneArrowsFor(zonesForRoute[index]!).map(arrow => ({
      type: 'Feature' as const,
      properties: { zone: arrow.zone, bearingDegrees: Math.round(arrow.bearingDegrees) },
      geometry: { type: 'Point' as const, coordinates: arrow.coordinates },
    })));
    arrowsSource?.setData({ type: 'FeatureCollection', features: arrowFeatures });
    const iconName = transitIconName(overlay?.transportType ?? 'bus');
    const fleetLevels = (overlay?.vehicles ?? []).map(vehicle => priorityLevelOf(vehicle));
    fleetSource?.setData({ type: 'FeatureCollection', features: (overlay?.vehicles ?? []).map((vehicle, index) => ({
      type: 'Feature' as const,
      properties: {
        id: vehicle.id, modeColor, iconName, emphasized: vehicle.emphasized,
        priorityLevel: fleetLevels[index] ?? 'L1', updatedAt: vehicle.updatedAt,
      },
      geometry: { type: 'Point' as const, coordinates: vehicle.coordinates },
    })).filter(feature => feature.geometry.coordinates.every(Number.isFinite)) });
    const container = this.map.getContainer();
    container.dataset.marshgoTransitFleetCount = String(overlay?.vehicles.length ?? 0);
    container.dataset.marshgoTransitFleetEmphasizedCount = String(overlay?.vehicles.filter(vehicle => vehicle.emphasized).length ?? 0);
    container.dataset.marshgoTransitFleetActiveCount = String(fleetLevels.filter(level => level === 'L2' || level === 'L3' || level === 'L4').length);
    container.dataset.marshgoTransitLineDirectionCount = String(overlay?.lineRoutes.length ?? 0);
    container.dataset.marshgoTransitZoneCount = String(zoneFeatures.length);
    container.dataset.marshgoTransitZoneArrowCount = String(arrowFeatures.length);
  }

  /** The driver's puck: a blue arrow that points where the car is heading, lying flat on the (tilted) road like in Apple Maps. */
  private updateMarker(point: Coordinate) {
    if (!this.marker) {
      const element = document.createElement('div');
      element.className = 'marshgo-puck';
      element.setAttribute('aria-hidden', 'true');
      element.innerHTML = '<span class="marshgo-puck__halo"></span><svg viewBox="0 0 44 44" class="marshgo-puck__arrow"><defs><linearGradient id="mgPuckGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#258AFF"/><stop offset="100%" stop-color="#0058D6"/></linearGradient><filter id="mgPuckGlow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#002D7A" flood-opacity="0.38"/></filter></defs><circle cx="22" cy="22" r="19" fill="#FFFFFF" filter="url(#mgPuckGlow)"/><circle cx="22" cy="22" r="15" fill="url(#mgPuckGrad)"/><path d="M22 10 L30 30 L22 25 L14 30 Z" fill="#FFFFFF"/></svg>';
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
      duration: this.glideDuration(duration, { center: this.vehicle, zoom: Math.max(this.map.getZoom(), 17), bearing: this.heading ?? this.map.getBearing() }), easing: cameraEasing(), essential: true,
    });
  }
  setWaypoints(points: RouteWaypoint[]) {
    this.waypoints = points.filter(point => isValidCoordinate(point?.coordinate));
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
    this.lastFitPoints = points;
    if (points.length === 1) { this.focus(points[0], 14, overrides); return; }
    this.cameraMode = 'OVERVIEW';
    this.fitCoordinates(points, overrides, 15);
  }
  private fitCoordinates(points: Coordinate[], overrides: RouteFitPadding, maxZoom: number) {
    if (points.length === 0 || !points.every(isValidCoordinate)) return;
    const lngs = points.map((point) => point[0]); const lats = points.map((point) => point[1]);
    // Full-screen navigation reserves room for its overlays; small previews must scale the padding down or MapLibre rejects the fit.
    const { clientWidth, clientHeight } = this.map.getContainer();
    const requestedTop = Math.min(clientHeight * 0.25, overrides.top ?? Math.min(110, clientHeight * 0.2));
    const requestedBottom = overrides.bottom ?? Math.min(270, clientHeight * 0.2);
    // Keep a usable map band between the top controls and an expanded sheet.
    // If top + bottom padding consumes almost the entire canvas, fitBounds can
    // zoom until a route endpoint falls behind the sheet even though the sheet
    // itself is accounted for in the requested padding.
    const minFitHeight = Math.min(32, Math.max(24, clientHeight * 0.04));
    // When a tall sheet and the top controls cannot both fit, keep the sheet's
    // requested edge accurate and give up some top padding. Capping only the
    // bottom padding shifts the route downward, underneath the sheet.
    const top = Math.min(requestedTop, Math.max(0, clientHeight - requestedBottom - minFitHeight));
    // A centred terminus callout is up to ~236 px wide, so a caller that reserves
    // a fixed 96 px on each side needs that to survive on 320-430 px viewports;
    // 0.15 of the width used to clamp it back to ~48 px and re-clip the chip.
    // 0.4 keeps the desktop panel inset (500 px on a wide screen) intact while MapLibre's
    // own rule — combined horizontal padding must stay below the viewport — still holds,
    // because left and right each cap at 0.4 and never both reach the cap on one screen.
    const maxSidePadding = clientWidth * 0.4;
    const padding = {
      top,
      right: Math.min(maxSidePadding, overrides.right ?? Math.min(32, clientWidth * 0.1)),
      // Overlay sheets can cover more than half of a route screen. Honor the
      // requested safe-area while keeping MapLibre's combined vertical padding
      // strictly smaller than the viewport.
      bottom: Math.min(Math.max(0, clientHeight - top - minFitHeight), requestedBottom),
      left: Math.min(maxSidePadding, overrides.left ?? Math.min(32, clientWidth * 0.1)),
    };
    this.lastFitPadding = padding;
    if (typeof overrides.bearing === 'number' && Number.isFinite(overrides.bearing) && overrides.bearing !== 0) {
      this.fitRotatedCoordinates(points, padding, maxZoom, overrides.bearing);
      return;
    }
    // A single focus point (transfer, stop) has zero-area bounds; MapLibre would
    // otherwise resolve the zoom to the maxZoom corner. Expand around the point's
    // centre so the padded fit lands on it instead of clamping one edge.
    const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
    const padLng = Math.max(maxLng - minLng, 0.00002) / 2;
    const padLat = Math.max(maxLat - minLat, 0.00002) / 2;
    const centerLng = (minLng + maxLng) / 2; const centerLat = (minLat + maxLat) / 2;
    this.markCameraRequest();
    this.map.fitBounds([[centerLng - padLng, centerLat - padLat], [centerLng + padLng, centerLat + padLat]], {
      padding,
      duration: this.glideDuration(520, { center: [centerLng, centerLat] }),
      easing: cameraEasing(),
      maxZoom,
    });
  }
  /** Fit the rotated point cloud instead of the rotated lat/lng bounding box. */
  private fitRotatedCoordinates(points: Coordinate[], padding: { top: number; right: number; bottom: number; left: number }, maxZoom: number, bearing: number) {
    const { clientWidth, clientHeight } = this.map.getContainer();
    const camera = cameraForRotatedPoints(
      points,
      bearing,
      Math.max(1, clientWidth - padding.left - padding.right),
      Math.max(1, clientHeight - padding.top - padding.bottom),
      this.map.getZoom(),
      maxZoom,
    );
    if (!camera) return;
    this.map.easeTo({
      center: camera.center,
      zoom: camera.zoom,
      bearing,
      padding,
      duration: this.glideDuration(CAMERA_FOCUS_DURATION_MS, { center: camera.center, zoom: camera.zoom, bearing }),
      easing: cameraEasing(),
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
    // Use the themed style corresponding to the active theme for both simple and satellite overlays.
    const themed = this.styleUrls?.[this.theme];
    const style = themed ?? styleForLayer(layer, configuredMapStyleUrl, this.theme.endsWith('_DARK'), configuredMapDarkStyleUrl) ?? this.baseStyle;
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
    this.map.easeTo({ pitch: perspective === '3d' ? PERSPECTIVE_PITCH : 0, duration: this.motionDuration(500), easing: cameraEasing(), essential: true });
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
  focus(point: Coordinate, zoom = 13, padding?: RouteFitPadding) {
    if (!isValidCoordinate(point)) return;
    this.cameraMode = 'FREE';
    this.lastFitPoints = [point];
    this.markCameraRequest();
    const safePadding = padding ? {
      top: Math.max(0, padding.top ?? 0),
      bottom: Math.max(0, padding.bottom ?? 0),
      left: Math.max(0, padding.left ?? 0),
      right: Math.max(0, padding.right ?? 0),
    } : null;
    this.lastFitPadding = safePadding ?? { top: 0, right: 0, bottom: 0, left: 0 };
    this.map.easeTo({
      center: point,
      zoom,
      duration: this.glideDuration(600, { center: point, zoom }),
      easing: cameraEasing(),
      essential: true,
      ...(safePadding ? { padding: safePadding } : {}),
    });
  }
  setCameraMode(mode: CameraMode) { this.setCameraModeInternal(mode); }
  setTheme(theme: MapTheme) {
    const nextTheme = this.themeForLayer(this.layer, theme);
    const changed = this.theme !== nextTheme;
    this.theme = nextTheme;
    const themed = this.styleUrls?.[this.theme];
    const style = themed ?? (configuredMapStyleUrl ? styleForLayer(this.layer, configuredMapStyleUrl, this.theme.endsWith('_DARK'), configuredMapDarkStyleUrl) : null);
    if (changed && style) { this.baseStyle = style; this.map.setStyle(style); return; }
    this.applySatellitePalette();
    const colors = mapStyleTokens[this.theme];
    if (this.map.getLayer('marshgo-background')) this.map.setPaintProperty('marshgo-background', 'background-color', colors.background);
    if (!this.map.getLayer('marshgo-route')) return;
    this.map.setPaintProperty('marshgo-route-halo', 'line-color', ['coalesce', ['get', 'modeColor'], colors.route]);
    this.map.setPaintProperty('marshgo-route-casing', 'line-color', colors.routeCasing);
    this.map.setPaintProperty('marshgo-route', 'line-color', ['coalesce', ['get', 'modeColor'], colors.route]);
    const walk = walkGeometryTokens(this.theme);
    if (this.map.getLayer('marshgo-route-walking-trail')) {
      this.map.setPaintProperty('marshgo-route-walking-trail', 'line-color', ['case', ['==', ['get', 'selected'], true], walk.coreSelected, walk.core]);
      this.map.setPaintProperty('marshgo-route-walking-trail-halo', 'line-color', ['case', ['==', ['get', 'selected'], true], walk.haloSelected, walk.halo]);
      this.map.setPaintProperty('marshgo-route-walking-estimate', 'line-color', ['coalesce', ['get', 'modeColor'], walk.estimate]);
    }
    if (this.map.getLayer('marshgo-route-reveal-glow')) {
      this.map.setPaintProperty('marshgo-route-reveal-glow', 'line-color', ['coalesce', ['get', 'modeColor'], colors.route]);
      this.map.setPaintProperty('marshgo-route-reveal-head-glow', 'circle-color', ['coalesce', ['get', 'modeColor'], colors.route]);
      this.map.setPaintProperty('marshgo-route-reveal-head-core', 'circle-stroke-color', ['coalesce', ['get', 'modeColor'], colors.route]);
    }
    this.map.setPaintProperty('marshgo-waypoints', 'circle-color', ['match', ['get', 'kind'], 'PICKUP', colors.pickup, 'DROPOFF', colors.dropoff, 'STOP', '#F8FAFC', 'TRANSFER', '#FFFFFF', 'SELF_LOCATION', '#0878F9', 'OTHER_LOCATION', '#8B5CF6', colors.route]);
    this.map.setPaintProperty('marshgo-waypoints', 'circle-stroke-color', ['match', ['get', 'kind'], 'STOP', '#475569', 'TRANSFER', '#327FC3', 'SELF_LOCATION', '#FFFFFF', 'OTHER_LOCATION', '#FFFFFF', '#FFFFFF']);
    if (this.map.getLayer('marshgo-waypoints-stops')) {
      this.map.setPaintProperty('marshgo-waypoints-stops', 'circle-color', '#F8FAFC');
      this.map.setPaintProperty('marshgo-waypoints-stops', 'circle-stroke-color', '#475569');
    }
    if (this.map.getLayer('marshgo-waypoints-halo')) {
      this.map.setPaintProperty('marshgo-waypoints-halo', 'circle-color', ['match', ['get', 'kind'], 'PICKUP', colors.pickup, 'DROPOFF', colors.dropoff, 'TRANSFER', '#327FC3', 'SELF_LOCATION', '#327FC3', 'OTHER_LOCATION', '#327FC3', colors.route]);
    }
    this.map.setPaintProperty('marshgo-vehicle-halo', 'circle-color', colors.vehicle);
    this.map.setPaintProperty('marshgo-vehicle', 'circle-color', colors.vehicle);
    this.map.setPaintProperty('marshgo-vehicle', 'circle-stroke-color', colors.routeCasing);
    if (this.map.getLayer('marshgo-buildings-3d')) this.map.setPaintProperty('marshgo-buildings-3d', 'fill-extrusion-color', this.theme.endsWith('_DARK') ? '#29415E' : '#D5E2EE');
    if (this.map.getLayer('marshgo-background')) this.map.setPaintProperty('marshgo-background', 'background-color', colors.background);
  }
  retry() { this.seenTileError = false; this.publish(this.basemapConfigured() ? 'loading' : 'unconfigured'); if (this.basemapConfigured()) this.map.setStyle(this.map.getStyle(), { diff: false }); else this.map.triggerRepaint(); }
  destroy() {
    this.map.getContainer().removeEventListener('wheel', this.wheelGestureListener);
    this.cancelLiveTransitGlide();
    this.marker?.remove();
    this.liveTransitMarker?.remove();
    for (const { marker } of this.journeyLabelMarkers.values()) marker.remove();
    this.journeyLabelMarkers.clear();
    this.transport?.destroy();
    this.map.remove();
  }
  getStatus() { return this.status; }
}
