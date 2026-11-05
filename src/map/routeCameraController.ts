import type { Coordinate } from '../../shared/navigation/contracts';
import type { RouteFitPadding, MapAdapter } from './MapAdapter';
import { boundsOf, corridorFitPoints } from './routeContextCorridor';
import { extentMeters, principalBearing } from './routeCameraFocus';

export type RouteCameraMode = 'ROUTE_OVERVIEW' | 'SEGMENT_FOCUS' | 'STOP_FOCUS' | 'MANUAL_CAMERA';

export interface RouteCameraState {
  mode: RouteCameraMode;
  activeSegmentId: string | null;
  activeStopId: string | null;
  activeStopCoordinate: Coordinate | null;
}

export function initialRouteCameraState(): RouteCameraState {
  return {
    mode: 'ROUTE_OVERVIEW',
    activeSegmentId: null,
    activeStopId: null,
    activeStopCoordinate: null,
  };
}

export function shouldShowRecenterButton(state: RouteCameraState): boolean {
  return state.mode === 'MANUAL_CAMERA' || state.mode === 'SEGMENT_FOCUS' || state.mode === 'STOP_FOCUS';
}

export interface SegmentFocusTarget {
  points: Coordinate[];
  bearing: number | null;
  key: string;
}

export function calculateSegmentFocusTarget(
  segmentCoordinates: Coordinate[],
  contextLines: Coordinate[][] = [],
  segmentId = '',
): SegmentFocusTarget | null {
  if (segmentCoordinates.length < 2) return null;
  // Target segment coordinates directly to ensure the street is centered cleanly in the visible viewport
  const points = segmentCoordinates.length >= 2 && contextLines.length === 0
    ? segmentCoordinates
    : corridorFitPoints(segmentCoordinates, contextLines, 0.2);
  const bounds = boundsOf(points);
  const boundsKey = bounds ? bounds.map((val) => val.toFixed(5)).join(',') : '';
  const bearing = principalBearing(points);
  return {
    points,
    bearing,
    key: `${segmentId}:${points.length}:${bearing !== null ? Math.round(bearing) : 'flat'}:${boundsKey}`,
  };
}

export class RouteCameraController {
  private state: RouteCameraState = initialRouteCameraState();
  private adapter: MapAdapter | null = null;
  private padding: RouteFitPadding = {};
  private onStateChange?: (state: RouteCameraState) => void;

  constructor(options?: {
    adapter?: MapAdapter | null;
    padding?: RouteFitPadding;
    onStateChange?: (state: RouteCameraState) => void;
  }) {
    this.adapter = options?.adapter ?? null;
    this.padding = options?.padding ?? {};
    this.onStateChange = options?.onStateChange;
  }

  setAdapter(adapter: MapAdapter | null) {
    this.adapter = adapter;
  }

  setPadding(padding: RouteFitPadding) {
    this.padding = padding;
  }

  getState(): RouteCameraState {
    return { ...this.state };
  }

  private updateState(partial: Partial<RouteCameraState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange?.(this.getState());
  }

  /** Called when the user touches/drags/zooms the map manually. */
  onUserMapInteraction() {
    if (this.state.mode !== 'MANUAL_CAMERA') {
      this.updateState({ mode: 'MANUAL_CAMERA' });
    }
  }

  showOverview(routePoints: Coordinate[], maxZoom = 15.2) {
    this.updateState({
      mode: 'ROUTE_OVERVIEW',
      activeSegmentId: null,
      activeStopId: null,
      activeStopCoordinate: null,
    });
    this.adapter?.setActiveRouteSegment?.(null);
    const padding: RouteFitPadding = { ...this.padding, bearing: 0, pitch: 0 };
    if (routePoints.length >= 2) {
      this.adapter?.focusCoordinates?.(routePoints, padding, maxZoom);
    } else {
      this.adapter?.fitRoute(padding);
    }
  }

  focusSegment(segmentId: string, target: SegmentFocusTarget | null, fallbackPoints: Coordinate[] = []) {
    if (!target) {
      this.showOverview(fallbackPoints);
      return;
    }
    this.updateState({
      mode: 'SEGMENT_FOCUS',
      activeSegmentId: segmentId,
      activeStopId: null,
      activeStopCoordinate: null,
    });
    this.adapter?.setActiveRouteSegment?.(segmentId);
    const padding: RouteFitPadding = {
      ...this.padding,
      bearing: target.bearing ?? 0,
      pitch: target.bearing !== null ? 28 : 0,
    };
    this.adapter?.focusCoordinates?.(target.points, padding, 17.5);
  }

  focusStop(stopId: string, coordinate: Coordinate) {
    this.updateState({
      mode: 'STOP_FOCUS',
      activeStopId: stopId,
      activeStopCoordinate: coordinate,
    });
    // Smoothly focus on stop position with clear zoom and adaptive viewport padding
    this.adapter?.focus(coordinate, 16.8, { ...this.padding, pitch: 20 });
  }

  /**
   * Refits camera on bottom sheet snap change if in auto modes.
   * In MANUAL_CAMERA mode, stays in place to preserve user context!
   */
  syncOnSnapSettled(options: {
    routePoints: Coordinate[];
    segmentTarget?: SegmentFocusTarget | null;
  }) {
    if (this.state.mode === 'MANUAL_CAMERA') {
      // Do not jerk the camera when the user has panned elsewhere!
      return;
    }
    if (this.state.mode === 'STOP_FOCUS' && this.state.activeStopCoordinate) {
      this.adapter?.focus(this.state.activeStopCoordinate, 16.5, this.padding);
      return;
    }
    if (this.state.mode === 'SEGMENT_FOCUS' && options.segmentTarget) {
      const padding = {
        ...this.padding,
        bearing: options.segmentTarget.bearing ?? 0,
      };
      this.adapter?.focusCoordinates?.(options.segmentTarget.points, padding, 17);
      return;
    }
    // ROUTE_OVERVIEW
    const padding = { ...this.padding, bearing: 0 };
    if (options.routePoints.length >= 2) {
      this.adapter?.focusCoordinates?.(options.routePoints, padding, 15.2);
    } else {
      this.adapter?.fitRoute(padding);
    }
  }
}
