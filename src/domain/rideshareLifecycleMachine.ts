/**
 * Domain State Machine for Rideshare Lifecycle (DEMO Simulator)
 * Synthetic data only - No production API calls or actual transactions.
 */

export type LifecycleStage =
  | 'PROPOSAL'              // 1. Водій опублікував поїздку
  | 'REQUESTED'             // 2. Пасажир надіслав запит на бронювання
  | 'BOOKING_CONFIRMED'     // 3. Водій підтвердив бронювання
  | 'GPS_CONSENT_PENDING'   // 4. Очікування взаємної згоди на поширення GPS
  | 'GPS_DENIED'            // 4a. Відмова від GPS (текстові орієнтири)
  | 'RENDEZVOUS_ACTIVE'     // 5. Взаємна карта зустрічі (обидва погодилися, рух назустріч)
  | 'ARRIVED_AT_PICKUP'     // 6. Водій на місці зустрічі
  | 'BOARDING_HANDSHAKE'    // 7. Посадка з перевіркою PIN / QR
  | 'IN_TRANSIT'            // 8. Поїздка триває
  | 'COMPLETED'             // 9. Поїздку завершено в пункті призначення
  | 'RATED_AND_HISTORY'     // 10. Оцінка виставлена, збережено в історію
  | 'CANCELLED';            // Скасовано на будь-якому етапі

export type UserRole = 'passenger' | 'driver';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ParticipantTelemetry {
  coordinates: LatLng;
  updatedAtMs: number;
  accuracyMeters: number;
  isStale: boolean;
}

export interface RideshareDemoTrip {
  id: string;
  isSyntheticDemo: true;
  driver: {
    id: string;
    name: string;
    phone: string;
    rating: number;
    tripsCount: number;
    avatarUrl: string;
  };
  passenger: {
    id: string;
    name: string;
    phone: string;
    avatarUrl: string;
  };
  vehicle: {
    make: string;
    model: string;
    plate: string;
    color: string;
    photoUrl: string;
  };
  pickup: {
    label: string;
    landmarkDescription: string;
    landmarkPhotoUrl: string;
    coordinates: LatLng;
  };
  destination: {
    label: string;
    coordinates: LatLng;
  };
  priceUah: number;
  seatsOffered: number;
  seatsBooked: number;
  verificationPin: string; // 4-значний PIN
  plannedDepartureTime: string;
  plannedArrivalTime: string;
}

export interface RideshareSessionState {
  stage: LifecycleStage;
  activeRole: UserRole;
  trip: RideshareDemoTrip;
  
  // Consent
  driverGpsConsent: boolean;
  passengerGpsConsent: boolean;
  
  // Telemetry (synthetic)
  driverTelemetry: ParticipantTelemetry | null;
  passengerTelemetry: ParticipantTelemetry | null;
  
  // Network & Simulator Fault Controls
  isOffline: boolean;
  isSimulatingGpsStale: boolean;
  
  // Boarding & Pin
  enteredPin: string;
  pinError: string | null;
  
  // Rating & Review
  ratingStars: number;
  ratingTags: string[];
  ratingComment: string;
  
  // Cancellation metadata
  cancellationReason: string | null;
  cancelledByRole: UserRole | null;
  
  // History log for transitions
  historyLog: Array<{
    timestampMs: number;
    fromStage: LifecycleStage;
    toStage: LifecycleStage;
    action: string;
  }>;
}

export const SYNTHETIC_DEFAULT_TRIP: RideshareDemoTrip = {
  id: 'demo-trip-lviv-camry-01',
  isSyntheticDemo: true,
  driver: {
    id: 'driver-oleksiy-01',
    name: 'Олексій Коваль (DEMO Водій)',
    phone: '+380 00 000 0000 (DEMO)',
    rating: 4.95,
    tripsCount: 342,
    avatarUrl: '/images/driver_oleksiy.jpg',
  },
  passenger: {
    id: 'passenger-demo-01',
    name: 'Дмитро (DEMO Пасажир)',
    phone: '+380 00 000 0001 (DEMO)',
    avatarUrl: '',
  },
  vehicle: {
    make: 'Toyota',
    model: 'Camry Hybrid',
    plate: 'BC 0000 ДЕМО',
    color: 'Графітовий металік (DEMO)',
    photoUrl: '/images/toyota_camry_carpool.jpg',
  },
  pickup: {
    label: 'вул. Малоголосківська, 12, Львів (DEMO)',
    landmarkDescription: 'Парковка біля центрального входу ТРЦ Fabrik (DEMO орієнтир)',
    landmarkPhotoUrl: '/images/lviv_naukova_building.jpg',
    coordinates: { lat: 49.8654, lng: 24.0152 },
  },
  destination: {
    label: 'вул. Наукова, 7, Львів (DEMO)',
    coordinates: { lat: 49.8032, lng: 24.0041 },
  },
  priceUah: 120,
  seatsOffered: 4,
  seatsBooked: 1,
  verificationPin: '4819',
  plannedDepartureTime: '10:00',
  plannedArrivalTime: '10:28',
};

