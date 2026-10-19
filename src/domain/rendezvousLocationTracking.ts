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
    && session.currentParticipantConsent === true
    && session.otherParticipantConsent === true
    && !terminalRendezvousStates.has(session.state);
}

/** Validate realtime push samples at the UI boundary; never trust an event payload as fresh GPS by itself. */
export function isFreshRendezvousSample(
  coordinates: unknown,
  capturedAt: unknown,
  now = Date.now(),
): coordinates is [number, number] {
  if (!Array.isArray(coordinates) || coordinates.length !== 2
    || !Number.isFinite(coordinates[0]) || Math.abs(coordinates[0]) > 180
    || !Number.isFinite(coordinates[1]) || Math.abs(coordinates[1]) > 90
    || typeof capturedAt !== 'string') return false;
  const captured = Date.parse(capturedAt);
  return Number.isFinite(captured) && now - captured <= 90_000 && captured - now <= 30_000;
}
