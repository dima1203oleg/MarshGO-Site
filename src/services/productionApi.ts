import { routeResultSchema, type RouteRequest, type RouteResult } from '../../shared/navigation/contracts';
import { NavigationProviderError } from '../../shared/navigation/errors';

export type ApiUser = {
  id: string;
  display_name: string;
  phone_e164: string;
  email?: string | null;
  roles: string[];
  is_verified: boolean;
  /** The driver's face photo (driver profile); vehicles have their own photos. */
  driver_photo_url?: string | null;
};
export type ApiUserDataExport = {
  profile: Pick<ApiUser, 'id' | 'display_name' | 'phone_e164' | 'email' | 'roles' | 'is_verified'> & { created_at: string };
  vehicles: Array<{ id: string; make: string; model: string; model_year: number; seat_count: number; verification_status: string; created_at: string }>;
  bookings: Array<{ id: string; offer_id: string; seat_count: number; total_price_minor: number; currency: string; fee_class: string; platform_fee_minor: number; fee_rule_version: string; status: string; created_at: string }>;
  demands: Array<{ id: string; origin_name: string; destination_name: string; earliest_departure: string; latest_departure: string; passenger_count: number; budget_minor: number | null; status: string; created_at: string }>;
};
export type ApiAccountDeletionRequest = {
  id: string; status: 'cooling_off' | 'approved' | 'processing' | 'completed' | 'cancelled' | 'rejected';
  requested_at: string; cooling_off_until: string | null; cancelled_at: string | null;
};
export type ApiBlockedUser = { user_id: string; display_name: string; created_at: string };
export type ApiModerationCase = {
  id: string; reporter_name: string; reported_user_name: string; booking_id: string | null;
  origin_name: string | null; destination_name: string | null; category: 'safety' | 'harassment' | 'fraud' | 'service' | 'other';
  details: string; status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  resolution_action: 'no_action' | 'suspend_account' | null; resolution_note: string | null;
  created_at: string; updated_at: string; resolved_at: string | null;
};
type ApiModerationDecision = Pick<ApiModerationCase, 'id' | 'status' | 'resolution_action' | 'resolution_note' | 'updated_at' | 'resolved_at'>;

export type ApiOffer = {
  id: string;
  origin_name: string;
  destination_name: string;
  departure_at: string;
  arrival_at: string | null;
  distance_m: number | null;
  duration_s: number | null;
  route_source: string | null;
  price_per_seat_minor: number;
  currency: string;
  available_seats: number;
  total_seats: number;
  driver_name: string;
  average_rating: number | null;
  review_count: number;
  status?: string;
  vehicle_id?: string;
  vehicle_photo_url?: string | null;
  /** Road geometry from the routing backend, [longitude, latitude]; only present on offer detail responses. */
  route_geometry?: Array<[number, number]> | null;
};

export type ApiBooking = {
  id: string;
  offer_id: string;
  seat_count: number;
  total_price_minor: number;
  currency: string;
  fee_class: 'community';
  platform_fee_minor: number;
  fee_rule_version: string;
  status: string;
  origin_name: string;
  destination_name: string;
  departure_at: string;
  driver_name: string;
  passenger_name: string;
  current_user_is_driver: boolean;
  completion_confirmation_count: number;
  current_user_confirmed_completion: boolean;
  current_user_has_review: boolean;
  /** A significant change by the driver waiting for this passenger's decision. */
  pending_change?: ApiBookingChange | null;
};
export type ApiChangeSummary = { price?: { old: number; new: number }; departure?: { old: string; new: string }; vehicle?: { old: string; new: string }; seats?: { old: number; new: number } };
export type ApiBookingChange = { id: string; summary: ApiChangeSummary; new_unit_price_minor: number | null; created_at: string };
export type ApiOfferChange = { id: string; field: 'price' | 'departure' | 'seats' | 'vehicle' | 'status'; old_value: string | null; new_value: string | null; significant: boolean; reason: string | null; created_at: string };
export type ApiReview = { id: string; booking_id: string; author_id: string; target_id: string; rating: number; comment: string | null; created_at: string };
export type ApiRendezvousLocation = { coordinates: [number, number]; accuracyMeters: number; capturedAt: string; freshness: 'LIVE' | 'STALE' } | null;
export type ApiRendezvous = {
  id: string; bookingId: string; journeyLegId: string | null; state: string;
  pickup: { label: string; coordinates: [number, number] };
  plannedPickupAt: string; predictedPickupAt: string | null; activationAt: string;
  locationSharingEnabled: boolean; driverArrivedAt: string | null; passengerArrivedAt: string | null;
  locations: { driver: ApiRendezvousLocation; passenger: ApiRendezvousLocation };
};
export type ApiRescueAlternative = ApiOffer & {
  origin_distance_m: number;
  destination_distance_m: number;
  rescue_match: 'ENDPOINTS' | 'ALONG_CANCELLED_ROUTE';
  route_origin_distance_m: number | null;
  source: 'MARSHGO Community';
};
export type ApiRescueResult = {
  booking_id: string;
  checked_at: string;
  radius_m: number;
  alternatives: ApiRescueAlternative[];
};

