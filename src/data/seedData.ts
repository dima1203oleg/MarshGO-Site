import { TransportOffer, PassengerDemand, Vehicle, User, Booking } from '../types';

export const CURRENT_USER: User = {
  id: 'usr_me_01',
  name: 'Дмитро Кізіма',
  phone: '+380 67 ••• •• 42',
  email: 'dmitrokizima02@gmail.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  role: 'passenger',
  activeRole: 'passenger',
  rating: 4.9,
  tripsCount: 14,
  isVerified: true,
  verificationLevel: 'id_document',
  memberSince: 'Травень 2025'
};

export const DRIVER_USER: User = {
  id: 'usr_drv_alex',
  name: 'Олександр Коваленко',
  phone: '+380 50 ••• •• 89',
  email: 'alex.driver@example.ua',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
  role: 'driver',
  activeRole: 'driver',
  rating: 4.9,
  tripsCount: 120,
  isVerified: true,
  verificationLevel: 'id_document',
  memberSince: 'Березень 2024'
};

export const INITIAL_VEHICLE: Vehicle = {
  id: 'veh_camry_01',
  driverId: 'usr_drv_alex',
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  color: 'Чорний перламутр',
  bodyType: 'sedan',
  seats: 4,
  licensePlateMasked: 'AA •••• AA',
  licensePlateFull: 'AA 1234 AA',
  photos: [
    {
      id: 'ph_1',
      url: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80',
      isPrimary: true,
      caption: 'Передня частина та профіль'
    },
    {
      id: 'ph_2',
      url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80',
      isPrimary: false,
      caption: 'Салон автомобіля'
    },
    {
      id: 'ph_3',
      url: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1000&q=80',
      isPrimary: false,
      caption: 'Задня частина'
    },
    {
      id: 'ph_4',
      url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=80',
      isPrimary: false,
      caption: 'Місткий багажник'
    }
  ],
  features: {
    airConditioning: true,
    phoneCharging: true,
    luggageAllowed: true,
    petsAllowed: true,
    childSeat: true,
    smokingAllowed: false
  }
};

export const INITIAL_VEHICLES: Vehicle[] = [
  INITIAL_VEHICLE,
  {
    id: 'veh_vito_02',
    driverId: 'usr_drv_alex',
    make: 'Mercedes-Benz',
    model: 'Vito Tourer Extra-Long',
    year: 2021,
    color: 'Сріблястий металік',
    bodyType: 'minivan',
    seats: 7,
    licensePlateMasked: 'AA •••• BC',
    licensePlateFull: 'AA 5678 BC',
    photos: [
      {
        id: 'ph_v1',
        url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80',
        isPrimary: true,
        caption: 'Мінівен Mercedes Vito 7+1'
      }
    ],
    features: {
      airConditioning: true,
      phoneCharging: true,
      luggageAllowed: true,
      petsAllowed: true,
      childSeat: true,
      smokingAllowed: false
    }
  },
  {
    id: 'veh_rav4_03',
    driverId: 'usr_drv_alex',
    make: 'Toyota',
    model: 'RAV4 Hybrid AWD',
    year: 2023,
    color: 'Білий перламутр',
    bodyType: 'suv',
    seats: 4,
    licensePlateMasked: 'AA •••• KI',
    licensePlateFull: 'AA 9012 KI',
    photos: [
      {
        id: 'ph_r1',
        url: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1000&q=80',
        isPrimary: true,
        caption: 'Кросовер Toyota RAV4 Hybrid'
      }
    ],
    features: {
      airConditioning: true,
      phoneCharging: true,
      luggageAllowed: true,
      petsAllowed: false,
      childSeat: true,
      smokingAllowed: false
    }
  }
];

