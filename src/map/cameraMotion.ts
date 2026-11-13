/** Keep map-camera movement consistent with the user's reduced-motion preference. */
export function cameraMotionDuration(durationMs: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : durationMs;
}

/** How far the camera travels: centre displacement, zoom change and turn angle. */
export type CameraMoveEffort = {
  distanceMeters?: number;
  zoomDelta?: number;
  bearingDelta?: number;
};

/**
 * Context-aware glide (ТЗ §7): a near-static refit snaps, a cross-city move
 * glides cinematically. The dominant of distance / zoom / turn sets the effort,
 * so one fixed animation never plays for every situation. The caller still runs
 * the result through cameraMotionDuration for reduced motion.
 */
export function adaptiveCameraDuration(baseMs: number, effort: CameraMoveEffort = {}): number {
  if (!Number.isFinite(baseMs) || baseMs <= 0) return 0;
  const distance = Number.isFinite(effort.distanceMeters) ? Math.max(0, effort.distanceMeters!) : 0;
  const zoom = Number.isFinite(effort.zoomDelta) ? Math.abs(effort.zoomDelta!) : 0;
  const bearing = Number.isFinite(effort.bearingDelta) ? Math.abs(effort.bearingDelta!) : 0;
  // Normalise each signal to 0..1: 2 km centre travel, 4 zoom levels, a 90° turn.
  const level = Math.max(Math.min(1, distance / 2000), Math.min(1, zoom / 4), Math.min(1, bearing / 90));
  const scaled = baseMs * (0.6 + 0.9 * level);
  // Never slower than half the base, never a leisurely >1.4 s that delays the user.
  const capped = Math.min(1400, Math.max(baseMs * 0.5, scaled));
  return Math.round(capped / 10) * 10;
}

/** The entrance easing from the motion tokens: cubic-bezier(.16,.84,.28,1). */
export const CAMERA_ENTRANCE_BEZIER = [0.16, 0.84, 0.28, 1] as const;
/** A focused leg gets a longer glide than an overview refit so the turn reads. */
export const CAMERA_FOCUS_DURATION_MS = 700;
/** A manual zoom step is feedback, not a journey: shorter than the overview refit. */
export const CAMERA_ZOOM_STEP_DURATION_MS = 320;

/**
 * MapLibre takes a plain easing function; this is the same cubic-bezier the CSS
 * entrance uses, so a map turn and the sheet move share one motion language.
 */
export function cameraEasing(bezier: readonly [number, number, number, number] = CAMERA_ENTRANCE_BEZIER): (progress: number) => number {
  const [x1, y1, x2, y2] = bezier;
  const sample = (control1: number, control2: number, t: number) => {
    const inverse = 1 - t;
    return 3 * inverse * inverse * t * control1 + 3 * inverse * t * t * control2 + t * t * t;
  };
  return (progress: number) => {
    if (!(progress > 0)) return 0;
    if (progress >= 1) return 1;
    let low = 0;
    let high = 1;
    let t = progress;
    for (let step = 0; step < 24; step += 1) {
      const x = sample(x1, x2, t);
      if (Math.abs(x - progress) < 1e-5) break;
      if (x < progress) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return sample(y1, y2, t);
  };
}

/**
 * MapLibre emits camera-start events for both programmatic moves and user input, and only real
 * input carries an `originalEvent`, so that is the whole test for whose hand is on the camera.
 * Ownership must be published on every gesture: a programmatic focus already leaves the camera in
 * the free mode, and a screen that never hears about the second gesture keeps auto-refitting
 * straight over the rider's own pan.
 *
 * Taking ownership deliberately does NOT stop the map. MapLibre already interrupts our animation
 * the gesture-preserving way (`camera.stop(true)`) as soon as a handler is active, while a plain
 * `map.stop()` also resets every handler and clears the recorded inertia — which kills the gesture
 * that is still in progress: the pinch loses its two-finger state after its first frame, and a
 * flick loses the momentum the rider just paid for.
 */
export function claimCameraForUserGesture(
  originalEvent: unknown,
  enterManualMode: () => void,
): boolean {
  if (originalEvent === undefined || originalEvent === null) return false;
  enterManualMode();
  return true;
}
