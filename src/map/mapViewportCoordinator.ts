import type { RouteFitPadding } from './MapAdapter';
import type { RouteSheetSnap } from '../views/routeSheet';

export type MapViewportInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  bearing?: number;
};

export type MapVisibleArea = {
  viewportWidth: number;
  viewportHeight: number;
  insets: MapViewportInsets;
  visibleWidth: number;
  visibleHeight: number;
  visibleCenterY: number;
};

export interface ViewportCoordinateOptions {
  viewportWidth: number;
  viewportHeight: number;
  sheetHeight: number;
  sheetSnap: RouteSheetSnap;
  topBarHeight?: number;
  isDesktop?: boolean;
  hasWarningNote?: boolean;
  bearing?: number;
}

/**
 * Calculates real visible bounds and padding for MapLibre camera fitting.
 * Keeps the route centered within the area between the compact top bar and bottom sheet,
 * leaving sufficient margins while maximizing street readability.
 */
export function calculateAdaptiveMapPadding(options: ViewportCoordinateOptions): RouteFitPadding {
  const {
    viewportWidth,
    viewportHeight,
    sheetHeight,
    sheetSnap: _sheetSnap,
    topBarHeight = 92,
    isDesktop = false,
    hasWarningNote = false,
    bearing,
  } = options;

  if (isDesktop) {
    return {
      top: 96 + (hasWarningNote ? 24 : 0),
      left: 490,
      right: 40,
      bottom: 40,
      bearing: bearing ?? 0,
    };
  }

  // Mobile viewport:
  // Top padding clears the compact header
  const top = topBarHeight + (hasWarningNote ? 26 : 0) + 6;

  // Bottom padding clears the bottom sheet height with a safe 12px breathing margin.
  // In expanded state, guarantee at least 96–120 px of top interactive map strip.
  const minVisibleMapHeight = Math.min(120, Math.max(96, Math.round(viewportHeight * 0.14)));
  const maxSafeBottom = Math.max(60, viewportHeight - top - minVisibleMapHeight);
  const bottom = Math.min(sheetHeight + 12, maxSafeBottom);

  // Side margins: compact 18–24px to maximize horizontal route span.
  const side = Math.min(24, Math.max(16, Math.round(viewportWidth * 0.05)));

  return {
    top,
    right: side,
    bottom,
    left: side,
    ...(typeof bearing === 'number' && Number.isFinite(bearing) ? { bearing } : {}),
  };
}

export function computeVisibleMapArea(options: ViewportCoordinateOptions): MapVisibleArea {
  const insets = calculateAdaptiveMapPadding(options);
  const width = options.viewportWidth;
  const height = options.viewportHeight;
  const visibleWidth = Math.max(1, width - (insets.left ?? 0) - (insets.right ?? 0));
  const visibleHeight = Math.max(1, height - (insets.top ?? 0) - (insets.bottom ?? 0));
  const visibleCenterY = (insets.top ?? 0) + visibleHeight / 2;

  return {
    viewportWidth: width,
    viewportHeight: height,
    insets: {
      top: insets.top ?? 0,
      right: insets.right ?? 0,
      bottom: insets.bottom ?? 0,
      left: insets.left ?? 0,
      bearing: insets.bearing,
    },
    visibleWidth,
    visibleHeight,
    visibleCenterY,
  };
}
