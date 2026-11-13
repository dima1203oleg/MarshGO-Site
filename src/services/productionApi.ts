import { routeResultSchema, type RouteRequest, type RouteResult } from '../../shared/navigation/contracts';
import { NavigationProviderError } from '../../shared/navigation/errors';
import { NETWORK_ERROR_CODE, networkFailureMessage, requestErrorMessage } from './requestErrorMessage';
import { normalizePlaceQuery } from './placeQuery';
import {
  createRealtimeChannel,
  type RealtimeChannel,
  type RealtimeSocket,
  type RealtimeStatus,
} from './realtimeChannel';
import { withAuthRefreshLock } from './authRefreshLock';
import type { TransitZoneGeometry, VehiclePriority } from '../map/transportVisualZones';

export interface TransitArrival {
  stopId: string;
  routeId: string;
  mode?: string;
  tripId?: string;
  vehicleId?: string;
  scheduledArrival?: string;
  predictedArrival?: string;
  arrivalSource: 'TRIP_UPDATE' | 'VEHICLE_PROJECTION' | 'SCHEDULE' | 'UNKNOWN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  /** Timestamp of the source vehicle observation; only present for GPS-derived arrivals. */
  observedAt?: string;
  /** Timestamp of a GTFS-RT feed update; it is not a vehicle GPS observation. */
  realtimeUpdatedAt?: string;
  isRealtime: boolean;
  etaSeconds?: number;
  displayLabel: string;
}

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
  /** The search found nothing on the chosen day; this offer is the same route on another day. */
  other_date?: boolean;
  vehicle_photo_url?: string | null;
  /** The driver's own face photo (separate from the vehicle photo). */
  driver_photo_url?: string | null;
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
  /** The boarding pass prints arrival and duration only when the offer actually carries them. */
  arrival_at?: string | null;
  duration_s?: number | null;
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
  currentParticipant: 'driver' | 'passenger'; currentParticipantConsent: boolean; otherParticipantConsent: boolean;
  locations: { driver: ApiRendezvousLocation; passenger: ApiRendezvousLocation };
};
export type ApiRendezvousApproach = {
  status: 'ROUTED' | 'LOCATION_UNAVAILABLE' | 'ROUTING_UNAVAILABLE';
  geometry: [number, number][] | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  calculatedAt?: string;
};
export type ApiRendezvousApproaches = {
  rendezvousId: string;
  pickup: { label: string; coordinates: [number, number] };
  driver: { location: ApiRendezvousLocation; approach: ApiRendezvousApproach };
  passenger: { location: ApiRendezvousLocation; approach: ApiRendezvousApproach };
  updatedAt: string;
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
export type ApiMobilityOperator = {
  provider_id: string;
  provider_name: string;
  provider_group: string;
  data_source: string;
  source_url: string;
  integration_status: string;
  data_freshness_seconds: number | null;
  booking_method: string;
  pricing_capability: string;
  live_availability_capability: boolean;
  commercial_permissions: string;
  attribution_requirements: string | null;
  enabled: boolean;
  last_successful_sync: string | null;
  last_sync_error: string | null;
  api_key_configured: boolean;
  location_count: number;
  live_available_count: number;
  status_message: string | null;
};
export type ApiTransportCity = {
  id: string;
  name: string;
  timezone: string;
  bbox: [number, number, number, number] | null;
  modes: string[];
  routeCount: number;
  stopCount: number;
  realtimeAvailable: boolean;
  sourceUrl: string | null;
  licenses: string[];
  providers: Array<{ name: string; sourceType: string; license: string | null; sourceRef: string | null }>;
};

export type ApiTransitAvailability = Record<string, { available: boolean; cities: string[] }>;
export type ApiMobilityAvailability = { modes: ApiRentalAvailability[]; transit: ApiTransitAvailability };
export type ApiRentalAvailability = { mode: 'bike' | 'scooter' | 'moped' | 'carsharing'; available: boolean; cities: string[] };
export type ApiProvider = { id: string; name: string; available: boolean; cities: string[]; sources: string[]; services: string[]; availabilityStatus?: string; bookingAvailable?: boolean };
export type ApiTransportProviders = { transportType: string; providers: ApiProvider[] };
export type ApiNearbyAsset = { id: string; type: string; location: [number, number]; distanceM: number; providerName: string; batteryPercent?: number; rangeMeters?: number };
export type ApiNearbyStation = { id: string; name: string; location: [number, number]; distanceM: number; providerName: string; availableAssets?: number; capacity?: number; returnAllowed?: boolean };
export type ApiProviderFailure = { id: string; name: string; sourceType: string; layer: string; reason: string };
export type ApiNearby = { mode: string; radiusM: number; providers: number; failedProviders: ApiProviderFailure[]; failedProviderCount: number; assets: ApiNearbyAsset[]; stations: ApiNearbyStation[]; totalAssets: number };

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
  | { type: 'journey.updated'; data: { journey_id: string; journey_leg_id?: string; booking_id?: string; state: 'READY' | 'REPLANNING' | 'PARTIALLY_RESERVED' | string } };
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
  /** The same exact journey may be recommended under more than one strategy. */
  recommendedStrategies?: ApiJourneyStrategy[];
  strategyRanks?: Partial<Record<ApiJourneyStrategy, number>>;
  state: string;
  totalDurationSeconds: number;
  /** Time from the requested start until arrival includes scheduled waits. */
  requestedDepartureAt?: string;
  waitingSeconds?: number;
  totalPriceMinor: number | null;
  confirmedPriceMinor: number | null;
  estimatedPriceMinMinor: number | null;
  estimatedPriceMaxMinor: number | null;
  walkingMeters: number;
  transfers: number;
  reliabilityScore: number | null;
  currency?: string;
  priceStatus?: 'ESTIMATED' | 'LOCKED' | 'DYNAMIC' | 'UNKNOWN';
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
    /** Concrete feed mode, e.g. suburban_train or marshrutka; mode remains the broad journey category. */
    transportType?: string;
    coordinates?: [number, number][];
    /** Provider/feed geometry in [longitude, latitude] order; absent means no verified path. */
    routeGeometry?: [number, number][] | null;
    /** Provenance of displayed geometry; estimates are rendered with a dashed line. */
    routeAccuracy?: string;
    geometrySource?: 'gtfs-shape' | 'gtfs-stop-sequence' | 'walking-estimate';
    stops?: Array<{ id: string; name: string; coordinates?: [number, number]; arrivalAt?: string; departureAt?: string; skipped?: boolean }>;
    currency?: string;
    scheduleSemantics?: 'published_departures' | 'frequency_estimate' | null;
    fareSource?: 'gtfs-v1' | 'city-tariff-registry' | null;
    fareIncludedByPreviousSegment?: boolean;
    /** What a rider pays in the vehicle for this boarding, from the server's audited tariff registry; absent means the server does not price cash yet. */
    cashPriceMinor?: number | null;
    cashCurrency?: string | null;
    cashFareProductId?: string | null;
    cashFareSource?: string | null;
    liveStatus?: 'LIVE' | 'SCHEDULED' | 'PREDICTED' | 'UNAVAILABLE' | 'UNVERIFIED' | 'UNKNOWN';
    driver: { id: string; name: string; averageRating: number | null; reviewCount: number } | null;
    vehicle: { id: string; make: string; model: string } | null;
  }>;
};
export type ApiJourneyLive = {
  journeyId: string;
  checkedAt: string;
  segments: Array<{
    legId: string;
    status: 'LIVE' | 'SCHEDULED' | 'UNVERIFIED';
    reason?: 'provider_unavailable' | 'no_fresh_matching_vehicle';
    lineRoutes?: Array<{ id: string; providerId: string; routeId: string; name: string; direction: string; directionId: string | null; geometrySource: 'gtfs_shape' | 'official_geojson'; coordinates: [number, number][]; geometryScope?: 'full_route' | 'leg_only'; zones?: TransitZoneGeometry | null }>;
    vehicles?: Array<{ id: string; providerId: string; coordinates: [number, number]; bearing: number | null; speed: number | null; updatedAt: string; tripId: string | null; routeId: string | null; directionId: string | null; approachingBoarding: boolean; remainingStops: number | null; emphasized: boolean; etaSeconds?: number | null; priority?: VehiclePriority | null; etaConfidence?: 'OBSERVED' | 'PREDICTED' | 'NONE' }>;
  }>;
};
export type ApiJourneyLifecycle = { id: string; state: string; currentLegId?: string | null; startedAt?: string | null; completedAt?: string | null };
export type ApiJourneySearchResult = {
  journeys: ApiJourney[];
  requestedStrategy?: ApiJourneyStrategy;
  availableStrategies?: ApiJourneyStrategy[];
  candidateCount?: number;
  paretoCount?: number;
  returnedCount?: number;
  alternativeLimitPerStrategy?: number;
  resultsTruncated?: boolean;
  candidateGenerationTruncated?: boolean;
  resultSamplingTruncated?: boolean;
  /**
   * Per-stage limits of the GTFS itinerary search. Each true flag is an independent fact about
   * how the candidate pool was built; the results screen must disclose them, not fold them into
   * the single `resultsTruncated` bit.
   */
  gtfsTruncation?: {
    stopSelection: boolean;
    candidateGraph: boolean;
    searchBudget: boolean;
    searchStepLimit: boolean;
    candidatePoolLimit: boolean;
    candidateSampling: boolean;
    responsePage: boolean;
  };
  partial: boolean;
  partialReasons?: string[];
  blockedProviders: string[];
  unsupportedPreferences: string[];
  providerErrors: string[];
  completeness?: {
    providersQueried: number;
    providersSucceeded: number;
    providersFailed: number;
    modesAvailable: string[];
    modesUnavailable: Array<{ mode: string; available: boolean; requested: boolean; reason: string }>;
    candidatesGenerated: number;
    candidatesValidated: number;
    candidatesRejected: number;
    candidatesDeduplicated: number;
    resultsReturned: number;
    searchTruncated: boolean;
    searchComplete: boolean;
    transitSearchFailed: boolean;
    /** Current Server contract: walking reach diagnostics are grouped under this object. */
    walkingReach?: {
      nearestOriginStopMeters?: number | null;
      nearestDestinationStopMeters?: number | null;
      extended?: true;
      journeysWithExtendedReach?: number;
    };
    /** Legacy fields retained for compatibility with older Server deployments. */
    walkReachExtended?: true;
    journeysWithExtendedReach?: number;
    nearestOriginStopMeters?: number | null;
    nearestDestinationStopMeters?: number | null;
  };
};
export type ApiStoredJourney = {
  id: string;
  origin_name: string;
  destination_name: string;
  origin_coordinates?: [number, number];
  destination_coordinates?: [number, number];
  requested_departure_at: string;
  strategy: ApiJourneyStrategy;
  state: string;
  passenger_count: number;
  total_price_minor: number | null;
  confirmed_price_minor: number | null;
  total_duration_s?: number | null;
  walking_distance_m?: number | null;
  transfer_count?: number | null;
  reliability_score?: number | null;
  waitingSeconds?: number | null;
  legs: Array<{
    id: string;
    mode: string;
    offerId: string | null;
    bookingId: string | null;
    state: string;
    priceMinor: number | null;
    priceStatus: string;
    originName?: string;
    originCoordinates?: [number, number];
    destinationName?: string;
    destinationCoordinates?: [number, number];
    departureAt?: string | null;
    arrivalAt?: string | null;
    scheduledDepartureAt?: string | null;
    scheduledArrivalAt?: string | null;
    predictedDepartureAt?: string | null;
    predictedArrivalAt?: string | null;
    liveStatus?: string | null;
    durationSeconds?: number | null;
    distanceMeters?: number | null;
    currency?: string | null;
    availabilityStatus?: string | null;
    providerType?: string | null;
    providerId?: string | null;
    routeId?: string | null;
    routeName?: string | null;
    transportType?: string | null;
    headsign?: string | null;
    scheduleSemantics?: string | null;
    dataSource?: string | null;
    source?: string | null;
    lastUpdatedAt?: string | null;
    routeGeometry?: [number, number][] | null;
    stops?: ApiJourney['legs'][number]['stops'];
  }>;
};
export type GeoJsonCollection = { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }> };
export type ApiRouteProgressStatus = 'RELIABLE' | 'UNCERTAIN' | 'OFF_ROUTE';
export type ApiNavigationSession = {
  id: string; state: 'active' | 'paused' | 'ended'; destination_name: string | null;
  route_distance_m: number | null; route_duration_s: number | null; route_version: number; opt_in: boolean;
  matching_vehicle_available: boolean; vehicle_seat_count: number | null;
  started_at: string; ended_at?: string | null; route: [number, number][] | null;
  /** Turn-by-turn steps of the current route (absent on older servers). */
  maneuvers?: import('../../shared/navigation/contracts').Maneuver[];
  current_location: [number, number] | null; current_location_accuracy_m: number | null; current_location_at: string | null;
  progress_status: ApiRouteProgressStatus | null; progress_ordinal: number | null; progress_fraction: number | null;
  last_reliable_fix_at: string | null;
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

/** The freshness level the server declared for the features it served (ТЗ-MG-TRANSPORT-12). */
export type LayerDataQuality = { level: string; counts?: Record<string, number>; oldestAgeMs?: number | null; newestAgeMs?: number | null; freshnessWindowMs?: number | null };
export type TransportLayerMeta = { dataQuality?: LayerDataQuality | null; failedProviderCount?: number; truncated?: boolean };
/** A map layer together with the server's own account of what it could not serve, so the client never has to guess. */
export type TransportLayerResponse = { collection: GeoJsonCollection; dataQuality: LayerDataQuality | null; failedProviderCount: number; truncated: boolean };

type ApiEnvelope<T> = { data: T; meta?: TransportLayerMeta | null };
const apiBase = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) ?? (typeof process !== 'undefined' ? process.env?.VITE_API_BASE_URL : '') ?? '';
let accessToken: string | null = null;
let refreshInFlight: Promise<{ user: ApiUser; accessToken: string }> | null = null;