export type ApiVehicle = {
  id: string;
  make: string;
  model: string;
  model_year: number;
  seat_count: number;
  verification_status: string;
  /** Licence plate (canonical form). */
  plate: string | null;
  /** 0 none, 1 plate + photo (automatic), 2 vehicle documents verified, 3 driver verified. */
  trust_level?: number;
  is_active: boolean;
};
export type ApiVehiclePhoto = { id: string; url: string; is_primary: boolean; sort_order: number; created_at: string };
export type ApiVerificationRecord = {
  id: string; verification_type: 'vehicle' | 'driver_license' | 'identity' | 'commercial'; vehicle_id: string | null;
  status: 'pending' | 'approved' | 'rejected'; created_at: string; reviewed_at: string | null; review_note: string | null;
};
export type ApiVerificationQueueItem = ApiVerificationRecord & {
  user_id: string; display_name: string; make: string | null; model: string | null;
  model_year: number | null; seat_count: number | null;
};

export type ApiMobilityProvider = {
  id: string; name: string; city: string; provider_type: string; source_type: string; feed_url: string; realtime_url: string | null;
  priority: number; status: 'enabled' | 'disabled' | 'paused'; health: 'unknown' | 'healthy' | 'degraded' | 'offline';
  country: string; access: 'open' | 'requires_credentials' | 'requires_partner_access' | 'insecure_endpoint'; license: string | null; update_frequency: string | null; coverage: string | null; source_ref: string | null;
  last_checked_at: string | null; last_sync_at: string | null; last_error: string | null;
  last_report: { checks?: Array<{ name: string; ok: boolean; detail?: string }>; counts?: Record<string, number>; responseMs?: number };
};
export type ApiMobilityAudit = { id: number; action: string; entity_id: string; details: Record<string, unknown>; created_at: string; actor: string | null };

export type ApiTransitAvailability = Record<string, { available: boolean; cities: string[] }>;
export type ApiMobilityAvailability = { modes: ApiRentalAvailability[]; transit: ApiTransitAvailability };
export type ApiRentalAvailability = { mode: 'bike' | 'scooter' | 'moped' | 'carsharing'; available: boolean; cities: string[] };
export type ApiProvider = { id: string; name: string; available: boolean; cities: string[]; sources: string[]; services: string[] };
export type ApiTransportProviders = { transportType: string; providers: ApiProvider[] };
export type ApiTransportCity = {
  id: string; name: string; timezone: string; bbox: [number, number, number, number] | null; modes: string[];
  routeCount: number; stopCount: number; realtimeAvailable: boolean; sourceUrl: string | null; licenses: string[];
  providers: Array<{ name: string; sourceType: string; license: string | null; sourceRef: string | null }>;
};
export type ApiNearbyAsset = { id: string; type: string; location: [number, number]; distanceM: number; providerName: string; batteryPercent?: number; rangeMeters?: number };
export type ApiNearbyStation = { id: string; name: string; location: [number, number]; distanceM: number; providerName: string; availableAssets?: number; capacity?: number; returnAllowed?: boolean };
export type ApiNearby = { mode: string; radiusM: number; providers: number; failedProviders: number; assets: ApiNearbyAsset[]; stations: ApiNearbyStation[]; totalAssets: number };

export type ApiMessage = { id: string; sender_id: string; sender_name: string; body: string; created_at: string };
export type ApiConversationUnread = { conversation_id: string; booking_id: string | null; unread_count: number };
export type ApiNotification = {
  id: string; event_type: string; title: string; body: string; payload: Record<string, unknown>;
  created_at: string; read_at: string | null;
};
export type ApiNotificationPage = { items: ApiNotification[]; nextCursor: string | null; unreadCount: number };
export type ApiRealtimeEvent =
  | { type: 'conversation.message.created'; data: ApiMessage & { conversation_id: string } }
  | { type: 'booking.change-requested' | 'trip.updated' | 'trip.cancelled'; data: { booking_id: string; offer_id: string; status?: string } }
  | { type: 'booking.confirmed' | 'booking.cancelled' | 'booking.changed'; data: { booking_id: string; offer_id?: string; status: string; seat_count?: number; available_seats?: number | null } }
  | { type: 'proposal.created' | 'proposal.countered' | 'proposal.updated'; data: { proposal_id: string; demand_id: string; status?: string; revision_number: number; price_minor: number; departure_at: string } }
  | { type: 'proposal.accepted'; data: { proposal_id: string; demand_id: string; booking_id: string; status: string; price_minor: number; departure_at: string } }
  | { type: 'proposal.closed'; data: { proposal_id: string; demand_id: string; status: string; reason: string } }
  | { type: 'navigation.match.driver-interested'; data: { candidate_id: string; demand_id: string; status: 'driver_interested' } }
  | { type: 'navigation.match.passenger-confirmed'; data: { candidate_id: string; demand_id: string; status: 'passenger_confirmed' } }
  | { type: 'navigation.route-updated'; data: { navigation_session_id: string; booking_id: string; route_version: number } }
  | { type: `rendezvous.${string}`; data: { rendezvous_id: string; state?: string; participant?: 'driver' | 'passenger'; coordinates?: [number, number]; accuracyMeters?: number; capturedAt?: string; near_pickup?: boolean } }
  | { type: 'journey.updated'; data: { journey_id: string; journey_leg_id: string; booking_id: string; state: 'READY' | 'REPLANNING' } };
