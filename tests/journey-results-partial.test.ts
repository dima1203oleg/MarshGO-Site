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
    candidateGenerationTruncated: true,
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
});
