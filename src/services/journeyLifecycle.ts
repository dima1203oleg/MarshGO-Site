import type { ApiJourneyLifecycle } from './productionApi';

type JourneyLifecycleApi = {
  activateJourney(id: string, legId?: string): Promise<ApiJourneyLifecycle>;
  endJourney(id: string, outcome: 'COMPLETED' | 'CANCELLED'): Promise<ApiJourneyLifecycle>;
};

export type JourneyLifecycleOutcome =
  | { readonly confirmed: true; readonly state: string; readonly currentLegId: string | null; readonly message: string | null }
  | { readonly confirmed: false; readonly state: null; readonly currentLegId: null; readonly message: string };

const declined = (_error: unknown, fallback: string): JourneyLifecycleOutcome => ({
  confirmed: false,
  state: null,
  currentLegId: null,
  // Keep transport/server diagnostics out of the passenger interface.
  message: fallback,
});

/**
 * Starting navigation lets the server own `journeys.state`. The stage map may still
 * open when this call fails — the plan itself is readable offline — but the outcome
 * never reports the journey as running, so the Trips list keeps showing the truth.
 */
export async function activatePassengerJourney(
  api: JourneyLifecycleApi,
  journeyId: string,
  legId?: string | null,
): Promise<JourneyLifecycleOutcome> {
  try {
    const result = await api.activateJourney(journeyId, legId ?? undefined);
    return { confirmed: true, state: result.state, currentLegId: result.currentLegId ?? null, message: null };
  } catch (error) {
    return declined(error, 'Поїздку не позначено як активну.');
  }
}

export async function completePassengerJourney(
  api: JourneyLifecycleApi,
  journeyId: string,
): Promise<JourneyLifecycleOutcome> {
  try {
    const result = await api.endJourney(journeyId, 'COMPLETED');
    return { confirmed: true, state: result.state, currentLegId: null, message: null };
  } catch (error) {
    return declined(error, 'Поїздку не вдалося завершити.');
  }
}

/**
 * States where the passenger is still on the way: a reload or a PWA relaunch of
 * such a journey returns to the stage screen instead of the plan overview.
 */
export function isRestorableJourneyState(state: string): boolean {
  return state === 'ACTIVE' || state === 'TRANSFER';
}
