import type { ApiJourney, ApiStoredJourney } from '../services/productionApi';

const isCoordinate = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2
  && Number.isFinite(value[0]) && Number.isFinite(value[1])
  && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;

function requiredCoordinate(value: unknown, journeyId: string, legId: string, end: string): [number, number] {
  if (!isCoordinate(value)) throw new Error(`У збереженого маршруту ${journeyId} немає координат ${end} для сегмента ${legId}.`);
  return [value[0], value[1]];
}

function priceStatus(value: string): NonNullable<ApiJourney['legs'][number]['priceStatus']> {
  return value === 'LOCKED' || value === 'DYNAMIC' || value === 'ESTIMATED' ? value : 'UNKNOWN';
}

function metadataText(metadata: Record<string, unknown> | null | undefined, ...keys: string[]) {
  for (const key of keys) if (typeof metadata?.[key] === 'string' && metadata[key].trim()) return metadata[key] as string;
  return undefined;
}

/** Convert the authenticated stored Journey DTO into the same map model used by search results. */
export function storedJourneyToApiJourney(stored: ApiStoredJourney): ApiJourney {
  const legs: ApiJourney['legs'] = stored.legs.map((leg) => {
    const metadata = leg.metadata ?? undefined;
    const routeGeometry = Array.isArray(leg.routeGeometry)
      && leg.routeGeometry.every(isCoordinate)
      ? leg.routeGeometry.map(([longitude, latitude]) => [longitude, latitude] as [number, number])
      : undefined;
    const validStops = Array.isArray(leg.stops)
      ? leg.stops.filter((stop) => isCoordinate(stop.coordinates))
      : undefined;
    return {
      id: leg.id,
      mode: leg.mode,
      offerId: leg.offerId,
      bookingId: leg.bookingId,
      state: leg.state,
      origin: { name: leg.originName, coordinates: requiredCoordinate(leg.originCoordinates, stored.id, leg.id, 'початку') },
      destination: { name: leg.destinationName, coordinates: requiredCoordinate(leg.destinationCoordinates, stored.id, leg.id, 'призначення') },
      departureAt: leg.departureAt,
      arrivalAt: leg.arrivalAt,
      durationSeconds: Math.max(0, Number(leg.durationSeconds) || 0),
      distanceMeters: typeof leg.distanceMeters === 'number' && Number.isFinite(leg.distanceMeters) ? leg.distanceMeters : null,
      priceMinor: typeof leg.priceMinor === 'number' && Number.isFinite(leg.priceMinor) ? leg.priceMinor : null,
      currency: leg.currency ?? 'UAH',
      priceStatus: priceStatus(leg.priceStatus),
      availabilityStatus: leg.availabilityStatus || 'UNKNOWN',
      source: leg.source ?? leg.dataSource ?? 'stored-journey',
      lastUpdatedAt: leg.lastUpdatedAt ?? stored.requested_departure_at,
      providerName: metadataText(metadata, 'providerName', 'provider_name'),
      routeName: metadataText(metadata, 'routeName', 'route_name'),
      headsign: metadataText(metadata, 'headsign', 'tripHeadsign'),
      transportType: metadataText(metadata, 'transportType', 'transport_type'),
      routeGeometry,
      stops: validStops,
      liveStatus: 'UNVERIFIED',
      driver: null,
      vehicle: null,
    };
  });
  const totalDurationSeconds = Math.max(0, Number(stored.total_duration_s) || legs.reduce((sum, leg) => sum + leg.durationSeconds, 0));
  const score = stored.reliability_score;
  return {
    id: stored.id,
    offerId: null,
    strategy: stored.strategy,
    state: stored.state,
    totalDurationSeconds,
    requestedDepartureAt: stored.requested_departure_at,
    waitingSeconds: Math.max(0, Number(stored.waitingSeconds) || 0),
    totalPriceMinor: typeof stored.total_price_minor === 'number' ? stored.total_price_minor : null,
    currency: legs.find((leg) => leg.currency)?.currency ?? 'UAH',
    priceStatus: stored.confirmed_price_minor !== null ? 'LOCKED' : 'ESTIMATED',
    confirmedPriceMinor: typeof stored.confirmed_price_minor === 'number' ? stored.confirmed_price_minor : null,
    estimatedPriceMinMinor: typeof stored.estimated_price_min_minor === 'number' ? stored.estimated_price_min_minor : null,
    estimatedPriceMaxMinor: typeof stored.estimated_price_max_minor === 'number' ? stored.estimated_price_max_minor : null,
    walkingMeters: Math.max(0, Number(stored.walking_distance_m) || 0),
    transfers: Math.max(0, Math.floor(Number(stored.transfer_count) || 0)),
    reliabilityScore: typeof score === 'number' && Number.isFinite(score) ? score : null,
    legs,
  };
}
