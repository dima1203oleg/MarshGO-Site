export type SearchRoutePlace = {
  label: string;
  latitude: number;
  longitude: number;
  providerId: string;
};

export type SearchRouteState = {
  origin: SearchRoutePlace;
  destination: SearchRoutePlace;
  date: string;
  passengers: number;
  departure: string;
  strategy: 'FASTEST' | 'CHEAPEST' | 'BALANCED' | 'PREMIUM' | 'RELIABLE' | 'CUSTOM';
  mode: 'offers' | 'planner';
};

const strategies = new Set<SearchRouteState['strategy']>([
  'FASTEST', 'CHEAPEST', 'BALANCED', 'PREMIUM', 'RELIABLE', 'CUSTOM',
]);

function validPlace(place: SearchRoutePlace): boolean {
  return place.label.length > 0 && place.label.length <= 240
    && place.providerId.length > 0 && place.providerId.length <= 256
    && Number.isFinite(place.latitude) && place.latitude >= -90 && place.latitude <= 90
    && Number.isFinite(place.longitude) && place.longitude >= -180 && place.longitude <= 180;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function buildSearchRoute(state: SearchRouteState): string {
  if (!validPlace(state.origin) || !validPlace(state.destination)) {
    throw new Error('Search route requires valid geocoded endpoints.');
  }
  if (!validDate(state.date) || !Number.isInteger(state.passengers) || state.passengers < 1 || state.passengers > 8) {
    throw new Error('Search route contains invalid date or passenger count.');
  }
  if (!strategies.has(state.strategy) || (state.mode !== 'offers' && state.mode !== 'planner')) {
    throw new Error('Search route contains invalid search mode.');
  }

  const query = new URLSearchParams({
    mode: state.mode,
    origin: state.origin.label,
    originLat: String(state.origin.latitude),
    originLon: String(state.origin.longitude),
    originProvider: state.origin.providerId,
    destination: state.destination.label,
    destinationLat: String(state.destination.latitude),
    destinationLon: String(state.destination.longitude),
    destinationProvider: state.destination.providerId,
    date: state.date,
    passengers: String(state.passengers),
    departure: state.departure,
    strategy: state.strategy,
  });
  return `/journeys/search?${query.toString()}`;
}

export function parseSearchRoute(search: string): SearchRouteState | null {
  const query = new URLSearchParams(search);
  const mode = query.get('mode');
  const strategy = query.get('strategy');
  const passengers = Number(query.get('passengers'));
  const origin: SearchRoutePlace = {
    label: query.get('origin') ?? '',
    latitude: Number(query.get('originLat')),
    longitude: Number(query.get('originLon')),
    providerId: query.get('originProvider') ?? '',
  };
  const destination: SearchRoutePlace = {
    label: query.get('destination') ?? '',
    latitude: Number(query.get('destinationLat')),
    longitude: Number(query.get('destinationLon')),
    providerId: query.get('destinationProvider') ?? '',
  };
  const date = query.get('date') ?? '';
  const departure = query.get('departure') ?? '';

  if ((mode !== 'offers' && mode !== 'planner') || !strategy || !strategies.has(strategy as SearchRouteState['strategy'])
    || !validPlace(origin) || !validPlace(destination) || !validDate(date)
    || !Number.isInteger(passengers) || passengers < 1 || passengers > 8
    || !departure || departure.length > 32 || !Number.isFinite(new Date(departure).getTime())) return null;

  return { origin, destination, date, passengers, departure, strategy: strategy as SearchRouteState['strategy'], mode };
}
