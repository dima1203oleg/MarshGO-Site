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
    assert.match(html, /Пошук не охопив усі варіанти/);
    assert.match(html, /частина маршрутів може бути відсутня/);
  });

  it('does not show the partial-results warning for a complete search', () => {
    const html = renderToStaticMarkup(createElement(JourneyResultsPanel, {
      result: searchResult(),
      onOpenMap: () => undefined,
    }));

    assert.doesNotMatch(html, /Пошук не охопив усі варіанти/);
  });

  it('shows plain-language GTFS truncation detail only when the Server provides a cause', () => {
    const html = renderToStaticMarkup(createElement(JourneyResultsPanel, {
      result: searchResult({
        gtfsTruncation: { candidateGraph: true, responsePage: true },
      }),
      onOpenMap: () => undefined,
    }));

    assert.match(html, /Список маршрутів громадського транспорту може бути неповним/);
    assert.match(html, /<summary[^>]*>Чому список неповний<\/summary>/);
    assert.match(html, /побудова графа розкладу, ліміт кількості результатів/);
  });
});
