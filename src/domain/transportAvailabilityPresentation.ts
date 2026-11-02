import { hasJourneySearchProvider, isJourneySearchSupported, type TransportTypeId } from './transportPreferences';
import type { ApiTransportProviders } from '../services/productionApi';

/** Copy for a disabled category; distinguish missing routing support from missing local coverage. */
export function transportUnavailableMessage(type: TransportTypeId, groups: ApiTransportProviders[] | null): string | undefined {
  if (!isJourneySearchSupported(type)) return 'Цей вид транспорту поки не підтримується в пошуку маршрутів.';
  if (groups !== null && !hasJourneySearchProvider(type, groups)) return 'Немає підключеного провайдера для пошуку в цьому районі.';
  return undefined;
}

/** Static bicycle networks show places and return rules, not live vehicle availability. */
export function staticBikeAvailabilityMessage(sources: readonly string[]): string | undefined {
  return sources.includes('static-bike-network-estimate')
    ? 'Точки мережі доступні; наявність вільних велосипедів не підтверджена.'
    : undefined;
}
