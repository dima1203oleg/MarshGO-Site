export interface MarshPassHomeCandidate {
  kind: 'booking' | 'journey';
  currentUserIsDriver?: boolean;
  status: string;
}

/** The Home ticket slot is reserved for a confirmed private-ride passenger booking. */
export function selectHomeMarshPasses<T extends MarshPassHomeCandidate>(items: T[]): T[] {
  return items.filter((item) => item.kind === 'booking'
    && !item.currentUserIsDriver
    && ['confirmed', 'boarding', 'in_progress'].includes(item.status));
}
