// Route-search recovery states, proven against the current API contract only: HTTP status/code on
// ProductionApiError, and completeness.transitSearchFailed which the Server sets when the transit
// worker threw (server/journey/searchCompleteness.ts). Fixtures are synthetic, not live feeds.
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { productionApi } from '../src/services/productionApi';
import type { ApiJourneySearchResult } from '../src/services/productionApi';
import {
  JOURNEY_EMPTY_PROVIDER_FAILURE_COPY,
  JOURNEY_SEARCH_UNAVAILABLE_COPY,
  journeyEmptyStateKind,
  journeySearchFailureKind,
} from '../src/views/journeySearchRecovery';
import { truncationNotices } from '../src/views/resultsDiagnostics';

const apiError = (status?: number, code?: string) =>
  Object.assign(new Error('Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.'), { code, status });

const emptyResult = (completeness?: ApiJourneySearchResult['completeness']): ApiJourneySearchResult => ({
  journeys: [], partial: false, blockedProviders: [], unsupportedPreferences: [], providerErrors: [],
  ...(completeness ? { completeness } : {}),
});

const completeness = (transitSearchFailed: boolean): NonNullable<ApiJourneySearchResult['completeness']> => ({
  providersQueried: 2, providersSucceeded: transitSearchFailed ? 0 : 2, providersFailed: transitSearchFailed ? 2 : 0,
  modesAvailable: [], modesUnavailable: [], candidatesGenerated: 0, candidatesValidated: 0, candidatesRejected: 0,
  candidatesDeduplicated: 0, resultsReturned: 0, searchTruncated: false, searchComplete: !transitSearchFailed,
  transitSearchFailed,
});

describe('journey search failure classification', () => {
  it('separates provider-unavailable from authorization and generic errors', () => {
    for (const status of [502, 503, 504]) {
      assert.equal(journeySearchFailureKind(apiError(status)), 'unavailable', `status ${status}`);
    }
    assert.equal(journeySearchFailureKind(apiError(undefined, 'network_error')), 'unavailable');
    assert.equal(journeySearchFailureKind(apiError(401)), 'auth');
    assert.equal(journeySearchFailureKind(apiError(403)), 'auth');
    for (const status of [400, 404, 422, 429, 500]) {
      assert.equal(journeySearchFailureKind(apiError(status)), 'error', `status ${status}`);
    }
    assert.equal(journeySearchFailureKind(new Error('boom')), 'error');
    assert.equal(journeySearchFailureKind(null), 'error');
    assert.equal(journeySearchFailureKind({ status: '503' }), 'error');
  });

  it('keeps the entered-search promise in the unavailable copy', () => {
    assert.match(JOURNEY_SEARCH_UNAVAILABLE_COPY, /збережено/);
    assert.match(JOURNEY_SEARCH_UNAVAILABLE_COPY, /спробуйте ще раз/i);
  });
});

describe('empty-results classification', () => {
  it('a failed transit search is provider-failure, never "no routes"', () => {
    assert.equal(journeyEmptyStateKind(emptyResult(completeness(true))), 'provider-failure');
    assert.doesNotMatch(JOURNEY_EMPTY_PROVIDER_FAILURE_COPY, /Актуальних маршрутів поки немає/);
    assert.match(JOURNEY_EMPTY_PROVIDER_FAILURE_COPY, /точки й умови збережено/);
    assert.doesNotMatch(JOURNEY_EMPTY_PROVIDER_FAILURE_COPY, /розклад|провайдер|сервіс маршрутів/i);
  });

  it('a healthy empty corridor stays a legitimate zero-result state', () => {
    assert.equal(journeyEmptyStateKind(emptyResult(completeness(false))), 'no-routes');
    assert.equal(journeyEmptyStateKind(emptyResult()), 'no-routes');
  });
});

describe('truncation notices', () => {
  it('reports each truncation flag independently with its own tone', () => {
    assert.deepEqual(truncationNotices({}), []);
    assert.deepEqual(truncationNotices({ resultsTruncated: true }), [
      { tone: 'blue', text: 'Показано найкращі варіанти для обраного режиму поїздки.' },
    ]);
    const candidate = truncationNotices({ candidateGenerationTruncated: true });
    assert.equal(candidate.length, 1);
    assert.equal(candidate[0]!.tone, 'amber');
    assert.match(candidate[0]!.text, /не охопив усі можливі варіанти/);
    const sampling = truncationNotices({ resultSamplingTruncated: true });
    assert.equal(sampling.length, 1);
    assert.equal(sampling[0]!.tone, 'amber');
    assert.match(sampling[0]!.text, /обмежила кількість варіантів/);
    assert.equal(truncationNotices({ resultsTruncated: true, candidateGenerationTruncated: true, resultSamplingTruncated: true }).length, 3);
  });
});

describe('API contract proof (stubbed fetch, real client)', () => {
  const searchInput = {
    origin: { name: 'Львів', coordinates: [24.0155, 49.8347] as [number, number] },
    destination: { name: 'Стрий', coordinates: [23.856, 49.258] as [number, number] },
    departureAt: '2026-11-04T08:00:00+02:00',
    passengers: 1,
    strategy: 'BALANCED' as const,
  };
  const originalFetch = globalThis.fetch;

  const jsonResponse = (status: number, payload: unknown): Response =>
    ({ status, ok: status < 400, json: async () => payload }) as unknown as Response;

  afterEach(() => { globalThis.fetch = originalFetch; });

  it('surfaces HTTP 503 as an unavailable failure, not an empty result', async () => {
    globalThis.fetch = (async () => jsonResponse(503, { error: { message: 'geocoder down' } })) as typeof globalThis.fetch;
    const error = await productionApi.searchJourneys(searchInput).then(() => null, (caught: unknown) => caught);
    assert.ok(error instanceof Error);
    assert.equal((error as { status?: number }).status, 503);
    assert.equal(journeySearchFailureKind(error), 'unavailable');
  });

  it('surfaces HTTP 401 as an authorization failure', async () => {
    globalThis.fetch = (async () => jsonResponse(401, { error: { message: 'authentication required' } })) as typeof globalThis.fetch;
    const error = await productionApi.searchJourneys(searchInput).then(() => null, (caught: unknown) => caught);
    assert.ok(error instanceof Error);
    assert.equal(journeySearchFailureKind(error), 'auth');
  });

  it('classifies a rejected fetch (no status) as unavailable via network_error', async () => {
    globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as typeof globalThis.fetch;
    const error = await productionApi.searchJourneys(searchInput).then(() => null, (caught: unknown) => caught);
    assert.ok(error instanceof Error);
    assert.equal((error as { code?: string }).code, 'network_error');
    assert.equal(journeySearchFailureKind(error), 'unavailable');
  });

  it('passes completeness.transitSearchFailed through so an empty 200 reads as provider-failure', async () => {
    globalThis.fetch = (async () => jsonResponse(200, { data: emptyResult(completeness(true)) })) as typeof globalThis.fetch;
    const result = await productionApi.searchJourneys(searchInput);
    assert.equal(result.journeys.length, 0);
    assert.equal(journeyEmptyStateKind(result), 'provider-failure');
  });

  it('keeps a healthy empty 200 as a legitimate zero-result response', async () => {
    globalThis.fetch = (async () => jsonResponse(200, { data: emptyResult(completeness(false)) })) as typeof globalThis.fetch;
    const result = await productionApi.searchJourneys(searchInput);
    assert.equal(result.journeys.length, 0);
    assert.equal(journeyEmptyStateKind(result), 'no-routes');
  });
});
