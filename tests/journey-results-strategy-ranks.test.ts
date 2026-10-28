import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ApiJourney, ApiJourneySearchResult } from '../src/services/productionApi';
import { JourneyResultsPanel } from '../src/views/JourneyResultsPanel';

function journey(id: string, balancedRank: number, durationSeconds = 1800, priceMinor = 1200): ApiJourney {
  const departureAt = '2026-10-28T10:00:00.000Z';
  const arrivalAt = new Date(Date.parse(departureAt) + durationSeconds * 1000).toISOString();
  return {
    id,
    offerId: null,
    strategy: 'BALANCED',
    strategyRanks: { BALANCED: balancedRank },
    state: 'AVAILABLE',
    totalDurationSeconds: durationSeconds,
    totalPriceMinor: priceMinor,
    confirmedPriceMinor: priceMinor,
    estimatedPriceMinMinor: null,
    estimatedPriceMaxMinor: null,
    walkingMeters: 0,
    transfers: 0,
    reliabilityScore: null,
    legs: [{
      id: `leg-${id}`,
      mode: 'BUS',
      offerId: null,
      origin: { name: 'A', coordinates: [24, 49] },
      destination: { name: 'B', coordinates: [24.01, 49.01] },
      departureAt,
      arrivalAt,
      durationSeconds,
      distanceMeters: 1000,
      priceMinor,
      priceStatus: 'ESTIMATED',
      availabilityStatus: 'SCHEDULED',
      source: 'fixture',
      lastUpdatedAt: departureAt,
      driver: null,
      vehicle: null,
    }],
  };
}

it('uses server strategy ranks to order equal-metric cards for the requested strategy', () => {
  const result: ApiJourneySearchResult = {
    journeys: [journey('second', 2), journey('first', 1)],
    requestedStrategy: 'BALANCED',
    availableStrategies: ['BALANCED'],
    partial: false,
    blockedProviders: [],
    unsupportedPreferences: [],
    providerErrors: [],
  };

  const markup = renderToStaticMarkup(createElement(JourneyResultsPanel, {
    result,
    onOpenMap: () => undefined,
  }));

  const renderedIds = [...markup.matchAll(/data-journey-id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(renderedIds, ['first', 'second']);
  assert.match(markup, /aria-pressed="true" aria-label="Оптимальний, 2 маршрути"/);
});

it('uses the strategy fallback to order journeys tied on server rank', () => {
  const result: ApiJourneySearchResult = {
    journeys: [journey('slower', 1, 2100), journey('faster', 1, 1800)],
    requestedStrategy: 'BALANCED',
    availableStrategies: ['BALANCED'],
    partial: false,
    blockedProviders: [],
    unsupportedPreferences: [],
    providerErrors: [],
  };

  const markup = renderToStaticMarkup(createElement(JourneyResultsPanel, {
    result,
    onOpenMap: () => undefined,
  }));

  const renderedIds = [...markup.matchAll(/data-journey-id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(renderedIds, ['faster', 'slower']);
});
