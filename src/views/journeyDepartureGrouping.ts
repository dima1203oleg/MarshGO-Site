import type { ApiJourney } from '../services/productionApi';
import { journeyBoardingTime } from './journeyResultPresentation';

export type JourneyDepartureGroup = {
  key: string;
  /** The strategy winner among the group; it must keep the card and its rank. */
  primary: ApiJourney;
  /** Every journey of the template, earliest boarding first. */
  departures: ApiJourney[];
};

const coordinateKey = (point: { coordinates: [number, number] }) =>
  point.coordinates.map(value => value.toFixed(5)).join(',');

/**
 * Two journeys share a template only when a passenger would catch the same vehicles at the
 * same stops for the same money from the same carrier. Fare, carrier, reliability and the
 * boarding/alighting coordinates stay in the key: a different tariff or a different stop is a
 * different offer, so it keeps its own card instead of hiding behind «Інші відправлення».
 */
function legTemplateKey(leg: ApiJourney['legs'][number]): string {
  return [
    leg.mode,
    leg.transportType ?? '',
    leg.routeName ?? '',
    leg.providerName ?? '',
    leg.priceMinor ?? 'unknown',
    leg.priceStatus,
    leg.origin.name,
    coordinateKey(leg.origin),
    leg.destination.name,
    coordinateKey(leg.destination),
  ].join('|');
}

export function journeyTemplateKey(journey: ApiJourney): string {
  return `${journey.reliabilityScore ?? 'unknown'}>${journey.legs.map(legTemplateKey).join('>')}`;
}

/**
 * Departure grouping is a presentation step, never a filter: every journey stays reachable,
 * and the first item of the already strategy-sorted list remains the card's primary journey.
 */
export function groupJourneyDepartures(journeys: readonly ApiJourney[]): JourneyDepartureGroup[] {
  const groups = new Map<string, JourneyDepartureGroup>();
  for (const journey of journeys) {
    const key = journeyTemplateKey(journey);
    const existing = groups.get(key);
    if (existing) existing.departures.push(journey);
    else groups.set(key, { key, primary: journey, departures: [journey] });
  }
  return [...groups.values()].map(group => ({
    ...group,
    departures: [...group.departures].sort((a, b) => journeyBoardingTime(a) - journeyBoardingTime(b)),
  }));
}

/** Alternatives shown behind «Інші відправлення»: the primary already owns the card. */
export function journeyGroupAlternatives(group: JourneyDepartureGroup): ApiJourney[] {
  return group.departures.filter(journey => journey.id !== group.primary.id);
}