/**
 * Whether a bearer token is currently held. Anonymous browsing is a supported state, and endpoints
 * that require a session (live vehicle position) must not be polled until one exists.
 */
export function hasApiSession(): boolean { return Boolean(accessToken); }

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
async function uploadPhotoFile<T>(path: string, file: File): Promise<T> {
  // Phones often report an empty type for camera files; infer it from the extension before validating.
  const type = file.type || (/\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : /\.(jpe?g|heic)$/i.test(file.name) ? 'image/jpeg' : '');
  if (!PHOTO_TYPES.has(type)) throw new Error('Додайте фото у форматі JPEG, PNG або WebP. Знімок із камери iPhone зберігайте як «Найсумісніший».');
  if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('Фото має бути до 10 МБ.');
  try { return await request<T>(path, { method: 'POST', body: file, headers: { 'content-type': type } }); }
  catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/storage is not configured/i.test(message)) throw new Error('Сховище фото тимчасово недоступне. Спробуйте пізніше.', { cause: error });
    if (/at most \d+ photos/i.test(message)) throw new Error('Можна додати не більше 3 фото. Видаліть одне, щоб додати інше.', { cause: error });
    if (/not a valid photo|Send a JPEG/i.test(message)) throw new Error('Не вдалося прийняти файл. Оберіть фото JPEG, PNG або WebP до 10 МБ.', { cause: error });
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) throw new Error('Немає зв’язку із сервером. Перевірте інтернет і повторіть.', { cause: error });
    throw error;
  }
}

