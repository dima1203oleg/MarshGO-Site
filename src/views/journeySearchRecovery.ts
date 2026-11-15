import { NETWORK_ERROR_CODE } from '../services/requestErrorMessage';
import type { ApiJourneySearchResult } from '../services/productionApi';

export type JourneySearchFailureKind = 'unavailable' | 'auth' | 'error';

/**
 * Structural match on ProductionApiError's public shape (status/code), same contract as the
 * geocoder recovery helper: the class itself needs browser globals, so tests classify plain
 * objects carrying the same fields.
 */
export function journeySearchFailureKind(error: unknown): JourneySearchFailureKind {
  if (typeof error === 'object' && error !== null) {
    const status = 'status' in error ? error.status : undefined;
    if (status === 401 || status === 403) return 'auth';
    if (status === 502 || status === 503 || status === 504) return 'unavailable';
    if (('code' in error ? error.code : undefined) === NETWORK_ERROR_CODE) return 'unavailable';
  }
  return 'error';
}

export type JourneyEmptyStateKind = 'provider-failure' | 'no-routes';

/**
 * Only for a 200 response with zero journeys. The Server sets completeness.transitSearchFailed
 * when the transit worker threw and searched nothing (server/journey/searchCompleteness.ts), so
 * an empty list in that case proves nothing about route absence and must not read as "no routes".
 */
export function journeyEmptyStateKind(result: ApiJourneySearchResult): JourneyEmptyStateKind {
  return result.completeness?.transitSearchFailed ? 'provider-failure' : 'no-routes';
}

/** Explain the honest zero-result case without exposing provider/debug details. */
export function journeyNoRoutesCopy(result: ApiJourneySearchResult): string {
  const requestedModeUnavailable = result.unsupportedPreferences.some(token => token.startsWith('transportType:'))
    || result.completeness?.modesUnavailable?.some(mode => mode.requested) === true;
  return requestedModeUnavailable
    ? 'Для частини обраних видів транспорту поки немає підтверджених рейсів у цьому напрямку. Спробуйте інший час або змініть набір транспорту.'
    : 'На вибраний час не знайдено підтверджених поєднань маршрутів. Змініть дату чи час і спробуйте ще раз.';
}

export const JOURNEY_SEARCH_UNAVAILABLE_COPY =
  'Пошук тимчасово недоступний. Ваші точки збережено — спробуйте ще раз.';

export const JOURNEY_EMPTY_PROVIDER_FAILURE_TITLE = 'Не вдалося скласти маршрут';

export const JOURNEY_EMPTY_PROVIDER_FAILURE_COPY =
  'Ваші точки й умови збережено. Змініть час або повторіть спробу трохи пізніше.';
