/**
 * Camera ownership for the active-journey map. Exactly one owner drives the
 * camera at a time: the stage refit, the HyperFlight preview, a rider gesture,
 * or GPS follow. The stage refit must never fight a live owner.
 */
export type JourneyCameraOwner = 'stage' | 'preview' | 'user' | 'follow';

/**
 * The stage refit may move the camera only while it owns the camera, or while
 * GPS follow is waiting for a fresh fix (honest fallback: show the planned
 * stage instead of an invented position). Preview and rider gestures keep the
 * frame they chose until the rider explicitly returns to the stage or to GPS.
 */
export function shouldFocusJourneyStage(owner: JourneyCameraOwner, hasFreshFix: boolean): boolean {
  if (owner === 'stage') return true;
  return owner === 'follow' && !hasFreshFix;
}