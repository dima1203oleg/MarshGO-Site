export type ScreenPoint = { x: number; y: number };
export type ScreenRect = { left: number; top: number; right: number; bottom: number };

function overlaps(a: ScreenRect, b: ScreenRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Keep a floating guidance card inside the usable map and off stop labels. */
export function placeGuidanceCallout(
  preferred: ScreenPoint,
  size: { width: number; height: number },
  bounds: ScreenRect,
  obstructions: ScreenRect[],
): ScreenPoint {
  const { width, height } = size;
  const candidates: ScreenPoint[] = [preferred];
  for (const obstruction of obstructions) {
    candidates.push(
      { x: preferred.x, y: obstruction.top + 6 },
      { x: obstruction.left - width / 2 - 8, y: preferred.y },
      { x: obstruction.right + width / 2 + 8, y: preferred.y },
      { x: preferred.x, y: obstruction.bottom + height + 22 },
    );
  }

  const maxX = Math.max(bounds.left + width / 2, bounds.right - width / 2);
  const minY = bounds.top + height + 14;
  const maxY = bounds.bottom + 14;
  let best: ScreenPoint | null = null;
  let bestOverlap = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const point = {
      x: Math.max(bounds.left + width / 2, Math.min(maxX, candidate.x)),
      y: Math.max(minY, Math.min(maxY, candidate.y)),
    };
    const rect = { left: point.x - width / 2, right: point.x + width / 2, top: point.y - height - 14, bottom: point.y - 14 };
    const collisions = obstructions.filter(obstruction => overlaps(rect, obstruction)).length;
    if (collisions === 0) return point;
    if (collisions < bestOverlap) { best = point; bestOverlap = collisions; }
  }
  return best ?? { x: Math.max(bounds.left + width / 2, Math.min(maxX, preferred.x)), y: Math.max(minY, Math.min(maxY, preferred.y)) };
}
