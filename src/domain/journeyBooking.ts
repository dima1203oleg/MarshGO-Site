import type { ApiJourney } from '../services/productionApi';

const nonBookableJourneyLegStates = new Set([
  'RESERVED',
  'CONFIRMED',
  'WAITING',
  'ACTIVE',
  'COMPLETED',
  'MISSED',
  'CANCELLED',
  'REPLACED',
  'FAILED',
]);

/** Do not offer a second booking action for a leg that is already booked or terminal. */
export function journeyLegCanBeBooked(leg: Pick<ApiJourney['legs'][number], 'offerId' | 'bookingId' | 'state' | 'availabilityStatus'>): boolean {
  return Boolean(leg.offerId)
    && !leg.bookingId
    && !nonBookableJourneyLegStates.has(leg.state ?? '')
    && leg.availabilityStatus !== 'UNAVAILABLE';
}
