import type { MapLayer, MapPerspective } from './mapMode';
import type { MapDisplayPreferences } from './mapLayerPreferences';
import type { Coordinate } from '../../shared/navigation/contracts';
export type MapStatus = 'unconfigured' | 'loading' | 'available' | 'degraded' | 'failed';
export type MapTheme = 'MARSHGO_LIGHT' | 'MARSHGO_DARK';
export type CameraMode = 'OVERVIEW' | 'FOLLOW' | 'FOLLOW_HEADING' | 'MANEUVER' | 'FREE' | 'RECENTER_PENDING';
export type ColoredRouteSegment = { id?: string; coordinates: Coordinate[]; modeColor: string; mode?: string; transportType?: string; approximate?: boolean };
export type RouteWaypoint = { coordinate: Coordinate; kind: string; segmentIds?: string[] };
export type ScreenPoint = { x: number; y: number };
export type LiveTransitPosition = { coordinates: Coordinate; color: string; label: string; updatedAt: string };
export type FocusedTransitMapOverlay = {
  color: string;
  transportType: string;
  lineRoutes: Array<{ id: string; direction: string; directionId?: string | null; coordinates: Coordinate[] }>;
  vehicles: Array<{ id: string; coordinates: Coordinate; updatedAt: string; routeLabel: string; emphasized: boolean }>;
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
  focusRouteSegment?(id: string, padding?: RouteFitPadding): boolean;
  focusCoordinates?(points: Coordinate[], padding?: RouteFitPadding, maxZoom?: number): void;
  onRouteSegmentSelect: (id: string) => void;
  onRouteSegmentAmbiguous?: (ids: string[], point: ScreenPoint) => void;
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
  focus(point: Coordinate, zoom?: number): void;
  onTransportHint: (message: string | null) => void;
  retry(): void;
  destroy(): void;
  getStatus(): MapStatus;
}
