export type FloatingInfoAnchor = 'bottom' | 'top' | 'left' | 'right';
export type FloatingInfoPoint = { x: number; y: number };
export type FloatingInfoRect = { left: number; top: number; right: number; bottom: number };
export type FloatingInfoSize = { width: number; height: number };
export type FloatingInfoPlacement = { anchor: FloatingInfoAnchor; offset: [number, number] };

const PLACEMENTS: readonly FloatingInfoPlacement[] = [
  { anchor: 'bottom', offset: [0, -28] },
  { anchor: 'right', offset: [-14, -28] },
  { anchor: 'left', offset: [14, -28] },
  { anchor: 'top', offset: [0, 14] },
];

function markerRect(point: FloatingInfoPoint, size: FloatingInfoSize, placement: FloatingInfoPlacement): FloatingInfoRect {
  const x = point.x + placement.offset[0];
  const y = point.y + placement.offset[1];
  const left = placement.anchor === 'left' ? x : placement.anchor === 'right' ? x - size.width : x - size.width / 2;
  const top = placement.anchor === 'top' ? y : placement.anchor === 'bottom' ? y - size.height : y - size.height / 2;
  return { left, top, right: left + size.width, bottom: top + size.height };
}

function overlapArea(a: FloatingInfoRect, b: FloatingInfoRect): number {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

function placementCost(rect: FloatingInfoRect, viewport: FloatingInfoSize, obstacles: readonly FloatingInfoRect[], placement: FloatingInfoPlacement): number {
  const edge = 8;
  const horizontalOverflow = Math.max(0, edge - rect.left) + Math.max(0, rect.right - (viewport.width - edge));
  const verticalOverflow = Math.max(0, edge - rect.top) + Math.max(0, rect.bottom - (viewport.height - edge));
  const collision = obstacles.reduce((total, obstacle) => total + overlapArea(rect, {
    left: obstacle.left - 6,
    top: obstacle.top - 6,
    right: obstacle.right + 6,
    bottom: obstacle.bottom + 6,
  }), 0);
  const displacement = Math.hypot(placement.offset[0], placement.offset[1] + 28);
  return collision * 4 + (horizontalOverflow + verticalOverflow) * Math.max(1, Math.min(rect.right - rect.left, rect.bottom - rect.top)) + displacement * 0.15;
}

/** Choose the nearest legible anchor that avoids the map controls, sheet and viewport edges. */
export function resolveFloatingInfoPlacement(
  point: FloatingInfoPoint,
  size: FloatingInfoSize,
  viewport: FloatingInfoSize,
  obstacles: readonly FloatingInfoRect[] = [],
): FloatingInfoPlacement {
  let best = PLACEMENTS[0];
  let bestCost = Number.POSITIVE_INFINITY;
  const edgePlacements = obstacles.flatMap(obstacle => [
    { anchor: 'right' as const, offset: [obstacle.left - 8 - point.x, -28] as [number, number] },
    { anchor: 'left' as const, offset: [obstacle.right + 8 - point.x, -28] as [number, number] },
    { anchor: 'bottom' as const, offset: [0, obstacle.top - 8 - point.y] as [number, number] },
    { anchor: 'top' as const, offset: [0, obstacle.bottom + 8 - point.y] as [number, number] },
  ]);
  for (const placement of [...PLACEMENTS, ...edgePlacements]) {
    const rect = markerRect(point, size, placement);
    const cost = placementCost(rect, viewport, obstacles, placement);
    if (cost < bestCost) {
      best = placement;
      bestCost = cost;
    }
  }
  return best;
}
