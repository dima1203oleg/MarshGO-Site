import type { ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy } from '../services/productionApi';
import { formatJourneyTotalPrice } from './journeyResultPresentation';

/** Return the journeys that the server recommends for a strategy, ordered by its rank. */
export function journeysForStrategy(result: ApiJourneySearchResult, strategy: ApiJourneyStrategy): ApiJourney[] {
  return result.journeys
    .filter(journey => journey.strategyRanks
      ? typeof journey.strategyRanks[strategy] === 'number'
      : (journey.recommendedStrategies ?? [journey.strategy]).includes(strategy))
    .filter(journey => strategy !== 'CHEAPEST' || formatJourneyTotalPrice(journey) !== '—')
    .sort((a, b) => {
      const rankA = a.strategyRanks?.[strategy];
      const rankB = b.strategyRanks?.[strategy];
      if (typeof rankA === 'number' || typeof rankB === 'number') {
        return (rankA ?? Number.MAX_SAFE_INTEGER) - (rankB ?? Number.MAX_SAFE_INTEGER);
      }
      if (strategy === 'FASTEST') return a.totalDurationSeconds - b.totalDurationSeconds;
      if (strategy === 'CHEAPEST') {
        const priceA = a.confirmedPriceMinor ?? a.totalPriceMinor;
        const priceB = b.confirmedPriceMinor ?? b.totalPriceMinor;
        if (priceA === null) return priceB === null ? a.totalDurationSeconds - b.totalDurationSeconds : 1;
        if (priceB === null) return -1;
        return priceA - priceB || a.totalDurationSeconds - b.totalDurationSeconds;
      }
      return a.totalDurationSeconds - b.totalDurationSeconds
        || (a.confirmedPriceMinor ?? a.totalPriceMinor ?? Number.MAX_SAFE_INTEGER)
          - (b.confirmedPriceMinor ?? b.totalPriceMinor ?? Number.MAX_SAFE_INTEGER);
    });
}

/** Carry the active result tab into route details so its label stays consistent. */
export function journeyForSelectedStrategy(journey: ApiJourney, strategy: ApiJourneyStrategy): ApiJourney {
  return journey.strategy === strategy ? journey : { ...journey, strategy };
}

/** Tell the UI when any returned route needs the legacy local-ordering fallback. */
export function hasUnrankedJourney(result: ApiJourneySearchResult): boolean {
  return result.journeys.some(journey => !journey.strategyRanks || Object.keys(journey.strategyRanks).length === 0);
}