// Initial state creator
export function createInitialSessionState(overrides?: Partial<RideshareSessionState>): RideshareSessionState {
  return {
    stage: 'PROPOSAL',
    activeRole: 'passenger',
    trip: SYNTHETIC_DEFAULT_TRIP,
    driverGpsConsent: false,
    passengerGpsConsent: false,
    driverTelemetry: {
      coordinates: { lat: 49.8550, lng: 24.0250 },
      updatedAtMs: Date.now(),
      accuracyMeters: 8,
      isStale: false,
    },
    passengerTelemetry: {
      coordinates: { lat: 49.8649, lng: 24.0145 },
      updatedAtMs: Date.now(),
      accuracyMeters: 5,
      isStale: false,
    },
    isOffline: false,
    isSimulatingGpsStale: false,
    enteredPin: '',
    pinError: null,
    ratingStars: 5,
    ratingTags: ['Пунктуальність', 'Чисте авто', 'Приємна бесіда'],
    ratingComment: '',
    cancellationReason: null,
    cancelledByRole: null,
    historyLog: [],
    ...overrides,
  };
}

// Transition Rules & Invariants
const VALID_TRANSITIONS: Record<LifecycleStage, LifecycleStage[]> = {
  PROPOSAL: ['REQUESTED', 'CANCELLED'],
  REQUESTED: ['BOOKING_CONFIRMED', 'CANCELLED'],
  BOOKING_CONFIRMED: ['GPS_CONSENT_PENDING', 'CANCELLED'],
  GPS_CONSENT_PENDING: ['RENDEZVOUS_ACTIVE', 'GPS_DENIED', 'CANCELLED'],
  GPS_DENIED: ['ARRIVED_AT_PICKUP', 'RENDEZVOUS_ACTIVE', 'CANCELLED'],
  RENDEZVOUS_ACTIVE: ['ARRIVED_AT_PICKUP', 'GPS_DENIED', 'CANCELLED'],
  ARRIVED_AT_PICKUP: ['BOARDING_HANDSHAKE', 'CANCELLED'],
  BOARDING_HANDSHAKE: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['COMPLETED'],
  COMPLETED: ['RATED_AND_HISTORY'],
  RATED_AND_HISTORY: [], // terminal
  CANCELLED: [],         // terminal
};

