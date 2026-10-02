import {
  TransportOffer,
  PassengerDemand,
  Vehicle,
  User,
  Booking,
  Proposal,
  NavigationSession,
  ChatMessage,
  RouteAlert,
  Review
} from '../types';
import {
  CURRENT_USER,
  DRIVER_USER,
  INITIAL_VEHICLE,
  INITIAL_VEHICLES,
  INITIAL_OFFERS,
  INITIAL_DEMANDS,
  INITIAL_BOOKINGS
} from '../data/seedData';

type Listener = () => void;

export class MarshgoRepository {
  private listeners: Set<Listener> = new Set();

  private user: User;
  private vehicles: Vehicle[];
  private activeVehicleId: string;
  private vehicle: Vehicle;
  private offers: TransportOffer[];
  private demands: PassengerDemand[];
  private proposals: Proposal[];
  private bookings: Booking[];
  private alerts: RouteAlert[];
  private reviews: Review[];
  private messages: Record<string, ChatMessage[]> = {};
  private activeNavSession: NavigationSession | null = null;
  private isDemoMode: boolean = true;

  constructor() {
    this.user = this.load('mg_user', CURRENT_USER);
    this.vehicles = this.load('mg_vehicles', INITIAL_VEHICLES);
    this.activeVehicleId = this.load('mg_active_vehicle_id', this.vehicles[0]?.id || 'veh_camry_01');
    this.vehicle = this.vehicles.find((v) => v.id === this.activeVehicleId) || this.vehicles[0] || INITIAL_VEHICLE;
    this.offers = this.load('mg_offers', INITIAL_OFFERS);
    this.demands = this.load('mg_demands', INITIAL_DEMANDS);
    this.bookings = this.load('mg_bookings', INITIAL_BOOKINGS);
    this.reviews = this.load('mg_reviews', [
      {
        id: 'rev_seed_01',
        bookingId: 'bk_demo_01',
        targetUserId: 'usr_drv_alex',
        targetUserName: 'Олександр Коваленко',
        authorUserId: 'usr_me_01',
        authorName: 'Дмитро Кізіма',
        authorRole: 'passenger',
        rating: 5,
        comment: 'Чудова поїздка! Дуже комфортна Toyota Camry, приїхали вчасно до Києва.',
        tags: ['Пунктуальний', 'Чисте авто', 'Комфортне водіння'],
        createdAt: 'Вчора'
      }
    ]);
    this.proposals = this.load('mg_proposals', [
      {
        id: 'prop_01',
        demandId: 'dmd_01',
        driverId: 'usr_drv_alex',
        driverName: 'Олександр (Toyota Camry)',
        driverAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
        driverRating: 4.9,
        vehicleSummary: 'Toyota Camry (2020), чорний',
        vehiclePhoto: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80',
        offeredPrice: 1000,
        estimatedPickupTime: '08:00',
        detourMinutes: 4,
        detourKm: 1.8,
        status: 'active',
        currentRevisionNumber: 1,
        createdAt: '10 хв тому',
        revisions: [
          {
            revisionNumber: 1,
            proposedByRole: 'driver',
            proposedByUserId: 'usr_drv_alex',
            priceAmount: 1000,
            proposedAt: '2026-09-29T12:00:00Z',
            comment: 'Доброго дня! Можу забрати за 1 000 грн. Виїзд о 08:00. Toyota Camry.'
          }
        ]
      }
    ]);
    this.alerts = this.load('mg_alerts', [
      {
        id: 'alt_01',
        userId: 'usr_me_01',
        origin: 'Стрий',
        destination: 'Львів',
        maxBudget: 250,
        active: true,
        matchesFoundCount: 2
      }
    ]);
    this.messages = this.load('mg_messages', {
      conv_dmd_01: [
        {
          id: 'msg_01',
          conversationId: 'conv_dmd_01',
          senderId: 'usr_drv_alex',
          senderName: 'Олександр',
          text: 'Доброго дня! Можу забрати за 1 000 грн. Виїзд о 08:00. Toyota Camry.',
          timestamp: '09:15',
          proposalCard: {
            proposalId: 'prop_01',
            amount: 1000,
            status: 'active'
          }
        },
        {
          id: 'msg_02',
          conversationId: 'conv_dmd_01',
          senderId: 'usr_me_01',
          senderName: 'Анна',
          text: 'Чудово! Мені підходить. Можемо забронювати?',
          timestamp: '09:17'
        },
        {
          id: 'msg_03',
          conversationId: 'conv_dmd_01',
          senderId: 'usr_drv_alex',
          senderName: 'Олександр',
          text: 'Так, звісно. Підтверджую бронювання.',
          timestamp: '09:18'
        }
      ]
    });
  }

