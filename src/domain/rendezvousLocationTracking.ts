import type { ApiRendezvous } from '../services/productionApi';

const terminalRendezvousStates = new Set(['BOARDING', 'COMPLETED', 'CANCELLED', 'EXPIRED']);

/** GPS watch is foreground-only and requires explicit consent from both participants. */
export function shouldWatchRendezvousLocation(
  session: ApiRendezvous,
  authenticated: boolean,
  pageVisible: boolean,
): boolean {
  return authenticated
    && pageVisible
    && session.locationSharingEnabled
    && session.currentParticipantConsent
    && session.otherParticipantConsent
    && !terminalRendezvousStates.has(session.state);
}
