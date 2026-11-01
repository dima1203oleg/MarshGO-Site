import type { ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy } from '../services/productionApi';
import { formatJourneyTotalPrice, journeyBoardingTime } from './journeyResultPresentation';

/**
 * Everything a passenger can actually compare between two results. The planner scores
 * such journeys identically and then ranks them arbitrarily, so a rank gap between two
 * equal signatures carries no information, while a gap between different ones does.
 */
function objectiveSignature(journey: ApiJourney): string {
  return [
    journey.totalDurationSeconds,
    formatJourneyTotalPrice(journey),
    journey.walkingMeters,
    journey.transfers,
    journey.legs.length,
  ].join('|');
}

/** Keep the result tabs consistent with the server's declared comparable strategies. */
export function strategyJourneys(result: ApiJourneySearchResult, strategy: ApiJourneyStrategy): ApiJourney[] {
  if (result.availableStrategies && !result.availableStrategies.includes(strategy)) return [];
  return result.journeys
    .filter(journey => journey.strategyRanks
      ? typeof journey.strategyRanks[strategy] === 'number'
      : (journey.recommendedStrategies ?? [journey.strategy]).includes(strategy))
    .filter(journey => strategy !== 'CHEAPEST' || formatJourneyTotalPrice(journey) !== '—')
    .sort((a, b) => {
      const boarding = journeyBoardingTime(a) - journeyBoardingTime(b);
      if (objectiveSignature(a) === objectiveSignature(b)) return boarding;
      const rankA = a.strategyRanks?.[strategy];
      const rankB = b.strategyRanks?.[strategy];
      if (typeof rankA === 'number' || typeof rankB === 'number') {
        return (rankA ?? Number.MAX_SAFE_INTEGER) - (rankB ?? Number.MAX_SAFE_INTEGER);
      }
      if (strategy === 'FASTEST') return a.totalDurationSeconds - b.totalDurationSeconds;
      if (strategy === 'CHEAPEST') {
        const priceA = a.confirmedPriceMinor ?? a.totalPriceMinor;
        const priceB = b.confirmedPriceMinor ?? b.totalPriceMinor;
        if (priceA === null) return priceB === null ? boarding : 1;
        if (priceB === null) return -1;
        return priceA - priceB || boarding;
      }
      return a.totalDurationSeconds - b.totalDurationSeconds
        || (a.confirmedPriceMinor ?? a.totalPriceMinor ?? Number.MAX_SAFE_INTEGER)
          - (b.confirmedPriceMinor ?? b.totalPriceMinor ?? Number.MAX_SAFE_INTEGER);
    });
}
