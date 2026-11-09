/** Keep map-camera movement consistent with the user's reduced-motion preference. */
export function cameraMotionDuration(durationMs: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : durationMs;
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

/** MapLibre emits camera-start events for both programmatic moves and user input. */
export function interruptCameraForUserGesture(
  originalEvent: unknown,
  cameraMode: string,
  stopAnimation: () => void,
  enterManualMode: () => void,
): boolean {
  if (originalEvent === undefined || originalEvent === null) return false;
  stopAnimation();
  if (cameraMode !== 'FREE') enterManualMode();
  return true;
}