  private load<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  private save(key: string, data: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      this.notify();
    } catch {
      // storage unavailable fallback
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // User & Role Switching
  public getUser(): User {
    return this.user;
  }

  public switchRole(role: 'passenger' | 'driver') {
    if (role === 'driver') {
      this.user = {
        ...DRIVER_USER,
        activeRole: 'driver'
      };
    } else {
      this.user = {
        ...CURRENT_USER,
        activeRole: 'passenger'
      };
    }
    this.save('mg_user', this.user);
  }

  public updateUser(updates: Partial<User>) {
    this.user = {
      ...this.user,
      ...updates
    };
    this.save('mg_user', this.user);
  }

  // Vehicles (Garage Management)
  public getVehicles(): Vehicle[] {
    return this.vehicles;
  }

  public getActiveVehicleId(): string {
    return this.activeVehicleId;
  }

  public setActiveVehicleId(id: string) {
    const found = this.vehicles.find((v) => v.id === id);
    if (found) {
      this.activeVehicleId = id;
      this.vehicle = found;
      this.save('mg_active_vehicle_id', this.activeVehicleId);
      this.save('mg_vehicle', this.vehicle);
    }
  }

  public getVehicle(): Vehicle {
    return this.vehicle;
  }

  public getVehicleById(id: string): Vehicle | undefined {
    return this.vehicles.find((v) => v.id === id);
  }

  public addVehicle(newVeh: Omit<Vehicle, 'id'> & { id?: string }): Vehicle {
    const id = newVeh.id || `veh_${Date.now()}`;
    const vehicleToAdd: Vehicle = {
      ...newVeh,
      id,
      driverId: newVeh.driverId || this.user.id || 'usr_drv_alex'
    };
    this.vehicles = [...this.vehicles, vehicleToAdd];
    this.save('mg_vehicles', this.vehicles);

    // If only vehicle or user wants, make active
    if (this.vehicles.length === 1) {
      this.setActiveVehicleId(id);
    }
    return vehicleToAdd;
  }

  public updateVehicle(updated: Partial<Vehicle>) {
    this.vehicle = { ...this.vehicle, ...updated };
    this.vehicles = this.vehicles.map((v) => (v.id === this.vehicle.id ? this.vehicle : v));
    this.save('mg_vehicle', this.vehicle);
    this.save('mg_vehicles', this.vehicles);
  }

  public updateVehicleById(id: string, updated: Partial<Vehicle>) {
    this.vehicles = this.vehicles.map((v) => (v.id === id ? { ...v, ...updated } : v));
    if (this.vehicle.id === id) {
      this.vehicle = { ...this.vehicle, ...updated };
      this.save('mg_vehicle', this.vehicle);
    }
    this.save('mg_vehicles', this.vehicles);
  }

  public deleteVehicle(id: string) {
    if (this.vehicles.length <= 1) return; // Prevent deleting the last vehicle
    this.vehicles = this.vehicles.filter((v) => v.id !== id);
    if (this.activeVehicleId === id) {
      this.setActiveVehicleId(this.vehicles[0]?.id);
    }
    this.save('mg_vehicles', this.vehicles);
  }

  public addVehiclePhoto(url: string, caption?: string) {
    const newPhoto = {
      id: `ph_${Date.now()}`,
      url,
      isPrimary: this.vehicle.photos.length === 0,
      caption: caption || 'Фото автомобіля'
    };
    this.vehicle.photos = [...this.vehicle.photos, newPhoto];
    this.vehicles = this.vehicles.map((v) => (v.id === this.vehicle.id ? this.vehicle : v));
    this.save('mg_vehicle', this.vehicle);
    this.save('mg_vehicles', this.vehicles);
  }

  public removeVehiclePhoto(photoId: string) {
    this.vehicle.photos = this.vehicle.photos.filter((p) => p.id !== photoId);
    if (this.vehicle.photos.length > 0 && !this.vehicle.photos.some((p) => p.isPrimary)) {
      this.vehicle.photos[0].isPrimary = true;
    }
    this.vehicles = this.vehicles.map((v) => (v.id === this.vehicle.id ? this.vehicle : v));
    this.save('mg_vehicle', this.vehicle);
    this.save('mg_vehicles', this.vehicles);
  }

  public setPrimaryVehiclePhoto(photoId: string) {
    this.vehicle.photos = this.vehicle.photos.map((p) => ({
      ...p,
      isPrimary: p.id === photoId
    }));
    this.vehicles = this.vehicles.map((v) => (v.id === this.vehicle.id ? this.vehicle : v));
    this.save('mg_vehicle', this.vehicle);
    this.save('mg_vehicles', this.vehicles);
  }

  // Offers (Unified Search Supply)
  public getOffers(): TransportOffer[] {
    return this.offers;
  }

  public getOfferById(id: string): TransportOffer | undefined {
    return this.offers.find((o) => o.id === id);
  }

  public createOffer(newOffer: Omit<TransportOffer, 'id' | 'currency' | 'platformFeeAmount'>): TransportOffer {
    const offer: TransportOffer = {
      ...newOffer,
      id: `off_${Date.now()}`,
      currency: 'UAH',
      platformFeeAmount: newOffer.category === 'community' ? 0 : Math.round(newOffer.priceAmount * 0.05)
    };
    this.offers = [offer, ...this.offers];
    this.save('mg_offers', this.offers);
    return offer;
  }

  // Demands (Reverse Marketplace)
  public getDemands(): PassengerDemand[] {
    return this.demands;
  }

  public getDemandById(id: string): PassengerDemand | undefined {
    return this.demands.find((d) => d.id === id);
  }

  public createDemand(params: {
    origin: string;
    destination: string;
    departureDate: string;
    timeWindowStart: string;
    timeWindowEnd: string;
    passengerCount: number;
    totalBudget: number;
    budgetType: 'total_all' | 'per_seat';
    notes?: string;
  }): PassengerDemand {
    const demand: PassengerDemand = {
      id: `dmd_${Date.now()}`,
      passengerId: this.user.id,
      passengerName: this.user.name,
      passengerAvatar: this.user.avatar,
      passengerRating: this.user.rating || 5.0,
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
      timeWindowStart: params.timeWindowStart,
      timeWindowEnd: params.timeWindowEnd,
      passengerCount: params.passengerCount,
      totalBudget: params.totalBudget,
      budgetType: params.budgetType,
      notes: params.notes,
      status: 'published',
      createdAt: 'Щойно',
      proposalsCount: 0
    };
    this.demands = [demand, ...this.demands];
    this.save('mg_demands', this.demands);
    return demand;
  }

  // Proposals & Negotiations
  public getProposalsForDemand(demandId: string): Proposal[] {
    return this.proposals.filter((p) => p.demandId === demandId);
  }

  public submitProposal(demandId: string, priceAmount: number, comment?: string): Proposal {
    const demand = this.getDemandById(demandId);
    if (!demand) throw new Error('Запит не знайдено');

    const proposal: Proposal = {
      id: `prop_${Date.now()}`,
      demandId,
      driverId: this.user.id,
      driverName: `${this.user.name} (${this.vehicle.make} ${this.vehicle.model})`,
      driverAvatar: this.user.avatar,
      driverRating: this.user.rating || 4.9,
      vehicleSummary: `${this.vehicle.make} ${this.vehicle.model} (${this.vehicle.year}), ${this.vehicle.color}`,
      vehiclePhoto: this.vehicle.photos[0]?.url || 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80',
      offeredPrice: priceAmount,
      estimatedPickupTime: demand.timeWindowStart,
      detourMinutes: 3,
      detourKm: 1.5,
      status: 'active',
      currentRevisionNumber: 1,
      createdAt: 'Щойно',
      revisions: [
        {
          revisionNumber: 1,
          proposedByRole: 'driver',
          proposedByUserId: this.user.id,
          priceAmount,
          proposedAt: new Date().toISOString(),
          comment: comment || `Можу забрати за ${priceAmount} грн на ${this.vehicle.make} ${this.vehicle.model}.`
        }
      ]
    };

    this.proposals = [proposal, ...this.proposals];
    this.save('mg_proposals', this.proposals);

    // Update demand proposals count
    demand.proposalsCount += 1;
    demand.status = 'offers_received';
    this.save('mg_demands', this.demands);

    // Add chat message
    this.addMessage(`conv_${demandId}`, {
      id: `msg_${Date.now()}`,
      conversationId: `conv_${demandId}`,
      senderId: this.user.id,
      senderName: this.user.name,
      text: comment || `Запропоновано поїздку за ${priceAmount} грн.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      proposalCard: {
        proposalId: proposal.id,
        amount: priceAmount,
        status: 'active'
      }
    });

    return proposal;
  }

  public counterOffer(proposalId: string, counterPriceAmount: number, comment?: string): Proposal {
    const proposal = this.proposals.find((p) => p.id === proposalId);
    if (!proposal) throw new Error('Пропозицію не знайдено');

    const nextRevision = proposal.currentRevisionNumber + 1;
    const isPassenger = this.user.activeRole === 'passenger';

    proposal.currentRevisionNumber = nextRevision;
    proposal.offeredPrice = counterPriceAmount;
    proposal.status = 'countered';
    proposal.revisions.push({
      revisionNumber: nextRevision,
      proposedByRole: isPassenger ? 'passenger' : 'driver',
      proposedByUserId: this.user.id,
      priceAmount: counterPriceAmount,
      proposedAt: new Date().toISOString(),
      comment: comment || `Зустрічна пропозиція: ${counterPriceAmount} грн.`
    });

    this.save('mg_proposals', this.proposals);

    this.addMessage(`conv_${proposal.demandId}`, {
      id: `msg_${Date.now()}`,
      conversationId: `conv_${proposal.demandId}`,
      senderId: this.user.id,
      senderName: this.user.name,
      text: comment || `Зустрічна пропозиція: ${counterPriceAmount} грн.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      proposalCard: {
        proposalId: proposal.id,
        amount: counterPriceAmount,
        status: 'countered'
      }
    });

    return proposal;
  }

  public acceptProposal(proposalId: string): Booking {
    const proposal = this.proposals.find((p) => p.id === proposalId);
    if (!proposal) throw new Error('Пропозицію не знайдено');
    const demand = this.getDemandById(proposal.demandId);
    if (!demand) throw new Error('Запит не знайдено');
    if (proposal.status === 'accepted' || demand.status === 'booked') {
      throw new Error('Для цього запиту вже підтверджено бронювання');
    }

    // Atomic update
    proposal.status = 'accepted';
    demand.status = 'booked';
    this.save('mg_proposals', this.proposals);
    this.save('mg_demands', this.demands);

    // Create booking
    const booking: Booking = {
      id: `bk_${Date.now()}`,
      demandId: demand.id,
      proposalId: proposal.id,
      passengerId: demand.passengerId,
      passengerName: demand.passengerName,
      driverId: proposal.driverId,
      driverName: proposal.driverName,
      driverPhoneMasked: '+380 50 ••• •• 89',
      driverPhoneFull: '+380 50 445 12 89',
      vehicleSummary: proposal.vehicleSummary,
      vehiclePlate: 'AA 1234 AA',
      vehiclePhoto: proposal.vehiclePhoto,
      origin: demand.origin,
      destination: demand.destination,
      departureTime: `${demand.departureDate}T${demand.timeWindowStart}:00Z`,
      seatsBooked: demand.passengerCount,
      finalPriceAmount: proposal.offeredPrice,
      status: 'confirmed',
      paymentMethod: 'cash_to_driver',
      isCostSharing: true,
      bookingCode: `MG-${Math.floor(1000 + Math.random() * 9000)}`,
      qrCodeData: `MARSHGO://TICKET/DEMAND-${demand.id}/FINAL-${proposal.offeredPrice}`,
      createdAt: new Date().toISOString()
    };

    this.bookings = [booking, ...this.bookings];
    this.save('mg_bookings', this.bookings);

    this.addMessage(`conv_${demand.id}`, {
      id: `msg_${Date.now()}`,
      conversationId: `conv_${demand.id}`,
      senderId: 'system',
      senderName: 'MARSHGO',
      isSystemEvent: true,
      text: `🎉 Домовленість досягнута! Вартість ${booking.finalPriceAmount} грн погоджена. Поїздку підтверджено.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    return booking;
  }

  // Book an existing offer (FLOW A)
  public bookOffer(offerId: string, seatsCount: number = 1): Booking {
    const offer = this.getOfferById(offerId);
    if (!offer) throw new Error('Пропозицію не знайдено');
    if (!Number.isInteger(seatsCount) || seatsCount < 1) {
      throw new Error('Вкажіть коректну кількість місць');
    }
    if (offer.availableSeats < seatsCount) {
      throw new Error('Недостатньо вільних місць');
    }

    // Atomic seat locking
    offer.availableSeats -= seatsCount;
    this.save('mg_offers', this.offers);

    const isPerCar = offer.priceUnit === 'per_car';
    const totalAmount = isPerCar ? offer.priceAmount : offer.priceAmount * seatsCount;

    const booking: Booking = {
      id: `bk_${Date.now()}`,
      offerId: offer.id,
      passengerId: this.user.id,
      passengerName: this.user.name,
      driverId: offer.driver.id,
      driverName: offer.driver.name,
      driverPhoneMasked: '+380 50 ••• •• 89',
      driverPhoneFull: '+380 50 445 12 89',
      vehicleSummary: offer.vehicle ? `${offer.vehicle.make} ${offer.vehicle.model}` : offer.partnerName || 'Транспорт',
      vehiclePlate: 'AA 1234 AA',
      vehiclePhoto: offer.vehicle?.primaryPhoto || 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80',
      origin: `${offer.origin} (${offer.originAddress})`,
      destination: `${offer.destination} (${offer.destinationAddress})`,
      departureTime: offer.departureTime,
      seatsBooked: seatsCount,
      finalPriceAmount: totalAmount,
      status: 'confirmed',
      paymentMethod: 'cash_to_driver',
      isCostSharing: offer.category === 'community',
      bookingCode: `MG-${Math.floor(1000 + Math.random() * 9000)}`,
      qrCodeData: `MARSHGO://TICKET/${offer.id}/${totalAmount}UAH`,
      createdAt: new Date().toISOString()
    };

    this.bookings = [booking, ...this.bookings];
    this.save('mg_bookings', this.bookings);

    return booking;
  }

  // Bookings
  public getBookings(): Booking[] {
    return this.bookings;
  }

  public cancelBooking(bookingId: string) {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking || booking.status === 'cancelled' || booking.status === 'completed') return;

    booking.status = 'cancelled';

    // Release seats back to offer if applicable
    if (booking.offerId) {
      const offer = this.getOfferById(booking.offerId);
      if (offer) {
        offer.availableSeats = Math.min(offer.totalSeats, offer.availableSeats + booking.seatsBooked);
        this.save('mg_offers', this.offers);
      }
    }

    this.save('mg_bookings', this.bookings);
  }

  // Reviews & Rating System
  public getReviews(): Review[] {
    return this.reviews;
  }

  public getReviewsForUser(userId: string): Review[] {
    return this.reviews.filter((r) => r.targetUserId === userId);
  }

  public completeBooking(bookingId: string) {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    booking.status = 'completed';
    this.save('mg_bookings', this.bookings);
  }

  public submitReview(params: {
    bookingId: string;
    rating: number; // 1 to 5
    comment: string;
    tags?: string[];
  }): Review {
    const booking = this.bookings.find((b) => b.id === params.bookingId);
    if (!booking) throw new Error('Поїздку не знайдено');
    if (booking.hasReviewed) throw new Error('Відгук для цієї поїздки вже залишено');
    if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
      throw new Error('Оцінка має бути від 1 до 5');
    }

    const isPassenger = this.user.activeRole === 'passenger';
    const targetUserId = isPassenger ? booking.driverId : booking.passengerId;
    const targetUserName = isPassenger ? booking.driverName : booking.passengerName;

    const review: Review = {
      id: `rev_${Date.now()}`,
      bookingId: booking.id,
      targetUserId,
      targetUserName,
      authorUserId: this.user.id,
      authorName: this.user.name,
      authorRole: this.user.activeRole,
      rating: params.rating,
      comment: params.comment,
      tags: params.tags,
      createdAt: 'Щойно'
    };

    this.reviews = [review, ...this.reviews];
    this.save('mg_reviews', this.reviews);

    // Mark booking as completed and reviewed
    booking.status = 'completed';
    booking.hasReviewed = true;
    booking.userRating = params.rating;
    this.save('mg_bookings', this.bookings);

    // Update target driver's rating in offers so search cards reflect the new rating
    this.offers = this.offers.map((offer) => {
      if (offer.driver.id === targetUserId) {
        const currentCount = offer.driver.reviewsCount || offer.driver.tripsCount || 1;
        const newCount = currentCount + 1;
        const currentRating = offer.driver.rating || 5.0;
        const newRating = Number((((currentRating * currentCount) + params.rating) / newCount).toFixed(1));
        return {
          ...offer,
          driver: {
            ...offer.driver,
            rating: newRating,
            reviewsCount: newCount,
            tripsCount: offer.driver.tripsCount + 1
          }
        };
      }
      return offer;
    });
    this.save('mg_offers', this.offers);

    return review;
  }

