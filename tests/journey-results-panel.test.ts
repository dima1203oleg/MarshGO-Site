import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import type { ApiJourneySearchResult } from '../src/services/productionApi';
import { JourneyResultsPanel } from '../src/views/JourneyResultsPanel';

const searchResult = (overrides: Partial<ApiJourneySearchResult> = {}): ApiJourneySearchResult => ({
  journeys: [],
  partial: false,
  blockedProviders: [],
  unsupportedPreferences: [],
  providerErrors: [],
  ...overrides,
});

describe('production journey-search status', () => {
  it('tells the passenger when candidate generation was truncated', () => {
    const html = renderToStaticMarkup(createElement(JourneyResultsPanel, {
      result: searchResult({
        partial: true,
        candidateGenerationTruncated: true,
        resultsTruncated: true,
        partialReasons: ['candidate_generation_truncated'],
      }),
      onOpenMap: () => undefined,
    }));

    assert.match(html, /role="status"/);
    assert.match(html, /Пошук перевірив не всі варіанти/);
    assert.match(html, /частина маршрутів може бути відсутня/);
  });

  it('does not show the partial-results warning for a complete search', () => {
    const html = renderToStaticMarkup(createElement(JourneyResultsPanel, {
      result: searchResult(),
      onOpenMap: () => undefined,
    }));

    assert.doesNotMatch(html, /Пошук перевірив не всі варіанти/);
  });
});
