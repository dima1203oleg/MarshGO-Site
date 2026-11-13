import type { Coordinate } from '../../shared/navigation/contracts';
import type { RouteFitPadding, MapAdapter } from './MapAdapter';
import { boundsOf, corridorFitPoints } from './routeContextCorridor';
import { extentMeters, maximizeFitBearing, principalBearing, segmentBearingForViewport, SEGMENT_FOCUS_MAX_ZOOM } from './routeCameraFocus';

export type RouteCameraMode = 'ROUTE_OVERVIEW' | 'SEGMENT_FOCUS' | 'TRANSFER_FOCUS' | 'STOP_FOCUS' | 'MANUAL_CAMERA';

export interface RouteCameraState {
  mode: RouteCameraMode;
  activeSegmentId: string | null;
  activeStopId: string | null;
  activeStopCoordinate: Coordinate | null;
  activeTransferId: string | null;
  activeTransferCoordinate: Coordinate | null;
  activeTransferPoints: Coordinate[] | null;
}

export function initialRouteCameraState(): RouteCameraState {
  return {
    mode: 'ROUTE_OVERVIEW',
    activeSegmentId: null,
    activeStopId: null,
    activeStopCoordinate: null,
    activeTransferId: null,
    activeTransferCoordinate: null,
    activeTransferPoints: null,
  };
}

export function shouldShowRecenterButton(state: RouteCameraState): boolean {
  return state.mode === 'MANUAL_CAMERA'
    || state.mode === 'SEGMENT_FOCUS'
    || state.mode === 'TRANSFER_FOCUS'
    || state.mode === 'STOP_FOCUS';
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
  /** Real map band left by the sheet: a wide strip calls for a horizontal leg. */
  visibleArea?: { width: number; height: number },
): SegmentFocusTarget | null {
  if (segmentCoordinates.length < 2) return null;
  const points = corridorFitPoints(segmentCoordinates, contextLines, 0.5);
  const bounds = boundsOf(points);
  const preferredBearing = segmentBearingForViewport(
    principalBearing(segmentCoordinates),
    visibleArea?.width ?? 1,
    visibleArea?.height ?? 2,
  );
  const measuredVisibleArea = visibleArea && visibleArea.width > 0 && visibleArea.height > 0 ? visibleArea : null;
  const bearing = extentMeters(segmentCoordinates) > 60
    ? measuredVisibleArea
      ? maximizeFitBearing(points, measuredVisibleArea.width, measuredVisibleArea.height, preferredBearing, SEGMENT_FOCUS_MAX_ZOOM)
      : preferredBearing
    : null;
  const boundsKey = bounds ? bounds.map((val) => val.toFixed(5)).join(',') : '';
  const bearingKey = bearing === null ? 'flat' : bearing.toFixed(1);
  return {
    points,
    bearing,
    key: `${segmentId}:${points.length}:${bearingKey}:${boundsKey}`,
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
      ...initialRouteCameraState(),
      mode: 'ROUTE_OVERVIEW',
    });
    this.adapter?.setActiveRouteSegment?.(null);
    const padding = { ...this.padding, bearing: 0 };
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
      ...initialRouteCameraState(),
      mode: 'SEGMENT_FOCUS',
      activeSegmentId: segmentId,
    });
    this.adapter?.setActiveRouteSegment?.(segmentId);
    const padding = {
      ...this.padding,
      bearing: target.bearing ?? 0,
    };
    this.adapter?.focusCoordinates?.(target.points, padding, SEGMENT_FOCUS_MAX_ZOOM, segmentId);
  }

  focusTransfer(transferId: string, coordinate: Coordinate, contextPoints: Coordinate[] = []) {
    const points = contextPoints.length >= 2 ? contextPoints : [coordinate];
    this.updateState({
      ...initialRouteCameraState(),
      mode: 'TRANSFER_FOCUS',
      activeTransferId: transferId,
      activeTransferCoordinate: coordinate,
      activeTransferPoints: points,
    });
    this.adapter?.setActiveRouteSegment?.(null);
    // A short two-point corridor keeps the transfer inside the sheet-aware fit
    // rectangle without zooming so far that the adjoining segments are lost.
    this.adapter?.focusCoordinates?.(points, { ...this.padding, bearing: 0 }, 16.4);
  }

  focusStop(stopId: string, coordinate: Coordinate) {
    this.updateState({
      ...initialRouteCameraState(),
      mode: 'STOP_FOCUS',
      activeStopId: stopId,
      activeStopCoordinate: coordinate,
    });
    // Smoothly focus on stop position with clear zoom, inside the visible map band.
    this.adapter?.focus(coordinate, 16.5, this.padding);
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
    if (this.state.mode === 'TRANSFER_FOCUS' && this.state.activeTransferPoints?.length) {
      this.adapter?.focusCoordinates?.(this.state.activeTransferPoints, { ...this.padding, bearing: 0 }, 16.4);
      return;
    }
    if (this.state.mode === 'SEGMENT_FOCUS' && options.segmentTarget) {
      const padding = {
        ...this.padding,
        bearing: options.segmentTarget.bearing ?? 0,
      };
      this.adapter?.focusCoordinates?.(options.segmentTarget.points, padding, 17, this.state.activeSegmentId ?? undefined);
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
