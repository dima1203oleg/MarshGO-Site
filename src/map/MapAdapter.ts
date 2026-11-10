import type { MapLayer, MapPerspective } from './mapMode';
import type { MapDisplayPreferences } from './mapLayerPreferences';
import type { TransitZoneGeometry, VehiclePriorityLevel } from './transportVisualZones';
import type { Coordinate } from '../../shared/navigation/contracts';
export type MapStatus = 'unconfigured' | 'loading' | 'available' | 'degraded' | 'failed';
export type MapTheme = 'MARSHGO_LIGHT' | 'MARSHGO_DARK';
export type CameraMode = 'OVERVIEW' | 'FOLLOW' | 'FOLLOW_HEADING' | 'MANEUVER' | 'FREE' | 'RECENTER_PENDING';
export type ColoredRouteSegment = { id?: string; coordinates: Coordinate[]; modeColor: string; isWalk: boolean; approximate?: boolean };
export type RouteWaypoint = { coordinate: Coordinate; kind: string; segmentIds?: string[] };
export type ScreenPoint = { x: number; y: number };
export type LiveTransitPosition = { coordinates: Coordinate; color: string; label: string; updatedAt: string };
export type MapAnnotationKind = 'BOARDING' | 'ALIGHTING' | 'WALK' | 'TERMINUS' | 'ROUTE' | 'VEHICLE';
export type MapAnnotationTone = 'green' | 'blue' | 'purple' | 'neutral';
/** A DOM label anchored to a real coordinate of the itinerary or of the live overlay. */
export type MapAnnotation = {
  id: string;
  kind: MapAnnotationKind;
  coordinates: Coordinate;
  title: string;
  detail?: string;
  tone?: MapAnnotationTone;
};
export type FocusedTransitMapOverlay = {
  color: string;
  transportType: string;
  lineRoutes: Array<{
    id: string;
    direction: string;
    directionId?: string | null;
    coordinates: Coordinate[];
    /** 'leg_only' means the provider gave us only the ridden slice, so zones A and C are unknown. */
    geometryScope?: 'full_route' | 'leg_only';
    zones?: TransitZoneGeometry | null;
  }>;
  vehicles: Array<{
    id: string;
    coordinates: Coordinate;
    updatedAt: string;
    routeLabel: string;
    emphasized: boolean;
    priorityLevel?: VehiclePriorityLevel;
    etaSeconds?: number | null;
    etaConfidence?: 'OBSERVED' | 'PREDICTED' | 'NONE';
  }>;
};

/** Screen-space separation keeps opposing transit directions legible without editing feed geometry. */
export function transitDirectionOffsetPx(directionId: string | null | undefined, index: number): number {
  if (directionId === '0') return -11;
  if (directionId === '1') return 11;
  if (index === 0) return -11;
  if (index === 1) return 11;
  return 0;
}

export type RouteFitPadding = { top?: number; right?: number; bottom?: number; left?: number; bearing?: number };
export interface MapAdapter {
  setRoute(points: Coordinate[]): void;
  setRouteSegments?(segments: ColoredRouteSegment[]): void;
  setActiveRouteSegment?(id: string | null): void;
  setLiveTransitPosition?(position: LiveTransitPosition | null): void;
  setFocusedTransitOverlay?(overlay: FocusedTransitMapOverlay | null): void;
  setJourneyLabels?(labels: MapAnnotation[] | null): void;
  getScaleLabel?(maxPixels?: number): { label: string; widthPx: number } | null;
  focusRouteSegment?(id: string, padding?: RouteFitPadding): boolean;
  focusCoordinates?(points: Coordinate[], padding?: RouteFitPadding, maxZoom?: number): void;
  onRouteSegmentSelect: (id: string) => void;
  onRouteSegmentAmbiguous?: (ids: string[], point: ScreenPoint) => void;
  onCameraMove?: () => void;
  project?(coordinate: Coordinate): ScreenPoint | null;
  revealSegmentProgress?(coordinates: Coordinate[], color: string): void;
  fadeSegmentReveal?(): void;
  clearSegmentReveal?(): void;
  zoomBy?(delta: number): void;
  setVehicle(point: Coordinate, heading?: number | null): void;
  onCameraModeChange: (mode: CameraMode) => void;
  setWaypoints(points: RouteWaypoint[]): void;
  fitRoute(padding?: RouteFitPadding): void;
  recenter(point?: Coordinate): void;
  setCameraMode(mode: CameraMode): void;
  setTheme(theme: MapTheme): void;
  setLayer(layer: MapLayer): void;
  setPerspective(perspective: MapPerspective): void;
  setTransportLayers(layers: ReadonlySet<import('./transportLayers').TransportLayerId>): void;
  setTransportDisplayPreferences(preferences: MapDisplayPreferences): void;
  focus(point: Coordinate, zoom?: number, padding?: RouteFitPadding): void;
  onTransportHint: (message: string | null) => void;
  retry(): void;
  destroy(): void;
  getStatus(): MapStatus;
}
