import type { MapAnnotation, MapAnnotationKind } from './MapAdapter';

/**
 * Screen-space placement for the route map's DOM callouts (.mg-map-label).
 * Two callouts must never print on top of each other and a terminus chip must
 * never hang off the viewport edge, so labels are projected and de-cluttered
 * here — a pure module, testable without a map or a DOM.
 */

/**
 * Passenger-critical fixes win the scarce space; live extras lose it.
 * A suppressed WALK callout hides nothing dishonestly: the walk duration and
 * distance always remain in the matching segment row of the bottom sheet.
 */
const KIND_PRIORITY: Record<MapAnnotationKind, number> = {
  BOARDING: 0,
  ALIGHTING: 0,
  TERMINUS: 1,
  WALK: 2,
  ROUTE: 3,
  VEHICLE: 4,
};

export type LabelScreenAnchor = 'center' | 'left' | 'right';
export type LabelBox = { width: number; height: number };
export type LabelRect = { left: number; top: number; right: number; bottom: number };
export type PlacedJourneyLabel = { annotation: MapAnnotation; anchor: LabelScreenAnchor; offset?: [number, number] };

export function labelPriority(kind: MapAnnotationKind): number {
  return KIND_PRIORITY[kind];
}

/**
 * Upper-bound pixel footprint of the .mg-map-label CSS (src/index.css): a 12-13 px
 * bold Cyrillic face measured at 8 px per glyph, the 216 px max-width, and the
 * per-kind layout (walk = glyph circle + stacked body; boarding/alighting =
 * coloured chip over a caption; terminus = kicker over a place name; line and
 * vehicle = one-row badge). The estimate is deliberately generous — rounding an
 * overlap the same way errs toward suppressing a low-priority label instead of
 * printing one callout on top of another.
 */
export function estimateLabelBoxPx(annotation: Pick<MapAnnotation, 'kind' | 'title' | 'detail'>): LabelBox {
  const titleWidth = annotation.title.length * 8;
  const detailWidth = annotation.detail ? annotation.detail.length * 8 : 0;
  switch (annotation.kind) {
    case 'WALK':
      return { width: Math.min(236, 51 + Math.max(titleWidth, detailWidth)), height: detailWidth ? 43 : 28 };
    case 'BOARDING':
    case 'ALIGHTING':
      // The caption wraps at its own 190 px max-width; the chip never exceeds the box clamp.
      return { width: Math.max(Math.min(190, detailWidth), Math.min(236, titleWidth + 40)), height: detailWidth ? 48 : 30 };
    case 'TERMINUS':
      return { width: Math.min(236, 20 + Math.max(titleWidth, detailWidth)), height: detailWidth ? 42 : 26 };
    case 'ROUTE':
    case 'VEHICLE':
    default:
      return { width: Math.min(236, 42 + titleWidth + (detailWidth ? detailWidth + 8 : 0)), height: detailWidth ? 30 : 26 };
  }
}

/**
 * Marker box on screen for a projected anchor point. MapLibre 'left'/'right'
 * anchors pin the coordinate to the box's left/right edge (the chip then grows
 * toward the opposite side), 'center' pins it to the middle.
 */
export function labelRectPx(point: { x: number; y: number }, box: LabelBox, anchor: LabelScreenAnchor): LabelRect {
  const left = anchor === 'left' ? point.x : anchor === 'right' ? point.x - box.width : point.x - box.width / 2;
  const top = point.y - box.height / 2;
  return { left, top, right: left + box.width, bottom: top + box.height };
}

/**
 * A centred chip that would spill past the viewport edge is re-anchored on the
 * edge nearest its margin so the label grows toward the map interior — the
 * passenger never reads a truncated «Посадка»/«Висадка».
 */
export function edgeAnchorFor(point: { x: number }, box: LabelBox, viewportWidth: number): LabelScreenAnchor {
  if (point.x - box.width / 2 >= 0 && point.x + box.width / 2 <= viewportWidth) return 'center';
  return point.x <= viewportWidth / 2 ? 'left' : 'right';
}

function rectsOverlap(a: LabelRect, b: LabelRect, gapPx: number): boolean {
  return a.left - gapPx < b.right && b.left - gapPx < a.right
    && a.top - gapPx < b.bottom && b.top - gapPx < a.bottom;
}

/**
 * Greedy priority de-clutter: labels are considered in
 * BOARDING/ALIGHTING > TERMINUS > WALK > ROUTE > VEHICLE order (feed order
 * breaks ties) and a label whose screen box comes within `minGapPx` of an
 * already-accepted box is suppressed entirely instead of drawn on top.
 * `project` is the caller's map.project() accessor; returning null (or a
 * non-finite point) drops the label from placement for this camera.
 */
export function placeJourneyLabels(
  annotations: readonly MapAnnotation[],
  project: (annotation: MapAnnotation) => { x: number; y: number } | null,
  viewport: { width: number; height: number },
  minGapPx = 4,
): PlacedJourneyLabel[] {
  const candidates = annotations.flatMap((annotation, index) => {
    const point = project(annotation);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
    const box = estimateLabelBoxPx(annotation);
    const anchor: LabelScreenAnchor = annotation.kind === 'BOARDING' || annotation.kind === 'ALIGHTING'
      ? edgeAnchorFor(point, box, viewport.width)
      : 'center';
    const isStopCallout = annotation.kind === 'BOARDING' || annotation.kind === 'ALIGHTING';
    const anchorOptions: LabelScreenAnchor[] = isStopCallout || annotation.kind === 'ROUTE'
      ? [...new Set([anchor, 'center', 'left', 'right'] as LabelScreenAnchor[])]
      : [anchor];
    const offsetOptions: Array<[number, number]> = isStopCallout
      ? [[0, 0], [0, -34], [0, 34], [-28, 0], [28, 0]]
      : [[0, 0]];
    return [{ annotation, point, box, anchor, anchorOptions, offsetOptions, rect: labelRectPx(point, box, anchor), priority: KIND_PRIORITY[annotation.kind], index }];
  });
  candidates.sort((a, b) => a.priority - b.priority || a.index - b.index);
  const accepted: Array<{ rect: LabelRect; label: PlacedJourneyLabel; index: number }> = [];
  for (const candidate of candidates) {
    if (candidate.annotation.kind !== 'ROUTE'
      && candidate.annotation.kind !== 'BOARDING'
      && candidate.annotation.kind !== 'ALIGHTING') {
      if (accepted.some(item => rectsOverlap(item.rect, candidate.rect, minGapPx))) continue;
      accepted.push({ rect: candidate.rect, label: { annotation: candidate.annotation, anchor: candidate.anchor }, index: candidate.index });
      continue;
    }
    const placement = candidate.offsetOptions.flatMap(offset => candidate.anchorOptions.map(anchor => ({
      anchor,
      offset,
      rect: labelRectPx({ x: candidate.point.x + offset[0], y: candidate.point.y + offset[1] }, candidate.box, anchor),
    }))).find(({ rect }) => rect.left >= 0 && rect.right <= viewport.width
      && rect.top >= 0 && rect.bottom <= viewport.height
      && !accepted.some(item => rectsOverlap(item.rect, rect, minGapPx)));
    if (!placement) continue;
    accepted.push({ rect: placement.rect, label: {
      annotation: candidate.annotation,
      anchor: placement.anchor,
      ...(placement.offset[0] || placement.offset[1] ? { offset: placement.offset } : {}),
    }, index: candidate.index });
  }
  // Feed order back out so the id-keyed DOM reconciliation never re-shuffles nodes.
  return accepted.sort((a, b) => a.index - b.index).map(item => item.label);
}
