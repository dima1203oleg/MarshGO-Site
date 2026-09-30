import type { Coordinate } from '../../shared/navigation/contracts';
export type MapStatus = 'unconfigured' | 'loading' | 'available' | 'degraded' | 'failed';
export type MapTheme = 'MARSHGO_LIGHT' | 'MARSHGO_DARK' | 'MARSHGO_NAVIGATION_LIGHT' | 'MARSHGO_NAVIGATION_DARK';
export type CameraMode = 'OVERVIEW' | 'FOLLOW' | 'FOLLOW_HEADING' | 'MANEUVER' | 'FREE' | 'RECENTER_PENDING';
export interface MapAdapter {
  setRoute(points: Coordinate[]): void;
  setVehicle(point: Coordinate): void;
  setWaypoints(points: Array<{ coordinate: Coordinate; kind: string }>): void;
  fitRoute(): void;
  recenter(point?: Coordinate): void;
  setCameraMode(mode: CameraMode): void;
  setTheme(theme: MapTheme): void;
  retry(): void;
  destroy(): void;
  getStatus(): MapStatus;
}
