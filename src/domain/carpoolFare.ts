export type CarpoolFareBasis = 'PER_SEAT' | 'TOTAL_ALL';

/** Offers created before fare basis was introduced retain the original per-seat meaning. */
export function carpoolFareBasis(value: unknown): CarpoolFareBasis {
  return value === 'TOTAL_ALL' ? 'TOTAL_ALL' : 'PER_SEAT';
}

/** `price_per_seat_minor` is a legacy field name; its meaning follows fare_basis. */
export function carpoolBookingTotalMinor(amountMinor: number, seats: number, basis: unknown): number {
  return amountMinor * (carpoolFareBasis(basis) === 'TOTAL_ALL' ? 1 : seats);
}

export function carpoolFareLabel(basis: unknown): string {
  return carpoolFareBasis(basis) === 'TOTAL_ALL' ? 'за всю поїздку' : 'за місце';
}

export function carpoolBookingTotalLabel(seats: number, basis: unknown): string {
  if (carpoolFareBasis(basis) === 'TOTAL_ALL') return 'Вартість усієї поїздки';
  return `Вартість за ${seats} ${seats === 1 ? 'місце' : 'місця'}`;
}
