export type CarpoolOfferWithDate = { other_date?: boolean };

export const carpoolOffersFromOtherDate = (offers: CarpoolOfferWithDate[]): boolean =>
  offers.some((offer) => offer.other_date === true);

export const carpoolDepartureDateLabel = (departureAt: string): string =>
  new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', timeZone: 'Europe/Kyiv' }).format(new Date(departureAt));
