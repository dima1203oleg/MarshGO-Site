import type { MapLayer, MapMode } from './mapMode';
import type { Coordinate } from '../../shared/navigation/contracts';
export type MapStatus = 'unconfigured' | 'loading' | 'available' | 'degraded' | 'failed';
export type MapTheme = 'MARSHGO_LIGHT' | 'MARSHGO_DARK' | 'MARSHGO_NAVIGATION_LIGHT' | 'MARSHGO_NAVIGATION_DARK';
export type CameraMode = 'OVERVIEW' | 'FOLLOW' | 'FOLLOW_HEADING' | 'MANEUVER' | 'FREE' | 'RECENTER_PENDING';
export interface MapAdapter {
  setRoute(points: Coordinate[]): void;
  setVehicle(point: Coordinate, heading?: number | null): void;
  onCameraModeChange: (mode: CameraMode) => void;
  setWaypoints(points: Array<{ coordinate: Coordinate; kind: string }>): void;
  fitRoute(): void;
  recenter(point?: Coordinate): void;
  setCameraMode(mode: CameraMode): void;
  setTheme(theme: MapTheme): void;
  setMode(mode: MapMode): void;
  setLayer(layer: MapLayer): void;
  setTransportLayers(layers: ReadonlySet<import('./transportLayers').TransportLayerId>): void;
  focus(point: Coordinate, zoom?: number): void;
  onTransportHint: (message: string | null) => void;
  retry(): void;
  destroy(): void;
  getStatus(): MapStatus;
}