export class ProductionApiError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
    this.name = 'ProductionApiError';
  }
}

async function requestEnvelope<T>(path: string, init: RequestInit = {}, retryAuth = true): Promise<{ data: T; meta: TransportLayerMeta | null }> {
  const headers = new Headers(init.headers);
  const tokenUsed = accessToken;
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (tokenUsed) headers.set('authorization', `Bearer ${tokenUsed}`);
  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/v1${path}`, { ...init, headers, credentials: 'include' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ProductionApiError(networkFailureMessage(typeof navigator === 'undefined' || navigator.onLine !== false), NETWORK_ERROR_CODE);
  }
  const body = await response.json().catch(() => null) as { data?: T; meta?: TransportLayerMeta | null; error?: { code?: string; message?: string } } | null;
  if (response.status === 401 && retryAuth && accessToken && !path.startsWith('/auth/')) {
    if (tokenUsed !== accessToken) return requestEnvelope<T>(path, init, false);
    // Whoever still holds this request's token owns the session write: login() can finish
    // while the refresh is in flight, and its newer token must not be overwritten by the
    // refresh result. The session hint stays untouched on network failures so a flaky
    // link does not sign anyone out.
    const ownsSession = () => tokenUsed === accessToken;
    try {
      refreshInFlight ??= withAuthRefreshLock(() => requestEnvelope<{ user: ApiUser; accessToken: string }>('/auth/refresh', { method: 'POST' }, false))
        .then((refreshed) => {
          if (ownsSession()) {
            accessToken = refreshed.data.accessToken;
          }
          return refreshed.data;
        })
        .finally(() => { refreshInFlight = null; });
      await refreshInFlight;
      return requestEnvelope<T>(path, init, false);
    } catch {
      if (!ownsSession()) return requestEnvelope<T>(path, init, false);
      accessToken = null;
    }
  }
  if (!response.ok) {
    if (response.status === 429 || body?.error?.code === 'rate_limit_exceeded') {
      throw new ProductionApiError('Забагато запитів за короткий час. Зачекайте кілька хвилин і спробуйте ще раз.', 'rate_limit_exceeded', response.status);
    }
    throw new ProductionApiError(requestErrorMessage(response.status, body?.error?.message, body?.error?.code), body?.error?.code, response.status);
  }
  if (response.status === 204) return { data: undefined as T, meta: null };
  return { data: (body as ApiEnvelope<T>).data, meta: body?.meta ?? null };
}

async function request<T>(path: string, init: RequestInit = {}, retryAuth = true): Promise<T> {
  return (await requestEnvelope<T>(path, init, retryAuth)).data;
}

/** Map layers must keep `meta`: it is the only proof of what the server could not serve. */
async function requestLayer(path: string, signal?: AbortSignal): Promise<TransportLayerResponse> {
  const { data, meta } = await requestEnvelope<GeoJsonCollection>(path, { signal });
  return { collection: data, dataQuality: meta?.dataQuality ?? null, failedProviderCount: meta?.failedProviderCount ?? 0, truncated: meta?.truncated === true };
}

/** Event types the passenger UI is allowed to react to; anything else is dropped. */
const REALTIME_EVENT_ALLOW_LIST = new Set([
  'conversation.message.created',
  'journey.updated',
  'navigation.route-updated',
]);

const isAllowedRealtimeType = (type: string) => REALTIME_EVENT_ALLOW_LIST.has(type)
  || type.startsWith('booking.') || type.startsWith('trip.') || type.startsWith('proposal.')
  || type.startsWith('navigation.match.') || type.startsWith('rendezvous.');

/**
 * The session-wide realtime channel. Created lazily so a visitor who never signs in
 * never requests a ticket, and shared by every screen that asks for live events.
 */
let realtimeChannel: RealtimeChannel<ApiRealtimeEvent> | null = null;

function getRealtimeChannel(): RealtimeChannel<ApiRealtimeEvent> {
  if (realtimeChannel) return realtimeChannel;
  realtimeChannel = createRealtimeChannel<ApiRealtimeEvent>({
    fetchTicket: () => request<{ ticket: string }>('/realtime/ticket', { method: 'POST' }).then(({ ticket }) => ticket),
    socketUrl: (ticket) => {
      const url = new URL(`${apiBase}/api/v1/realtime`, window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      // The ticket is single-use, so it travels in the query of exactly one upgrade.
      url.searchParams.set('ticket', ticket);
      return url.toString();
    },
    // One cast at the DOM boundary: the browser hands its handlers an Event argument
    // that the channel never reads, so the structural socket interface differs only there.
    createSocket: (url) => new WebSocket(url) as unknown as RealtimeSocket,
    parseEvent: (raw) => {
      try {
        const event = JSON.parse(String(raw)) as ApiRealtimeEvent | { type?: string };
        if (!event || typeof event.type !== 'string' || !isAllowedRealtimeType(event.type)) return null;
        return event as ApiRealtimeEvent;
      } catch {
        // Malformed frames are ignored: persisted REST history stays authoritative.
        return null;
      }
    },
    addReconnectSignal: (retryNow) => {
      const onOnline = () => retryNow();
      const onVisible = () => { if (document.visibilityState === 'visible') retryNow(); };
      window.addEventListener('online', onOnline);
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        window.removeEventListener('online', onOnline);
        document.removeEventListener('visibilitychange', onVisible);
      };
    },
  });
  return realtimeChannel;
}

export const productionApi = {
  async restoreSession(): Promise<ApiUser | null> {
    // The refresh cookie is HttpOnly, so only the server can determine whether
    // this browser has a session. A 401 is an ordinary anonymous state.
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const session = await withAuthRefreshLock(() => request<{ user: ApiUser; accessToken: string }>('/auth/refresh', {
        method: 'POST',
        signal: controller.signal,
      }));
      accessToken = session.accessToken;
      return session.user;
    } catch (error) {
      if (error instanceof ProductionApiError && error.status === 401) {
        accessToken = null;
        // No session is a normal anonymous state (including first-time visits).
        return null;
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  },
  async login(email: string, password: string) {
    const session = await request<{ user: ApiUser; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    accessToken = session.accessToken;
    return session.user;
  },
  requestPasswordReset(email: string) {
    return request<{ sent: true; message: string }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  async register(input: { email: string; password: string; displayName: string; phone?: string }) {
    const session = await request<{ user: ApiUser; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    accessToken = session.accessToken;
    return session.user;
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
  suggestPlaces(query: string, bias?: { latitude: number; longitude: number }, signal?: AbortSignal) {
    const normalized = normalizePlaceQuery(query);
    if (!normalized) return Promise.resolve<ApiPlace[]>([]);
    const locality = bias ? `&lat=${encodeURIComponent(String(bias.latitude))}&lon=${encodeURIComponent(String(bias.longitude))}` : '';
    return request<ApiPlace[]>(`/places/suggest?q=${encodeURIComponent(normalized)}${locality}`, { signal });
  },
  reverseGeocode(latitude: number, longitude: number) {
    return request<ApiPlace>(`/places/reverse?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`);
  },
  async searchJourneys({ signal, ...input }: {
    origin: { name: string; coordinates: [number, number] };
    destination: { name: string; coordinates: [number, number] };
    departureAt: string;
    passengers: number;
    strategy: ApiJourneyStrategy;
    preferences?: Record<string, boolean | number | string[] | Record<string, string[]>>;
    signal?: AbortSignal;
  }) {
    // Search constraints are part of the passenger's request. Retrying an older server with
    // those preferences removed can return routes that violate the selected modes, providers,
    // budget or arrival deadline while the UI still shows those constraints as active.
    // Surface contract failures instead; a compatible API must apply the submitted preferences.
    return request<ApiJourneySearchResult>('/journeys/search', { method: 'POST', body: JSON.stringify(input), signal });
  },
  journeys() { return request<ApiStoredJourney[]>('/journeys/me'); },
  journey(id: string) { return request<ApiStoredJourney>(`/journeys/${encodeURIComponent(id)}`); },
  activateJourney(id: string, legId?: string) {
    return request<ApiJourneyLifecycle>(`/journeys/${encodeURIComponent(id)}/activate`, {
      method: 'POST', body: JSON.stringify(legId ? { legId } : {}),
    });
  },
  endJourney(id: string, outcome: 'COMPLETED' | 'CANCELLED') {
    return request<ApiJourneyLifecycle>(`/journeys/${encodeURIComponent(id)}/end`, {
      method: 'POST', body: JSON.stringify({ outcome }),
    });
  },
  journeyLive(id: string, arg2?: AbortSignal | string, arg3?: string | AbortSignal) {
    const signal = arg2 instanceof AbortSignal ? arg2 : arg3 instanceof AbortSignal ? arg3 : undefined;
    const legId = typeof arg2 === 'string' ? arg2 : typeof arg3 === 'string' ? arg3 : undefined;
    const suffix = legId ? `?legId=${encodeURIComponent(legId)}` : '';
    return request<ApiJourneyLive>(`/journeys/${encodeURIComponent(id)}/live${suffix}`, { signal });
  },
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
  transportTypesCatalog(cityId?: string) {
    const query = cityId ? `?cityId=${encodeURIComponent(cityId)}` : '';
    return request<Array<{
      id: string;
      label: string;
      enabled: boolean;
      availability: string;
      capabilities: string[];
      reason: string | null;
    }>>(`/catalog/transport-types${query}`);
  },
  transportRegions() {
    return request<Array<{
      id: string;
      name: string;
      capital: string;
      majorCities: string[];
      bbox: [number, number, number, number];
    }>>('/catalog/regions');
  },
  transportLayerAvailability() { return request<Array<{ id: string; available: boolean }>>('/transport/layers'); },
  transportRoutes(bbox: string, types: string[], signal?: AbortSignal) { return requestLayer(`/transport/routes?bbox=${bbox}&types=${types.join(',')}`, signal); },
  transportStops(bbox: string, types: string[], signal?: AbortSignal) { return requestLayer(`/transport/stops?bbox=${bbox}&types=${types.join(',')}`, signal); },
  transportVehicles(bbox: string, types: string[], signal?: AbortSignal) { return requestLayer(`/transport/vehicles?bbox=${bbox}&types=${types.join(',')}`, signal); },
  transitStopArrivals(stopId: string, lat: number, lon: number, signal?: AbortSignal) {
    return request<{ stopId: string; lat: number; lon: number; arrivals: TransitArrival[] }>(
      `/transit/stops/${encodeURIComponent(stopId)}/arrivals?lat=${lat}&lon=${lon}`, { signal },
    );
  },
  transportCities(signal?: AbortSignal) { return request<ApiTransportCity[]>('/transport/cities', { signal }); },
  transportMicromobility(bbox: string, types: string[], signal?: AbortSignal) { return requestLayer(`/transport/micromobility?bbox=${bbox}&types=${types.join(',')}`, signal); },
  transportMicromobilityGeofences(bbox: string, signal?: AbortSignal) { return requestLayer(`/transport/micromobility/geofences?bbox=${encodeURIComponent(bbox)}`, signal); },
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
  sendNavigationLocation(id: string, input: { coordinates: [number, number]; accuracyMeters: number; capturedAt: string; headingDeg?: number }) {
    return request<{ accepted: boolean; onRoute: boolean; capturedAt: string; progressStatus: ApiRouteProgressStatus | null; progressOrdinal: number | null; progressFraction: number | null }>(`/navigation/sessions/${id}/location`, {
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
  acceptProposal(proposalId: string, expectedRevision: number) {
    return request<ApiBooking>(`/proposals/${proposalId}/accept`, {
      method: 'POST', body: JSON.stringify({ expectedRevision }),
    });
  },
  cancelDemand(demandId: string) {
    return request<{ id: string; status: string }>(`/demands/${demandId}/cancel`, { method: 'POST' });
  },
  bookings() { return request<ApiBooking[]>('/bookings'); },
  bookingRendezvous(bookingId: string) { return request<ApiRendezvous>(`/bookings/${encodeURIComponent(bookingId)}/rendezvous`); },
  activateRendezvous(bookingId: string) { return request<ApiRendezvous>(`/bookings/${encodeURIComponent(bookingId)}/rendezvous/activate`, { method: 'POST' }); },
  setRendezvousConsent(rendezvousId: string, enabled: boolean) {
    return request<ApiRendezvous>(`/rendezvous/${encodeURIComponent(rendezvousId)}/consent`, { method: 'POST', body: JSON.stringify({ enabled }) });
  },
  rendezvousApproaches(rendezvousId: string) {
    return request<ApiRendezvousApproaches>(`/rendezvous/${encodeURIComponent(rendezvousId)}/approaches`);
  },
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
  /** The file goes to the API (not straight to storage), so it works behind tunnels and on phones. */
  async uploadDriverPhoto(file: File) {
    return uploadPhotoFile<{ driver_photo_url: string }>('/users/me/driver-photo/file', file);
  },
  deleteDriverPhoto() { return request<{ driver_photo_url: null }>('/users/me/driver-photo', { method: 'DELETE' }); },
  async uploadVehiclePhoto(vehicleId: string, file: File) {
    return uploadPhotoFile<ApiVehiclePhoto>(`/vehicles/${vehicleId}/photos/file`, file);
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
  mobilityOperators() { return request<ApiMobilityOperator[]>('/mobility/operators'); },
  updateMobilityOperator(providerId: string, enabled: boolean) {
    return request<{ provider_id: string; enabled: boolean }>(`/admin/mobility/operators/${encodeURIComponent(providerId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
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
  /**
   * Live events for this session. Every caller shares one WebSocket managed by
   * `realtimeChannel`; the returned handle only registers and unregisters a
   * listener, so screens can subscribe freely without leaking connections.
   */
  subscribeRealtime(onEvent: (event: ApiRealtimeEvent) => void, onState: (connected: boolean) => void) {
    const channel = getRealtimeChannel();
    const unsubscribeStatus = channel.onStatus((status) => onState(status === 'online'));
    const unsubscribeEvents = channel.subscribe(onEvent);
    return () => {
      unsubscribeStatus();
      unsubscribeEvents();
    };
  },
  /** Connection state of the shared channel — for honest status UI. */
  realtimeStatus() { return getRealtimeChannel().status(); },
  onRealtimeStatus(listener: (status: RealtimeStatus) => void) { return getRealtimeChannel().onStatus(listener); },
  /** Diagnostics only: how many live listeners and sockets the session holds. */
  realtimeDiagnostics() {
    const channel = getRealtimeChannel();
    return { subscribers: channel.subscriberCount(), sockets: channel.socketCount(), status: channel.status() };
  },
  book(offerId: string, seats: number, journey?: { journeyId: string; journeyLegId: string }) {
    const context = [offerId, seats, journey?.journeyId ?? '', journey?.journeyLegId ?? ''].join(':');
    const storageKey = `marshgo:booking-attempt:${context}`;
    let idempotencyKey: string | null = null;
    try { idempotencyKey = sessionStorage.getItem(storageKey); } catch { /* Private browsing may disable storage. */ }
    idempotencyKey ??= crypto.randomUUID();
    try { sessionStorage.setItem(storageKey, idempotencyKey); } catch { /* The request remains protected for this invocation. */ }
    return request<ApiBooking>('/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ offerId, seats, ...(journey ?? {}) }),
    }).then((booking) => {
      try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be disabled. */ }
      return booking;
    });
  },
};