  // Navigation Session (Foreground Beta)
  public getActiveNavSession(): NavigationSession | null {
    return this.activeNavSession;
  }

  public startNavigationSession(origin: string = 'Стрий', destination: string = 'Львів'): NavigationSession {
    const session: NavigationSession = {
      id: `nav_${Date.now()}`,
      driverId: this.user.id,
      origin,
      destination,
      status: 'active',
      matchmakingOptIn: false, // Default OFF per safety rule!
      currentLocation: {
        lat: 49.2562, // Stryi
        lng: 23.8514,
        accuracyMeters: 8,
        timestamp: new Date().toISOString()
      },
      remainingDistanceKm: 68,
      remainingDurationMinutes: 52,
      waypointStops: [
        {
          id: 'wp_origin',
          name: origin,
          type: 'origin',
          lat: 49.2562,
          lng: 23.8514
        },
        {
          id: 'wp_dest',
          name: destination,
          type: 'destination',
          lat: 49.8397,
          lng: 24.0297
        }
      ],
      candidates: [
        {
          id: 'cand_duliby_01',
          demandId: 'dmd_stryi_lviv_01',
          passengerName: 'Ірина Мельник',
          passengerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
          passengerCount: 1,
          origin: 'Дуліби (зупинка Аптека)',
          destination: 'Львів (King Cross Leopolis)',
          timeWindow: 'Зараз (до 10:30)',
          offeredBudget: 200,
          detourMinutes: 4, // +4 хвилини реальний дорожній detour
          detourKm: 1.8, // +1.8 км
          pickupLocation: {
            lat: 49.2311,
            lng: 23.8344,
            address: 'Дуліби, вул. Шевченка, 12'
          },
          dropoffLocation: {
            lat: 49.7733,
            lng: 24.0094,
            address: 'Львів, Стрийська (King Cross)'
          },
          status: 'suggested'
        }
      ]
    };

    this.activeNavSession = session;
    this.notify();
    return session;
  }

