export type TripsSection = 'active' | 'upcoming' | 'past' | 'requests' | 'saved';

/** Carpool records only; multimodal saved routes are a separate responsibility. */
export const tripsBookingSections = ['active', 'upcoming', 'past'] as const;
export type TripsBookingSection = typeof tripsBookingSections[number];

export const tripsTabs: ReadonlyArray<readonly [TripsSection, string]> = [
  ['active', 'Активні'],
  ['upcoming', 'Майбутні'],
  ['past', 'Минулі'],
  ['requests', 'Запити'],
  ['saved', 'Збережені'],
];

export const tripsTabSubtitle: Record<TripsSection, string> = {
  active: 'Активні бронювання MARSHGO',
  upcoming: 'Майбутні бронювання MARSHGO',
  past: 'Минулі бронювання MARSHGO',
  requests: 'Запити та пропозиції',
  saved: 'Збережені маршрути',
};

export const isBookingSection = (section: TripsSection): section is TripsBookingSection =>
  (tripsBookingSections as readonly string[]).includes(section);

export const showsBookingList = (section: TripsSection): boolean =>
  isBookingSection(section) || section === 'requests';

export const showsSavedRoutes = (section: TripsSection): boolean => section === 'saved';
