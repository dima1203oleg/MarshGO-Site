export type CarpoolOfferWithDate = { other_date?: boolean };

export const carpoolOffersFromOtherDate = (offers: CarpoolOfferWithDate[]): boolean =>
  offers.some((offer) => offer.other_date === true);

export const carpoolDepartureDateLabel = (departureAt: string): string =>
  new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', timeZone: 'Europe/Kyiv' }).format(new Date(departureAt));

/** The results screen keeps exactly one visible sorting control: the transit ranking panel wins,
 *  and a sorter with nothing to sort never renders. */
export const showsCarpoolSorter = (offerCount: number, transitRankingVisible: boolean): boolean =>
  !transitRankingVisible && offerCount > 1;