export function canTransition(from: LifecycleStage, to: LifecycleStage): boolean {
  if (from === to) return true;
  const allowed = VALID_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

export type LifecycleEvent =
  | { type: 'SUBMIT_REQUEST' }
  | { type: 'CONFIRM_BOOKING' }
  | { type: 'PROMPT_GPS' }
  | { type: 'GRANT_GPS_CONSENT'; role: UserRole }
  | { type: 'DENY_GPS_CONSENT'; role: UserRole }
  | { type: 'DRIVER_ARRIVED' }
  | { type: 'ENTER_PIN'; pin: string }
  | { type: 'CONFIRM_BOARDING_QR' }
  | { type: 'START_RIDE' }
  | { type: 'COMPLETE_RIDE' }
  | { type: 'SUBMIT_RATING'; stars: number; tags: string[]; comment: string }
  | { type: 'CANCEL_RIDE'; reason: string; role: UserRole }
  | { type: 'TOGGLE_OFFLINE'; isOffline?: boolean }
  | { type: 'SET_GPS_STALE'; isStale: boolean }
  | { type: 'SWITCH_ROLE'; role: UserRole }
  | { type: 'UPDATE_TELEMETRY'; driver?: LatLng; passenger?: LatLng }
  | { type: 'RESET_SIMULATOR' };

/**
 * Pure state reducer enforcing all invariants, permissions and edge conditions
 */
export function rideshareLifecycleReducer(
  state: RideshareSessionState,
  event: LifecycleEvent
): RideshareSessionState {
  const now = Date.now();

  // Helper for logging valid transition
  const logTransition = (toStage: LifecycleStage, action: string) => [
    ...state.historyLog,
    { timestampMs: now, fromStage: state.stage, toStage, action },
  ];

  switch (event.type) {
    case 'SWITCH_ROLE':
      return { ...state, activeRole: event.role };

    case 'TOGGLE_OFFLINE': {
      const nextOffline = event.isOffline !== undefined ? event.isOffline : !state.isOffline;
      return { ...state, isOffline: nextOffline };
    }

    case 'SET_GPS_STALE': {
      return {
        ...state,
        isSimulatingGpsStale: event.isStale,
        driverTelemetry: state.driverTelemetry
          ? {
              ...state.driverTelemetry,
              isStale: event.isStale,
              updatedAtMs: event.isStale ? now - 45000 : now,
            }
          : null,
        passengerTelemetry: state.passengerTelemetry
          ? {
              ...state.passengerTelemetry,
              isStale: event.isStale,
              updatedAtMs: event.isStale ? now - 45000 : now,
            }
          : null,
      };
    }

    case 'UPDATE_TELEMETRY': {
      return {
        ...state,
        driverTelemetry: event.driver
          ? {
              coordinates: event.driver,
              updatedAtMs: now,
              accuracyMeters: 6,
              isStale: state.isSimulatingGpsStale,
            }
          : state.driverTelemetry,
        passengerTelemetry: event.passenger
          ? {
              coordinates: event.passenger,
              updatedAtMs: now,
              accuracyMeters: 4,
              isStale: state.isSimulatingGpsStale,
            }
          : state.passengerTelemetry,
      };
    }

    case 'SUBMIT_REQUEST': {
      if (state.isOffline) {
        throw new Error('Неможливо надіслати запит: відсутній звʼязок (Offline).');
      }
      if (!canTransition(state.stage, 'REQUESTED')) {
        throw new Error(`Заборонений перехід: неможливо надіслати запит зі стану ${state.stage}.`);
      }
      return {
        ...state,
        stage: 'REQUESTED',
        historyLog: logTransition('REQUESTED', 'Пасажир надіслав запит на бронювання 1 місця'),
      };
    }

    case 'CONFIRM_BOOKING': {
      if (state.isOffline) {
        throw new Error('Неможливо підтвердити бронювання офлайн.');
      }
      if (!canTransition(state.stage, 'BOOKING_CONFIRMED')) {
        throw new Error(`Заборонений перехід: неможливо підтвердити бронювання зі стану ${state.stage}.`);
      }
      return {
        ...state,
        stage: 'BOOKING_CONFIRMED',
        historyLog: logTransition('BOOKING_CONFIRMED', 'Водій підтвердив бронювання'),
      };
    }

    case 'PROMPT_GPS': {
      if (!canTransition(state.stage, 'GPS_CONSENT_PENDING')) {
        throw new Error(`Заборонений перехід до узгодження GPS зі стану ${state.stage}.`);
      }
      return {
        ...state,
        stage: 'GPS_CONSENT_PENDING',
        historyLog: logTransition('GPS_CONSENT_PENDING', 'Відкрито узгодження обміну GPS'),
      };
    }

    case 'GRANT_GPS_CONSENT': {
      const isDriver = event.role === 'driver';
      const nextDriverConsent = isDriver ? true : state.driverGpsConsent;
      const nextPassengerConsent = !isDriver ? true : state.passengerGpsConsent;

      // Both must consent to enter full RENDEZVOUS_ACTIVE
      const bothConsented = nextDriverConsent && nextPassengerConsent;
      const targetStage: LifecycleStage = bothConsented ? 'RENDEZVOUS_ACTIVE' : state.stage;

      return {
        ...state,
        driverGpsConsent: nextDriverConsent,
        passengerGpsConsent: nextPassengerConsent,
        stage: targetStage,
        historyLog: bothConsented && state.stage !== 'RENDEZVOUS_ACTIVE'
          ? logTransition('RENDEZVOUS_ACTIVE', 'Обопільна згода на GPS отримана. Активовано карту зустрічі')
          : state.historyLog,
      };
    }

    case 'DENY_GPS_CONSENT': {
      if (!canTransition(state.stage, 'GPS_DENIED')) {
        throw new Error(`Заборонений перехід у відмову GPS зі стану ${state.stage}.`);
      }
      const isDriver = event.role === 'driver';
      return {
        ...state,
        stage: 'GPS_DENIED',
        driverGpsConsent: isDriver ? false : state.driverGpsConsent,
        passengerGpsConsent: !isDriver ? false : state.passengerGpsConsent,
        historyLog: logTransition('GPS_DENIED', `${isDriver ? 'Водій' : 'Пасажир'} відхилив GPS. Активовано текстові орієнтири`),
      };
    }

    case 'DRIVER_ARRIVED': {
      if (!canTransition(state.stage, 'ARRIVED_AT_PICKUP')) {
        throw new Error(`Водій не може прибути в точку зустрічі зі стану ${state.stage}.`);
      }
      return {
        ...state,
        stage: 'ARRIVED_AT_PICKUP',
        historyLog: logTransition('ARRIVED_AT_PICKUP', 'Водій прибув у точку посадки та очікує пасажира'),
      };
    }

    case 'ENTER_PIN': {
      if (state.stage !== 'ARRIVED_AT_PICKUP' && state.stage !== 'BOARDING_HANDSHAKE') {
        throw new Error(`Перевірка PIN дозволена лише під час посадки, поточний стан: ${state.stage}.`);
      }
      const cleaned = event.pin.trim();
      const isCorrect = cleaned === state.trip.verificationPin;

      if (!isCorrect) {
        return {
          ...state,
          stage: 'BOARDING_HANDSHAKE',
          enteredPin: cleaned,
          pinError: cleaned.length === 4 ? 'Невірний код! Звіртеся з пасажиром.' : null,
        };
      }

      // Correct PIN unlocks IN_TRANSIT
      return {
        ...state,
        stage: 'IN_TRANSIT',
        enteredPin: cleaned,
        pinError: null,
        historyLog: logTransition('IN_TRANSIT', 'PIN успішно верифіковано. Поїздку розпочато'),
      };
    }

    case 'CONFIRM_BOARDING_QR': {
      if (state.stage !== 'ARRIVED_AT_PICKUP' && state.stage !== 'BOARDING_HANDSHAKE') {
        throw new Error(`QR-посадка доступна лише в точці зустрічі, поточний стан: ${state.stage}.`);
      }
      return {
        ...state,
        stage: 'IN_TRANSIT',
        pinError: null,
        enteredPin: state.trip.verificationPin,
        historyLog: logTransition('IN_TRANSIT', 'QR-код відскановано успішно. Поїздку розпочато'),
      };
    }

    case 'START_RIDE': {
      if (!canTransition(state.stage, 'IN_TRANSIT')) {
        throw new Error(`Неможливо розпочати поїздку без проходження верифікації посадки. Поточний стан: ${state.stage}.`);
      }
      return {
        ...state,
        stage: 'IN_TRANSIT',
        historyLog: logTransition('IN_TRANSIT', 'Початок руху за маршрутом'),
      };
    }

    case 'COMPLETE_RIDE': {
      if (!canTransition(state.stage, 'COMPLETED')) {
        throw new Error(`Заборонений перехід: завершення можливе лише з IN_TRANSIT, поточний: ${state.stage}.`);
      }
      return {
        ...state,
        stage: 'COMPLETED',
        historyLog: logTransition('COMPLETED', 'Прибули в пункт призначення. Поїздку успішно завершено'),
      };
    }

    case 'SUBMIT_RATING': {
      if (state.stage !== 'COMPLETED') {
        throw new Error(`Оцінювання доступне лише після завершення поїздки, поточний стан: ${state.stage}.`);
      }
      return {
        ...state,
        stage: 'RATED_AND_HISTORY',
        ratingStars: event.stars,
        ratingTags: event.tags,
        ratingComment: event.comment,
        historyLog: logTransition('RATED_AND_HISTORY', `Оцінка ${event.stars}★ збережена в локальну історію`),
      };
    }

    case 'CANCEL_RIDE': {
      if (state.stage === 'COMPLETED' || state.stage === 'RATED_AND_HISTORY' || state.stage === 'CANCELLED') {
        throw new Error(`Неможливо скасувати поїздку в термінальному стані ${state.stage}.`);
      }
      return {
        ...state,
        stage: 'CANCELLED',
        cancellationReason: event.reason,
        cancelledByRole: event.role,
        historyLog: logTransition('CANCELLED', `Поїздку скасовано (${event.role === 'driver' ? 'водієм' : 'пасажиром'}): ${event.reason}`),
      };
    }

    case 'RESET_SIMULATOR': {
      return createInitialSessionState({
        activeRole: state.activeRole,
      });
    }

    default:
      return state;
  }
}

/**
 * Great-circle straight-line distance in meters (synthetic estimate)
 */
export function calculateStraightLineDistance(from: LatLng, to: LatLng): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (from.lat * Math.PI) / 180;
  const phi2 = (to.lat * Math.PI) / 180;
  const deltaPhi = ((to.lat - from.lat) * Math.PI) / 180;
  const deltaLambda = ((to.lng - from.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Calculates synthetic ETA in minutes based on distance and assumed mode speed
 */
export function estimateEtaMinutes(distanceMeters: number, mode: 'driving' | 'walking'): number {
  if (distanceMeters <= 20) return 0;
  // Driving avg speed ~32 km/h (8.8 m/s), walking ~4.5 km/h (1.25 m/s)
  const speed = mode === 'driving' ? 8.8 : 1.25;
  const seconds = distanceMeters / speed;
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Format distance cleanly in Ukrainian
 */
export function formatDistanceUk(meters: number): string {
  if (meters < 1000) {
    return `${meters} м`;
  }
  return `${(meters / 1000).toFixed(1)} км`;
}
