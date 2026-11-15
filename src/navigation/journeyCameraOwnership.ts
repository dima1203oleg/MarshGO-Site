export type JourneyCameraOwner = 'stage' | 'preview' | 'user' | 'follow';

/**
 * If GPS follow has no fresh fix yet, keep the selected journey stage framed.
 * Manual camera control and cinematic preview retain ownership of the camera.
 */
export function shouldFocusJourneyStage(owner: JourneyCameraOwner, hasFreshFix: boolean): boolean {
  return owner === 'stage' || (owner === 'follow' && !hasFreshFix);
}