export const INITIAL_OFFERS: TransportOffer[] = [
  {
    id: 'off_camry_odesa_kyiv',
    category: 'community',
    source: 'marshgo_community',
    isLiveIntegration: true,
    origin: 'Одеса',
    originAddress: 'Центральний автовокзал (вул. Колонтаївська)',
    destination: 'Київ',
    destinationAddress: 'Метро Житомирська / Теремки',
    departureTime: '2026-09-30T08:00:00Z',
    arrivalTime: '2026-09-30T14:20:00Z',
    durationMinutes: 380,
    distanceKm: 475,
    intermediateStops: ['Умань', 'Біла Церква'],
    driver: {
      id: 'usr_drv_alex',
      name: 'Олександр',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
      rating: 4.9,
      tripsCount: 120,
      isVerified: true,
      isPro: false
    },
    vehicle: {
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      color: 'Чорний перламутр',
      primaryPhoto: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80',
      allPhotos: [
        'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1000&q=80'
      ]
    },
    totalSeats: 3,
    availableSeats: 2,
    priceAmount: 500,
    priceUnit: 'per_seat',
    currency: 'UAH',
    platformFeeAmount: 0, // 0% Community carpool!
    comfortTags: ['Кондиціонер', 'Зарядка Type-C', 'Місце для 2 валіз', 'Не палимо'],
    cancellationPolicy: 'Гнучка (до 24 год безкоштовно)'
  },
  {
    id: 'off_taxi_pro_odesa_kyiv',
    category: 'taxi_pro',
    source: 'demo_partner',
    partnerName: 'Uklon Partner (DEMO)',
    isLiveIntegration: false,
    origin: 'Одеса',
    originAddress: 'Від ваших дверей (будь-яка адреса)',
    destination: 'Київ',
    destinationAddress: 'До дверей призначення',
    departureTime: '2026-09-30T08:30:00Z',
    arrivalTime: '2026-09-30T14:30:00Z',
    durationMinutes: 360,
    distanceKm: 475,
    driver: {
      id: 'usr_drv_taxi',
      name: 'Сергій (PRO-ліцензія)',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
      rating: 4.8,
      tripsCount: 450,
      isVerified: true,
      isPro: true
    },
    vehicle: {
      make: 'Hyundai',
      model: 'Sonata',
      year: 2021,
      color: 'Жовтий таксі',
      primaryPhoto: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80'
    },
    totalSeats: 4,
    availableSeats: 4,
    priceAmount: 1400,
    priceUnit: 'per_car',
    currency: 'UAH',
    platformFeeAmount: 70,
    comfortTags: ['Швидко', 'Комфорт-клас', 'Чек та звітність'],
    cancellationPolicy: 'Помірна'
  },
  {
    id: 'off_bus_infobus_odesa_kyiv',
    category: 'bus',
    source: 'demo_partner',
    partnerName: 'INFOBUS / Автолюкс (DEMO)',
    isLiveIntegration: false,
    origin: 'Одеса',
    originAddress: 'Автовокзал "Привокзальний"',
    destination: 'Київ',
    destinationAddress: 'Центральний автовокзал (Деміївська)',
    departureTime: '2026-09-30T09:00:00Z',
    arrivalTime: '2026-09-30T16:30:00Z',
    durationMinutes: 450,
    distanceKm: 480,
    driver: {
      id: 'usr_bus_trans',
      name: 'Автолюкс Експрес',
      avatar: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=250&q=80',
      rating: 4.7,
      tripsCount: 1400,
      isVerified: true,
      isPro: true
    },
    vehicle: {
      make: 'Neoplan',
      model: 'Cityliner',
      year: 2019,
      color: 'Біло-синій',
      primaryPhoto: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1000&q=80'
    },
    totalSeats: 48,
    availableSeats: 16,
    priceAmount: 850,
    priceUnit: 'per_seat',
    currency: 'UAH',
    platformFeeAmount: 0,
    comfortTags: ['Wi-Fi', 'Розетки 220V', 'WC в салоні', 'Багаж 1 валіза'],
    cancellationPolicy: 'Сувора'
  },
  {
    id: 'off_transfer_vclass_odesa_kyiv',
    category: 'transfer',
    source: 'marshgo_pro',
    partnerName: 'VIP Transfer Ukraine',
    isLiveIntegration: true,
    origin: 'Одеса',
    originAddress: 'Будь-яка точка міста / готель',
    destination: 'Київ',
    destinationAddress: 'Аеропорт / Ж/Д / Адреса',
    departureTime: '2026-09-30T07:30:00Z',
    arrivalTime: '2026-09-30T13:30:00Z',
    durationMinutes: 360,
    distanceKm: 475,
    driver: {
      id: 'usr_drv_vip',
      name: 'Максим (VIP Transfer)',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80',
      rating: 4.98,
      tripsCount: 310,
      isVerified: true,
      isPro: true
    },
    vehicle: {
      make: 'Mercedes-Benz',
      model: 'V-Class VIP',
      year: 2022,
      color: 'Чорний',
      primaryPhoto: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80'
    },
    totalSeats: 6,
    availableSeats: 6,
    priceAmount: 1500,
    priceUnit: 'per_seat',
    currency: 'UAH',
    platformFeeAmount: 150,
    comfortTags: ['Шкіряний салон', 'Вода BonAqua', 'Преміум звук', 'Мінібар'],
    cancellationPolicy: 'Гнучка (до 24 год безкоштовно)'
  },
  {
    id: 'off_carsharing_getmancar',
    category: 'carsharing',
    source: 'demo_partner',
    partnerName: 'Getmancar (DEMO)',
    isLiveIntegration: false,
    origin: 'Одеса',
    originAddress: 'Зона паркування в центрі',
    destination: 'Київ',
    destinationAddress: 'Завершення оренди в Києві',
    departureTime: '2026-09-30T08:00:00Z',
    arrivalTime: '2026-09-30T14:00:00Z',
    durationMinutes: 360,
    distanceKm: 475,
    driver: {
      id: 'usr_getmancar',
      name: 'Getmancar Автопарк',
      avatar: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=250&q=80',
      rating: 4.8,
      tripsCount: 9500,
      isVerified: true,
      isPro: true
    },
    vehicle: {
      make: 'Skoda',
      model: 'Octavia A7',
      year: 2020,
      color: 'Сріблястий',
      primaryPhoto: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1000&q=80'
    },
    totalSeats: 5,
    availableSeats: 5,
    priceAmount: 1200,
    priceUnit: 'per_day',
    currency: 'UAH',
    platformFeeAmount: 0,
    comfortTags: ['Пальне включено', 'КАСКО', 'Самостійне керування (стаж 2+ роки)'],
    cancellationPolicy: 'Гнучка (до 24 год безкоштовно)'
  }
];

