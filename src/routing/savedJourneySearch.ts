import type { ApiPlace, ApiJourney } from '../services/productionApi';

type JourneyEndpoints = Pick<ApiJourney['legs'][number], 'origin' | 'destination'>;

function toSearchPlace(endpoint: JourneyEndpoints['origin'] | null | undefined): ApiPlace | null {
  if (!endpoint || typeof endpoint.name !== 'string' || !Array.isArray(endpoint.coordinates)
    || endpoint.coordinates.length !== 2) return null;
  const label = endpoint.name.trim();
  const [longitude, latitude] = endpoint.coordinates;
  if (!label || label.length > 240
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;

  return { label, latitude, longitude, providerId: 'saved-route-coordinate' };
}

/** Restore selected endpoint coordinates without performing another geocoding lookup. */
export function savedJourneySearchPlaces(legs: readonly JourneyEndpoints[]): {
  origin: ApiPlace;
  destination: ApiPlace;
} | null {
  const firstLeg = legs[0];
  const lastLeg = legs.at(-1);
  if (!firstLeg || !lastLeg) return null;
  const origin = toSearchPlace(firstLeg.origin);
  const destination = toSearchPlace(lastLeg.destination);
  return origin && destination ? { origin, destination } : null;
}
