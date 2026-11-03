import type { Coordinate } from '../../shared/navigation/contracts';

/** west, south, east, north. */
export type GeoBbox = [number, number, number, number];

/** Roughly 440 m at Ukrainian latitudes: enough to keep a short walk leg readable. */
const MIN_CORRIDOR_PAD_DEGREES = 0.004;
/** Stops a single long tram line from pulling the camera past the city. */
const MAX_CORRIDOR_PAD_DEGREES = 0.02;

export function boundsOf(points: readonly Coordinate[]): GeoBbox | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    if (point[0] < west) west = point[0];
    if (point[0] > east) east = point[0];
    if (point[1] < south) south = point[1];
    if (point[1] > north) north = point[1];
  }
  if (!Number.isFinite(west) || !Number.isFinite(south)) return null;
  return [west, south, east, north];
}

/**
 * The published line of a vehicle runs for tens of kilometres, far beyond the
 * ride a passenger takes. Framing it whole shrinks a 6 km itinerary to a dot in
 * a city-wide view with no legible streets, so the camera is fitted against the
 * itinerary plus a corridor: the line is still visible approaching and leaving
 * the ride, but the surrounding streets stay readable.
 */
export function contextCorridor(points: readonly Coordinate[], ratio = 0.3): GeoBbox | null {
  const bounds = boundsOf(points);
  if (!bounds) return null;
  const span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  const pad = Math.min(MAX_CORRIDOR_PAD_DEGREES, Math.max(MIN_CORRIDOR_PAD_DEGREES, span * ratio));
  return [bounds[0] - pad, bounds[1] - pad, bounds[2] + pad, bounds[3] + pad];
}

const inside = (point: Coordinate, bbox: GeoBbox) =>
  point[0] >= bbox[0] && point[0] <= bbox[2] && point[1] >= bbox[1] && point[1] <= bbox[3];

/** Liang–Barsky: the part of a→b that lies inside the box, or null when it misses it. */
function clipSegment(a: Coordinate, b: Coordinate, box: GeoBbox): { enter: Coordinate; exit: Coordinate } | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let enter = 0;
  let exit = 1;
  const edges: Array<[number, number]> = [
    [-dx, a[0] - box[0]],
    [dx, box[2] - a[0]],
    [-dy, a[1] - box[1]],
    [dy, box[3] - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) {
      if (ratio > exit) return null;
      if (ratio > enter) enter = ratio;
    } else {
      if (ratio < enter) return null;
      if (ratio < exit) exit = ratio;
    }
  }
  const at = (t: number): Coordinate => [a[0] + dx * t, a[1] + dy * t];
  return { enter: at(enter), exit: at(exit) };
}

/**
 * Contiguous stretches of a polyline inside the corridor. Every run starts and
 * ends exactly on the corridor edge, so nothing far outside is ever handed to
 * the camera, and a run never bridges an excluded stretch: that would draw a
 * straight chord across road the vehicle does not drive.
 */
export function clipToBbox(points: readonly Coordinate[], bbox: GeoBbox): Coordinate[][] {
  const runs: Coordinate[][] = [];
  let run: Coordinate[] | null = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const piece = clipSegment(from, to, bbox);
    if (!piece) {
      if (run && run.length >= 2) runs.push(run);
      run = null;
      continue;
    }
    if (!run) run = [inside(from, bbox) ? from : piece.enter];
    else if (!inside(from, bbox)) {
      if (run.length >= 2) runs.push(run);
      run = [piece.enter];
    }
    run.push(piece.exit);
    if (!inside(to, bbox)) {
      if (run.length >= 2) runs.push(run);
      run = null;
    }
  }
  if (run && run.length >= 2) runs.push(run);
  return runs;
}

/** Fit geometry: the itinerary itself plus only the nearby parts of every line it rides. */
export function corridorFitPoints(
  itinerary: readonly Coordinate[],
  contextLines: ReadonlyArray<readonly Coordinate[]>,
  ratio = 0.3,
): Coordinate[] {
  const points = [...itinerary];
  const corridor = contextCorridor(itinerary, ratio);
  if (!corridor) return points;
  for (const line of contextLines) {
    for (const run of clipToBbox(line, corridor)) points.push(...run);
  }
  return points;
}