export type ApiConversation = { id: string; booking_id: string; created_at: string };
export type ApiPlace = { label: string; latitude: number; longitude: number; providerId: string };
export type ApiJourneyStrategy = 'FASTEST' | 'CHEAPEST' | 'BALANCED' | 'PREMIUM' | 'RELIABLE' | 'CUSTOM';
export type ApiJourney = {
  id: string;
  offerId: string | null;
  source?: string;
  providerName?: string;
  routeName?: string;
  headsign?: string;
  strategy: ApiJourneyStrategy;
  state: string;
  totalDurationSeconds: number;
  totalPriceMinor: number | null;
  confirmedPriceMinor: number | null;
  estimatedPriceMinMinor: number | null;
  estimatedPriceMaxMinor: number | null;
  walkingMeters: number;
  transfers: number;
  reliabilityScore: number | null;
  legs: Array<{
    id: string;
    mode: string;
    offerId: string | null;
    origin: { name: string; coordinates: [number, number] };
    destination: { name: string; coordinates: [number, number] };
    departureAt: string;
    arrivalAt: string;
    durationSeconds: number;
    distanceMeters: number | null;
    priceMinor: number | null;
    priceStatus: 'ESTIMATED' | 'LOCKED' | 'DYNAMIC' | 'UNKNOWN';
    availabilityStatus: string;
    source: string;
    lastUpdatedAt: string;
    providerName?: string;
    routeName?: string;
    headsign?: string;
    driver: { id: string; name: string; averageRating: number | null; reviewCount: number } | null;
    vehicle: { id: string; make: string; model: string } | null;
  }>;
};
export type ApiJourneySearchResult = {
  journeys: ApiJourney[];
  partial: boolean;
  blockedProviders: string[];
  unsupportedPreferences: string[];
  providerErrors: string[];
};
export type ApiStoredJourney = {
  id: string;
  origin_name: string;
  destination_name: string;
  requested_departure_at: string;
  strategy: ApiJourneyStrategy;
  state: string;
  passenger_count: number;
  total_price_minor: number | null;
  confirmed_price_minor: number | null;
  legs: Array<{ id: string; mode: string; offerId: string | null; bookingId: string | null; state: string; priceMinor: number | null; priceStatus: string }>;
};
export type GeoJsonCollection = { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }> };
export type ApiNavigationSession = {
  id: string; state: 'active' | 'paused' | 'ended'; destination_name: string | null;
  route_distance_m: number | null; route_duration_s: number | null; route_version: number; opt_in: boolean;
  matching_vehicle_available: boolean; vehicle_seat_count: number | null;
  started_at: string; ended_at?: string | null; route: [number, number][] | null;
  /** Turn-by-turn steps of the current route (absent on older servers). */
  maneuvers?: import('../../shared/navigation/contracts').Maneuver[];
  current_location: [number, number] | null; current_location_accuracy_m: number | null; current_location_at: string | null;
};
export type ApiNavigationMatch = {
  id: string; demand_id: string; status: 'suggested' | 'driver_interested' | 'passenger_confirmed' | 'dismissed' | 'expired';
  detour_distance_m: number; detour_duration_s: number; pickup_eta: string; expires_at: string;
  origin_name: string; destination_name: string; earliest_departure: string; latest_departure: string;
  passenger_count: number; budget_minor: number | null; budget_type: 'total_all' | 'per_seat';
  vehicle_make: string | null; vehicle_model: string | null;
};
export type ApiPassengerNavigationMatch = Omit<ApiNavigationMatch, 'id'> & { candidate_id: string; driver_name: string | null };
export type ApiDemand = {
  id: string; origin_name: string; destination_name: string; earliest_departure: string; latest_departure: string;
  passenger_count: number; budget_minor: number | null; budget_type: 'total_all' | 'per_seat'; notes: string | null;
  requirements: Record<string, unknown>; status: string; created_at: string;
  proposal_count?: number;
};
export type ApiProposal = {
  id: string; demand_id: string; driver_id: string; driver_name: string; vehicle_id: string;
  navigation_candidate_id?: string | null;
  make: string; model: string; model_year: number; price_minor: number; currency: string; departure_at: string;
  comment: string | null; status: string; expires_at: string; revision_number: number; last_actor_role: 'driver' | 'passenger' | null;
  last_comment: string | null;
};
export type ApiProposalRevision = {
  revision_number: number; actor_id: string; actor_role: 'driver' | 'passenger'; price_minor: number;
  departure_at: string; comment: string | null; created_at: string;
};

type ApiEnvelope<T> = { data: T };
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
let accessToken: string | null = null;

