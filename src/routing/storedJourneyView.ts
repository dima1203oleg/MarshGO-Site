import type { ApiJourney, ApiJourneyStrategy, ApiStoredJourney } from '../services/productionApi';

type Leg = ApiStoredJourney['legs'][number];
type Point = { name: string; coordinates: [number, number] };

const isPoint = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);

const priceStatusFor = (journey: ApiStoredJourney): ApiJourney['priceStatus'] => (
  journey.confirmed_price_minor !== null ? 'LOCKED'
    : journey.total_price_minor !== null ? 'ESTIMATED' : 'UNKNOWN'
);

/**
 * A stored leg is normally written with both of its own endpoints, but a leg saved by an older planner release can
 * be missing them. Chaining neighbours keeps the polyline inside the journey instead of drawing it to 0,0.
 */
function resolveEndpoints(journey: ApiStoredJourney): Point[][] {
  const journeyOrigin = isPoint(journey.origin_coordinates) ? journey.origin_coordinates : null;
  const journeyDestination = isPoint(journey.destination_coordinates) ? journey.destination_coordinates : null;
  const legs = journey.legs.map((leg) => ({
    origin: isPoint(leg.originCoordinates) ? leg.originCoordinates : null,
    destination: isPoint(leg.destinationCoordinates) ? leg.destinationCoordinates : null,
    originName: leg.originName,
    destinationName: leg.destinationName,
  }));
  legs.forEach((leg, index) => {
    leg.origin ??= index === 0 ? journeyOrigin : legs[index - 1]?.destination ?? journeyOrigin;
  });
  for (let index = legs.length - 1; index >= 0; index--) {
    const leg = legs[index];
    leg.destination ??= legs[index + 1] ? legs[index + 1].origin : journeyDestination;
  }
  return [
    legs.map((leg, index) => ({ name: leg.originName || (index === 0 ? journey.origin_name : legs[index - 1]?.destinationName) || 'Точка маршруту', coordinates: leg.origin ?? [0, 0] })),
    legs.map((leg, index) => ({ name: leg.destinationName || (index === legs.length - 1 ? journey.destination_name : legs[index + 1]?.originName) || 'Точка маршруту', coordinates: leg.destination ?? leg.origin ?? [0, 0] })),
  ];
}

function legView(leg: Leg, origin: Point, destination: Point, index: number, journey: ApiStoredJourney): ApiJourney['legs'][number] {
  const departure = leg.departureAt ?? leg.scheduledDepartureAt ?? journey.requested_departure_at;
  const arrival = leg.arrivalAt ?? leg.scheduledArrivalAt ?? departure;
  const live = leg.liveStatus;
  return {
    id: leg.id,
    mode: leg.mode,
    offerId: leg.offerId,
    origin,
    destination,
    departureAt: departure,
    arrivalAt: arrival,
    durationSeconds: leg.durationSeconds ?? 0,
    distanceMeters: leg.distanceMeters ?? null,
    priceMinor: leg.priceMinor,
    priceStatus: (leg.priceStatus ?? 'UNKNOWN') as ApiJourney['legs'][number]['priceStatus'],
    availabilityStatus: leg.availabilityStatus ?? 'UNKNOWN',
    source: leg.source ?? leg.dataSource ?? 'stored-journey',
    lastUpdatedAt: leg.lastUpdatedAt ?? '',
    routeName: leg.routeName ?? undefined,
    transportType: leg.transportType ?? undefined,
    headsign: leg.headsign ?? undefined,
    routeGeometry: leg.routeGeometry ?? null,
    stops: leg.stops ?? [],
    currency: leg.currency ?? 'UAH',
    scheduleSemantics: (leg.scheduleSemantics ?? null) as ApiJourney['legs'][number]['scheduleSemantics'],
    liveStatus: live === 'LIVE' || live === 'PREDICTED' || live === 'SCHEDULED' || live === 'UNAVAILABLE' || live === 'UNVERIFIED' ? live : 'UNKNOWN',
    driver: null,
    vehicle: null,
  };
}

/**
 * A stored journey comes back from GET /api/v1/journeys/:id with the same per-leg detail the planner produced
 * (coordinates, geometry, stops, times), but in the persistence row's field names. The canonical route screen
 * speaks the planner shape, so the deep link is mapped instead of being rendered as a plain text list.
 */
export function storedJourneyToApiJourney(journey: ApiStoredJourney): ApiJourney {
  const [origins, destinations] = resolveEndpoints(journey);
  const legs = journey.legs.map((leg, index) => legView(leg, origins[index], destinations[index], index, journey));
  const totalPrice = journey.confirmed_price_minor ?? journey.total_price_minor;
  return {
    id: journey.id,
    offerId: legs.find((leg) => leg.offerId)?.offerId ?? null,
    strategy: journey.strategy as ApiJourneyStrategy,
    state: journey.state,
    totalDurationSeconds: journey.total_duration_s ?? legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    requestedDepartureAt: journey.requested_departure_at,
    waitingSeconds: journey.waitingSeconds ?? 0,
    totalPriceMinor: totalPrice,
    confirmedPriceMinor: journey.confirmed_price_minor,
    estimatedPriceMinMinor: totalPrice,
    estimatedPriceMaxMinor: totalPrice,
    walkingMeters: journey.walking_distance_m ?? legs.reduce((sum, leg) => sum + (leg.mode === 'WALK' ? leg.distanceMeters ?? 0 : 0), 0),
    transfers: journey.transfer_count ?? Math.max(0, legs.filter((leg) => leg.mode !== 'WALK').length - 1),
    reliabilityScore: journey.reliability_score === null || journey.reliability_score === undefined ? null : Number(journey.reliability_score),
    currency: legs[0]?.currency ?? 'UAH',
    priceStatus: priceStatusFor(journey),
    legs,
  };
}
