import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ApiJourneySearchResult } from '../src/services/productionApi';
import { JourneyResultsPanel } from '../src/views/JourneyResultsPanel';

it('discloses when bounded provider search may have omitted routes', () => {
  const result: ApiJourneySearchResult = {
    journeys: [],
    partial: true,
    partialReasons: ['candidate_generation_truncated'],
    resultsTruncated: true,
    candidateGenerationTruncated: true,
    resultSamplingTruncated: false,
    blockedProviders: [],
    unsupportedPreferences: [],
    providerErrors: [],
  };

  const markup = renderToStaticMarkup(createElement(JourneyResultsPanel, {
    result,
    onOpenMap: () => undefined,
  }));

  assert.match(markup, /role="status"/);
  assert.match(markup, /Пошук досяг ліміту обробки джерел/);
  assert.match(markup, /частина маршрутів могла не потрапити до результатів/);
  assert.doesNotMatch(markup, /Pareto-варіантів/,
    'candidate generation alone must not imply that the displayed result list was limited');
});

it('distinguishes omitted result alternatives from candidate generation limits', () => {
  const base: ApiJourneySearchResult = {
    journeys: [], partial: false, blockedProviders: [], unsupportedPreferences: [], providerErrors: [],
  };
  const render = (overrides: Partial<ApiJourneySearchResult>) => renderToStaticMarkup(createElement(JourneyResultsPanel, {
    result: { ...base, ...overrides }, onOpenMap: () => undefined,
  }));
  assert.match(render({ resultsTruncated: true, candidateGenerationTruncated: false, resultSamplingTruncated: true }), /Pareto-варіантів/);
  assert.match(render({ resultsTruncated: true, candidateGenerationTruncated: true, resultSamplingTruncated: true }), /Pareto-варіантів/);
  assert.match(render({ resultsTruncated: true, candidateGenerationTruncated: false }), /Pareto-варіантів/,
    'older servers with an aggregate limit still show the list-limit notice when no candidate limit is reported');
  assert.doesNotMatch(render({ resultsTruncated: true, candidateGenerationTruncated: true }), /Pareto-варіантів/,
    'an ambiguous legacy aggregate must not assert list sampling when candidate generation was truncated');
});

it('does not present an incomplete empty search as a conclusive absence of routes', () => {
  const base: ApiJourneySearchResult = {
    journeys: [], partial: false, blockedProviders: [], unsupportedPreferences: [], providerErrors: [],
  };
  const render = (overrides: Partial<ApiJourneySearchResult>) => renderToStaticMarkup(createElement(JourneyResultsPanel, {
    result: { ...base, ...overrides }, onOpenMap: () => undefined,
  }));
  const incomplete = render({ partial: true, candidateGenerationTruncated: true,
    partialReasons: ['candidate_generation_truncated'] });
  assert.match(incomplete, /Пошук неповний — не вдалося перевірити всі маршрути/);
  assert.doesNotMatch(incomplete, /Актуальних маршрутів поки немає/);
  assert.match(render({ providerErrors: ['помилка джерела'] }), /Пошук неповний — не вдалося перевірити всі маршрути/);
  assert.match(render({}), /Маршрутів за цими умовами не знайдено/);
});