export const INITIAL_DEMANDS: PassengerDemand[] = [
  {
    id: 'dmd_01',
    passengerId: 'usr_anna_01',
    passengerName: 'Анна Ткаченко',
    passengerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
    passengerRating: 4.9,
    origin: 'Одеса',
    destination: 'Київ',
    departureDate: '2026-09-30',
    timeWindowStart: '08:00',
    timeWindowEnd: '10:00',
    passengerCount: 2,
    totalBudget: 1200, // 1 200 грн загалом за двох!
    budgetType: 'total_all',
    notes: 'Їдемо вдвох із невеликими рюкзаками. Потрібен виїзд без запізнень.',
    status: 'published',
    createdAt: '5 хв тому',
    proposalsCount: 3,
    featuresNeeded: {
      luggage: true,
      pets: false,
      childSeat: false
    }
  },
  {
    id: 'dmd_02',
    passengerId: 'usr_chornomorsk_01',
    passengerName: 'Марина Соколова',
    passengerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80',
    passengerRating: 5.0,
    origin: 'Чорноморськ',
    destination: 'Київ',
    departureDate: '2026-09-30',
    timeWindowStart: '09:00',
    timeWindowEnd: '10:30',
    passengerCount: 1,
    totalBudget: 700,
    budgetType: 'total_all',
    notes: 'Можу підійти до зупинки біля виїзду з міста.',
    status: 'published',
    createdAt: '12 хв тому',
    proposalsCount: 1
  },
  {
    id: 'dmd_03',
    passengerId: 'usr_vin_01',
    passengerName: 'Олена Васильчук',
    passengerAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
    passengerRating: 4.8,
    origin: 'Одеса',
    destination: 'Вінниця',
    departureDate: '2026-09-30',
    timeWindowStart: '07:00',
    timeWindowEnd: '08:30',
    passengerCount: 3,
    totalBudget: 900,
    budgetType: 'total_all',
    notes: 'Сімʼя з підлітком, потрібне заднє сидіння.',
    status: 'published',
    createdAt: '18 хв тому',
    proposalsCount: 2
  },
  {
    id: 'dmd_04',
    passengerId: 'usr_uman_01',
    passengerName: 'Вікторія Кравчук',
    passengerAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=250&q=80',
    passengerRating: 4.7,
    origin: 'Одеса',
    destination: 'Умань',
    departureDate: '2026-09-30',
    timeWindowStart: '08:30',
    timeWindowEnd: '10:00',
    passengerCount: 1,
    totalBudget: 600,
    budgetType: 'total_all',
    notes: 'Висадити біля траси коло входу до парку Софіївка.',
    status: 'published',
    createdAt: '25 хв тому',
    proposalsCount: 4
  },
  // Corridor demand for Stryi -> Lviv navigation simulation
  {
    id: 'dmd_stryi_lviv_01',
    passengerId: 'usr_duliby_01',
    passengerName: 'Ірина Мельник',
    passengerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    passengerRating: 4.9,
    origin: 'Дуліби',
    destination: 'Львів (ТРЦ King Cross)',
    departureDate: '2026-09-30',
    timeWindowStart: '09:00',
    timeWindowEnd: '11:00',
    passengerCount: 1,
    totalBudget: 200,
    budgetType: 'total_all',
    notes: 'Стоятиму на зупинці біля центральної аптеки в Дулібах.',
    status: 'published',
    createdAt: '2 хв тому',
    proposalsCount: 0
  }
];

export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'bk_demo_01',
    offerId: 'off_camry_odesa_kyiv',
    passengerId: 'usr_me_01',
    passengerName: 'Дмитро Кізіма',
    driverId: 'usr_drv_alex',
    driverName: 'Олександр Коваленко',
    driverPhoneMasked: '+380 50 ••• •• 89',
    driverPhoneFull: '+380 50 445 12 89',
    vehicleSummary: 'Toyota Camry (2020), чорний',
    vehiclePlate: 'AA 1234 AA',
    vehiclePhoto: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80',
    origin: 'Одеса (Центральний автовокзал)',
    destination: 'Київ (м. Житомирська)',
    departureTime: '2026-09-30T08:00:00Z',
    seatsBooked: 2,
    finalPriceAmount: 1000,
    status: 'confirmed',
    paymentMethod: 'cash_to_driver',
    isCostSharing: true,
    bookingCode: 'MG-8831',
    qrCodeData: 'MARSHGO://TICKET/MG-8831/VERIFIED-2026-09-30',
    createdAt: '2026-09-29T11:45:00Z'
  }
];
