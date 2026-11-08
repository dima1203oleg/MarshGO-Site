/**
 * Screen-space proof that a camera fit landed where the passenger can see it.
 *
 * The map publishes this for the last fit target after every settle, and the
 * route-screen acceptance probe reads the same numbers from the DOM. Keeping
 * the geometry here (instead of inside the adapter) lets a unit test pin the
 * "inside the visible band" rule without a browser or a tile server.
 */
export type ProjectedPoint = { x: number; y: number };
export type ScreenRect = { left: number; top: number; right: number; bottom: number };

export type FocusMeasurement = {
  pointCount: number;
  insideCount: number;
  insideRatio: number;
  bbox: ScreenRect | null;
  /** Smallest distance from a projected point to the rect edge; negative means outside. */
  minMarginPx: number | null;
  bboxInside: boolean;
};

/**
 * A point fitted to the edge of the padded rect projects onto it within
 * floating-point noise (observed |margin| ~ 1e-10 px). Pixel resolution starts
 * at 1e-6 px, so treating smaller negatives as inside keeps the proof about
 * geometry rather than about double subtraction.
 */
const EDGE_EPSILON_PX = 1e-6;

export function measureProjectedFocus(points: readonly ProjectedPoint[], rect: ScreenRect): FocusMeasurement {
  const pointCount = points.length;
  if (pointCount === 0) {
    return { pointCount: 0, insideCount: 0, insideRatio: 0, bbox: null, minMarginPx: null, bboxInside: false };
  }
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  let insideCount = 0;
  let minMarginPx = Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    const margin = Math.min(point.x - rect.left, rect.right - point.x, point.y - rect.top, rect.bottom - point.y);
    minMarginPx = Math.min(minMarginPx, margin);
    if (margin >= -EDGE_EPSILON_PX) insideCount += 1;
  }
  if (!Number.isFinite(minX)) {
    return { pointCount, insideCount: 0, insideRatio: 0, bbox: null, minMarginPx: null, bboxInside: false };
  }
  const bbox = { left: minX, top: minY, right: maxX, bottom: maxY };
  return {
    pointCount,
    insideCount,
    insideRatio: insideCount / pointCount,
    bbox,
    minMarginPx,
    bboxInside: bbox.left >= rect.left - EDGE_EPSILON_PX && bbox.right <= rect.right + EDGE_EPSILON_PX
      && bbox.top >= rect.top - EDGE_EPSILON_PX && bbox.bottom <= rect.bottom + EDGE_EPSILON_PX,
  };
}
