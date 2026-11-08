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
  /**
   * Height of floating chrome anchored above the sheet (the live-leg chip).
   * The fit rectangle has to clear it as well, otherwise the last focus point
   * lands behind a control sitting inside the bottom of the visible band.
   */
  extraBottomInset?: number;
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
    extraBottomInset = 0,
    bearing,
  } = options;
  const extraBottom = Math.max(0, extraBottomInset);

  if (isDesktop) {
    // The live chip is centred over the map on desktop too, anchored at the
    // sheet's detent height; keep the corridor above it instead of behind it.
    return {
      top: 96 + (hasWarningNote ? 24 : 0),
      left: 490,
      right: 40,
      bottom: extraBottom > 0 ? sheetHeight + 8 + extraBottom : 40,
      bearing: bearing ?? 0,
    };
  }

  // Mobile viewport:
  // Top padding clears the compact header
  const top = topBarHeight + (hasWarningNote ? 26 : 0) + 6;

  // Bottom padding must clear the sheet itself, not just leave a nominal band:
  // the fit rectangle ends above the sheet top, so a focused point or segment is
  // never projected underneath the sheet. Floating chrome above the sheet (the
  // live-leg chip) is part of that inset for the same reason. MapLibre only
  // requires the combined vertical padding to stay below the viewport, which
  // keeps this honest even at the expanded detent on short phones.
  const bottom = Math.min(sheetHeight + 8 + extraBottom, Math.max(8, viewportHeight - top - 8));

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
