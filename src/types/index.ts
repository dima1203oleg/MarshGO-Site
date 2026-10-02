// MARSHGO Core Domain Contracts and Types
// Ukrainian Transport Marketplace & Navigation

export type UserRole = 'passenger' | 'driver' | 'admin' | 'carrier';

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar: string;
  role: UserRole;
  activeRole: 'passenger' | 'driver';
  rating: number; // 0 for brand new users (no fake ratings!)
  reviewsCount?: number;
  tripsCount: number;
  isVerified: boolean;
  verificationLevel: 'none' | 'phone' | 'id_document' | 'pro_licensed';
  memberSince: string;
}

export interface BlockedUser {
  id: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: 'driver' | 'passenger';
  blockedAt: string; // ISO date string
  reason: string;
  notes?: string;
}

export interface VehiclePhoto {
  id: string;
  url: string;
  isPrimary: boolean;
  caption?: string;
}

export interface Vehicle {
  id: string;
  driverId: string;
  make: string; // e.g. "Toyota"
  model: string; // e.g. "Camry"
  year: number; // e.g. 2020
  color: string; // e.g. "Чорний металік"
  bodyType: 'sedan' | 'suv' | 'minivan' | 'hatchback' | 'station_wagon';
  seats: number;
  licensePlateMasked: string; // e.g. "AA •••• AA" (masked for public view)
  licensePlateFull?: string; // Revealed only to confirmed passengers
  photos: VehiclePhoto[];
  features: {
    airConditioning: boolean;
    phoneCharging: boolean;
    luggageAllowed: boolean;
    petsAllowed: boolean;
    childSeat: boolean;
    smokingAllowed: boolean;
  };
}

export type TransportCategory =
  | 'all'
  | 'community' // Попутка (0% комісія)
  | 'taxi_pro' // Таксі та PRO
  | 'bus' // Автобуси
  | 'minibus' // Маршрутки
  | 'transfer' // Трансфер
  | 'carsharing' // Каршеринг (Demo/Preview)
  | 'transit' // Міський транспорт
  | 'rail'; // Потяг (Укрзалізниця - контракт pending)

export type OfferSource = 'marshgo_community' | 'marshgo_pro' | 'partner_api' | 'demo_partner';

export interface TransportOffer {
  id: string;
  category: TransportCategory;
  source: OfferSource;
  partnerName?: string; // e.g. "Uklon Partner", "FlixBus", "INFOBUS" (labeled DEMO if not live API)
  isLiveIntegration: boolean; // false = DEMO_MODE badge required
  
  // Route details
  origin: string;
  originAddress: string;
  destination: string;
  destinationAddress: string;
  departureTime: string; // ISO string
  arrivalTime: string; // ISO string
  durationMinutes: number;
  distanceKm: number;
  intermediateStops?: string[];
  /** Road geometry returned by the routing backend, in [longitude, latitude] order. */
  routeGeometry?: Array<[number, number]>;

  // Vehicle & Driver info
  driver: {
    id: string;
    name: string;
    avatar: string;
    rating: number; // 0 if new
    reviewsCount?: number;
    tripsCount: number;
    isVerified: boolean;
    isPro: boolean;
  };
  vehicle?: {
    make: string;
    model: string;
    year: number;
    color: string;
    primaryPhoto: string;
    allPhotos?: string[];
  };

  // Capacity & Economics
  totalSeats: number;
  availableSeats: number;
  priceAmount: number; // in UAH
  priceUnit: 'per_seat' | 'per_car' | 'per_day';
  currency: 'UAH';
  platformFeeAmount: number; // 0 for community!
  comfortTags: string[];
  cancellationPolicy: 'Гнучка (до 24 год безкоштовно)' | 'Помірна' | 'Сувора';
}

export type DemandStatus =
  | 'draft'
  | 'published'
  | 'matching'
  | 'offers_received'
  | 'agreed'
  | 'booked'
  | 'expired'
  | 'cancelled'
  | 'completed';