  public setMatchmakingOptIn(enabled: boolean) {
    if (this.activeNavSession) {
      this.activeNavSession.matchmakingOptIn = enabled;
      this.notify();
    }
  }

  public acceptNavigationMatch(candidateId: string) {
    if (!this.activeNavSession) return;
    const candidate = this.activeNavSession.candidates.find((c) => c.id === candidateId);
    if (!candidate || !this.activeNavSession.matchmakingOptIn || candidate.status !== 'suggested') return;

    candidate.status = 'accepted';

    // Recalculate route by inserting pickup and dropoff
    const pickupWp = {
      id: `wp_pickup_${candidateId}`,
      name: candidate.origin,
      type: 'pickup' as const,
      lat: candidate.pickupLocation.lat,
      lng: candidate.pickupLocation.lng,
      passengerName: candidate.passengerName
    };

    const dropoffWp = {
      id: `wp_dropoff_${candidateId}`,
      name: candidate.destination,
      type: 'dropoff' as const,
      lat: candidate.dropoffLocation.lat,
      lng: candidate.dropoffLocation.lng,
      passengerName: candidate.passengerName
    };

    // Recalculate duration & distance
    this.activeNavSession.remainingDistanceKm += candidate.detourKm;
    this.activeNavSession.remainingDurationMinutes += candidate.detourMinutes;

    // Insert between origin and destination
    this.activeNavSession.waypointStops.splice(1, 0, pickupWp, dropoffWp);

    // Create mutual confirmed booking
    const booking: Booking = {
      id: `bk_nav_${Date.now()}`,
      demandId: candidate.demandId,
      passengerId: 'usr_duliby_01',
      passengerName: candidate.passengerName,
      driverId: this.user.id,
      driverName: this.user.name,
      driverPhoneMasked: '+380 50 ••• •• 89',
      driverPhoneFull: '+380 50 445 12 89',
      vehicleSummary: `${this.vehicle.make} ${this.vehicle.model}`,
      vehiclePlate: 'AA 1234 AA',
      vehiclePhoto: this.vehicle.photos[0]?.url || '',
      origin: candidate.origin,
      destination: candidate.destination,
      departureTime: new Date().toISOString(),
      seatsBooked: candidate.passengerCount,
      finalPriceAmount: candidate.offeredBudget,
      status: 'confirmed',
      paymentMethod: 'cash_to_driver',
      isCostSharing: true,
      bookingCode: `MG-NAV-${Math.floor(1000 + Math.random() * 9000)}`,
      qrCodeData: `MARSHGO://NAV-TICKET/${candidate.id}`,
      createdAt: new Date().toISOString()
    };

    this.bookings = [booking, ...this.bookings];
    this.save('mg_bookings', this.bookings);

    this.notify();
  }

  public endNavigationSession() {
    this.activeNavSession = null;
    this.notify();
  }

  // Chat messages
  public getMessages(conversationId: string): ChatMessage[] {
    return this.messages[conversationId] || [];
  }

  public addMessage(conversationId: string, msg: ChatMessage) {
    if (!this.messages[conversationId]) {
      this.messages[conversationId] = [];
    }
    this.messages[conversationId].push(msg);
    this.save('mg_messages', this.messages);
  }

  // Alerts
  public getAlerts(): RouteAlert[] {
    return this.alerts;
  }

  public createAlert(origin: string, destination: string, maxBudget?: number): RouteAlert {
    const alert: RouteAlert = {
      id: `alt_${Date.now()}`,
      userId: this.user.id,
      origin,
      destination,
      maxBudget,
      active: true,
      matchesFoundCount: 1
    };
    this.alerts = [alert, ...this.alerts];
    this.save('mg_alerts', this.alerts);
    return alert;
  }

  // Demo vs Live toggle
  public getDemoMode(): boolean {
    return this.isDemoMode;
  }

  public setDemoMode(val: boolean) {
    this.isDemoMode = val;
    this.notify();
  }
}

export const storage = new MarshgoRepository();
