import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLACE_SEARCH_UNAVAILABLE_COPY,
  isPlaceProviderUnavailable,
  localCityPlace,
  localCityPlaceSuggestions,
  placeSearchFailure,
  placeSearchPending,
  placeSearchResults,
} from '../src/services/placeSearchRecovery';
import type { ApiPlace } from '../src/services/productionApi';

// Mirrors ProductionApiError's public shape (message/code/status, productionApi.ts) without
// importing the API module, which needs browser globals at load time.
const apiError = (status?: number, code?: string) =>
  Object.assign(new Error('Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.'), { code, status });

const place: ApiPlace = { label: 'Львів, вокзал', latitude: 49.8397, longitude: 24.0297, providerId: 'photon:1' };

test('HTTP 503 from the geocoder is a recoverable provider-unavailable state', () => {
  const state = placeSearchFailure(apiError(503));
  assert.equal(state.unavailable, true);
  assert.deepEqual(state.suggestions, []);
});

test('502 and 504 share the unavailable state; other statuses keep the generic error path', () => {
  assert.equal(placeSearchFailure(apiError(502)).unavailable, true);
  assert.equal(placeSearchFailure(apiError(504)).unavailable, true);
  for (const status of [400, 401, 404, 422, 429, 500]) {
    assert.equal(placeSearchFailure(apiError(status)).unavailable, false, `status ${status}`);
  }
  assert.equal(isPlaceProviderUnavailable(new Error('Failed to fetch')), false);
  assert.equal(isPlaceProviderUnavailable('503'), false);
  assert.equal(isPlaceProviderUnavailable(null), false);
  assert.equal(isPlaceProviderUnavailable({ status: '503' }), false);
});

test('a fetch failure wrapped as network_error is provider-unavailable even without a status', () => {
  assert.equal(placeSearchFailure(apiError(undefined, 'network_error')).unavailable, true);
  assert.equal(placeSearchFailure(apiError(undefined, 'rate_limit_exceeded')).unavailable, false);
});

test('a 503 never leaves stale suggestions selectable', () => {
  const recovered = placeSearchResults([place]);
  assert.equal(recovered.suggestions.length, 1);
  const failed = placeSearchFailure(apiError(503));
  assert.deepEqual(failed.suggestions, []);
  assert.equal(failed.unavailable, true);
});

test('retry recovers: pending clears the notice, results restore normal suggestions', () => {
  const failed = placeSearchFailure(apiError(503));
  assert.equal(failed.unavailable, true);
  const retrying = placeSearchPending();
  assert.equal(retrying.unavailable, false);
  assert.deepEqual(retrying.suggestions, []);
  const recovered = placeSearchResults([place]);
  assert.equal(recovered.unavailable, false);
  assert.deepEqual(recovered.suggestions, [place]);
});

test('an empty success is distinct from provider-unavailable', () => {
  const empty = placeSearchResults([]);
  assert.equal(empty.unavailable, false);
  assert.deepEqual(empty.suggestions, []);
});

test('normal suggestions pass through untouched', () => {
  const second: ApiPlace = { label: 'Львів, Риновок', latitude: 49.8419, longitude: 24.0315, providerId: 'photon:2' };
  const state = placeSearchResults([place, second]);
  assert.equal(state.unavailable, false);
  assert.deepEqual(state.suggestions, [place, second]);
});

test('city-name fallback returns an explicit city-center point from the canonical map directory', () => {
  assert.deepEqual(localCityPlace('Львів'), {
    label: 'Львів · центр міста', latitude: 49.8397, longitude: 24.0297,
    providerId: 'marshgo:city-reference:lviv',
  });
  assert.deepEqual(localCityPlace('м. Київ, Україна'), {
    label: 'Київ · центр міста', latitude: 50.4501, longitude: 30.5234,
    providerId: 'marshgo:city-reference:kyiv',
  });
  assert.equal(localCityPlace('вул. Хрещатик, Київ'), null, 'street searches still require a geocoder');
  assert.deepEqual(localCityPlaceSuggestions('Рівне').map((place) => place.label), ['Рівне · центр міста']);
});

test('unavailable copy offers a clear retry or map-selection fallback', () => {
  assert.match(PLACE_SEARCH_UNAVAILABLE_COPY, /Не вдалося знайти місце/);
  assert.match(PLACE_SEARCH_UNAVAILABLE_COPY, /точку на мапі/i);
  assert.match(PLACE_SEARCH_UNAVAILABLE_COPY, /Спробуйте ще раз/i);
  assert.doesNotMatch(PLACE_SEARCH_UNAVAILABLE_COPY, /геокодер|координат|сервіс|провайдер/i);
});