export interface PassengerDemand {
  id: string;
  passengerId: string;
  passengerName: string;
  passengerAvatar: string;
  passengerRating: number;
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  timeWindowStart: string; // HH:mm
  timeWindowEnd: string; // HH:mm
  passengerCount: number;
  totalBudget: number; // Total budget offered by passenger in UAH
  budgetType: 'total_all' | 'per_seat';
  notes?: string;
  status: DemandStatus;
  createdAt: string;
  proposalsCount: number;
  featuresNeeded?: {
    luggage: boolean;
    pets: boolean;
    childSeat: boolean;
  };
}

export type NegotiationStatus = 'active' | 'accepted' | 'declined' | 'countered' | 'expired';

export interface NegotiationRevision {
  revisionNumber: number;
  proposedByRole: 'passenger' | 'driver';
  proposedByUserId: string;
  priceAmount: number; // UAH
  proposedAt: string;
  comment?: string;
}

export interface Proposal {
  id: string;
  demandId: string;
  driverId: string;
  driverName: string;
  driverAvatar: string;
  driverRating: number;
  vehicleSummary: string; // e.g. "Toyota Camry (2020), чорний"
  vehiclePhoto: string;
  offeredPrice: number; // UAH
  estimatedPickupTime: string;
  detourMinutes: number; // +X min
  detourKm: number; // +Y km
  status: NegotiationStatus;
  revisions: NegotiationRevision[];
  currentRevisionNumber: number;
  createdAt: string;
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'boarding'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Booking {
  id: string;
  offerId?: string;
  demandId?: string;
  proposalId?: string;
  passengerId: string;
  passengerName: string;
  driverId: string;
  driverName: string;
  driverPhoneMasked: string;
  driverPhoneFull?: string;
  vehicleSummary: string;
  vehiclePlate: string;
  vehiclePhoto: string;
  origin: string;
  destination: string;
  departureTime: string;
  seatsBooked: number;
  finalPriceAmount: number;
  status: BookingStatus;
  paymentMethod: 'cash_to_driver' | 'online_sandbox';
  isCostSharing: boolean; // 0% platform fee
  bookingCode: string; // e.g. "MG-7821"
  qrCodeData: string;
  hasReviewed?: boolean;
  userRating?: number;
  createdAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  targetUserId: string;
  targetUserName: string;
  authorUserId: string;
  authorName: string;
  authorRole: 'passenger' | 'driver';
  rating: number; // 1 to 5
  comment: string;
  tags?: string[];
  createdAt: string;
}

export interface MatchCandidate {
  id: string;
  demandId: string;
  passengerName: string;
  passengerAvatar: string;
  passengerCount: number;
  origin: string;
  destination: string;
  timeWindow: string;
  offeredBudget: number; // UAH
  detourMinutes: number; // +X min via road routing
  detourKm: number; // +Y km
  pickupLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  dropoffLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  status: 'suggested' | 'accepted' | 'dismissed' | 'expired';
}

export interface NavigationSession {
  id: string;
  driverId: string;
  origin: string;
  destination: string;
  status: 'active' | 'paused_stale' | 'paused_background' | 'completed' | 'cancelled';
  matchmakingOptIn: boolean; // Default FALSE per safety requirements!
  currentLocation: {
    lat: number;
    lng: number;
    accuracyMeters: number;
    timestamp: string;
  };
  remainingDistanceKm: number;
  remainingDurationMinutes: number;
  routeGeometry?: Array<[number, number]>;
  waypointStops: {
    id: string;
    name: string;
    type: 'pickup' | 'dropoff' | 'origin' | 'destination';
    lat: number;
    lng: number;
    passengerName?: string;
  }[];
  candidates: MatchCandidate[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isSystemEvent?: boolean;
  proposalCard?: {
    proposalId: string;
    amount: number;
    status: NegotiationStatus;
  };
}

export interface RouteAlert {
  id: string;
  userId: string;
  origin: string;
  destination: string;
  maxBudget?: number;
  preferredTimeWindow?: string;
  active: boolean;
  matchesFoundCount: number;
}
