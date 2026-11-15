import { NETWORK_ERROR_CODE } from './requestErrorMessage';
import type { ApiPlace } from './productionApi';
import { UKRAINE_CITIES } from '../domain/ukraineCities';

export type PlaceSearchState = {
  suggestions: ApiPlace[];
  unavailable: boolean;
};

export const PLACE_SEARCH_UNAVAILABLE_COPY =
  'Не вдалося знайти місце. Спробуйте ще раз або виберіть точку на мапі.';

function normalizeCityQuery(value: string): string {
  return value.trim().toLocaleLowerCase('uk-UA')
    .replace(/^(?:м\.?|місто)\s*/u, '')
    .replace(/,?\s*(?:україна|ukraine)$/u, '')
    .replace(/[,.]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** A truthful coarse fallback for city names, using the same reference points as the map picker. */
export function localCityPlace(query: string): ApiPlace | null {
  const normalized = normalizeCityQuery(query);
  if (!normalized) return null;
  const city = UKRAINE_CITIES.find((candidate) => normalizeCityQuery(candidate.name) === normalized);
  if (!city) return null;
  return {
    label: `${city.name} · центр міста`,
    latitude: city.lat,
    longitude: city.lng,
    providerId: `marshgo:city-reference:${city.id}`,
  };
}

export function localCityPlaceSuggestions(query: string): ApiPlace[] {
  const place = localCityPlace(query);
  return place ? [place] : [];
}

/**
 * Structural match on ProductionApiError's public shape (status/code) instead of importing the
 * class: this helper stays runnable in dependency-free tests, and any error carrying the same
 * contract is classified identically.
 */
export function isPlaceProviderUnavailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = 'status' in error ? error.status : undefined;
  if (typeof status === 'number') return status === 502 || status === 503 || status === 504;
  return ('code' in error ? error.code : undefined) === NETWORK_ERROR_CODE;
}

export function placeSearchPending(): PlaceSearchState {
  return { suggestions: [], unavailable: false };
}

export function placeSearchResults(places: ApiPlace[]): PlaceSearchState {
  return { suggestions: places, unavailable: false };
}

/** A failed lookup must never leave stale suggestions selectable, whatever the failure kind. */
export function placeSearchFailure(error: unknown): PlaceSearchState {
  return { suggestions: [], unavailable: isPlaceProviderUnavailable(error) };
}