async function request<T>(path: string, init: RequestInit = {}, retryAuth = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${apiBase}/api/v1${path}`, { ...init, headers, credentials: 'include' });
  const body = await response.json().catch(() => null) as { data?: T; error?: { code?: string; message?: string } } | null;
  if (response.status === 401 && retryAuth && accessToken && !path.startsWith('/auth/')) {
    try {
      const session = await request<{ user: ApiUser; accessToken: string }>('/auth/refresh', { method: 'POST' }, false);
      accessToken = session.accessToken;
      return request<T>(path, init, false);
    } catch {
      accessToken = null;
    }
  }
  if (!response.ok) {
    if (response.status === 429 || body?.error?.code === 'rate_limit_exceeded') {
      throw new Error('Забагато запитів за короткий час. Зачекайте кілька хвилин і спробуйте ще раз.');
    }
    throw new Error(body?.error?.message || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (body as ApiEnvelope<T>).data;
}

export const productionApi = {
  async restoreSession() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const session = await request<{ user: ApiUser; accessToken: string }>('/auth/refresh', {
        method: 'POST',
        signal: controller.signal,
      });
      accessToken = session.accessToken;
      return session.user;
    } finally {
      window.clearTimeout(timeoutId);
    }
  },
  async requestOtp(phone: string, displayName: string) {
    return request<{ expiresInSeconds: number; delivery: string; developmentCode?: string }>('/auth/otp/request', {
      method: 'POST', body: JSON.stringify({ phone, displayName }),
    });
  },
  async verifyOtp(phone: string, code: string) {
    const session = await request<{ user: ApiUser; accessToken: string }>('/auth/otp/verify', {
      method: 'POST', body: JSON.stringify({ phone, code }),
    });
    accessToken = session.accessToken;
    return session.user;
  },
  async logout() {
    try { await request('/auth/logout', { method: 'POST' }); } finally { accessToken = null; }
  },
  async logoutAll() {
    try { await request('/auth/logout-all', { method: 'POST' }); } finally { accessToken = null; }
  },
  offers(params: { origin: string; destination: string; date: string; seats: number; originCoordinates?: [number, number]; destinationCoordinates?: [number, number] }) {
    const query = new URLSearchParams({ origin: params.origin, destination: params.destination, date: params.date, seats: String(params.seats) });
    if (params.originCoordinates) { query.set('originLon', String(params.originCoordinates[0])); query.set('originLat', String(params.originCoordinates[1])); }
    if (params.destinationCoordinates) { query.set('destinationLon', String(params.destinationCoordinates[0])); query.set('destinationLat', String(params.destinationCoordinates[1])); }
    return request<ApiOffer[]>(`/offers?${query.toString()}`);
  },
  offer(id: string) { return request<ApiOffer>(`/offers/${encodeURIComponent(id)}`); },
  myOffers() { return request<ApiOffer[]>('/offers/mine'); },
  updateOffer(id: string, input: { pricePerSeatMinor?: number; departureAt?: string; totalSeats?: number; vehicleId?: string; reason?: string }) {
    return request<ApiOffer & { changed: boolean; approvalsRequested: number; bookingsNotified: number }>(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  },
  cancelOffer(id: string, reason?: string) { return request<{ id: string; status: 'cancelled'; cancelledBookings: number }>(`/offers/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }); },
  offerChanges(id: string) { return request<ApiOfferChange[]>(`/offers/${id}/changes`); },
  acceptBookingChange(id: string) { return request<{ id: string; status: 'accepted' }>(`/booking-changes/${id}/accept`, { method: 'POST' }); },
  rejectBookingChange(id: string) { return request<{ id: string; status: 'rejected' }>(`/booking-changes/${id}/reject`, { method: 'POST' }); },
  createOffer(input: {
    vehicleId: string; originName: string; destinationName: string; origin: [number, number]; destination: [number, number];
    departureAt: string; pricePerSeatMinor: number; seats: number;
  }) {
    return request<{ id: string; origin_name: string; destination_name: string; departure_at: string; status: string }>(
      '/offers', { method: 'POST', body: JSON.stringify(input) },
    );
  },
  suggestPlaces(query: string) {
    return request<ApiPlace[]>(`/places/suggest?q=${encodeURIComponent(query)}`);
  },
  reverseGeocode(latitude: number, longitude: number) {
    return request<ApiPlace>(`/places/reverse?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`);
  },
  searchJourneys(input: {
    origin: { name: string; coordinates: [number, number] };
    destination: { name: string; coordinates: [number, number] };
    departureAt: string;
    passengers: number;
    strategy: ApiJourneyStrategy;
    preferences?: Record<string, boolean | string[]>;
  }) {
    return request<ApiJourneySearchResult>('/journeys/search', { method: 'POST', body: JSON.stringify(input) });
  },
  journeys() { return request<ApiStoredJourney[]>('/journeys/me'); },
  journey(id: string) { return request<ApiStoredJourney>(`/journeys/${encodeURIComponent(id)}`); },
  startNavigation(input: { origin: [number, number]; destination?: [number, number]; destinationName?: string }) {
    return request<ApiNavigationSession>('/navigation/sessions', { method: 'POST', body: JSON.stringify(input) });
  },
  async calculateRoute(input: RouteRequest): Promise<RouteResult> {
    const result = await request<unknown>('/routing/calculate', { method: 'POST', body: JSON.stringify(input) });
    const parsed = routeResultSchema.safeParse(result);
    if (!parsed.success) throw new NavigationProviderError('ROUTING_INVALID_RESPONSE', 'marshgo-api');
    return parsed.data;
  },
  activeNavigation() { return request<ApiNavigationSession | null>('/navigation/sessions/active'); },
  setNavigationMatching(id: string, enabled: boolean) {
    return request<{ id: string; enabled: boolean; default: false }>(`/navigation/sessions/${id}/matching`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
  },
  pauseNavigation(id: string) { return request<{ id: string; state: 'paused'; opt_in: boolean }>(`/navigation/sessions/${id}/pause`, { method: 'POST' }); },
  resumeNavigation(id: string) { return request<{ id: string; state: 'active'; opt_in: boolean }>(`/navigation/sessions/${id}/resume`, { method: 'POST' }); },
  transportLayerAvailability() { return request<Array<{ id: string; available: boolean }>>('/transport/layers'); },
  transportCities(signal?: AbortSignal) { return request<ApiTransportCity[]>('/transport/cities', { signal }); },
  transportRoutes(bbox: string, types: string[], signal?: AbortSignal) { return request<GeoJsonCollection>(`/transport/routes?bbox=${bbox}&types=${types.join(',')}`, { signal }); },
  transportStops(bbox: string, types: string[], signal?: AbortSignal) { return request<GeoJsonCollection>(`/transport/stops?bbox=${bbox}&types=${types.join(',')}`, { signal }); },
  transportVehicles(bbox: string, types: string[], signal?: AbortSignal) { return request<GeoJsonCollection>(`/transport/vehicles?bbox=${bbox}&types=${types.join(',')}`, { signal }); },
  transportMicromobility(bbox: string, types: string[], signal?: AbortSignal) { return request<GeoJsonCollection>(`/transport/micromobility?bbox=${bbox}&types=${types.join(',')}`, { signal }); },
  setNavigationDestination(id: string, input: { destination: [number, number]; destinationName: string }) {
    return request<ApiNavigationSession>(`/navigation/sessions/${id}/destination`, { method: 'PUT', body: JSON.stringify(input) });
  },
  rerouteNavigation(id: string) { return request<ApiNavigationSession>(`/navigation/sessions/${id}/reroute`, { method: 'POST' }); },
  refreshNavigationMatches(id: string) { return request<ApiNavigationMatch[]>(`/navigation/sessions/${id}/matches/refresh`, { method: 'POST' }); },
  navigationMatches(id: string) { return request<ApiNavigationMatch[]>(`/navigation/sessions/${id}/matches`); },
  expressNavigationInterest(sessionId: string, candidateId: string) {
    return request<{ id: string; demand_id: string; status: 'driver_interested'; pickup_eta: string; detour_distance_m: number; detour_duration_s: number }>(
      `/navigation/sessions/${sessionId}/matches/${candidateId}/interest`, { method: 'POST' },
    );
  },
  myNavigationMatches() { return request<ApiPassengerNavigationMatch[]>('/demands/mine/navigation-matches'); },
  confirmNavigationMatch(candidateId: string) {
    return request<{ id: string; demandId: string; status: 'passenger_confirmed'; nextStep: 'price_negotiation' }>(
      `/navigation/matches/${candidateId}/passenger-confirm`, { method: 'POST' },
    );
  },
  navigationSession(id: string) { return request<ApiNavigationSession>(`/navigation/sessions/${id}`); },
  sendNavigationLocation(id: string, input: { coordinates: [number, number]; accuracyMeters: number; capturedAt: string }) {
    return request<{ accepted: boolean; onRoute: boolean; capturedAt: string }>(`/navigation/sessions/${id}/location`, {
      method: 'POST', body: JSON.stringify(input),
    });
  },
  endNavigation(id: string) { return request<{ id: string; state: string; ended_at?: string; replayed?: boolean }>(`/navigation/sessions/${id}/end`, { method: 'POST' }); },
  createDemand(input: {
    originName: string; destinationName: string; origin: [number, number]; destination: [number, number];
    earliestDeparture: string; latestDeparture: string; passengers: number; budgetMinor?: number;
    budgetType?: 'total_all' | 'per_seat'; notes?: string; requirements?: Record<string, boolean>;
  }) {
    return request<ApiDemand>('/demands', { method: 'POST', body: JSON.stringify(input) });
  },
  myDemands() { return request<ApiDemand[]>('/demands/mine'); },
  openDemands() { return request<ApiDemand[]>('/demands'); },
  openDemand(id: string) { return request<ApiDemand>(`/demands/${encodeURIComponent(id)}`); },
  demandProposals(demandId: string) { return request<ApiProposal[]>(`/demands/${demandId}/proposals`); },
  proposalRevisions(proposalId: string) { return request<ApiProposalRevision[]>(`/proposals/${proposalId}/revisions`); },
  createProposal(demandId: string, input: { vehicleId: string; priceMinor: number; departureAt: string; comment?: string; navigationCandidateId?: string }) {
    return request<ApiProposal>(`/demands/${demandId}/proposals`, { method: 'POST', body: JSON.stringify(input) });
  },
  counterProposal(proposalId: string, input: { priceMinor: number; departureAt: string; comment?: string }) {
    return request<ApiProposal>(`/proposals/${proposalId}/counter`, { method: 'POST', body: JSON.stringify(input) });
  },
  agreeProposal(proposalId: string) {
    return request<ApiProposal>(`/proposals/${proposalId}/agree`, { method: 'POST' });
  },
  acceptProposal(proposalId: string) {
    return request<ApiBooking>(`/proposals/${proposalId}/accept`, { method: 'POST' });
  },
  cancelDemand(demandId: string) {
    return request<{ id: string; status: string }>(`/demands/${demandId}/cancel`, { method: 'POST' });
  },
  bookings() { return request<ApiBooking[]>('/bookings'); },
  bookingRendezvous(bookingId: string) { return request<ApiRendezvous>(`/bookings/${encodeURIComponent(bookingId)}/rendezvous`); },
  activateRendezvous(bookingId: string) { return request<ApiRendezvous>(`/bookings/${encodeURIComponent(bookingId)}/rendezvous/activate`, { method: 'POST' }); },
  sendRendezvousLocation(rendezvousId: string, location: { longitude: number; latitude: number; accuracyMeters: number; capturedAt: string }) {
    return request<{ rendezvousId: string; storedEphemerally: true; expiresInSeconds: number; nearPickup: boolean; arrivalRequiresUserConfirmation: true }>(
      `/rendezvous/${encodeURIComponent(rendezvousId)}/location`, { method: 'POST', body: JSON.stringify(location) },
    );
  },
  rendezvousStatus(rendezvousId: string, action: 'approaching' | 'arrived' | 'delayed' | 'will_arrive' | 'cannot_make_it', minutes?: number) {
    return request<{ id: string; state: string; locationSharingEnabled: boolean }>(
      `/rendezvous/${encodeURIComponent(rendezvousId)}/status`, { method: 'POST', body: JSON.stringify({ action, ...(minutes ? { minutes } : {}) }) },
    );
  },
  rendezvousBoarding(rendezvousId: string) {
    return request<{ id: string; state: string }>(`/rendezvous/${encodeURIComponent(rendezvousId)}/boarding`, { method: 'POST' });
  },
  endRendezvous(rendezvousId: string) { return request<{ id: string; state: string }>(`/rendezvous/${encodeURIComponent(rendezvousId)}/end`, { method: 'POST' }); },
  notifications(cursor?: string | null) {
    const query = new URLSearchParams({ limit: '30' });
    if (cursor) query.set('cursor', cursor);
    return request<ApiNotificationPage>(`/notifications?${query.toString()}`);
  },
  markNotificationRead(id: string) { return request<{ id: string; read_at: string }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }); },
  markAllNotificationsRead() { return request<{ updated: number }>('/notifications/read-all', { method: 'POST' }); },
  cancelBooking(bookingId: string) {
    return request<{ id: string; status: string; replayed?: boolean }>(`/bookings/${bookingId}/cancel`, { method: 'POST' });
  },
  bookingRescue(bookingId: string) { return request<ApiRescueResult>(`/bookings/${bookingId}/rescue`); },
  bookingTicket(bookingId: string) {
    return request<{ format: string; token: string; expiresAt: string }>(`/bookings/${bookingId}/ticket`);
  },
  markBoarding(bookingId: string, ticket: string) {
    return request<{ id: string; status: string; replayed?: boolean }>(`/bookings/${bookingId}/boarding`, { method: 'POST', body: JSON.stringify({ ticket }) });
  },
  startTrip(bookingId: string) {
    return request<{ id: string; status: string }>(`/bookings/${bookingId}/start`, { method: 'POST' });
  },
  confirmTripCompletion(bookingId: string) {
    return request<{ id: string; status: string; confirmations: number; requiredConfirmations: number; replayed?: boolean }>(`/bookings/${bookingId}/complete`, { method: 'POST' });
  },
  createBookingReview(bookingId: string, input: { rating: number; comment?: string }) {
    return request<ApiReview>(`/bookings/${bookingId}/reviews`, { method: 'POST', body: JSON.stringify(input) });
  },
  blockedUsers() { return request<ApiBlockedUser[]>('/users/me/blocks'); },
  blockBookingOther(bookingId: string) { return request<void>(`/bookings/${bookingId}/block-other`, { method: 'POST' }); },
  unblockUser(userId: string) { return request<void>(`/users/${encodeURIComponent(userId)}/block`, { method: 'DELETE' }); },
  createReport(input: { bookingId: string; category: ApiModerationCase['category']; details: string }) {
    return request<{ id: string; status: 'open' }>('/reports', { method: 'POST', body: JSON.stringify(input) });
  },
  moderationCases(status: 'open' | 'in_review' | 'resolved' | 'dismissed' | 'all' = 'open') {
    return request<ApiModerationCase[]>(`/admin/moderation?status=${status}`);
  },
  reviewModerationCase(caseId: string, input: { status: 'in_review' | 'resolved' | 'dismissed'; action?: 'no_action' | 'suspend_account'; note?: string }) {
    return request<ApiModerationDecision>(`/admin/moderation/${encodeURIComponent(caseId)}/decision`, { method: 'POST', body: JSON.stringify(input) });
  },
  me() { return request<ApiUser>('/users/me'); },
  exportMyData() { return request<ApiUserDataExport>('/users/me/export'); },
  accountDeletionRequest() { return request<ApiAccountDeletionRequest | null>('/users/me/deletion-request'); },
  requestAccountDeletion() { return request<ApiAccountDeletionRequest>('/users/me/deletion-requests', { method: 'POST' }); },
  cancelAccountDeletion() { return request<ApiAccountDeletionRequest>('/users/me/deletion-requests/cancel', { method: 'POST' }); },
  vehicles() { return request<ApiVehicle[]>('/vehicles'); },
  enableRole(role: 'passenger' | 'driver') {
    return request<{ id: string; roles: string[] }>('/users/me/roles', { method: 'POST', body: JSON.stringify({ role }) });
  },
  createVehicle(input: { make: string; model: string; modelYear: number; seats: number; plate: string }) {
    return request<ApiVehicle>('/vehicles', { method: 'POST', body: JSON.stringify(input) });
  },
  vehiclePhotos(vehicleId: string) { return request<ApiVehiclePhoto[]>(`/vehicles/${vehicleId}/photos`); },
  async uploadDriverPhoto(file: File) {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('Додайте JPEG, PNG або WebP до 10 МБ.');
    const upload = await request<{ key: string; url: string; fields: Record<string, string> }>('/users/me/driver-photo/upload-url', { method: 'POST', body: JSON.stringify({ contentType: file.type }) });
    const form = new FormData();
    for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
    form.append('file', file);
    const uploaded = await fetch(upload.url, { method: 'POST', body: form });
    if (!uploaded.ok) throw new Error(`Сховище не прийняло фото (${uploaded.status}).`);
    return request<{ driver_photo_url: string }>('/users/me/driver-photo', { method: 'POST', body: JSON.stringify({ key: upload.key, contentType: file.type }) });
  },
  deleteDriverPhoto() { return request<{ driver_photo_url: null }>('/users/me/driver-photo', { method: 'DELETE' }); },
  async uploadVehiclePhoto(vehicleId: string, file: File) {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('Додайте JPEG, PNG або WebP до 10 МБ.');
    const upload = await request<{ key: string; url: string; fields: Record<string, string>; maxBytes: number }>(`/vehicles/${vehicleId}/photos/upload-url`, {
      method: 'POST', body: JSON.stringify({ contentType: file.type }),
    });
    const form = new FormData();
    for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
    form.append('file', file);
    const uploaded = await fetch(upload.url, { method: 'POST', body: form });
    if (!uploaded.ok) throw new Error(`Сховище не прийняло фото (${uploaded.status}).`);
    return request<ApiVehiclePhoto>(`/vehicles/${vehicleId}/photos`, { method: 'POST', body: JSON.stringify({ key: upload.key, contentType: file.type }) });
  },
  setPrimaryVehiclePhoto(vehicleId: string, photoId: string) {
    return request<ApiVehiclePhoto>(`/vehicles/${vehicleId}/photos/${photoId}/primary`, { method: 'PATCH' });
  },
  reorderVehiclePhotos(vehicleId: string, photoIds: string[]) {
    return request<{ photoIds: string[] }>(`/vehicles/${vehicleId}/photos/order`, { method: 'PUT', body: JSON.stringify({ photoIds }) });
  },
  deleteVehiclePhoto(vehicleId: string, photoId: string) {
    return request<{ id: string; deleted: boolean }>(`/vehicles/${vehicleId}/photos/${photoId}`, { method: 'DELETE' });
  },
  deleteVehicle(id: string) { return request<{ id: string; archived: true; activatedVehicleId: string | null }>(`/vehicles/${id}`, { method: 'DELETE' }); },
  activateVehicle(id: string) { return request<ApiVehicle>(`/vehicles/${id}/activate`, { method: 'POST' }); },
  verificationRecords() { return request<ApiVerificationRecord[]>('/users/me/verification'); },
  verificationEvidenceUploadUrl(vehicleId: string, contentType: string) {
    return request<{ key: string; url: string; fields: Record<string, string>; expiresInSeconds: number; maxBytes: number }>(
      `/vehicles/${vehicleId}/verification/evidence/upload-url`, { method: 'POST', body: JSON.stringify({ contentType }) },
    );
  },
  async uploadVerificationEvidence(vehicleId: string, file: File) {
    const upload = await this.verificationEvidenceUploadUrl(vehicleId, file.type);
    if (file.size < 1 || file.size > upload.maxBytes) throw new Error('Документ має бути меншим за 8 МБ.');
    const form = new FormData();
    for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
    form.append('file', file);
    const response = await fetch(upload.url, { method: 'POST', body: form });
    if (!response.ok) throw new Error(`Сховище не прийняло документ (${response.status}).`);
    return { key: upload.key, contentType: file.type };
  },
  submitVehicleVerification(vehicleId: string, input: { registrationEvidenceKey: string; registrationContentType: string; driverLicenseEvidenceKey: string; driverLicenseContentType: string }) {
    return request<{ vehicleId: string; status: string }>(`/vehicles/${vehicleId}/verification`, { method: 'POST', body: JSON.stringify(input) });
  },
  providersByTransport(point?: { latitude: number; longitude: number }) { return request<ApiTransportProviders[]>(`/mobility/providers${point ? `?lat=${point.latitude}&lon=${point.longitude}` : ''}`); },
  mobilityAvailability() { return request<ApiMobilityAvailability>('/mobility/availability'); },
  nearbyRentals(mode: string, latitude: number, longitude: number, radiusM = 1000) {
    return request<ApiNearby>(`/mobility/nearby?mode=${encodeURIComponent(mode)}&lat=${latitude}&lon=${longitude}&radiusM=${radiusM}`);
  },
  mobilityProviders() { return request<ApiMobilityProvider[]>('/admin/mobility/providers'); },
  createMobilityProvider(input: { name: string; city: string; providerType: string; sourceType: string; feedUrl: string; realtimeUrl?: string; priority?: number }) {
    return request<ApiMobilityProvider>('/admin/mobility/providers', { method: 'POST', body: JSON.stringify(input) });
  },
  updateMobilityProvider(id: string, input: { status?: 'enabled' | 'disabled' | 'paused'; priority?: number }) {
    return request<ApiMobilityProvider>(`/admin/mobility/providers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
  },
  deleteMobilityProvider(id: string) { return request<void>(`/admin/mobility/providers/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  testMobilityProvider(id: string) { return request<{ provider: ApiMobilityProvider }>(`/admin/mobility/providers/${encodeURIComponent(id)}/test`, { method: 'POST' }); },
  mobilityAudit() { return request<ApiMobilityAudit[]>('/admin/mobility/audit'); },
  adminVerificationQueue() { return request<ApiVerificationQueueItem[]>('/admin/verification'); },
  adminVerificationEvidence(id: string) { return request<{ url: string; expiresInSeconds: number }>(`/admin/verification/${id}/evidence`); },
  decideVerification(id: string, decision: 'approved' | 'rejected', note?: string) {
    return request<{ id: string; status: string; vehicleStatus: string | null }>(`/admin/verification/${id}/decision`, {
      method: 'POST', body: JSON.stringify({ decision, ...(note ? { note } : {}) }),
    });
  },
  conversation(bookingId: string) { return request<ApiConversation>(`/bookings/${bookingId}/conversation`); },
  conversationById(conversationId: string) { return request<ApiConversation>(`/conversations/${encodeURIComponent(conversationId)}`); },
  async messages(conversationId: string) {
    const page = await request<ApiMessage[] | { messages: ApiMessage[] }>(
      `/conversations/${conversationId}/messages`,
    );
    return Array.isArray(page) ? page : page.messages;
  },
  async messagePage(conversationId: string, before?: string) {
    const params = new URLSearchParams({ limit: '50' });
    if (before) params.set('before', before);
    const page = await request<ApiMessage[] | { messages: ApiMessage[]; pagination?: { hasMore: boolean; nextCursor: string | null } }>(
      `/conversations/${conversationId}/messages?${params}`,
    );
    if (Array.isArray(page)) return { messages: page, hasMore: false, nextCursor: null };
    return {
      messages: page.messages,
      hasMore: page.pagination?.hasMore ?? false,
      nextCursor: page.pagination?.nextCursor ?? null,
    };
  },
  conversationUnreadCounts() { return request<ApiConversationUnread[]>('/conversation-unread-counts'); },
  markConversationRead(conversationId: string) {
    return request<{ conversation_id: string; last_read_message_id: string | null; unread_count: number }>(
      `/conversations/${encodeURIComponent(conversationId)}/read`, { method: 'POST' },
    );
  },
  sendMessage(conversationId: string, body: string) {
    return request<ApiMessage>(`/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
  },
  subscribeRealtime(onEvent: (event: ApiRealtimeEvent) => void, onState: (connected: boolean) => void) {
    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;
    const reconnect = () => {
      if (!active || retryTimer) return;
      onState(false);
      retryTimer = setTimeout(() => { retryTimer = null; void connect(); }, retryDelay);
      retryDelay = Math.min(30_000, retryDelay * 2);
    };
    const connect = async () => {
      if (!active) return;
      try {
        const { ticket } = await request<{ ticket: string }>('/realtime/ticket', { method: 'POST' });
        if (!active) return;
        const url = new URL(`${apiBase}/api/v1/realtime`, window.location.href);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.searchParams.set('ticket', ticket);
        const next = new WebSocket(url);
        socket = next;
        next.onopen = () => { retryDelay = 1000; onState(true); };
        next.onmessage = (message) => {
          try {
            const event = JSON.parse(String(message.data)) as ApiRealtimeEvent | { type: string };
            if (event.type === 'conversation.message.created' || event.type === 'journey.updated' || event.type.startsWith('booking.') || event.type.startsWith('trip.') || event.type.startsWith('proposal.') || event.type.startsWith('navigation.match.') || event.type.startsWith('rendezvous.')) onEvent(event as ApiRealtimeEvent);
          } catch { /* Ignore malformed realtime frames; persisted REST history remains authoritative. */ }
        };
        next.onerror = () => next.close();
        next.onclose = () => { if (socket === next) socket = null; reconnect(); };
      } catch { reconnect(); }
    };
    void connect();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      const current = socket;
      socket = null;
      current?.close(1000, 'chat closed');
      onState(false);
    };
  },
  book(offerId: string, seats: number, journey?: { journeyId: string; journeyLegId: string }) {
    return request<ApiBooking>('/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ offerId, seats, ...(journey ?? {}) }),
    });
  },
};
