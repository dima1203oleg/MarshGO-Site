/** Keep map-camera movement consistent with the user's reduced-motion preference. */
export function cameraMotionDuration(durationMs: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : durationMs;
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
