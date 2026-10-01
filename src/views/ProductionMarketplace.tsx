import { FormEvent, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownUp, ArrowLeft, ArrowRight, Ban, Bell, CalendarDays, CarFront, ChevronRight,
  CircleUserRound, Clock3, Compass, FileDown, Flag, Home, LogOut, MapPin, MessageCircle, Minus, Navigation,
  Plus, Search, ShieldCheck, Ticket, Users, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { BrandMark } from '../components/BrandMark';
import { ApiAccountDeletionRequest, ApiBlockedUser, ApiBooking, ApiDemand, ApiJourneySearchResult, ApiJourneyStrategy, ApiMessage, ApiModerationCase, ApiNotification, ApiNotificationPage, ApiOffer, ApiPassengerNavigationMatch, ApiPlace, ApiProposal, ApiProposalRevision, ApiRescueResult, ApiRendezvous, ApiStoredJourney, ApiUser, ApiVehicle, ApiVehiclePhoto, ApiVerificationQueueItem, ApiVerificationRecord, productionApi } from '../services/productionApi';
import { OfflineNavigationStore } from '../navigation/OfflineNavigationStore';
import { defaultKyivDateTime, formatKyivDateTimeInput, kyivDateTimeInputToDate, kyivDateTimeInputToIso } from '../domain/kyivTime';
import { useProductionTabRouter } from '../routing/useProductionTabRouter';
import { pathForProductionEntity, type ProductionTab } from '../routing/productionRoutes';
import { JourneyResultsPanel } from './JourneyResultsPanel';
const ProductionNavigation = lazy(() => import('./ProductionNavigation').then((module) => ({ default: module.ProductionNavigation })));

type Tab = ProductionTab;
const formatMoney = (minor: number, currency: string) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
const formatDate = (value: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) => new Intl.DateTimeFormat('uk-UA', { ...options, timeZone: 'Europe/Kyiv' }).format(new Date(value));
const todayKyiv = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());
const tabItems: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Головна', icon: Home }, { id: 'search', label: 'Пошук', icon: Search },
  { id: 'trips', label: 'Поїздки', icon: Ticket }, { id: 'profile', label: 'Профіль', icon: CircleUserRound },
];
const demandRequirementLabels: Record<string, string> = { luggage: 'Багаж', pets: 'Тварини', childSeat: 'Дитяче крісло' };

export function ProductionMarketplace() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('+380');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [authIntro, setAuthIntro] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingPermissionMessage, setOnboardingPermissionMessage] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [searchOriginPlace, setSearchOriginPlace] = useState<ApiPlace | null>(null);
  const [searchDestinationPlace, setSearchDestinationPlace] = useState<ApiPlace | null>(null);
  const [routePlaceField, setRoutePlaceField] = useState<'origin' | 'destination' | null>(null);
  const [routePlaceSuggestions, setRoutePlaceSuggestions] = useState<ApiPlace[]>([]);
  const [date, setDate] = useState(todayKyiv);
  const [seats, setSeats] = useState(1);
  const [journeyDeparture, setJourneyDeparture] = useState(() => defaultKyivDateTime(1, 8));
  const [journeyStrategy, setJourneyStrategy] = useState<ApiJourneyStrategy>('BALANCED');
  const [journeyResult, setJourneyResult] = useState<ApiJourneySearchResult | null>(null);
  const [journeyBookingLink, setJourneyBookingLink] = useState<{ journeyId: string; journeyLegId: string } | null>(null);
  const [journeys, setJourneys] = useState<ApiStoredJourney[]>([]);
  const [notificationPage, setNotificationPage] = useState<ApiNotificationPage>({ items: [], nextCursor: null, unreadCount: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [offers, setOffers] = useState<ApiOffer[]>([]);
  const [myOffers, setMyOffers] = useState<ApiOffer[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [rendezvousSessions, setRendezvousSessions] = useState<Record<string, ApiRendezvous>>({});
  const rendezvousSessionsRef = useRef<Record<string, ApiRendezvous>>({});
  const [rendezvousBusyId, setRendezvousBusy] = useState<string | null>(null);
  const [bookingRescues, setBookingRescues] = useState<Record<string, { loading: boolean; failed: boolean; result?: ApiRescueResult }>>({});
  const [blockedUsers, setBlockedUsers] = useState<ApiBlockedUser[]>([]);
  const [vehicles, setVehicles] = useState<ApiVehicle[]>([]);
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, ApiVehiclePhoto[]>>({});
  const [verificationRecords, setVerificationRecords] = useState<ApiVerificationRecord[]>([]);
  const [myDemands, setMyDemands] = useState<ApiDemand[]>([]);
  const [passengerNavigationMatches, setPassengerNavigationMatches] = useState<ApiPassengerNavigationMatch[]>([]);
  const [openDemands, setOpenDemands] = useState<ApiDemand[]>([]);
  const [selectedDemand, setSelectedDemand] = useState<ApiDemand | null>(null);
  const [selectedDemandIsOwned, setSelectedDemandIsOwned] = useState(false);
  const [proposals, setProposals] = useState<ApiProposal[]>([]);
  const [proposalRevisions, setProposalRevisions] = useState<Record<string, ApiProposalRevision[]>>({});
  const [proposalTarget, setProposalTarget] = useState<ApiDemand | null>(null);
  const [proposalNavigationCandidateId, setProposalNavigationCandidateId] = useState<string | null>(null);
  const [counterTarget, setCounterTarget] = useState<ApiProposal | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [placeField, setPlaceField] = useState<'origin' | 'destination' | null>(null);
  const [placeSuggestions, setPlaceSuggestions] = useState<ApiPlace[]>([]);
  const [placeSearchBusy, setPlaceSearchBusy] = useState(false);
  const [demandOriginText, setDemandOriginText] = useState('');
  const [demandDestinationText, setDemandDestinationText] = useState('');
  const [demandOrigin, setDemandOrigin] = useState<ApiPlace | null>(null);
  const [demandDestination, setDemandDestination] = useState<ApiPlace | null>(null);
  const [offerOriginText, setOfferOriginText] = useState('');
  const [offerDestinationText, setOfferDestinationText] = useState('');
  const [offerOrigin, setOfferOrigin] = useState<ApiPlace | null>(null);
  const [offerDestination, setOfferDestination] = useState<ApiPlace | null>(null);
  const [offerPlaceField, setOfferPlaceField] = useState<'origin' | 'destination' | null>(null);
  const [offerPlaceSuggestions, setOfferPlaceSuggestions] = useState<ApiPlace[]>([]);
  const [offerDeparture, setOfferDeparture] = useState(() => defaultKyivDateTime(1, 8));
  const [offerPrice, setOfferPrice] = useState('150');
  const [offerSeats, setOfferSeats] = useState(1);
  const [offerVehicleId, setOfferVehicleId] = useState('');
  const [demandEarliest, setDemandEarliest] = useState(() => defaultKyivDateTime(1, 8));
  const [demandLatest, setDemandLatest] = useState(() => defaultKyivDateTime(1, 10));
  const [demandPassengers, setDemandPassengers] = useState(1);
  const [demandBudget, setDemandBudget] = useState('');
  const [demandBudgetType, setDemandBudgetType] = useState<'total_all' | 'per_seat'>('total_all');
  const [demandNotes, setDemandNotes] = useState('');
  const [demandRequirements, setDemandRequirements] = useState({ luggage: false, pets: false, childSeat: false });
  const [proposalPrice, setProposalPrice] = useState('');
  const [proposalDeparture, setProposalDeparture] = useState('');
  const [proposalComment, setProposalComment] = useState('');
  const [proposalVehicleId, setProposalVehicleId] = useState('');
  const [counterPrice, setCounterPrice] = useState('');
  const [counterDeparture, setCounterDeparture] = useState('');
  const [counterComment, setCounterComment] = useState('');
  const { tab, setTab, activateTab, route, setRoutePath, notFound, goHome } = useProductionTabRouter();
  const [showResults, setShowResults] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<ApiOffer | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<ApiStoredJourney | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ApiBooking | null>(null);
  const [visibleBookingTicket, setVisibleBookingTicket] = useState<{ bookingId: string; token: string } | null>(null);
  const [boardingTicketInput, setBoardingTicketInput] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [deletionRequest, setDeletionRequest] = useState<ApiAccountDeletionRequest | null>(null);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [verificationTarget, setVerificationTarget] = useState<ApiVehicle | null>(null);
  const [registrationEvidence, setRegistrationEvidence] = useState<File | null>(null);
  const [driverLicenseEvidence, setDriverLicenseEvidence] = useState<File | null>(null);
  const [adminQueue, setAdminQueue] = useState<ApiVerificationQueueItem[]>([]);
  const [moderationCases, setModerationCases] = useState<ApiModerationCase[]>([]);
  const [moderationNotes, setModerationNotes] = useState<Record<string, string>>({});
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportCategory, setReportCategory] = useState<ApiModerationCase['category']>('safety');
  const [reportDetails, setReportDetails] = useState('');
  const [reviewingRecord, setReviewingRecord] = useState<ApiVerificationQueueItem | null>(null);
  const [reviewEvidenceUrl, setReviewEvidenceUrl] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [vehicleForm, setVehicleForm] = useState({ make: '', model: '', modelYear: new Date().getFullYear(), seats: 4 });
  const routedEntityKey = useRef('');

  const refreshBookings = useCallback(async () => setBookings(await productionApi.bookings()), []);
  useEffect(() => { rendezvousSessionsRef.current = rendezvousSessions; }, [rendezvousSessions]);
  const refreshJourneys = useCallback(async () => setJourneys(await productionApi.journeys()), []);
  const refreshNotifications = useCallback(async () => setNotificationPage(await productionApi.notifications()), []);
  const refreshBlockedUsers = useCallback(async () => setBlockedUsers(await productionApi.blockedUsers()), []);
  const refreshMyOffers = useCallback(async () => setMyOffers(await productionApi.myOffers()), []);
  const refreshVehicles = useCallback(async () => {
    const [nextVehicles, nextVerification] = await Promise.all([productionApi.vehicles(), productionApi.verificationRecords()]);
    const photos = await Promise.all(nextVehicles.map(async (vehicle) => [vehicle.id, await productionApi.vehiclePhotos(vehicle.id).catch(() => [])] as const));
    setVehicles(nextVehicles); setVerificationRecords(nextVerification); setVehiclePhotos(Object.fromEntries(photos));
  }, []);
  const refreshMyDemands = useCallback(async () => setMyDemands(await productionApi.myDemands()), []);
  const refreshPassengerNavigationMatches = useCallback(async () => setPassengerNavigationMatches(await productionApi.myNavigationMatches()), []);
  const refreshOpenDemands = useCallback(async () => setOpenDemands(await productionApi.openDemands()), []);
  const refreshAdminQueue = useCallback(async () => setAdminQueue(await productionApi.adminVerificationQueue()), []);
  const refreshModerationCases = useCallback(async () => setModerationCases(await productionApi.moderationCases('all')), []);

  useEffect(() => {
    if (!user || loading || tab !== 'admin' || !user.roles.some((role) => role === 'admin' || role === 'moderator')) return;
    void Promise.all([refreshAdminQueue(), refreshModerationCases()]).catch((error: unknown) => {
      setStatusMessage(error instanceof Error ? error.message : 'Черга модерації недоступна.');
    });
  }, [loading, refreshAdminQueue, refreshModerationCases, tab, user?.id, user?.roles.join(',')]);
  const loadOffers = useCallback(async () => {
    const next = await productionApi.offers({
      origin: origin.trim(), destination: destination.trim(), date, seats,
      ...(searchOriginPlace && searchDestinationPlace ? {
        originCoordinates: [searchOriginPlace.longitude, searchOriginPlace.latitude] as [number, number],
        destinationCoordinates: [searchDestinationPlace.longitude, searchDestinationPlace.latitude] as [number, number],
      } : {}),
    });
    setOffers(next);
    return next;
  }, [date, destination, origin, seats, searchDestinationPlace, searchOriginPlace]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
    void StatusBar.setStyle({ style: user ? Style.Light : Style.Dark }).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    productionApi.restoreSession().then(async () => {
      const currentUser = await productionApi.me();
      setUser(currentUser);
      const [currentDeletionRequest] = await Promise.all([productionApi.accountDeletionRequest(), refreshBookings(), refreshJourneys(), refreshNotifications(), refreshVehicles(), refreshBlockedUsers(), ...(currentUser.roles.includes('driver') ? [refreshMyOffers(), refreshOpenDemands()] : []), ...(currentUser.roles.includes('passenger') ? [refreshMyDemands(), refreshPassengerNavigationMatches()] : [])]);
      setDeletionRequest(currentDeletionRequest);
    }).catch(() => undefined).finally(() => setLoading(false));
  }, [refreshBlockedUsers, refreshBookings, refreshJourneys, refreshMyOffers, refreshPassengerNavigationMatches, refreshVehicles]);

  useEffect(() => {
    const entityId = route?.entityId;
    if (!user || loading || !route || route.kind === 'tab' || !entityId) {
      routedEntityKey.current = '';
      return;
    }
    const key = `${user.id}:${route.kind}:${entityId}`;
    if (routedEntityKey.current === key) return;
    routedEntityKey.current = key;
    let active = true;
    const load = async () => {
      try {
        if (route.kind === 'offer') {
          const offer = await productionApi.offer(entityId);
          if (!active) return;
          setSelectedJourney(null); setSelectedOffer(offer); activateTab('search');
        } else if (route.kind === 'booking') {
          const currentBookings = await productionApi.bookings();
          const booking = currentBookings.find((item) => item.id === entityId);
          if (!booking) throw new Error('Бронювання недоступне для цього облікового запису.');
          if (!active) return;
          setBookings(currentBookings); setSelectedOffer(null); setSelectedJourney(null); activateTab('trips');
        } else if (route.kind === 'demand') {
          let demand: ApiDemand | undefined;
          let owned = false;
          if (user.roles.includes('passenger')) {
            const mine = await productionApi.myDemands();
            demand = mine.find((item) => item.id === entityId);
            owned = Boolean(demand);
            if (active) setMyDemands(mine);
          }
          if (!demand && user.roles.includes('driver')) demand = await productionApi.openDemand(entityId);
          if (!demand) throw new Error('Заявка недоступна для цього облікового запису.');
          const nextProposals = await productionApi.demandProposals(entityId).catch(() => []);
          if (!active) return;
          setSelectedDemand(demand); setSelectedDemandIsOwned(owned); setProposals(nextProposals);
          activateTab(owned ? 'my-demands' : 'requests');
        } else if (route.kind === 'journey') {
          const journey = await productionApi.journey(entityId);
          if (!active) return;
          setSelectedOffer(null); setSelectedJourney(journey); activateTab('trips');
        } else if (route.kind === 'conversation') {
          const conversation = await productionApi.conversationById(entityId);
          const currentBookings = await productionApi.bookings();
          const booking = currentBookings.find((item) => item.id === conversation.booking_id);
          if (!booking) throw new Error('Розмова недоступна для цього облікового запису.');
          const history = await productionApi.messages(conversation.id);
          if (!active) return;
          setBookings(currentBookings); setSelectedBooking(booking); setMessages(history); activateTab('chat');
        }
      } catch (error) {
        if (!active) return;
        setStatusMessage(error instanceof Error ? error.message : 'Посилання більше недоступне. Перевірте доступ і спробуйте ще раз.');
        activateTab(route.tab);
      }
    };
    void load();
    return () => { active = false; };
  }, [activateTab, loading, route?.entityId, route?.kind, route?.tab, user?.id, user?.roles.join(',')]);

  useEffect(() => {
    if (!user) return;
    return productionApi.subscribeRealtime((event) => {
      void refreshNotifications().catch(() => undefined);
      if (event.type === 'journey.updated') {
        void refreshJourneys().catch(() => setStatusMessage('Маршрут не оновився. Оновіть список поїздок.'));
        setStatusMessage(event.data.state === 'READY' ? 'Ваш маршрут готов, бронювання збережене.' : 'Стан маршруту змінився. Перевірте актуальні варіанти.');
        return;
      }
      if (event.type.startsWith('booking.')) {
        void Promise.all([refreshBookings(), ...(user.roles.includes('driver') ? [refreshMyOffers()] : [])])
          .catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Стан бронювання не оновився.'));
        return;
      }
      if (event.type.startsWith('rendezvous.')) {
        if ('rendezvous_id' in event.data) {
          const rendezvousId = event.data.rendezvous_id;
          const session = Object.values(rendezvousSessionsRef.current).find((item) => item.id === rendezvousId);
          if (session) void productionApi.bookingRendezvous(session.bookingId).then((next) => setRendezvousSessions((current) => ({ ...current, [session.bookingId]: next }))).catch(() => undefined);
        }
        return;
      }
      if (event.type === 'navigation.match.driver-interested') {
        if (user.roles.includes('passenger')) {
          void refreshPassengerNavigationMatches()
            .then(() => setStatusMessage('Водій зацікавився вашою заявкою на маршрут.'))
            .catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Не вдалося оновити пропозиції водіїв.'));
        }
        return;
      }
      if (!event.type.startsWith('proposal.')) return;
      const refreshes: Promise<unknown>[] = [];
      if (user.roles.includes('driver')) refreshes.push(refreshOpenDemands());
      if (user.roles.includes('passenger')) refreshes.push(refreshMyDemands());
      if (selectedDemand) refreshes.push(productionApi.demandProposals(selectedDemand.id).then(setProposals));
      void Promise.all(refreshes).catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Цінова пропозиція змінилася. Оновіть список.'));
    }, () => undefined);
  }, [refreshBookings, refreshJourneys, refreshMyDemands, refreshMyOffers, refreshNotifications, refreshOpenDemands, selectedDemand?.id, user?.id, user?.roles.join(',')]);

  useEffect(() => {
    if (!user) return;
    const pending = bookings.filter(booking => booking.status === 'cancelled' && !booking.current_user_is_driver && !bookingRescues[booking.id]);
    if (!pending.length) return;
    setBookingRescues(current => ({
      ...current,
      ...Object.fromEntries(pending.map(booking => [booking.id, { loading: true, failed: false }])),
    }));
    for (const booking of pending) {
      void productionApi.bookingRescue(booking.id)
        .then(result => setBookingRescues(current => ({ ...current, [booking.id]: { loading: false, failed: false, result } })))
        .catch(() => setBookingRescues(current => ({ ...current, [booking.id]: { loading: false, failed: true } })));
    }
  }, [bookingRescues, bookings, user?.id]);

  useEffect(() => {
    if (!user || tab !== 'trips') return;
    // Keep the cross-device trip state fresh if a realtime connection is temporarily unavailable.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshBookings().catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Стан поїздок не оновився.'));
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refreshBookings, tab, user?.id]);

  useEffect(() => {
    if (tab !== 'chat' || !selectedBooking) { setRealtimeConnected(false); return; }
    let disposed = false;
    let unsubscribe: () => void = () => { /* No socket exists until the conversation is resolved. */ };
    void productionApi.conversation(selectedBooking.id).then((conversation) => {
      if (disposed) return;
      unsubscribe = productionApi.subscribeRealtime((event) => {
        if (event.type !== 'conversation.message.created') return;
        if (event.data.conversation_id !== conversation.id) return;
        setMessages((current) => current.some((message) => message.id === event.data.id)
          ? current : [...current, event.data]);
      }, (connected) => {
        setRealtimeConnected(connected);
        if (connected) void productionApi.messages(conversation.id).then((history) => {
          if (disposed) return;
          setMessages((current) => {
            const merged = new Map(history.map((message) => [message.id, message]));
            for (const message of current) merged.set(message.id, message);
            return [...merged.values()].sort((left, right) => left.created_at.localeCompare(right.created_at));
          });
        }).catch(() => undefined);
      });
    }).catch((error: unknown) => {
      if (!disposed) setStatusMessage(error instanceof Error ? error.message : 'Чат недоступний.');
    });
    return () => { disposed = true; unsubscribe(); setRealtimeConnected(false); };
  }, [selectedBooking?.id, tab]);

  const requestOtp = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setStatusMessage('');
    try {
      const result = await productionApi.requestOtp(phone, name);
      setOtpRequested(true); setDevCode(result.developmentCode ?? '');
      setStatusMessage(result.delivery === 'development' ? 'Код тестового середовища показано нижче.' : 'Код надіслано SMS.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося запросити код.'); }
    finally { setBusy(false); }
  };

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setStatusMessage('');
    try {
      const currentUser = await productionApi.verifyOtp(phone, code);
      setUser(currentUser);
      const refreshedUser = await productionApi.me(); setUser(refreshedUser);
      await Promise.all([refreshBookings(), refreshJourneys(), refreshVehicles(), refreshBlockedUsers(), ...(refreshedUser.roles.includes('driver') ? [refreshMyOffers(), refreshOpenDemands()] : []), ...(refreshedUser.roles.includes('passenger') ? [refreshMyDemands(), refreshPassengerNavigationMatches()] : [])]);
      setShowLogin(false);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Код не прийнято.'); }
    finally { setBusy(false); }
  };

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!origin.trim() || !destination.trim()) { setStatusMessage('Вкажіть місто відправлення та призначення.'); return; }
    if (!searchOriginPlace || !searchDestinationPlace) { setStatusMessage('Оберіть обидві точки зі справжніх результатів геокодера.'); return; }
    setBusy(true); setStatusMessage('');
    try { setJourneyResult(null); await loadOffers(); setShowResults(true); setTab('search'); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Пошук не вдався.'); }
    finally { setBusy(false); }
  };

  const searchJourney = async () => {
    if (!origin.trim() || !destination.trim()) { setStatusMessage('Вкажіть початок і кінець маршруту.'); return; }
    if (!searchOriginPlace || !searchDestinationPlace) { setStatusMessage('Для планування оберіть обидві точки з результатів геокодера.'); return; }
    const departure = kyivDateTimeInputToDate(journeyDeparture);
    if (!departure || departure.getTime() <= Date.now()) { setStatusMessage('Оберіть коректний майбутній час за київським часом.'); return; }
    setBusy(true); setStatusMessage('');
    try {
      const result = await productionApi.searchJourneys({
        origin: { name: searchOriginPlace.label, coordinates: [searchOriginPlace.longitude, searchOriginPlace.latitude] },
        destination: { name: searchDestinationPlace.label, coordinates: [searchDestinationPlace.longitude, searchDestinationPlace.latitude] },
        departureAt: departure.toISOString(), passengers: seats, strategy: journeyStrategy,
      });
      setJourneyResult(result); setShowResults(true); setTab('search');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося побудувати маршрут.'); }
    finally { setBusy(false); }
  };

  const openJourneyOffer = async (offerId: string, journeyId: string, journeyLegId: string) => {
    setBusy(true); setStatusMessage('');
    try {
      const offer = await productionApi.offer(offerId);
      setJourneyBookingLink({ journeyId, journeyLegId });
      setSelectedOffer(offer);
      setSelectedJourney(null);
      setRoutePath(pathForProductionEntity('offer', offerId));
    }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Пропозиція більше недоступна. Оновіть пошук.'); }
    finally { setBusy(false); }
  };

  const searchRoutePlace = async (field: 'origin' | 'destination') => {
    const query = field === 'origin' ? origin.trim() : destination.trim();
    if (query.length < 3) { setStatusMessage('Введіть щонайменше 3 символи для пошуку місця.'); return; }
    setRoutePlaceField(field); setRoutePlaceSuggestions([]); setPlaceSearchBusy(true); setStatusMessage('');
    try { setRoutePlaceSuggestions(await productionApi.suggestPlaces(query)); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Пошук місця недоступний.'); }
    finally { setPlaceSearchBusy(false); }
  };

  const chooseSearchPlace = (place: ApiPlace) => {
    if (routePlaceField === 'origin') { setSearchOriginPlace(place); setOrigin(place.label); }
    if (routePlaceField === 'destination') { setSearchDestinationPlace(place); setDestination(place.label); }
    setRoutePlaceSuggestions([]); setRoutePlaceField(null);
  };

  const book = async (offer: ApiOffer) => {
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.book(offer.id, seats, journeyBookingLink ?? undefined);
      setStatusMessage(journeyBookingLink
        ? 'Місце заброньовано. Journey оновлено сервером і збережено як готовий маршрут.'
        : 'Місця заброньовано. Підтвердження збережено на сервері.');
      // Booking is already committed by the API. A background refresh of an
      // incomplete search form must not turn that success into a UI error.
      await refreshBookings();
      if (journeyBookingLink) await refreshJourneys();
      if (origin.trim() && destination.trim() && searchOriginPlace && searchDestinationPlace) {
        void loadOffers().catch(() => undefined);
      }
      setSelectedOffer(null); setJourneyBookingLink(null); setTab('trips');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося створити бронювання.'); }
    finally { setBusy(false); }
  };

  const cancelTrip = async (booking: ApiBooking) => {
    if (!window.confirm('Скасувати бронювання? Місця буде повернено поїздці.')) return;
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.cancelBooking(booking.id);
      await refreshBookings();
      setStatusMessage(booking.current_user_is_driver
        ? 'Бронювання скасовано на сервері, місця повернено. Пасажиру надіслано оновлення.'
        : 'Бронювання скасовано. Перевіряємо актуальні поїздки поруч із цим маршрутом.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося скасувати бронювання.'); }
    finally { setBusy(false); }
  };

  const showBookingTicket = async (booking: ApiBooking) => {
    setBusy(true); setStatusMessage('');
    try {
      const ticket = await productionApi.bookingTicket(booking.id);
      setVisibleBookingTicket({ bookingId: booking.id, token: ticket.token });
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Квиток недоступний.'); }
    finally { setBusy(false); }
  };

  const loadRendezvous = async (booking: ApiBooking) => {
    setRendezvousBusy(booking.id); setStatusMessage('');
    try { const session = await productionApi.bookingRendezvous(booking.id); setRendezvousSessions((current) => ({ ...current, [booking.id]: session })); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Зустріч поки недоступна.'); }
    finally { setRendezvousBusy(null); }
  };

  const activateRendezvous = async (booking: ApiBooking) => {
    setRendezvousBusy(booking.id); setStatusMessage('');
    try { const session = await productionApi.activateRendezvous(booking.id); setRendezvousSessions((current) => ({ ...current, [booking.id]: session })); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося активувати обмін місцем.'); }
    finally { setRendezvousBusy(null); }
  };

  const sendRendezvousLocation = async (booking: ApiBooking) => {
    const session = rendezvousSessions[booking.id];
    if (!session || !navigator.geolocation) { setStatusMessage('Геолокація недоступна на цьому пристрої.'); return; }
    setRendezvousBusy(booking.id); setStatusMessage('');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }));
      await productionApi.sendRendezvousLocation(session.id, { longitude: position.coords.longitude, latitude: position.coords.latitude, accuracyMeters: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() });
      const next = await productionApi.bookingRendezvous(booking.id);
      setRendezvousSessions((current) => ({ ...current, [booking.id]: next }));
      setStatusMessage('Поточне місце надіслано учаснику бронювання. Воно автоматично зникне за 5 хвилин.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося отримати геолокацію. Перевірте дозвіл пристрою.'); }
    finally { setRendezvousBusy(null); }
  };

  const rendezvousAction = async (booking: ApiBooking, action: 'approaching' | 'arrived' | 'delayed') => {
    const session = rendezvousSessions[booking.id];
    if (!session) return;
    setRendezvousBusy(booking.id); setStatusMessage('');
    try {
      await productionApi.rendezvousStatus(session.id, action);
      const next = await productionApi.bookingRendezvous(booking.id);
      setRendezvousSessions((current) => ({ ...current, [booking.id]: next }));
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося оновити статус зустрічі.'); }
    finally { setRendezvousBusy(null); }
  };

  const rendezvousBoarding = async (booking: ApiBooking) => {
    const session = rendezvousSessions[booking.id];
    if (!session) return;
    setRendezvousBusy(booking.id); setStatusMessage('');
    try {
      await productionApi.rendezvousBoarding(session.id);
      const next = await productionApi.bookingRendezvous(booking.id);
      setRendezvousSessions((current) => ({ ...current, [booking.id]: next }));
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Посадка ще не готова.'); }
    finally { setRendezvousBusy(null); }
  };

  const endRendezvous = async (booking: ApiBooking) => {
    const session = rendezvousSessions[booking.id];
    if (!session) return;
    setRendezvousBusy(booking.id); setStatusMessage('');
    try {
      await productionApi.endRendezvous(session.id);
      const next = await productionApi.bookingRendezvous(booking.id);
      setRendezvousSessions((current) => ({ ...current, [booking.id]: next }));
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося завершити обмін місцем.'); }
    finally { setRendezvousBusy(null); }
  };

  const confirmBoarding = async (booking: ApiBooking) => {
    const ticket = boardingTicketInput[booking.id]?.trim();
    if (!ticket) { setStatusMessage('Введіть підписаний токен квитка пасажира.'); return; }
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.markBoarding(booking.id, ticket);
      setBoardingTicketInput((current) => ({ ...current, [booking.id]: '' }));
      await refreshBookings();
      setStatusMessage('Посадку підтверджено сервером.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося підтвердити посадку.'); }
    finally { setBusy(false); }
  };

  const startTrip = async (booking: ApiBooking) => {
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.startTrip(booking.id);
      await refreshBookings();
      setStatusMessage('Початок поїздки збережено на сервері.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося розпочати поїздку.'); }
    finally { setBusy(false); }
  };

  const confirmTripCompletion = async (booking: ApiBooking) => {
    setBusy(true); setStatusMessage('');
    try {
      const result = await productionApi.confirmTripCompletion(booking.id);
      await refreshBookings();
      setStatusMessage(result.status === 'completed' ? 'Поїздку завершено за підтвердженнями обох учасників.' : `Завершення підтверджено вами · ${result.confirmations} з ${result.requiredConfirmations}. Очікуємо другого учасника.`);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося підтвердити завершення.'); }
    finally { setBusy(false); }
  };

  const openChat = async (booking: ApiBooking) => {
    setSelectedBooking(booking); setBusy(true); setStatusMessage('');
    try {
      const conversation = await productionApi.conversation(booking.id);
      setMessages(await productionApi.messages(conversation.id)); setRoutePath(pathForProductionEntity('conversation', conversation.id));
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Чат недоступний.'); }
    finally { setBusy(false); }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedBooking || !messageDraft.trim()) return;
    setBusy(true);
    try {
      const conversation = await productionApi.conversation(selectedBooking.id);
      const sent = await productionApi.sendMessage(conversation.id, messageDraft.trim());
      setMessages((current) => current.some((message) => message.id === sent.id)
        ? current : [...current, { ...sent, sender_name: user?.display_name ?? sent.sender_name }]); setMessageDraft('');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Повідомлення не надіслано.'); }
    finally { setBusy(false); }
  };

  const searchPlace = async (field: 'origin' | 'destination') => {
    const query = field === 'origin' ? demandOriginText.trim() : demandDestinationText.trim();
    if (query.length < 3) { setStatusMessage('Введіть щонайменше 3 символи для пошуку місця.'); return; }
    setPlaceField(field); setPlaceSearchBusy(true); setPlaceSuggestions([]); setStatusMessage('');
    try { setPlaceSuggestions(await productionApi.suggestPlaces(query)); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Пошук місця недоступний.'); }
    finally { setPlaceSearchBusy(false); }
  };

  const searchOfferPlace = async (field: 'origin' | 'destination') => {
    const query = field === 'origin' ? offerOriginText.trim() : offerDestinationText.trim();
    if (query.length < 3) { setStatusMessage('Введіть щонайменше 3 символи для пошуку місця.'); return; }
    setOfferPlaceField(field); setOfferPlaceSuggestions([]); setPlaceSearchBusy(true); setStatusMessage('');
    try { setOfferPlaceSuggestions(await productionApi.suggestPlaces(query)); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Пошук місця недоступний.'); }
    finally { setPlaceSearchBusy(false); }
  };

  const chooseOfferPlace = (place: ApiPlace) => {
    if (offerPlaceField === 'origin') { setOfferOrigin(place); setOfferOriginText(place.label); }
    if (offerPlaceField === 'destination') { setOfferDestination(place); setOfferDestinationText(place.label); }
    setOfferPlaceSuggestions([]); setOfferPlaceField(null);
  };

  const publishOffer = async (event: FormEvent) => {
    event.preventDefault();
    const vehicle = vehicles.find((item) => item.id === offerVehicleId && item.verification_status === 'verified');
    const departure = kyivDateTimeInputToDate(offerDeparture);
    const priceMinor = Math.round(Number(offerPrice.replace(',', '.')) * 100);
    if (!offerOrigin || !offerDestination) { setStatusMessage('Оберіть звідки й куди зі справжніх результатів геокодера.'); return; }
    if (!vehicle) { setStatusMessage('Оберіть своє авто після проходження перевірки.'); return; }
    if (!departure || departure <= new Date()) { setStatusMessage('Час відправлення має бути коректним київським часом у майбутньому.'); return; }
    if (!Number.isInteger(priceMinor) || priceMinor < 1) { setStatusMessage('Ціна за місце має бути більшою за 0.'); return; }
    if (!Number.isInteger(offerSeats) || offerSeats < 1 || offerSeats > vehicle.seat_count) { setStatusMessage('Кількість місць не може перевищувати місткість авто.'); return; }
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.createOffer({
        vehicleId: vehicle.id, originName: offerOrigin.label, destinationName: offerDestination.label,
        origin: [offerOrigin.longitude, offerOrigin.latitude], destination: [offerDestination.longitude, offerDestination.latitude],
        departureAt: departure.toISOString(), pricePerSeatMinor: priceMinor, seats: offerSeats,
      });
      await Promise.all([refreshMyOffers(), refreshBookings()]);
      setStatusMessage('Поїздку збережено на сервері. Вона з’явиться у ваших поїздках після оновлення.');
      setOfferOrigin(null); setOfferDestination(null); setOfferOriginText(''); setOfferDestinationText('');
      setOfferPlaceSuggestions([]); setTab('trips');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося опублікувати поїздку.'); }
    finally { setBusy(false); }
  };

  const choosePlace = (place: ApiPlace) => {
    if (placeField === 'origin') { setDemandOrigin(place); setDemandOriginText(place.label); }
    if (placeField === 'destination') { setDemandDestination(place); setDemandDestinationText(place.label); }
    setPlaceSuggestions([]); setPlaceField(null);
  };

  const publishDemand = async (event: FormEvent) => {
    event.preventDefault();
    if (!demandOrigin || !demandDestination) { setStatusMessage('Оберіть обидва місця зі справжніх результатів геокодера.'); return; }
    const earliest = kyivDateTimeInputToDate(demandEarliest); const latest = kyivDateTimeInputToDate(demandLatest);
    if (!earliest || !latest || latest < earliest) { setStatusMessage('Перевірте часовий інтервал за київським часом.'); return; }
    const budget = demandBudget.trim() ? Math.round(Number(demandBudget.replace(',', '.')) * 100) : undefined;
    if (demandBudget.trim() && (!Number.isFinite(budget) || budget! < 1)) { setStatusMessage('Бюджет має бути додатною сумою.'); return; }
    setBusy(true); setStatusMessage('');
    try {
      const demand = await productionApi.createDemand({
        originName: demandOrigin.label, destinationName: demandDestination.label,
        origin: [demandOrigin.longitude, demandOrigin.latitude], destination: [demandDestination.longitude, demandDestination.latitude],
        earliestDeparture: earliest.toISOString(), latestDeparture: latest.toISOString(), passengers: demandPassengers,
        ...(budget === undefined ? {} : { budgetMinor: budget }), budgetType: demandBudgetType, notes: demandNotes, requirements: demandRequirements,
      });
      setStatusMessage('Заявку опубліковано на сервері.');
      await refreshMyDemands(); setSelectedDemand(demand); setSelectedDemandIsOwned(true); setProposals([]); setRoutePath(pathForProductionEntity('demand', demand.id)); activateTab('my-demands');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося опублікувати заявку.'); }
    finally { setBusy(false); }
  };

  const viewDemand = async (demand: ApiDemand, isOwned: boolean) => {
    setSelectedDemand(demand); setSelectedDemandIsOwned(isOwned); setProposals([]); setProposalRevisions({}); setBusy(true); setStatusMessage('');
    try { setProposals(await productionApi.demandProposals(demand.id).catch(() => [])); setRoutePath(pathForProductionEntity('demand', demand.id)); activateTab(isOwned ? 'my-demands' : 'requests'); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося завантажити пропозиції.'); }
    finally { setBusy(false); }
  };

  const openNavigationDemand = async (demandId: string, candidateId: string) => {
    setBusy(true); setStatusMessage('');
    try {
      const demands = await productionApi.openDemands();
      setOpenDemands(demands);
      const demand = demands.find((item) => item.id === demandId);
      if (!demand) { setStatusMessage('Заявка вже недоступна або закрита.'); return; }
      await viewDemand(demand, false);
      setProposalNavigationCandidateId(candidateId);
      setProposalTarget(demand);
      setProposalDeparture(formatKyivDateTimeInput(demand.earliest_departure));
      const proposedTotal = demand.budget_minor === null ? null : demand.budget_minor / 100 * (demand.budget_type === 'per_seat' ? demand.passenger_count : 1);
      setProposalPrice(proposedTotal === null ? '' : String(proposedTotal.toFixed(2)));
      const verified = vehicles.find((vehicle) => vehicle.verification_status === 'verified' && vehicle.is_active) ?? vehicles.find((vehicle) => vehicle.verification_status === 'verified');
      setProposalVehicleId(verified?.id ?? '');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося відкрити заявку пасажира.'); }
    finally { setBusy(false); }
  };

  const loadProposalHistory = async (proposalId: string) => {
    setBusy(true);
    try { const history = await productionApi.proposalRevisions(proposalId); setProposalRevisions((current) => ({ ...current, [proposalId]: history })); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Історія переговорів недоступна.'); }
    finally { setBusy(false); }
  };

  const sendProposal = async (event: FormEvent) => {
    event.preventDefault();
    if (!proposalTarget) return;
    const amount = Math.round(Number(proposalPrice.replace(',', '.')) * 100);
    const departureAt = kyivDateTimeInputToIso(proposalDeparture);
    if (!Number.isInteger(amount) || amount < 1 || !departureAt || !proposalVehicleId) { setStatusMessage('Потрібні перевірений автомобіль, коректний київський час і ціна більша за 0.'); return; }
    setBusy(true);
    try {
      await productionApi.createProposal(proposalTarget.id, { vehicleId: proposalVehicleId, priceMinor: amount, departureAt, comment: proposalComment, ...(proposalNavigationCandidateId ? { navigationCandidateId: proposalNavigationCandidateId } : {}) });
      setProposalTarget(null); setProposalNavigationCandidateId(null); setStatusMessage('Цінову пропозицію надіслано пасажиру.'); await refreshOpenDemands();
      await viewDemand(proposalTarget, false);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося надіслати пропозицію.'); }
    finally { setBusy(false); }
  };

  const sendCounter = async (event: FormEvent) => {
    event.preventDefault();
    if (!counterTarget) return;
    const amount = Math.round(Number(counterPrice.replace(',', '.')) * 100);
    const departureAt = kyivDateTimeInputToIso(counterDeparture);
    if (!Number.isInteger(amount) || amount < 1 || !departureAt) { setStatusMessage('Вкажіть додатну ціну й коректний київський час виїзду.'); return; }
    setBusy(true);
    try {
      await productionApi.counterProposal(counterTarget.id, { priceMinor: amount, departureAt, comment: counterComment });
      setCounterTarget(null); setStatusMessage('Зустрічну пропозицію збережено.');
      if (selectedDemand) await viewDemand(selectedDemand, selectedDemandIsOwned);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося оновити пропозицію.'); }
    finally { setBusy(false); }
  };

  const agreeProposal = async (proposal: ApiProposal) => {
    setBusy(true);
    try {
      await productionApi.agreeProposal(proposal.id); setStatusMessage('Ви погодили ціну. Пасажир має підтвердити бронювання.');
      if (selectedDemand) await viewDemand(selectedDemand, selectedDemandIsOwned);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося погодити ціну.'); }
    finally { setBusy(false); }
  };

  const confirmProposal = async (proposal: ApiProposal) => {
    setBusy(true);
    try {
      await productionApi.acceptProposal(proposal.id); setStatusMessage('Домовленість підтверджено; бронювання створено на сервері.');
      await Promise.all([refreshBookings(), refreshMyDemands()]); setSelectedDemand(null); setTab('trips');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося підтвердити бронювання.'); }
    finally { setBusy(false); }
  };

  const confirmNavigationMatch = async (candidateId: string) => {
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.confirmNavigationMatch(candidateId);
      await refreshPassengerNavigationMatches();
      setStatusMessage('Взаємний інтерес підтверджено. Ціну та бронювання ще не погоджено — це окремий наступний крок.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося підтвердити взаємний інтерес.'); }
    finally { setBusy(false); }
  };

  const cancelDemand = async (demand: ApiDemand) => {
    setBusy(true);
    try { await productionApi.cancelDemand(demand.id); await refreshMyDemands(); setStatusMessage('Заявку скасовано.'); if (selectedDemand?.id===demand.id) setSelectedDemand(null); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося скасувати заявку.'); }
    finally { setBusy(false); }
  };

  const createVehicle = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await productionApi.createVehicle(vehicleForm); await refreshVehicles(); setShowVehicleForm(false);
      setStatusMessage('Автомобіль додано. Перевірка профілю водія може бути потрібна перед публікацією поїздки.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося додати автомобіль.'); }
    finally { setBusy(false); }
  };

  const uploadVehiclePhoto = async (vehicleId: string, file: File) => {
    setBusy(true); setStatusMessage('');
    try {
      const photo = await productionApi.uploadVehiclePhoto(vehicleId, file);
      setVehiclePhotos((current) => ({ ...current, [vehicleId]: [...(current[vehicleId] ?? []), photo] }));
      setStatusMessage('Фото автомобіля завантажено до приватного сховища.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося завантажити фото.'); }
    finally { setBusy(false); }
  };

  const setPrimaryVehiclePhoto = async (vehicleId: string, photoId: string) => {
    setBusy(true);
    try { await productionApi.setPrimaryVehiclePhoto(vehicleId, photoId); await refreshVehicles(); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося змінити головне фото.'); }
    finally { setBusy(false); }
  };

  const deleteVehiclePhoto = async (vehicleId: string, photoId: string) => {
    setBusy(true);
    try { await productionApi.deleteVehiclePhoto(vehicleId, photoId); await refreshVehicles(); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося видалити фото.'); }
    finally { setBusy(false); }
  };

  const submitVerification = async (event: FormEvent) => {
    event.preventDefault();
    if (!verificationTarget || !registrationEvidence || !driverLicenseEvidence) {
      setStatusMessage('Додайте техпаспорт і посвідчення водія.'); return;
    }
    const acceptedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
    const files = [registrationEvidence, driverLicenseEvidence];
    if (files.some((file) => !acceptedTypes.has(file.type) || file.size < 1 || file.size > 8 * 1024 * 1024)) {
      setStatusMessage('Дозволені JPEG, PNG або PDF до 8 МБ кожен.'); return;
    }
    setBusy(true); setStatusMessage('');
    try {
      const [registration, license] = await Promise.all([
        productionApi.uploadVerificationEvidence(verificationTarget.id, registrationEvidence),
        productionApi.uploadVerificationEvidence(verificationTarget.id, driverLicenseEvidence),
      ]);
      await productionApi.submitVehicleVerification(verificationTarget.id, {
        registrationEvidenceKey: registration.key, registrationContentType: registration.contentType,
        driverLicenseEvidenceKey: license.key, driverLicenseContentType: license.contentType,
      });
      await refreshVehicles(); setVerificationTarget(null); setRegistrationEvidence(null); setDriverLicenseEvidence(null);
      setStatusMessage('Документи передано на перевірку. Статус авто оновиться після рішення модератора.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося передати документи.'); }
    finally { setBusy(false); }
  };

  const openVerificationEvidence = async (record: ApiVerificationQueueItem) => {
    setBusy(true); setStatusMessage('');
    try {
      const evidence = await productionApi.adminVerificationEvidence(record.id);
      setReviewingRecord(record); setReviewEvidenceUrl(evidence.url); setReviewNote('');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Документ недоступний для перевірки.'); }
    finally { setBusy(false); }
  };

  const decideVerification = async (decision: 'approved' | 'rejected') => {
    if (!reviewingRecord) return;
    if (decision === 'rejected' && reviewNote.trim().length < 3) { setStatusMessage('Для відмови вкажіть коротку причину.'); return; }
    setBusy(true);
    try {
      await productionApi.decideVerification(reviewingRecord.id, decision, reviewNote.trim());
      setReviewingRecord(null); setReviewEvidenceUrl(''); setReviewNote(''); await refreshAdminQueue();
      setStatusMessage(decision === 'approved' ? 'Документ схвалено.' : 'Документ відхилено із зазначеною причиною.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Рішення не збережено.'); }
    finally { setBusy(false); }
  };

  const enableDriver = async () => {
    if (!user) return;
    setBusy(true);
    try { await productionApi.enableRole('driver'); setUser({ ...user, roles: [...new Set([...user.roles, 'driver'])] }); await Promise.all([refreshOpenDemands(), refreshMyOffers()]); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося змінити роль.'); }
    finally { setBusy(false); }
  };

  const blockBookingContact = async () => {
    if (!selectedBooking) return;
    const contactName = selectedBooking.current_user_is_driver ? selectedBooking.passenger_name : selectedBooking.driver_name;
    if (!window.confirm(`Заблокувати ${contactName}? Чат і нові пропозиції між вами будуть недоступні. Наявне бронювання не скасується.`)) return;
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.blockBookingOther(selectedBooking.id);
      await refreshBlockedUsers();
      setMessages([]); setRealtimeConnected(false); setSelectedBooking(null); setTab((currentTab) => currentTab === 'chat' ? 'trips' : currentTab);
      setStatusMessage(`${contactName} заблоковано. Бронювання залишилось у списку поїздок.`);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося заблокувати користувача.'); }
    finally { setBusy(false); }
  };

  const unblockContact = async (blocked: ApiBlockedUser) => {
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.unblockUser(blocked.user_id);
      await refreshBlockedUsers();
      setStatusMessage(`${blocked.display_name} розблоковано.`);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося розблокувати користувача.'); }
    finally { setBusy(false); }
  };

  const submitSafetyReport = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedBooking || reportDetails.trim().length < 10) return;
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.createReport({ bookingId: selectedBooking.id, category: reportCategory, details: reportDetails.trim() });
      setShowReportForm(false); setReportDetails(''); setSelectedBooking(null); setMessages([]); setTab('trips');
      setStatusMessage('Скаргу передано команді безпеки. Її перевірить уповноважений модератор.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося передати скаргу.'); }
    finally { setBusy(false); }
  };

  const reviewModerationCase = async (report: ApiModerationCase, status: 'in_review' | 'resolved' | 'dismissed', action?: 'no_action' | 'suspend_account') => {
    const note = moderationNotes[report.id]?.trim();
    if (status !== 'in_review' && (!action || (note?.length ?? 0) < 3)) { setStatusMessage('Для закриття скарги потрібне рішення та короткий коментар.'); return; }
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.reviewModerationCase(report.id, { status, ...(action ? { action } : {}), ...(note ? { note } : {}) });
      await refreshModerationCases();
      setStatusMessage(status === 'in_review' ? 'Скаргу взято в роботу.' : action === 'suspend_account' ? 'Акаунт призупинено, активні сесії відкликано.' : status === 'dismissed' ? 'Скаргу закрито без підтвердження порушення.' : 'Розгляд скарги завершено.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося оновити скаргу.'); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    const activeNavigation = await productionApi.activeNavigation().catch(() => null);
    if (activeNavigation) await productionApi.endNavigation(activeNavigation.id).catch(() => undefined);
    await productionApi.logout().catch(() => undefined);
    new OfflineNavigationStore().clear();
    setUser(null); setBookings([]); setJourneys([]); setNotificationPage({ items: [], nextCursor: null, unreadCount: 0 }); setShowNotifications(false); setBlockedUsers([]); setVehicles([]); setOffers([]); setShowLogin(true); setOtpRequested(false);
  };

  const downloadPersonalData = async () => {
    setExportingData(true);
    setStatusMessage('');
    try {
      const data = await productionApi.exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `marshgo-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatusMessage('Ваші дані завантажено у форматі JSON.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? `Не вдалося експортувати дані: ${error.message}` : 'Не вдалося експортувати дані. Спробуйте ще раз.');
    } finally {
      setExportingData(false);
    }
  };

  const requestDeletion = async () => {
    if (!window.confirm('Подати запит на видалення акаунта? Його можна скасувати протягом періоду очікування.')) return;
    setDeletionBusy(true); setStatusMessage('');
    try {
      setDeletionRequest(await productionApi.requestAccountDeletion());
      setStatusMessage('Запит на видалення зареєстровано. Він ще не видаляє дані; перевірте стан і дату в профілі.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося подати запит на видалення.'); }
    finally { setDeletionBusy(false); }
  };

  const cancelDeletion = async () => {
    setDeletionBusy(true); setStatusMessage('');
    try {
      setDeletionRequest(await productionApi.cancelAccountDeletion());
      setStatusMessage('Запит на видалення скасовано. Акаунт і його дані залишаються активними.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося скасувати запит.'); }
    finally { setDeletionBusy(false); }
  };

  const openNotifications = async () => {
    setShowNotifications(true); setNotificationsLoading(true);
    try { await refreshNotifications(); }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Сповіщення тимчасово недоступні.'); }
    finally { setNotificationsLoading(false); }
  };

  const markNotificationRead = async (notification: ApiNotification) => {
    if (notification.read_at) return;
    try {
      await productionApi.markNotificationRead(notification.id);
      setNotificationPage(current => ({ ...current, unreadCount: Math.max(0, current.unreadCount - 1), items: current.items.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item) }));
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося позначити сповіщення прочитаним.'); }
  };

  const markAllNotificationsRead = async () => {
    try {
      await productionApi.markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotificationPage(current => ({ ...current, unreadCount: 0, items: current.items.map(item => ({ ...item, read_at: item.read_at ?? now })) }));
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося оновити сповіщення.'); }
  };

  const loadMoreNotifications = async () => {
    if (!notificationPage.nextCursor || notificationsLoading) return;
    setNotificationsLoading(true);
    try {
      const next = await productionApi.notifications(notificationPage.nextCursor);
      setNotificationPage(current => ({ ...next, items: [...current.items, ...next.items] }));
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося завантажити давніші сповіщення.'); }
    finally { setNotificationsLoading(false); }
  };

  const continueToPhoneLogin = () => {
    setOnboardingStep(0);
    setShowLogin(true);
  };
  const requestOnboardingLocation = () => {
    if (!navigator.geolocation) {
      setOnboardingPermissionMessage('Цей браузер не надає доступу до геолокації. Її можна ввімкнути пізніше в налаштуваннях пристрою.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setOnboardingPermissionMessage('Доступ увімкнено. Геолокація потрібна лише під час активної навігації або зустрічі.'),
      () => setOnboardingPermissionMessage('Дозвіл не надано. Його можна ввімкнути пізніше перед навігацією.'),
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 12_000 },
    );
  };

  if (loading) return <main className="grid min-h-[100svh] place-items-center bg-[#f5f8fd] text-sm text-slate-500">Завантажуємо захищену сесію…</main>;
  if (!user || showLogin) return (
    <main className={`auth-screen relative flex min-h-[100svh] overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-safe ${authIntro ? 'auth-intro-screen' : ''} ${onboardingStep > 0 ? 'bg-[#f4f8ff] text-[#14243b]' : 'bg-[#081b35] text-white'} ${authIntro ? 'items-stretch' : 'items-end sm:items-center sm:justify-center'}`}>
      {authIntro && <img src="/images/welcome-kyiv-v1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_58%]" />}
      <div className={`absolute inset-0 ${authIntro ? 'bg-[linear-gradient(180deg,rgba(4,17,37,.45)_0%,rgba(5,22,44,.08)_34%,rgba(5,15,29,.28)_57%,rgba(3,10,19,.9)_100%)]' : onboardingStep > 0 ? 'bg-[linear-gradient(180deg,#f4f8ff_0%,#ffffff_58%,#edf4ff_100%)]' : 'bg-[radial-gradient(ellipse_at_55%_35%,rgba(41,131,255,.65),transparent_48%),linear-gradient(180deg,#113d75_0%,#122f54_48%,#08121f_100%)]'}`} />
      {!authIntro && onboardingStep === 0 && <div className="absolute inset-x-0 bottom-0 h-[48%] bg-[linear-gradient(0deg,rgba(4,10,18,.88),transparent)]" />}
      <section className={`relative z-10 mx-auto flex w-full max-w-md flex-col ${authIntro ? 'min-h-[calc(100svh-env(safe-area-inset-top))] items-center pb-1 text-center' : 'pb-2'}`}>
        {!authIntro && onboardingStep === 0 && <button onClick={() => { setAuthIntro(true); setShowLogin(false); setStatusMessage(''); }} className="mb-6 grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-white/10" aria-label="Назад"><ArrowLeft size={19}/></button>}
        {authIntro ? <>
          <div className="mt-[max(3rem,10svh)] flex flex-col items-center drop-shadow-[0_2px_16px_rgba(4,12,28,.3)]">
            <BrandMark size="lg" className="mb-3 ring-1 ring-white/60 shadow-[0_0_38px_rgba(56,189,248,.42)]" />
            <strong className="text-[2rem] font-extrabold tracking-tight">MARSH<span className="text-sky-400">GO</span></strong>
            <p className="mt-1 text-xs text-white/85">Один маршрут. Усі способи доїхати.</p>
            <p className="mt-1 text-[10px] text-white/75">Попутки · міські поїздки · подорожі Україною</p>
          </div>
          <div className="mt-auto w-full pb-5 pt-8 text-left drop-shadow-[0_2px_12px_rgba(0,0,0,.55)]">
            <p className="text-[11px] font-bold uppercase tracking-[.27em] text-blue-100">Україна ближче</p>
            <h1 className="mt-2 text-[2.15rem] font-extrabold leading-[1.08] tracking-tight">Усі способи<br/>доїхати — в одному<br/>застосунку.</h1>
            <p className="mt-3 max-w-sm text-sm leading-5 text-blue-50/90">Знайдіть попутку, сплануйте маршрут і домовтеся про поїздку в одному місці.</p>
          </div>
          <div className="w-full">
            <button onClick={() => { setAuthIntro(false); setOnboardingStep(1); setShowLogin(false); }} className="w-full rounded-2xl bg-blue-600 px-5 py-[1.05rem] text-sm font-bold shadow-lg shadow-blue-950/45">Почати</button>
            <button onClick={() => { setAuthIntro(false); setOnboardingStep(0); setShowLogin(true); }} className="mt-3 w-full rounded-2xl border border-white/50 bg-slate-950/25 px-5 py-3.5 text-sm font-semibold backdrop-blur-sm">У мене вже є акаунт</button>
          </div>
        </> : onboardingStep > 0 ? <section className="mx-auto flex min-h-[calc(100svh-env(safe-area-inset-top))] w-full max-w-md flex-col pb-2 pt-2 text-[#14243b]">
          <header className="flex items-center justify-between">
            <button onClick={() => onboardingStep === 1 ? setAuthIntro(true) : setOnboardingStep(onboardingStep - 1)} aria-label="Назад" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><ArrowLeft size={19}/></button>
            <BrandMark size="sm"/>
            <button onClick={continueToPhoneLogin} className="px-2 py-2 text-xs font-semibold text-slate-500">Пропустити</button>
          </header>
          <div className="mt-7 flex gap-1.5" aria-label={`Крок ${onboardingStep} з 3`}>{[1,2,3].map(step=><span key={step} className={`h-1.5 flex-1 rounded-full ${step<=onboardingStep?'bg-blue-600':'bg-slate-200'}`}/>)}</div>
          {onboardingStep === 1 ? <>
            <div className="mt-10 grid min-h-48 place-items-center rounded-[2rem] bg-gradient-to-br from-blue-50 via-white to-sky-100">
              <div className="grid grid-cols-3 gap-3">{[{Icon:CarFront,label:'Попутки',tone:'text-blue-600 bg-blue-100'},{Icon:Ticket,label:'Автобуси',tone:'text-emerald-600 bg-emerald-100'},{Icon:Navigation,label:'Маршрути',tone:'text-amber-600 bg-amber-100'}].map(({Icon,label,tone})=><div key={label} className="flex w-20 flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-sm"><span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon size={22}/></span><small className="text-[10px] font-bold text-slate-600">{label}</small></div>)}</div>
            </div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-blue-700">Подорожі простіше</p>
            <h1 className="mt-2 text-[1.8rem] font-extrabold leading-tight tracking-tight text-[#081b35]">Усі поїздки —<br/>в одному додатку</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Шукайте реальні пропозиції MARSHGO Community і зберігайте маршрути в одному місці.</p>
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Автобуси, таксі та громадський транспорт з’являться після підключення перевірених партнерів.</p>
          </> : onboardingStep === 2 ? <>
            <div className="mt-10 grid min-h-48 place-items-center rounded-[2rem] bg-gradient-to-br from-blue-50 via-white to-indigo-100"><div className="w-full max-w-xs space-y-2">{[{Icon:Clock3,title:'Найшвидше',caption:'Пріоритет — час'},{Icon:Ticket,title:'Найдешевше',caption:'Пріоритет — ціна'},{Icon:ShieldCheck,title:'Найнадійніше',caption:'Зручніші пересадки'}].map(({Icon,title,caption})=><div key={title} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-600"><Icon size={18}/></span><span><b className="block text-xs">{title}</b><small className="text-[10px] text-slate-500">{caption}</small></span><span className="ml-auto h-4 w-4 rounded-full border border-slate-300"/></div>)}</div></div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-blue-700">Ваші пріоритети</p>
            <h1 className="mt-2 text-[1.8rem] font-extrabold leading-tight tracking-tight text-[#081b35]">Обирайте, що<br/>важливо саме вам</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Серверний планувальник упорядкує доступні варіанти за часом, ціною чи надійністю.</p>
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Зараз планувальник використовує реальні Community-пропозиції. Інші види транспорту ще не підключені.</p>
          </> : <>
            <div className="mt-10 grid min-h-48 place-items-center rounded-[2rem] bg-gradient-to-br from-blue-50 via-white to-sky-100"><span className="grid h-24 w-24 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/20"><MapPin size={44}/></span></div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-blue-700">Керування дозволами</p>
            <h1 className="mt-2 text-[1.8rem] font-extrabold leading-tight tracking-tight text-[#081b35]">Дозвольте MARSHGO<br/>бути корисним</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Геолокація використовується лише під час активної навігації або зустрічі з водієм. Її можна не вмикати зараз.</p>
            {onboardingPermissionMessage&&<p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">{onboardingPermissionMessage}</p>}
            <button onClick={requestOnboardingLocation} className="mt-5 w-full rounded-2xl border border-blue-100 bg-white py-3.5 text-sm font-bold text-blue-700">Дозволити геолокацію</button>
          </>}
          <div className="mt-auto pt-8">
            {onboardingStep < 3 ? <button onClick={() => setOnboardingStep(onboardingStep + 1)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/20">Далі <ArrowRight size={17}/></button> : <button onClick={continueToPhoneLogin} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/20">Продовжити <ArrowRight size={17}/></button>}
            {onboardingStep === 3&&<button onClick={continueToPhoneLogin} className="mt-2 w-full py-3 text-sm font-semibold text-slate-500">Не зараз</button>}
            <p className="mt-3 text-center text-[10px] text-slate-500">Крок {onboardingStep} з 3</p>
          </div>
        </section> : <>
        <div className="mb-8 flex items-center gap-3"><BrandMark/><div><strong className="text-2xl tracking-tight">MARSH<span className="text-sky-400">GO</span></strong><p className="text-xs text-blue-100/80">One Route. Every Way.</p></div></div>
        {!otpRequested ? <>
          <h1 className="text-3xl font-extrabold">Вхід за номером телефону</h1><p className="mt-2 text-sm text-blue-100/80">Створіть профіль або увійдіть за номером.</p>
          <form onSubmit={requestOtp} className="mt-6 space-y-3">
            <input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 text-white outline-none placeholder:text-blue-100/55 focus:border-sky-300" placeholder="Ваше ім’я" autoComplete="name" />
            <input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 text-white outline-none placeholder:text-blue-100/55 focus:border-sky-300" placeholder="+380 номер телефону" autoComplete="tel" />
            <button disabled={busy} className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-bold shadow-lg shadow-blue-900/40 disabled:opacity-60">{busy ? 'Надсилаємо…' : 'Почати'}</button>
          </form>
        </> : <>
          <h1 className="text-3xl font-extrabold">Вхід за номером</h1><p className="mt-2 text-sm text-blue-100/80">Підтвердьте номер телефону, щоб продовжити.</p>
          <form onSubmit={verifyOtp} className="mt-6 space-y-3">
            <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-center text-2xl tracking-[.4em] text-white outline-none focus:border-sky-300" placeholder="••••••" autoComplete="one-time-code" />
            {devCode && <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-950">Тестовий OTP локального середовища: <b>{devCode}</b></p>}
            <button disabled={busy} className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-bold disabled:opacity-60">{busy ? 'Перевіряємо…' : 'Підтвердити номер'}</button>
            <button type="button" onClick={() => { setOtpRequested(false); setCode(''); }} className="w-full py-2 text-sm text-blue-100">Змінити номер</button>
          </form>
        </>}
        {statusMessage && <p role="status" className="mt-4 rounded-xl bg-white/10 p-3 text-sm text-white">{statusMessage}</p>}
        {!authIntro && <p className="mt-5 flex gap-2 text-xs leading-5 text-blue-100/70"><ShieldCheck size={16} className="shrink-0"/>Реальна доставка SMS вмикається після налаштування провайдера.</p>}
        </>}
      </section>
    </main>
  );

  if (notFound) return <main className="grid min-h-[70svh] place-items-center px-5 text-center"><div className="max-w-md rounded-3xl bg-white p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">404</p><h1 className="mt-2 text-2xl font-extrabold">Сторінку не знайдено</h1><p className="mt-2 text-sm text-slate-500">Перевірте адресу або поверніться до головної сторінки MARSHGO.</p><button onClick={goHome} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">На головну</button></div></main>;

  const status = statusMessage ? <div role="status" className="mx-auto mt-3 w-full max-w-xl rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">{statusMessage}<button onClick={() => setStatusMessage('')} className="float-right"><X size={16}/></button></div> : null;
  const header = <header className="app-header mx-auto flex w-full max-w-xl items-center justify-between px-5 pb-3 pt-[max(.8rem,env(safe-area-inset-top))]">
    <div className="flex items-center gap-2.5"><BrandMark size="sm"/><div><strong className="text-[18px] tracking-tight text-[#081b35]">MARSH<span className="text-blue-600">GO</span></strong><p className="-mt-1 text-[10px] text-slate-500">Усі поїздки в одному місці</p></div></div>
    <nav aria-label="Розділи MARSHGO" className="desktop-top-nav hidden items-center gap-1">
      {([['home','Головна'],['search','Пошук поїздок'],['trips','Мої поїздки'],['profile','Профіль']] as const).map(([id,label])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);setSelectedOffer(null);setSelectedBooking(null);}} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700 aria-[current=page]:bg-blue-50 aria-[current=page]:text-blue-700">{label}</button>)}
    </nav>
    <button onClick={() => void openNotifications()} aria-label={`Сповіщення${notificationPage.unreadCount ? `, непрочитаних ${notificationPage.unreadCount}` : ''}`} className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-slate-700 shadow-sm"><Bell size={19}/>{notificationPage.unreadCount>0&&<span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">{notificationPage.unreadCount>99?'99+':notificationPage.unreadCount}</span>}</button>
  </header>;

  const searchForm = <form onSubmit={search} className="journey-search-card rounded-[1.7rem] border border-white bg-white p-3 shadow-[0_10px_28px_rgba(31,67,114,.08)]">
    <div className="relative">
      <label className="flex items-center gap-3 rounded-t-2xl bg-[#f6f8fc] px-3 py-3"><MapPin size={19} className="shrink-0 text-blue-600"/><span className="min-w-0 flex-1"><small className="block text-[10px] text-slate-400">Звідки</small><input required value={origin} onChange={(event) => {setOrigin(event.target.value);setSearchOriginPlace(null);}} className="w-full bg-transparent text-sm font-bold outline-none" placeholder="Місто відправлення" /></span><button type="button" aria-label="Знайти" onClick={()=>void searchRoutePlace('origin')} disabled={placeSearchBusy} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-blue-700">{placeSearchBusy&&routePlaceField==='origin'?'…':<Search size={16}/>}</button></label>
      {routePlaceField==='origin'&&routePlaceSuggestions.length>0&&<div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-white">{routePlaceSuggestions.map(place=><button key={place.providerId} type="button" onClick={()=>chooseSearchPlace(place)} className="block w-full px-3 py-2.5 text-left text-xs hover:bg-blue-50">{place.label}</button>)}</div>}
      <div className="ml-[21px] h-3 border-l-2 border-dotted border-slate-300" />
      <label className="flex items-center gap-3 rounded-b-2xl bg-[#f6f8fc] px-3 py-3"><MapPin size={19} className="shrink-0 text-rose-500"/><span className="min-w-0 flex-1"><small className="block text-[10px] text-slate-400">Куди</small><input required value={destination} onChange={(event) => {setDestination(event.target.value);setSearchDestinationPlace(null);}} className="w-full bg-transparent text-sm font-bold outline-none" placeholder="Місто призначення" /></span><button type="button" aria-label="Знайти" onClick={()=>void searchRoutePlace('destination')} disabled={placeSearchBusy} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-blue-700">{placeSearchBusy&&routePlaceField==='destination'?'…':<Search size={16}/>}</button><button type="button" onClick={() => { setOrigin(destination); setDestination(origin); setSearchOriginPlace(searchDestinationPlace); setSearchDestinationPlace(searchOriginPlace); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-blue-600 shadow-sm" aria-label="Поміняти місцями"><ArrowDownUp size={17}/></button></label>
      {routePlaceField==='destination'&&routePlaceSuggestions.length>0&&<div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-white">{routePlaceSuggestions.map(place=><button key={place.providerId} type="button" onClick={()=>chooseSearchPlace(place)} className="block w-full px-3 py-2.5 text-left text-xs hover:bg-blue-50">{place.label}</button>)}</div>}
    </div>
    <div className="mt-2 grid grid-cols-[1.2fr_.8fr] gap-2">
      <label className="relative flex items-center gap-2 rounded-xl bg-[#f6f8fc] px-3 py-2.5"><CalendarDays size={17} className="shrink-0 text-slate-500"/><span className="min-w-0"><small className="block text-[10px] text-slate-400">Дата</small><span className="block truncate text-xs font-semibold">{new Intl.DateTimeFormat('uk-UA',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Kyiv'}).format(new Date(`${date}T12:00:00`))}</span></span><input aria-label="Дата поїздки" required lang="uk-UA" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label>
      <div className="flex min-w-0 items-center gap-1 rounded-xl bg-[#f6f8fc] px-2"><Users size={16} className="shrink-0 text-slate-500"/><span className="shrink-0 whitespace-nowrap text-[11px] font-semibold">{seats} пас.</span><button type="button" onClick={() => setSeats(Math.max(1,seats-1))} className="grid h-8 w-6 shrink-0 place-items-center text-slate-500" aria-label="Менше пасажирів"><Minus size={14}/></button><button type="button" onClick={() => setSeats(Math.min(8,seats+1))} className="grid h-8 w-6 shrink-0 place-items-center text-blue-600" aria-label="Більше пасажирів"><Plus size={16}/></button></div>
    </div>
    <button disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 disabled:opacity-60"><Search size={17}/>{busy ? 'Шукаємо…' : 'Знайти маршрут'}<ArrowRight size={17}/></button>
    <details className="mt-3 rounded-xl bg-[#f6f8fc] px-3 py-2.5">
      <summary className="cursor-pointer list-none text-xs font-bold text-blue-700">Який маршрут обрати? <span className="float-right text-slate-400">+</span></summary>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <label className="min-w-0 rounded-xl bg-white px-3 py-2 text-[10px] font-semibold text-slate-500">Відправлення<input aria-label="Час відправлення для плану" type="datetime-local" value={journeyDeparture} onChange={event=>setJourneyDeparture(event.target.value)} className="mt-1 block w-full min-w-0 bg-transparent text-xs font-semibold text-slate-800 outline-none"/></label>
        <label className="min-w-0 rounded-xl bg-white px-3 py-2 text-[10px] font-semibold text-slate-500">Пріоритет<select aria-label="Пріоритет маршруту" value={journeyStrategy} onChange={event=>setJourneyStrategy(event.target.value as ApiJourneyStrategy)} className="mt-1 block w-full min-w-0 bg-transparent text-xs font-semibold text-slate-800 outline-none"><option value="BALANCED">Оптимально</option><option value="FASTEST">Найшвидше</option><option value="CHEAPEST">Найдешевше</option><option value="PREMIUM">Premium</option><option value="RELIABLE">Найнадійніше</option></select></label>
      </div>
      <p className="px-1 pt-1 text-[10px] leading-4 text-slate-500">Планувальник зараз використовує реальні пропозиції MARSHGO Community. Сторонні перевізники з’являться після підключення їхніх API.</p>
    </details>
    <button type="button" disabled={busy} onClick={()=>void searchJourney()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 disabled:opacity-60"><Compass size={17}/>{busy?'Будуємо…':'Оптимізувати весь маршрут'}<ArrowRight size={17}/></button>
  </form>;

  const transportTypes = <div className="transport-mode-grid grid grid-cols-4 gap-2" aria-label="Доступні способи поїздки">
    {([
      { label: 'Попутка', Icon: CarFront, active: true }, { label: 'Автобус', Icon: Ticket, active: false },
      { label: 'Таксі', Icon: CarFront, active: false }, { label: 'Маршрутка', Icon: Users, active: false },
    ] satisfies { label: string; Icon: LucideIcon; active: boolean }[]).map(({ label, Icon, active }) => <button key={label} type="button" aria-label={`${label}${active ? ', доступно' : ', скоро'}`} onClick={() => !active && setStatusMessage(`${label} поки не підключено як перевірене джерело. Зараз доступні пропозиції MARSHGO Community.`)} className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-[10px] font-semibold transition-colors ${active ? 'border-blue-100 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-500 shadow-sm'}`}><span className={`grid h-8 w-8 place-items-center rounded-xl ${active ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-500'}`}><Icon size={16}/></span>{label}{!active&&<span className="text-[8px] font-medium text-slate-400">Скоро</span>}</button>)}
    </div>;

  const offerCard = (offer: ApiOffer, index: number) => <button key={offer.id} onClick={() => { setJourneyBookingLink(null); setSelectedJourney(null); setSelectedOffer(offer); setRoutePath(pathForProductionEntity('offer', offer.id)); }} className="journey-offer-card w-full rounded-[1.35rem] border border-slate-100 bg-white p-4 text-left shadow-[0_4px_16px_rgba(30,64,100,.05)]">
    <div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Community · Попутка</span><span className="text-[10px] text-slate-400">{offer.available_seats} місць</span></div>
    {offer.vehicle_photo_url&&<img src={offer.vehicle_photo_url} alt={`Автомобіль водія ${offer.driver_name}`} loading="lazy" className="mb-3 aspect-[16/8] w-full rounded-xl object-cover"/>}
    <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2"><div><b className="text-lg">{formatDate(offer.departure_at,{hour:'2-digit',minute:'2-digit'})}</b><p className="text-xs font-semibold text-slate-700">{offer.origin_name}</p></div><span className="text-slate-300">→</span><div><b className="text-lg">{offer.arrival_at ? formatDate(offer.arrival_at,{hour:'2-digit',minute:'2-digit'}) : '—'}</b><p className="text-xs font-semibold text-slate-700">{offer.destination_name}</p></div><div className="text-right"><b className="text-lg">{formatMoney(offer.price_per_seat_minor,offer.currency)}</b><p className="text-[10px] text-slate-400">за одне місце</p></div></div>
    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><span className="flex min-w-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{offer.driver_name.slice(0,1).toUpperCase()}</span><span className="truncate text-xs font-bold">{offer.driver_name}</span>{offer.review_count > 0 ? <span className="shrink-0 text-[10px] text-amber-600">★ {Number(offer.average_rating).toFixed(1)} ({offer.review_count})</span> : <span className="shrink-0 text-[10px] text-slate-400">Новий</span>}</span><span className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">Деталі</span></div>
    {index === 0 && offer.duration_s ? <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400"><Clock3 size={12}/>{Math.floor(offer.duration_s/3600)} год {Math.round((offer.duration_s%3600)/60)} хв · маршрут розраховано</p> : null}
  </button>;

  const homeScreen = <div className="home-screen mx-auto w-full max-w-xl px-5 pb-8">
    <section className="home-intro"><p className="home-greeting relative z-[1] text-xs font-semibold text-blue-700">Привіт, {user.display_name.split(' ')[0]}!</p><h1 className="home-title relative z-[1] mt-1 max-w-[17rem] text-[1.55rem] font-extrabold leading-tight tracking-tight text-[#081b35]">Подорожуйте Україною простіше</h1><p className="home-description relative z-[1] mt-2 max-w-[18rem] text-xs leading-5 text-slate-600">Попутки та зручне планування — в одному додатку.</p></section>
    <div className="home-search-panel mt-4">{searchForm}</div><div className="home-transport-panel">{transportTypes}</div>
    <button onClick={() => setTab('demand')} className="home-demand-cta mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700"><Compass size={16}/>Опублікувати свій запит на поїздку<ArrowRight size={15}/></button>
    <div className="home-offer-heading mt-6 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600">Реальні пропозиції</p><h2 className="mt-1 text-lg font-extrabold">Маршрути поруч</h2></div><button onClick={() => setTab('search')} className="text-xs font-semibold text-blue-600">Усі результати</button></div>
    {offers.length ? <div className="home-offer-list mt-3 space-y-3">{offers.slice(0,2).map(offerCard)}</div> : <div className="home-offer-empty mt-3 rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm">Ще немає завантажених пропозицій. Введіть маршрут і натисніть «Знайти маршрут», щоб отримати актуальні поїздки з сервера.</div>}
    {user.roles.includes('driver')&&<button onClick={()=>setTab('navigation')} className="home-navigation-cta mt-5 flex w-full items-center gap-3 rounded-2xl bg-[#0c2850] p-4 text-left text-white"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Navigation size={20}/></span><span className="flex-1"><b className="block text-sm">Почати навігацію</b><small className="text-xs text-blue-100/75">GPS у foreground. Пошук попутників доступний після згоди та перевірки авто.</small></span><ArrowRight size={17}/></button>}
  </div>;

  const resultsScreen = <div className="journey-results mx-auto w-full max-w-xl px-5 pb-8"><div className="mb-4 flex items-center gap-3"><button onClick={() => setShowResults(false)} aria-label="Повернутися до пошуку" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-sm"><ArrowLeft size={18}/></button><div className="min-w-0 flex-1"><h1 className="truncate text-lg font-extrabold">{origin} → {destination}</h1><p className="text-xs text-slate-500">{new Intl.DateTimeFormat('uk-UA',{dateStyle:'medium',timeZone:'Europe/Kyiv'}).format(new Date(`${date}T12:00:00`))} · {seats} пасажир(и)</p></div><button aria-label="Сповіщення про маршрут" onClick={() => setStatusMessage('Збереження маршруту сповістить вас після підключення push-сповіщень.')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-sm"><Bell size={18}/></button></div>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{['Усі','Попутки','Автобуси','Таксі'].map((item,index)=><button key={item} onClick={()=>index>1&&setStatusMessage(`${item} не підключено як реальне джерело.`)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${index===0||index===1?'bg-blue-600 text-white':'bg-white text-slate-500'}`}>{item}</button>)}</div>
    <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Знайдені поїздки</h2><span className="text-xs text-slate-500">{offers.length} варіантів</span></div>
    {journeyResult ? <JourneyResultsPanel result={journeyResult} onOpenOffer={(offerId,journeyId,journeyLegId)=>void openJourneyOffer(offerId,journeyId,journeyLegId)}/> : offers.length ? <div className="space-y-3">{offers.map(offerCard)}</div> : <div className="rounded-2xl bg-white p-6 text-center"><Search className="mx-auto text-slate-300"/><p className="mt-2 font-bold">Немає поїздок за цими умовами</p><p className="mt-1 text-sm text-slate-500">Спробуйте змінити дату або кількість пасажирів.</p></div>}
  </div>;

  const visibleBookings = route?.kind === 'booking' && route.entityId ? bookings.filter((booking) => booking.id === route.entityId) : bookings;
  const tripsScreen = <div className="mx-auto w-full max-w-xl px-5 pb-8"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Ваші бронювання</p><h1 className="mt-1 text-2xl font-extrabold">Мої поїздки</h1></div>
    {journeys.length > 0 && <section className="mb-5" aria-label="Збережені маршрути"><div className="mb-2 flex items-center justify-between"><h2 className="font-extrabold">Збережені маршрути</h2><button onClick={() => void refreshJourneys().catch(error => setStatusMessage(error instanceof Error ? error.message : 'Маршрути недоступні.'))} className="text-xs font-bold text-blue-600">Оновити</button></div><div className="space-y-2">{journeys.map(journey => { const statusLabel: Record<string, string> = { PLANNED: 'Заплановано', READY: 'Маршрут готовий', PARTIALLY_RESERVED: 'Частково заброньовано', REPLANNING: 'Потрібне перепланування', ACTIVE: 'У дорозі', COMPLETED: 'Завершено', CANCELLED: 'Скасовано', FAILED: 'Не вдалося побудувати' }; return <article key={journey.id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${journey.state === 'READY' ? 'bg-emerald-50 text-emerald-700' : journey.state === 'REPLANNING' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>{statusLabel[journey.state] ?? journey.state}</span><span className="text-[10px] text-slate-400">{journey.strategy}</span></div><button onClick={() => setRoutePath(pathForProductionEntity('journey', journey.id))} className="mt-3 text-left font-extrabold">{journey.origin_name} <span className="text-blue-600">→</span> {journey.destination_name}</button><p className="mt-1 text-xs text-slate-500">{formatDate(journey.requested_departure_at)} · {journey.passenger_count} пасажир(и) · {journey.legs.length} відрізок</p><p className="mt-1 text-xs font-bold text-blue-700">{journey.confirmed_price_minor !== null ? `Підтверджено ${formatMoney(journey.confirmed_price_minor, 'UAH')}` : journey.total_price_minor !== null ? `Оцінка ${formatMoney(journey.total_price_minor, 'UAH')}` : 'Ціна оновиться після перепланування'}</p>{journey.legs.map(leg => <p key={leg.id} className="mt-1 text-[10px] text-slate-500">{leg.mode === 'COMMUNITY' ? 'Попутка MARSHGO Community' : leg.mode} · {leg.state === 'CONFIRMED' ? 'бронювання підтверджене' : leg.state === 'CANCELLED' ? 'скасовано' : 'пропозиція збережена'}</p>)}</article>; })}</div></section>}
    {user.roles.includes('driver')&&<section className="mb-5"><div className="mb-2 flex items-center justify-between"><h2 className="font-extrabold">Мої оголошення</h2><button onClick={()=>void refreshMyOffers().catch(error=>setStatusMessage(error instanceof Error?error.message:'Оголошення недоступні.'))} className="text-xs font-bold text-blue-600">Оновити</button></div>{myOffers.length?<div className="space-y-2">{myOffers.map((offer)=><article key={offer.id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><b>{offer.origin_name} → {offer.destination_name}</b><span className="text-[10px] text-slate-500">{offer.status}</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(offer.departure_at)} · {offer.available_seats}/{offer.total_seats} місць</p><p className="mt-1 text-xs font-bold text-blue-700">{formatMoney(offer.price_per_seat_minor,offer.currency)} за місце{offer.duration_s?` · ${Math.floor(offer.duration_s/3600)} год ${Math.round(offer.duration_s%3600/60)} хв`:''}</p></article>)}</div>:<p className="rounded-2xl bg-white p-4 text-sm text-slate-500">Опублікованих поїздок ще немає.</p>}</section>}
    {visibleBookings.length ? <div className="space-y-3">{visibleBookings.map((booking)=>{
      const statusLabel: Record<string, string> = { confirmed: 'Підтверджено', boarding: 'Посадка', in_progress: 'У дорозі', completed: 'Завершено', cancelled: 'Скасовано' };
      const rendezvous = rendezvousSessions[booking.id];
      const rendezvousStatus: Record<string, string> = { SCHEDULED: 'Очікує часу зустрічі', ACTIVE: 'Обмін місцем активний', DRIVER_APPROACHING: 'Водій наближається', PASSENGER_APPROACHING: 'Пасажир прямує до точки', DRIVER_WAITING: 'Водій на місці', PASSENGER_WAITING: 'Пасажир на місці', BOTH_NEARBY: 'Обидва підтвердили прибуття', BOARDING: 'Посадка розпочалася', CANCELLED: 'Обмін місцем завершено', COMPLETED: 'Зустріч завершена', EXPIRED: 'Час зустрічі минув' };
      return <article key={booking.id} className="rounded-[1.4rem] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${booking.status==='confirmed'?'bg-emerald-50 text-emerald-700':booking.status==='completed'?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-600'}`}>{statusLabel[booking.status] ?? booking.status}</span><span className="text-[10px] text-slate-400">{formatDate(booking.departure_at,{day:'numeric',month:'short'})}</span></div>
        <h2 className="mt-3 text-lg font-extrabold">{booking.origin_name} <span className="text-blue-600">→</span> {booking.destination_name}</h2><p className="mt-1 text-xs text-slate-500">{formatDate(booking.departure_at)} · {booking.seat_count} місця · {formatMoney(booking.total_price_minor,booking.currency)}</p>
        {['confirmed','boarding','in_progress'].includes(booking.status)&&<section className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-3"><div className="flex items-center justify-between gap-2"><div><b className="block text-xs">Зустріч із {booking.current_user_is_driver?booking.passenger_name:booking.driver_name}</b><small className="text-[10px] text-slate-500">Точка посадки · {rendezvous?.pickup.label??booking.origin_name}</small></div>{rendezvous&&<span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-blue-700">{rendezvousStatus[rendezvous.state]??rendezvous.state}</span>}</div>{!rendezvous?<button disabled={rendezvousBusyId===booking.id} onClick={()=>void loadRendezvous(booking)} className="mt-2 w-full rounded-xl bg-white py-2.5 text-xs font-bold text-blue-700 disabled:opacity-50">{rendezvousBusyId===booking.id?'Завантажуємо…':'Відкрити зустріч'}</button>:<><p className="mt-2 text-[10px] text-slate-600">За планом · {formatDate(rendezvous.plannedPickupAt)}{rendezvous.driverArrivedAt&&' · водій на місці'}{rendezvous.passengerArrivedAt&&' · ви на місці'}</p>{rendezvous.locationSharingEnabled&&<p className="mt-1 text-[10px] text-slate-500">Останнє місце: {rendezvous.locations[booking.current_user_is_driver?'passenger':'driver']?.freshness==='LIVE'?'оновлено, доступне учаснику бронювання':rendezvous.locations[booking.current_user_is_driver?'passenger':'driver']?.freshness==='STALE'?'застаріло':'ще не надіслано'}. Точні координати не зберігаються.</p>}{!rendezvous.locationSharingEnabled&&['SCHEDULED','ACTIVATING'].includes(rendezvous.state)&&<button disabled={rendezvousBusyId===booking.id||Date.now()<Date.parse(rendezvous.activationAt)} onClick={()=>void activateRendezvous(booking)} className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">{Date.now()<Date.parse(rendezvous.activationAt)?`Обмін місцем доступний ${formatDate(rendezvous.activationAt,{hour:'2-digit',minute:'2-digit'})}`:'Увімкнути короткочасний обмін місцем'}</button>}{rendezvous.locationSharingEnabled&&<><div className="mt-2 grid grid-cols-2 gap-2"><button disabled={rendezvousBusyId===booking.id} onClick={()=>void sendRendezvousLocation(booking)} className="rounded-xl bg-white py-2.5 text-[10px] font-bold text-blue-700 disabled:opacity-50">Надіслати моє місце</button><button disabled={rendezvousBusyId===booking.id} onClick={()=>void rendezvousAction(booking,'arrived')} className="rounded-xl bg-emerald-600 py-2.5 text-[10px] font-bold text-white disabled:opacity-50">Я на місці</button></div><button disabled={rendezvousBusyId===booking.id} onClick={()=>void rendezvousAction(booking,'approaching')} className="mt-2 w-full rounded-xl bg-white py-2 text-[10px] font-semibold text-slate-700">Я пряму до точки посадки</button>{rendezvous.state==='BOTH_NEARBY'&&<button disabled={rendezvousBusyId===booking.id} onClick={()=>void rendezvousBoarding(booking)} className="mt-2 w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white disabled:opacity-50">Підтвердити зустріч і посадку</button>}<button disabled={rendezvousBusyId===booking.id} onClick={()=>void endRendezvous(booking)} className="mt-2 w-full py-1 text-[10px] font-semibold text-slate-500">Завершити обмін місцем</button></>}</>}</section>}
        {booking.status==='confirmed'&&!booking.current_user_is_driver&&<div className="mt-3 rounded-xl bg-blue-50 p-3"><button disabled={busy} onClick={()=>void showBookingTicket(booking)} className="text-xs font-bold text-blue-700">{visibleBookingTicket?.bookingId===booking.id?'Оновити квиток':'Показати квиток для посадки'}</button>{visibleBookingTicket?.bookingId===booking.id&&<div className="mt-2 rounded-lg bg-white p-2"><p className="text-[10px] font-semibold text-slate-500">Передайте цей підписаний токен водієві для підтвердження посадки</p><code data-testid="booking-ticket-token" className="mt-1 block max-h-20 overflow-auto break-all text-[9px] text-slate-700">{visibleBookingTicket.token}</code></div>}</div>}
        {booking.status==='confirmed'&&booking.current_user_is_driver&&<div className="mt-3 rounded-xl bg-slate-50 p-3"><label className="block text-[10px] font-bold text-slate-600">Токен квитка пасажира<textarea value={boardingTicketInput[booking.id]??''} onChange={(event)=>setBoardingTicketInput((current)=>({...current,[booking.id]:event.target.value}))} className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-200 bg-white p-2 text-[10px] font-normal" placeholder="Вставте підписаний токен квитка" /></label><button disabled={busy||!boardingTicketInput[booking.id]?.trim()} onClick={()=>void confirmBoarding(booking)} className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">Підтвердити посадку</button></div>}
        {booking.status==='boarding'&&booking.current_user_is_driver&&<button disabled={busy} onClick={()=>void startTrip(booking)} className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-xs font-bold text-white disabled:opacity-50">Почати поїздку</button>}
        {booking.status==='in_progress'&&<div className="mt-3 rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-800">Завершення: {booking.completion_confirmation_count}/2 учасники</p>{!booking.current_user_confirmed_completion&&<button disabled={busy} onClick={()=>void confirmTripCompletion(booking)} className="mt-2 w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">Підтвердити завершення</button>}{booking.current_user_confirmed_completion&&<p className="mt-1 text-[10px] text-emerald-700">Ваше підтвердження збережено на сервері.</p>}</div>}
        {booking.status==='cancelled'&&!booking.current_user_is_driver&&<section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs text-slate-800">Інші поїздки MARSHGO поруч</b>{bookingRescues[booking.id]?.result&&<small className="text-[9px] text-slate-500">Перевірено {formatDate(bookingRescues[booking.id].result!.checked_at,{hour:'2-digit',minute:'2-digit'})}</small>}</div>{bookingRescues[booking.id]?.loading?<p className="mt-2 text-xs text-slate-500">Шукаємо опубліковані поїздки з вільними місцями…</p>:bookingRescues[booking.id]?.failed?<p className="mt-2 text-xs text-amber-800">Не вдалося перевірити актуальні поїздки. Спробуйте оновити список пізніше.</p>:bookingRescues[booking.id]?.result?.alternatives.length?<div className="mt-2 space-y-2">{bookingRescues[booking.id].result!.alternatives.map(alternative=><button key={alternative.id} data-testid="rescue-alternative" data-offer-id={alternative.id} onClick={()=>{setSeats(booking.seat_count);setSelectedOffer(alternative);}} className="w-full rounded-xl bg-white p-3 text-left shadow-sm"><span className="flex items-center justify-between gap-2"><b className="text-xs">{alternative.origin_name} → {alternative.destination_name}</b><b className="shrink-0 text-sm text-blue-700">{formatMoney(alternative.price_per_seat_minor*booking.seat_count,alternative.currency)}</b></span><span className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{formatDate(alternative.departure_at,{hour:'2-digit',minute:'2-digit'})} · {alternative.available_seats} вільних</span><span>{alternative.rescue_match==='ALONG_CANCELLED_ROUTE'?`${((alternative.route_origin_distance_m??0)/1000).toFixed(1)} км від маршруту`:`${(alternative.origin_distance_m/1000).toFixed(1)} км від посадки`}</span></span><span className="mt-1 block text-[9px] text-slate-500">{alternative.rescue_match==='ALONG_CANCELLED_ROUTE'?'Початок уздовж вашого маршруту':'Поруч із початковою точкою'}</span><span className="mt-1 block text-[9px] text-slate-400">{alternative.source} · наявність перевірена зараз</span></button>)}</div>:bookingRescues[booking.id]?.result?<p className="mt-2 text-xs text-slate-500">На цей час не знайдено опублікованих поїздок із потрібною кількістю місць у межах 20 км від точок маршруту.</p>:null}</section>}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs text-slate-500">{booking.current_user_is_driver ? `Пасажир · ${booking.passenger_name}` : `Водій · ${booking.driver_name}`}</span><div className="flex items-center gap-2">{booking.status==='confirmed'&&<button disabled={busy} onClick={()=>void cancelTrip(booking)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">Скасувати</button>}<button onClick={()=>void openChat(booking)} className="flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><MessageCircle size={14}/>Написати</button></div></div>
      </article>;
    })}</div> : <div className="rounded-2xl bg-white p-6 text-center"><Ticket className="mx-auto text-slate-300"/><p className="mt-2 font-bold">Поки немає поїздок</p><p className="mt-1 text-sm text-slate-500">Знайдіть маршрут і забронюйте місце.</p><button onClick={()=>setTab('home')} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Знайти поїздку</button></div>}
  </div>;

  const chatScreen = <div className="mx-auto flex min-h-[65svh] w-full max-w-xl flex-col px-5 pb-5"><div className="mb-4 flex items-center gap-3"><button onClick={()=>{setSelectedBooking(null);setTab('trips');}} className="grid h-10 w-10 place-items-center rounded-full bg-white"><ArrowLeft size={18}/></button><div className="min-w-0 flex-1"><h1 className="truncate font-extrabold">{selectedBooking ? (selectedBooking.current_user_is_driver ? selectedBooking.passenger_name : selectedBooking.driver_name) : 'Чати'}</h1><p className="truncate text-xs text-slate-500">{selectedBooking ? `${selectedBooking.origin_name} → ${selectedBooking.destination_name}` : 'Повідомлення за бронюваннями'}</p></div>{selectedBooking&&<><button disabled={busy} onClick={()=>{setReportCategory('safety');setReportDetails('');setShowReportForm(true);}} aria-label="Поскаржитися на співрозмовника" title="Поскаржитися" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700 disabled:opacity-50"><Flag size={18}/></button><button disabled={busy} onClick={()=>void blockBookingContact()} aria-label="Заблокувати співрозмовника" title="Заблокувати співрозмовника" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600 disabled:opacity-50"><Ban size={18}/></button></>}</div>
    {!selectedBooking ? <div className="space-y-3">{bookings.length ? bookings.map(booking=><button key={booking.id} onClick={()=>void openChat(booking)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-blue-600"><MessageCircle size={18}/></span><span className="min-w-0 flex-1"><b className="block text-sm">{booking.origin_name} → {booking.destination_name}</b><small className="text-slate-500">{booking.driver_name} · {formatDate(booking.departure_at,{day:'numeric',month:'short'})}</small></span><ChevronRight size={17} className="text-slate-400"/></button>) : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">Чат з’явиться після підтвердження бронювання.</p>}</div> : <>
      <div className="mb-3 rounded-xl bg-white px-3 py-2 text-center text-[11px] text-slate-500">Бронювання · {selectedBooking.origin_name} → {selectedBooking.destination_name}<span className={`ml-2 font-semibold ${realtimeConnected?'text-emerald-600':'text-slate-400'}`}>{realtimeConnected?'· онлайн':'· офлайн, історія збережена'}</span></div>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl bg-white/60 p-3">{messages.length ? messages.map((item)=><div key={item.id} className={`max-w-[84%] rounded-2xl px-3 py-2.5 text-sm ${item.sender_id===user.id?'ml-auto rounded-br-md bg-blue-600 text-white':'rounded-bl-md bg-white shadow-sm'}`}><p>{item.body}</p><small className={`mt-1 block text-[10px] ${item.sender_id===user.id?'text-blue-100':'text-slate-400'}`}>{formatDate(item.created_at,{hour:'2-digit',minute:'2-digit'})}</small></div>) : <div className="py-10 text-center text-sm text-slate-500">Почніть розмову з водієм або пасажиром.</div>}</div>
      <form onSubmit={sendMessage} className="mt-3 flex gap-2 rounded-full bg-white p-2 shadow-sm"><input value={messageDraft} onChange={event=>setMessageDraft(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" placeholder="Напишіть повідомлення…" maxLength={4000}/><button disabled={busy||!messageDraft.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-white disabled:opacity-50"><ArrowRight size={18}/></button></form>
    </>}
  </div>;

  const vehicleCard = (vehicle: ApiVehicle) => {
    const records = verificationRecords.filter((record) => record.vehicle_id === vehicle.id);
    const reviewPending = records.some((record) => record.status === 'pending');
    const reviewRejected = records.some((record) => record.status === 'rejected');
    const latestRejected = records
      .filter((record) => record.status === 'rejected')
      .sort((a, b) => Date.parse(b.reviewed_at ?? b.created_at) - Date.parse(a.reviewed_at ?? a.created_at))[0];
    const photos = vehiclePhotos[vehicle.id] ?? [];
    return <article key={vehicle.id} className="rounded-xl bg-[#f6f8fc] p-3">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-blue-600"><CarFront size={19}/></span><div className="min-w-0 flex-1"><b className="block text-sm">{vehicle.make} {vehicle.model}</b><small className="text-slate-500">{vehicle.model_year} · {vehicle.seat_count} місць · {vehicle.verification_status==='verified'?'Перевірено':vehicle.verification_status==='rejected'?'Відхилено':'Потрібна перевірка'}</small></div>{vehicle.is_active?<span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Активне</span>:<button onClick={async()=>{setBusy(true);try{await productionApi.activateVehicle(vehicle.id);await refreshVehicles();}catch(error){setStatusMessage(error instanceof Error?error.message:'Не вдалося активувати авто.');}finally{setBusy(false);}}} className="text-xs font-bold text-blue-600">Обрати</button>}</div>
      {photos.length>0?<div className="mt-3 grid grid-cols-3 gap-2">{photos.map((photo)=><div key={photo.id} className="relative overflow-hidden rounded-lg bg-white"><img src={photo.url} alt={`${vehicle.make} ${vehicle.model}`} className="aspect-[4/3] w-full object-cover"/><div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-slate-950/60 px-2 py-1 text-[9px] text-white"><button onClick={()=>void setPrimaryVehiclePhoto(vehicle.id,photo.id)} className="font-bold">{photo.is_primary?'Головне':'Зробити головним'}</button><button onClick={()=>void deleteVehiclePhoto(vehicle.id,photo.id)} aria-label="Видалити фото">×</button></div></div>)}</div>:<p className="mt-2 text-[10px] text-slate-500">Фото потрібне для публікації поїздки.</p>}
      {user.roles.includes('driver')&&<label className="mt-2 flex w-full cursor-pointer items-center justify-center rounded-lg bg-white py-2 text-xs font-bold text-blue-700">{busy?'Зачекайте…':'Додати фото авто'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadVehiclePhoto(vehicle.id,file);event.currentTarget.value='';}} className="sr-only"/></label>}
      {vehicle.verification_status==='rejected'&&latestRejected&&<p role="status" className="mt-2 rounded-lg border border-rose-100 bg-rose-50 p-2.5 text-xs leading-5 text-rose-800"><b>Потрібно виправити документи.</b> Причина: {latestRejected.review_note||'Модератор попросив подати документи повторно.'} Після виправлення їх можна надіслати ще раз.</p>}
      {vehicle.verification_status!=='verified'&&<button disabled={reviewPending} onClick={()=>{setRegistrationEvidence(null);setDriverLicenseEvidence(null);setVerificationTarget(vehicle);}} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-xs font-bold text-blue-700 disabled:text-slate-400"><ShieldCheck size={14}/>{reviewPending?'Документи на перевірці':reviewRejected?'Надіслати повторно':'Подати документи'}</button>}
    </article>;
  };

  const profileScreen = <div className="mx-auto w-full max-w-xl px-5 pb-8"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Обліковий запис</p><h1 className="mt-1 text-2xl font-extrabold">Профіль</h1></div>
    <div className="flex items-center gap-4 rounded-[1.4rem] bg-white p-5 shadow-sm"><span className="grid h-14 w-14 place-items-center rounded-full bg-blue-100 text-xl font-extrabold text-blue-700">{user.display_name.slice(0,1).toUpperCase()}</span><div className="min-w-0 flex-1"><b className="text-lg">{user.display_name}</b><p className="text-sm text-slate-500">{user.phone_e164}</p><p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">{user.is_verified ? <><ShieldCheck size={14}/> Номер підтверджено</> : 'Профіль не верифіковано'}</p></div></div>
    <section className="mt-4 rounded-[1.4rem] bg-white p-4 shadow-sm"><h2 className="font-extrabold">Конфіденційність і дані</h2><p className="mt-1 text-xs leading-5 text-slate-500">Завантажте копію даних профілю, автомобілів, бронювань і заявок, які зберігає MARSHGO.</p><button type="button" disabled={exportingData} onClick={()=>void downloadPersonalData()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"><FileDown size={17}/>{exportingData?'Готуємо файл…':'Завантажити мої дані (JSON)'}</button><p className="mt-2 text-[10px] leading-4 text-slate-400">Файл формується з вашого автентифікованого профілю. Чужі дані до нього не включаються.</p></section>
    <section className="mt-4 rounded-[1.4rem] bg-white p-4 shadow-sm"><h2 className="font-extrabold">Видалення акаунта</h2>{deletionRequest?.status==='cooling_off'?<><p className="mt-1 text-xs leading-5 text-amber-800">Запит очікує скасування до {deletionRequest.cooling_off_until?formatDate(deletionRequest.cooling_off_until,{dateStyle:'medium',timeStyle:'short'}):'завершення періоду очікування'}. Дані ще не видалені; цей deployment не має автоматичного purge worker.</p><button type="button" disabled={deletionBusy} onClick={()=>void cancelDeletion()} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-60">{deletionBusy?'Оновлюємо…':'Скасувати запит'}</button></>:deletionRequest?.status==='cancelled'?<><p className="mt-1 text-xs text-slate-500">Попередній запит скасовано. Дані залишаються в акаунті.</p><button type="button" disabled={deletionBusy} onClick={()=>void requestDeletion()} className="mt-3 w-full rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-60">Подати новий запит</button></>:deletionRequest?<p className="mt-1 text-xs leading-5 text-slate-500">Статус останнього запиту: {deletionRequest.status}. Зверніться до підтримки для уточнення подальшої обробки.</p>:<><p className="mt-1 text-xs leading-5 text-slate-500">Запит відкриває період очікування із можливістю скасування. Фактичне стирання потребує окремої обробки даних і не відбувається натисканням кнопки.</p><button type="button" disabled={deletionBusy} onClick={()=>void requestDeletion()} className="mt-3 w-full rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-60">{deletionBusy?'Надсилаємо…':'Подати запит на видалення'}</button></>}</section>
    <div className="mt-4 rounded-[1.4rem] bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-extrabold">Мій автомобіль</h2><p className="text-xs text-slate-500">Авто, прив’язані до вашого акаунта</p></div><button onClick={()=>user.roles.includes('driver')?setShowVehicleForm(true):setStatusMessage('Спершу активуйте роль водія.')} className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-blue-700" aria-label="Додати авто"><Plus size={19}/></button></div>
      {vehicles.length ? <div className="space-y-2">{vehicles.map(vehicleCard)}</div> : <p className="rounded-xl bg-[#f6f8fc] p-3 text-sm text-slate-500">Автомобілів ще не додано.</p>}
      <button onClick={()=>void enableDriver()} disabled={user.roles.includes('driver')||busy} className="mt-3 w-full rounded-xl border border-blue-100 py-3 text-sm font-bold text-blue-700 disabled:text-slate-400">{user.roles.includes('driver')?'Роль водія активна':'Увімкнути роль водія'}</button>
    </div>
    <section className="mt-4 rounded-[1.4rem] bg-white p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><Ban size={17} className="text-rose-600"/><div><h2 className="font-extrabold">Заблоковані користувачі</h2><p className="text-xs text-slate-500">Керуйте приватним списком блокувань</p></div></div>{blockedUsers.length? <div className="space-y-2">{blockedUsers.map((blocked)=><div key={blocked.user_id} className="flex items-center gap-3 rounded-xl bg-[#f6f8fc] p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-sm font-bold text-slate-600">{blocked.display_name.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{blocked.display_name}</b><small className="text-slate-500">Заблоковано {formatDate(blocked.created_at,{day:'numeric',month:'short',year:'numeric'})}</small></span><button disabled={busy} onClick={()=>void unblockContact(blocked)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50">Розблокувати</button></div>)}</div>:<p className="rounded-xl bg-[#f6f8fc] p-3 text-sm text-slate-500">Список порожній. Заблокувати контакт можна з його чату.</p>}</section>
    <div className="mt-4 overflow-hidden rounded-[1.4rem] bg-white shadow-sm">{[['Документи','Статус перевірки доступний у профілі'],['Налаштування','Особисті налаштування'],['Допомога','Центр підтримки']].map(([title,sub])=><button key={title} onClick={()=>setStatusMessage(`${title}: цей розділ ще не реалізовано.`)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-4 text-left last:border-0"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-slate-600"><ShieldCheck size={17}/></span><span className="flex-1"><b className="block text-sm">{title}</b><small className="text-slate-400">{sub}</small></span><ChevronRight size={17} className="text-slate-400"/></button>)}</div>
    {user.roles.some((role)=>role==='admin'||role==='moderator')&&<button onClick={()=>setTab('admin')} className="mt-3 flex w-full items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm"><span><b className="block text-sm">Модерація та скарги</b><small className="text-slate-500">Захищені черги перевірки документів і безпеки</small></span><ChevronRight size={17} className="text-slate-400"/></button>}
    <button onClick={()=>void logout()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-rose-600 shadow-sm"><LogOut size={16}/>Вийти</button>
  </div>;

  const adminScreen = <div className="mx-auto w-full max-w-xl px-5 pb-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Тільки персонал</p><h1 className="text-2xl font-extrabold">Перевірка документів</h1></div><button onClick={()=>void refreshAdminQueue().catch((error:unknown)=>setStatusMessage(error instanceof Error?error.message:'Черга недоступна.'))} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700">Оновити</button></div><p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Документи містять чутливі дані. Відкриття й рішення журналюються; схвалення одного документа ще не верифікує авто.</p>{adminQueue.length?<div className="space-y-3">{adminQueue.map(record=><article key={record.id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">{record.verification_type==='vehicle'?'Реєстраційний документ':record.verification_type==='driver_license'?'Посвідчення водія':record.verification_type}</p><h2 className="mt-1 font-extrabold">{record.display_name}</h2><p className="mt-1 text-xs text-slate-500">{record.make&&record.model?`${record.make} ${record.model} · ${record.model_year} · ${record.seat_count} місць`:'Документ профілю'}</p><p className="mt-1 text-[10px] text-slate-400">Подано {formatDate(record.created_at)}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">Очікує</span></div><button disabled={busy} onClick={()=>void openVerificationEvidence(record)} className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-xs font-bold text-white disabled:opacity-50">Відкрити та перевірити документ</button></article>)}</div>:<div className="rounded-2xl bg-white p-6 text-center"><ShieldCheck className="mx-auto text-emerald-600"/><p className="mt-2 font-bold">Черга порожня</p><p className="mt-1 text-xs text-slate-500">Нові подання з’являться після завантаження водієм документів.</p></div>}</div>;

  const moderationScreen = <section className="mb-5 rounded-[1.4rem] bg-[#eef4ff] p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-700">Безпека спільноти</p><h2 className="text-lg font-extrabold">Скарги користувачів</h2></div><button onClick={()=>void refreshModerationCases().catch(error=>setStatusMessage(error instanceof Error?error.message:'Черга скарг недоступна.'))} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700">Оновити</button></div>{moderationCases.length? <div className="space-y-3">{moderationCases.map(report=><article key={report.id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-rose-600">{({safety:'Безпека',harassment:'Домагання',fraud:'Шахрайство',service:'Якість сервісу',other:'Інше'} as const)[report.category]}</p><h3 className="mt-1 text-sm font-extrabold">{report.reporter_name} · {report.reported_user_name}</h3><p className="mt-1 text-xs text-slate-500">{report.origin_name&&report.destination_name?`${report.origin_name} → ${report.destination_name}`:'Бронювання недоступне'} · {formatDate(report.created_at)}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{report.details}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${report.status==='open'?'bg-amber-50 text-amber-700':report.status==='in_review'?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-600'}`}>{report.status==='open'?'Нова':report.status==='in_review'?'У роботі':report.status==='resolved'?'Вирішена':'Відхилена'}</span></div>{report.status==='open'&&<button disabled={busy} onClick={()=>void reviewModerationCase(report,'in_review')} className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">Взяти у роботу</button>}{report.status==='in_review'&&<><label className="mt-3 block text-xs font-semibold text-slate-600">Рішення й коротке обґрунтування<textarea value={moderationNotes[report.id]??''} onChange={event=>setModerationNotes(current=>({...current,[report.id]:event.target.value}))} maxLength={1000} className="mt-1.5 min-h-16 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder="Опишіть перевірку та вжиті заходи"/></label><div className="mt-2 grid grid-cols-2 gap-2"><button disabled={busy} onClick={()=>void reviewModerationCase(report,'resolved','no_action')} className="rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">Підтвердити, без блокування</button><button disabled={busy} onClick={()=>void reviewModerationCase(report,'dismissed','no_action')} className="rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">Відхилити скаргу</button>{user.roles.includes('admin')&&<button disabled={busy} onClick={()=>void reviewModerationCase(report,'resolved','suspend_account')} className="col-span-2 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">Призупинити акаунт і відкликати сесії</button>}</div></>}</article>)}</div>:<div className="rounded-xl bg-white p-4 text-sm text-slate-500">Скарг у черзі немає.</div>}</section>;
  const adminDashboard = <div className="mx-auto w-full max-w-xl px-5 pb-5">{moderationScreen}{adminScreen}</div>;

  const publishableVehicles = vehicles.filter((vehicle) => vehicle.verification_status === 'verified' && (vehiclePhotos[vehicle.id]?.length ?? 0) > 0);
  const offerFormScreen = <div className="mx-auto w-full max-w-xl px-5 pb-5">
    <div className="mb-4 flex items-center gap-3"><button onClick={()=>setTab('home')} className="grid h-10 w-10 place-items-center rounded-full bg-white"><ArrowLeft size={18}/></button><div><p className="text-xs text-slate-500">MARSHGO Community</p><h1 className="font-extrabold">Опублікувати поїздку</h1></div></div>
    <form onSubmit={publishOffer} className="space-y-3 rounded-[1.5rem] bg-white p-4 shadow-sm">
      {([['origin','Звідки',offerOriginText,setOfferOriginText,offerOrigin],['destination','Куди',offerDestinationText,setOfferDestinationText,offerDestination]] as const).map(([field,label,value,setValue,selected])=><div key={field} className="rounded-xl bg-[#f6f8fc] p-3"><label className="block text-[10px] font-semibold text-slate-400">{label}</label><div className="mt-1 flex items-center gap-2"><MapPin size={16} className={field==='origin'?'text-emerald-600':'text-rose-500'}/><input required value={value} onChange={event=>{setValue(event.target.value);if(field==='origin')setOfferOrigin(null);else setOfferDestination(null);}} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" placeholder="Пошук адреси або міста"/><button type="button" onClick={()=>void searchOfferPlace(field)} disabled={placeSearchBusy} className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-blue-700">{placeSearchBusy&&offerPlaceField===field?'...':'Знайти'}</button></div>{selected&&<p className="mt-1 text-[10px] text-emerald-700">Точку вибрано з геокодера</p>}{offerPlaceField===field&&offerPlaceSuggestions.length>0&&<div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-white">{offerPlaceSuggestions.map(place=><button key={place.providerId} type="button" onClick={()=>chooseOfferPlace(place)} className="block w-full px-3 py-2.5 text-left text-xs hover:bg-blue-50">{place.label}</button>)}</div>}</div>)}
      <label className="block rounded-xl bg-[#f6f8fc] p-3 text-[10px] font-semibold text-slate-400">Час відправлення · Київ<input required type="datetime-local" min={formatKyivDateTimeInput(new Date(Date.now()+60_000))} value={offerDeparture} onChange={event=>setOfferDeparture(event.target.value)} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800 outline-none"/></label>
      <label className="block rounded-xl bg-[#f6f8fc] p-3 text-[10px] font-semibold text-slate-400">Перевірений автомобіль<select required value={offerVehicleId} onChange={event=>{setOfferVehicleId(event.target.value);const selected=vehicles.find(vehicle=>vehicle.id===event.target.value);if(selected)setOfferSeats(Math.min(offerSeats,selected.seat_count));}} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800"><option value="">Оберіть авто</option>{publishableVehicles.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.seat_count} місць</option>)}</select></label>
      {publishableVehicles.length===0&&<div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Для публікації потрібне перевірене авто зі справжнім фото. Додайте авто й фото в профілі та дочекайтеся перевірки документів.<button type="button" onClick={()=>setTab('profile')} className="ml-1 font-bold underline">Відкрити профіль</button></div>}
      <div className="grid grid-cols-2 gap-2"><label className="rounded-xl bg-[#f6f8fc] p-3 text-[10px] font-semibold text-slate-400">Ціна за місце, грн<input required inputMode="decimal" value={offerPrice} onChange={event=>setOfferPrice(event.target.value)} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800 outline-none"/></label><label className="rounded-xl bg-[#f6f8fc] p-3 text-[10px] font-semibold text-slate-400">Місця<select value={offerSeats} onChange={event=>setOfferSeats(Number(event.target.value))} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800">{Array.from({length:Math.max(1,vehicles.find(vehicle=>vehicle.id===offerVehicleId)?.seat_count??1)},(_,index)=>index+1).map(count=><option key={count} value={count}>{count}</option>)}</select></label></div>
      <button disabled={busy||!publishableVehicles.some(vehicle=>vehicle.id===offerVehicleId)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white disabled:opacity-50">{busy?'Публікуємо…':'Опублікувати поїздку'}<ArrowRight size={17}/></button>
      <p className="text-[10px] leading-4 text-slate-400">Платформа бере 0% комісії з приватних Community-поїздок. Дорожню відстань та ETA має підтвердити налаштований сервер маршрутизації.</p>
    </form>
  </div>;

  const demandFormScreen = <div className="mx-auto w-full max-w-xl px-5 pb-5">
    <div className="mb-4 flex items-center gap-3"><button onClick={()=>setTab('home')} className="grid h-10 w-10 place-items-center rounded-full bg-white"><ArrowLeft size={18}/></button><div><p className="text-xs text-slate-500">Reverse Marketplace</p><h1 className="font-extrabold">Шукаю поїздку</h1></div><button onClick={()=>{setSelectedDemand(null);setTab('my-demands');}} className="ml-auto text-xs font-bold text-blue-600">Мої заявки</button></div>
    <form onSubmit={publishDemand} className="space-y-3 rounded-[1.5rem] bg-white p-4 shadow-sm">
      {([['origin','Звідки',demandOriginText,setDemandOriginText,demandOrigin],['destination','Куди',demandDestinationText,setDemandDestinationText,demandDestination]] as const).map(([field,label,value,setValue,selected])=><div key={field} className="rounded-xl bg-[#f6f8fc] p-3"><label className="block text-[10px] font-semibold text-slate-400">{label}</label><div className="mt-1 flex items-center gap-2"><MapPin size={16} className={field==='origin'?'text-emerald-600':'text-rose-500'}/><input required value={value} onChange={event=>{setValue(event.target.value);if(field==='origin')setDemandOrigin(null);else setDemandDestination(null);}} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" placeholder="Пошук адреси або міста"/><button type="button" onClick={()=>void searchPlace(field)} disabled={placeSearchBusy} className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-blue-700">{placeSearchBusy&&placeField===field?'...':'Знайти'}</button></div>{selected&&<p className="mt-1 text-[10px] text-emerald-700">Точку вибрано з геокодера</p>}{placeField===field&&placeSuggestions.length>0&&<div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-white">{placeSuggestions.map(place=><button key={place.providerId} type="button" onClick={()=>choosePlace(place)} className="block w-full px-3 py-2.5 text-left text-xs hover:bg-blue-50">{place.label}</button>)}</div>}</div>)}
      <div className="grid grid-cols-2 gap-2"><label className="rounded-xl bg-[#f6f8fc] p-3 text-[10px] font-semibold text-slate-400">Не раніше<input required type="datetime-local" value={demandEarliest} onChange={event=>setDemandEarliest(event.target.value)} className="mt-1 block w-full bg-transparent text-xs font-bold text-slate-800 outline-none"/></label><label className="rounded-xl bg-[#f6f8fc] p-3 text-[10px] font-semibold text-slate-400">Не пізніше<input required type="datetime-local" value={demandLatest} onChange={event=>setDemandLatest(event.target.value)} className="mt-1 block w-full bg-transparent text-xs font-bold text-slate-800 outline-none"/></label></div>
      <div className="grid grid-cols-2 gap-2"><label className="rounded-xl bg-[#f6f8fc] p-3 text-[10px] font-semibold text-slate-400">Пасажири<select value={demandPassengers} onChange={event=>setDemandPassengers(Number(event.target.value))} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800">{Array.from({length:8},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label><label className="rounded-xl bg-[#f6f8fc] p-3 text-[10px] font-semibold text-slate-400">Бюджет, грн<input inputMode="decimal" value={demandBudget} onChange={event=>setDemandBudget(event.target.value)} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800 outline-none" placeholder="Не вказано"/></label></div>
      <label className="block rounded-xl bg-[#f6f8fc] p-3 text-[10px] font-semibold text-slate-400">Тип бюджету<select value={demandBudgetType} onChange={event=>setDemandBudgetType(event.target.value as 'total_all'|'per_seat')} className="mt-1 block w-full bg-transparent text-xs font-bold text-slate-800"><option value="total_all">За всю поїздку</option><option value="per_seat">За одне місце</option></select></label>
      <div className="rounded-xl bg-[#f6f8fc] p-3"><p className="mb-2 text-[10px] font-semibold text-slate-400">Потреби пасажирів</p><div className="flex flex-wrap gap-2">{([['luggage','Багаж'],['pets','Тварини'],['childSeat','Дитяче крісло']] as const).map(([key,label])=><label key={key} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600"><input type="checkbox" checked={demandRequirements[key]} onChange={event=>setDemandRequirements({...demandRequirements,[key]:event.target.checked})} className="accent-blue-600"/>{label}</label>)}</div></div>
      <label className="block rounded-xl bg-[#f6f8fc] p-3 text-[10px] font-semibold text-slate-400">Додаткові умови<textarea value={demandNotes} onChange={event=>setDemandNotes(event.target.value)} maxLength={1000} rows={2} className="mt-1 block w-full resize-none bg-transparent text-sm text-slate-800 outline-none" placeholder="Що ще важливо водієві знати?"/></label>
      <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white disabled:opacity-50">{busy?'Публікуємо…':'Опублікувати заявку'}<ArrowRight size={17}/></button>
      <p className="text-[10px] leading-4 text-slate-400">Координати зберігаються з вибраних геокодером точок. Якщо сервіс місць не налаштовано, заявка не публікується.</p>
    </form>
  </div>;

  const proposalCard = (proposal: ApiProposal) => {
    const myRole = selectedDemandIsOwned ? 'passenger' : 'driver';
    const isMyTurn = proposal.last_actor_role !== myRole && proposal.status === 'pending';
    const needsDriverAgreement = !selectedDemandIsOwned && proposal.last_actor_role === 'passenger' && proposal.status === 'pending';
    const passengerCanConfirm = selectedDemandIsOwned && proposal.last_actor_role === 'driver' && proposal.status === 'pending';
    return <article key={proposal.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><b className="text-sm">{proposal.driver_name}</b><p className="text-xs text-slate-500">{proposal.make} {proposal.model} · {proposal.model_year}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${proposal.status==='pending'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-500'}`}>{proposal.status==='pending'?'Переговори':proposal.status==='expired'?'Пропозиція більше не актуальна':proposal.status==='accepted'?'Бронювання створено':proposal.status==='rejected'?'Закрито':'Відкликано'}</span></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-500">{formatDate(proposal.departure_at)}</span><b className="text-lg">{formatMoney(proposal.price_minor,proposal.currency)}</b></div>{proposal.last_comment&&<p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{proposal.last_comment}</p>}
      <button onClick={()=>void loadProposalHistory(proposal.id)} className="mt-3 text-[11px] font-bold text-blue-600">Історія переговорів</button>
      {proposalRevisions[proposal.id]&&<div className="mt-2 space-y-1 border-l-2 border-blue-100 pl-3">{proposalRevisions[proposal.id].map(revision=><p key={revision.revision_number} className="text-[10px] text-slate-500">{revision.actor_role==='driver'?'Водій':'Пасажир'} · {formatMoney(revision.price_minor,'UAH')} · {formatDate(revision.created_at,{hour:'2-digit',minute:'2-digit'})}{revision.comment?` · ${revision.comment}`:''}</p>)}</div>}
      {proposal.status==='pending'&&<div className="mt-3 grid grid-cols-1 gap-2">{isMyTurn&&<button onClick={()=>{setCounterTarget(proposal);setCounterPrice(String((proposal.price_minor/100).toFixed(2)));setCounterDeparture(formatKyivDateTimeInput(proposal.departure_at));setCounterComment('');}} className="rounded-xl border border-blue-200 py-2.5 text-xs font-bold text-blue-700">Змінити ціну або час</button>}{needsDriverAgreement&&<button disabled={busy} onClick={()=>void agreeProposal(proposal)} className="rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white">Погодити зустрічну ціну</button>}{passengerCanConfirm&&<button disabled={busy} onClick={()=>void confirmProposal(proposal)} className="rounded-xl bg-blue-600 py-3 text-xs font-bold text-white">Підтвердити домовленість і бронювання</button>}</div>}</article>;
  };

  const demandDetailScreen = (owned: boolean) => selectedDemand ? <div className="mx-auto w-full max-w-xl px-5 pb-5"><div className="mb-4 flex items-center gap-3"><button onClick={()=>setSelectedDemand(null)} className="grid h-10 w-10 place-items-center rounded-full bg-white"><ArrowLeft size={18}/></button><div><p className="text-xs text-slate-500">{owned?'Моя заявка':'Заявка пасажира'}</p><h1 className="font-extrabold">{selectedDemand.origin_name.split(',')[0]} → {selectedDemand.destination_name.split(',')[0]}</h1></div></div><div className="mb-3 rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm font-bold">{formatDate(selectedDemand.earliest_departure)} – {formatDate(selectedDemand.latest_departure,{hour:'2-digit',minute:'2-digit'})}</p><p className="mt-1 text-xs text-slate-500">{selectedDemand.passenger_count} пасажири · {selectedDemand.budget_minor===null?'Бюджет не вказано':`${formatMoney(selectedDemand.budget_minor,'UAH')} ${selectedDemand.budget_type==='per_seat'?'за місце':'за всіх'}`}</p>{selectedDemand.notes&&<p className="mt-2 text-xs text-slate-600">{selectedDemand.notes}</p>}{owned&&selectedDemand.status==='open'&&<button onClick={()=>void cancelDemand(selectedDemand)} className="mt-3 text-xs font-bold text-rose-600">Скасувати заявку</button>}</div><div className="mb-2 flex items-center justify-between"><h2 className="font-extrabold">Пропозиції водіїв</h2><span className="text-xs text-slate-500">{proposals.length}</span></div>{proposals.length?<div className="space-y-3">{proposals.map(proposalCard)}</div>:<p className="rounded-2xl bg-white p-4 text-sm text-slate-500">Пропозицій поки немає.</p>}</div> : null;

  const myDemandsScreen = selectedDemand && selectedDemandIsOwned ? demandDetailScreen(true) : <div className="mx-auto w-full max-w-xl px-5 pb-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Пасажир</p><h1 className="text-2xl font-extrabold">Мої заявки</h1></div><div className="flex gap-2"><button onClick={()=>void refreshPassengerNavigationMatches().catch(error=>setStatusMessage(error instanceof Error?error.message:'Підбір недоступний.'))} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700">Оновити</button><button onClick={()=>{setSelectedDemand(null);setTab('demand');}} className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-white"><Plus size={20}/></button></div></div>{passengerNavigationMatches.length>0&&<section className="mb-4 space-y-2"><h2 className="px-1 text-sm font-extrabold">Водії поруч із маршрутом</h2>{passengerNavigationMatches.map(match=><article key={match.candidate_id} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><b className="text-sm">{match.origin_name.split(',')[0]} → {match.destination_name.split(',')[0]}</b><p className="mt-1 text-xs text-slate-500">Забір орієнтовно {formatDate(match.pickup_eta,{hour:'2-digit',minute:'2-digit'})} · відхилення +{(match.detour_distance_m/1000).toFixed(1)} км / +{Math.round(match.detour_duration_s/60)} хв</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{match.status==='passenger_confirmed'?'Взаємний інтерес':'Є інтерес водія'}</span></div>{match.status==='driver_interested'?<><p className="mt-2 text-xs text-slate-500">Підтвердьте, якщо цей маршрут і час вам підходять. Це ще не бронювання.</p><button disabled={busy} onClick={()=>void confirmNavigationMatch(match.candidate_id)} className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">Підтвердити взаємний інтерес</button></>:<p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Взаємний інтерес підтверджено. Водій може надіслати ціну у пропозиції до цієї заявки; бронювання ще немає.</p>}</article>)}</section>}{myDemands.length?<div className="space-y-3">{myDemands.map(demand=><button key={demand.id} data-testid={`owned-demand-${demand.id}`} onClick={()=>void viewDemand(demand,true)} className="w-full rounded-2xl bg-white p-4 text-left shadow-sm"><div className="flex items-center justify-between"><b>{demand.origin_name.split(',')[0]} → {demand.destination_name.split(',')[0]}</b><span className="text-[10px] text-slate-400">{demand.status}</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(demand.earliest_departure)} · {demand.passenger_count} пасажир(и)</p><p className="mt-2 text-xs font-bold text-blue-600">{demand.budget_minor===null?'Без вказаного бюджету':`${formatMoney(demand.budget_minor,'UAH')} ${demand.budget_type==='per_seat'?'за місце':'за всіх'}`} · {demand.proposal_count ?? 0} пропозицій</p></button>)}</div>:<div className="rounded-2xl bg-white p-6 text-center"><Compass className="mx-auto text-slate-300"/><p className="mt-2 font-bold">Ви ще не публікували запитів</p><button onClick={()=>setTab('demand')} className="mt-3 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Створити заявку</button></div>}</div>;

  const requestsScreen = selectedDemand && !selectedDemandIsOwned ? demandDetailScreen(false) : (
    <div className="mx-auto w-full max-w-xl px-5 pb-5">
      <div className="mb-4 flex items-center justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Для водія</p><h1 className="text-2xl font-extrabold">Заявки пасажирів</h1></div>
        <button onClick={() => { void refreshOpenDemands().catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Заявки недоступні.')); }} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700">Оновити</button>
      </div>
      {statusMessage && <p role="status" className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">{statusMessage}</p>}
      <p className="mb-3 rounded-xl bg-amber-50 p-3 text-[11px] leading-4 text-amber-800">Список показує відкриті заявки. Автоматичне географічне ранжування за маршрутом ще не підключено.</p>
      {openDemands.length ? <div className="space-y-3">
        {openDemands.map((demand) => <article key={demand.id} data-testid={`open-demand-${demand.id}`} className="rounded-2xl bg-white p-4 shadow-sm">
          <button onClick={() => { void viewDemand(demand, false); }} className="w-full text-left">
            <div className="flex items-start justify-between gap-2"><b>{demand.origin_name.split(',')[0]} → {demand.destination_name.split(',')[0]}</b><ChevronRight size={17} className="shrink-0 text-slate-400"/></div>
            <p className="mt-1 text-xs text-slate-500">{formatDate(demand.earliest_departure)} – {formatDate(demand.latest_departure, { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="mt-1 text-xs text-slate-500">{demand.passenger_count} пасажири · {demand.budget_minor === null ? 'Бюджет не вказано' : `${formatMoney(demand.budget_minor, 'UAH')} ${demand.budget_type === 'per_seat' ? 'за місце' : 'за всіх'}`}</p>
            {demand.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-600">{demand.notes}</p>}
            {Object.entries(demand.requirements ?? {}).some(([, enabled]) => enabled === true) && <p className="mt-2 text-[10px] font-semibold text-blue-700">{Object.entries(demand.requirements ?? {}).filter(([, enabled]) => enabled === true).map(([key]) => demandRequirementLabels[key] ?? key).join(' · ')}</p>}
          </button>
          <button disabled={!vehicles.some((vehicle) => vehicle.verification_status === 'verified') || busy} onClick={() => {
            setProposalNavigationCandidateId(null);
            setProposalTarget(demand);
            setProposalDeparture(formatKyivDateTimeInput(demand.earliest_departure));
            const proposedTotal = demand.budget_minor === null ? null : demand.budget_minor / 100 * (demand.budget_type === 'per_seat' ? demand.passenger_count : 1);
            setProposalPrice(proposedTotal === null ? '' : String(proposedTotal.toFixed(2)));
            const verified = vehicles.find((vehicle) => vehicle.verification_status === 'verified' && vehicle.is_active) ?? vehicles.find((vehicle) => vehicle.verification_status === 'verified');
            setProposalVehicleId(verified?.id ?? '');
          }} className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500">
            {vehicles.some((vehicle) => vehicle.verification_status === 'verified') ? 'Запропонувати ціну' : 'Потрібне перевірене авто'}
          </button>
        </article>)}
      </div> : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">Відкритих заявок зараз немає.</p>}
    </div>
  );

  const createMenu = showCreateMenu ? <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/35 p-3 sm:items-center"><div className="w-full max-w-md rounded-[1.6rem] bg-white p-4 shadow-xl"><div className="mb-3 flex items-center justify-between"><h2 className="font-extrabold">Створити</h2><button onClick={()=>setShowCreateMenu(false)} aria-label="Закрити"><X size={20}/></button></div><button onClick={()=>{setShowCreateMenu(false);setSelectedDemand(null);setSelectedDemandIsOwned(false);setProposals([]);setTab('demand');}} className="mb-2 flex w-full items-center gap-3 rounded-xl bg-blue-50 p-3 text-left"><Compass className="text-blue-600"/><span><b className="block text-sm">Шукаю поїздку</b><small className="text-slate-500">Опублікувати маршрут і бюджет</small></span></button><button onClick={()=>{setShowCreateMenu(false);if(!user.roles.includes('driver')){setStatusMessage('Спершу активуйте роль водія у профілі.');setTab('profile');return;}setTab('offer-new');void refreshVehicles().catch(e=>setStatusMessage(e instanceof Error?e.message:'Автомобілі недоступні.'));}} className="mb-2 flex w-full items-center gap-3 rounded-xl bg-emerald-50 p-3 text-left"><CarFront className="text-emerald-600"/><span><b className="block text-sm">Опублікувати поїздку</b><small className="text-slate-500">Власне авто, маршрут і ціна</small></span></button><button onClick={()=>{setShowCreateMenu(false);if(!user.roles.includes('driver')){setStatusMessage('Спершу активуйте роль водія у профілі.');setTab('profile');return;}setTab('navigation');}} className="mb-2 flex w-full items-center gap-3 rounded-xl bg-indigo-50 p-3 text-left"><Navigation className="text-indigo-600"/><span><b className="block text-sm">Прокласти маршрут</b><small className="text-slate-500">Без публікації поїздки · foreground GPS</small></span></button><button onClick={()=>{setShowCreateMenu(false);if(!user.roles.includes('driver')){setStatusMessage('Спершу активуйте роль водія у профілі.');setTab('profile');return;}setSelectedDemand(null);setSelectedDemandIsOwned(false);setProposals([]);setTab('requests');void refreshOpenDemands().catch(e=>setStatusMessage(e instanceof Error?e.message:'Заявки недоступні.'));}} className="flex w-full items-center gap-3 rounded-xl bg-slate-50 p-3 text-left"><Users className="text-blue-600"/><span><b className="block text-sm">Знайти пасажира</b><small className="text-slate-500">Переглянути заявки водієві</small></span></button></div></div> : null;

  const journeyDetailScreen = selectedJourney ? <section className="mx-auto w-full max-w-xl px-5 pb-8"><button onClick={() => { setSelectedJourney(null); setTab('trips'); }} className="mb-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold"><ArrowLeft size={17}/>Мої поїздки</button><article className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Збережений Journey · {selectedJourney.state}</p><h1 className="mt-2 text-2xl font-extrabold">{selectedJourney.origin_name} → {selectedJourney.destination_name}</h1><p className="mt-2 text-sm text-slate-500">{formatDate(selectedJourney.requested_departure_at)} · {selectedJourney.passenger_count} пасажир(и) · {selectedJourney.strategy}</p><p className="mt-3 font-bold text-blue-700">{selectedJourney.confirmed_price_minor !== null ? `Підтверджена ціна ${formatMoney(selectedJourney.confirmed_price_minor, 'UAH')}` : selectedJourney.total_price_minor !== null ? `Розрахункова ціна ${formatMoney(selectedJourney.total_price_minor, 'UAH')}` : 'Ціна ще не визначена'}</p><ol className="mt-5 space-y-3">{selectedJourney.legs.map((leg, index) => <li key={leg.id} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{index + 1}</span><span className="min-w-0 flex-1"><b className="block">{leg.mode === 'COMMUNITY' ? 'Попутка MARSHGO Community' : leg.mode}</b><small className="text-slate-500">{leg.state} · {leg.priceMinor === null ? 'ціна не вказана' : formatMoney(leg.priceMinor, 'UAH')}</small></span></li>)}</ol></article></section> : null;

  const screen = selectedJourney ? journeyDetailScreen : selectedOffer ? <div className="mx-auto w-full max-w-xl px-5 pb-5"><div className="mb-4 flex items-center gap-3"><button onClick={()=>{setSelectedOffer(null);setJourneyBookingLink(null);setTab('search');}} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><ArrowLeft size={18}/></button><div><p className="text-xs text-slate-500">Деталі поїздки</p><h1 className="font-extrabold">{selectedOffer.origin_name.split(',')[0]} → {selectedOffer.destination_name.split(',')[0]}</h1></div></div><div className="mb-3 overflow-hidden rounded-[1.4rem]">{selectedOffer.vehicle_photo_url ? <img src={selectedOffer.vehicle_photo_url} alt={`Авто водія ${selectedOffer.driver_name}`} className="aspect-[16/8] w-full object-cover"/> : <div className="grid aspect-[16/8] place-items-center bg-gradient-to-br from-blue-100 via-slate-100 to-sky-100 text-blue-700"><div className="flex flex-col items-center gap-2"><CarFront size={42}/><span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold text-slate-600">Фото авто не додано</span></div></div>}</div><div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">COMMUNITY · Попутка</span><div className="mt-5 grid grid-cols-2 gap-4"><div><small className="text-slate-400">Відправлення</small><p className="mt-1 text-xl font-extrabold">{formatDate(selectedOffer.departure_at,{hour:'2-digit',minute:'2-digit'})}</p><b>{selectedOffer.origin_name.split(',')[0]}</b></div><div className="text-right"><small className="text-slate-400">Прибуття</small><p className="mt-1 text-xl font-extrabold">{selectedOffer.arrival_at?formatDate(selectedOffer.arrival_at,{hour:'2-digit',minute:'2-digit'}):'—'}</p><b>{selectedOffer.destination_name.split(',')[0]}</b></div></div><div className="my-4 border-t border-slate-100"/><p className="flex items-center gap-3 text-sm"><span className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">{selectedOffer.driver_name.slice(0,1)}</span><span><b>{selectedOffer.driver_name}</b><small className="block text-slate-500">{selectedOffer.review_count?`★ ${Number(selectedOffer.average_rating).toFixed(1)} · ${selectedOffer.review_count} відгуків`:'Новий водій'}</small></span></p><div className="mt-5 flex justify-between text-sm"><span className="text-slate-500">Вільні місця</span><b>{selectedOffer.available_seats}</b></div><div className="mt-3 flex justify-between text-sm"><span className="text-slate-500">Вартість за {seats} {seats===1?'місце':'місця'}</span><b className="text-lg">{formatMoney(selectedOffer.price_per_seat_minor*seats,selectedOffer.currency)}</b></div><p className="mt-1 text-right text-[10px] text-slate-400">MARSHGO Community · комісія платформи 0%</p><button data-testid="offer-book-button" data-offer-id={selectedOffer.id} disabled={busy||selectedOffer.available_seats<seats} onClick={()=>void book(selectedOffer)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white disabled:opacity-50">{busy?'Обробляємо…':'Забронювати місце'}<ArrowRight size={17}/></button></div></div> : tab==='navigation' ? <Suspense fallback={<main className="grid min-h-[100svh] place-items-center bg-[#f5f8fd] text-sm text-slate-500">Завантажуємо навігацію…</main>}><ProductionNavigation onBack={()=>setTab('home')} onOpenDemand={(demandId,candidateId)=>void openNavigationDemand(demandId,candidateId)}/></Suspense> : tab==='home' ? (showResults ? resultsScreen : homeScreen) : tab==='search' ? resultsScreen : tab==='trips' ? tripsScreen : tab==='chat' ? chatScreen : tab==='profile' ? profileScreen : tab==='admin' ? adminDashboard : tab==='demand' ? demandFormScreen : tab==='offer-new' ? offerFormScreen : tab==='requests' ? requestsScreen : myDemandsScreen;

  if (tab === 'navigation' && !selectedOffer) return screen;

  return <main className="production-app min-h-[100svh] bg-[#f5f8fd] pb-[calc(5.3rem+env(safe-area-inset-bottom))] text-[#17243a]">
    {header}
    {status}
    <div className="pt-1">{screen}</div>
    <nav aria-label="Основна навігація" className="app-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pt-2 backdrop-blur-xl"><div className="app-tabbar-inner mx-auto flex max-w-xl items-center justify-around px-1">{tabItems.map((item,index)=>{const Icon=item.icon;const active=tab===item.id;return <span key={item.id} className="contents">{index===2&&<button onClick={()=>setShowCreateMenu(true)} aria-label="Створити поїздку чи запит" className="app-create-button -mt-5 grid h-12 w-12 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30"><Plus size={23}/><span className="desktop-create-label">Створити</span></button>}<button aria-current={active?'page':undefined} onClick={()=>{setTab(item.id);setSelectedOffer(null);setSelectedBooking(null);setJourneyBookingLink(null);}} className={`flex min-w-[56px] flex-col items-center gap-1 px-2 py-1 ${active?'text-blue-600':'text-slate-400'}`}><Icon size={20} strokeWidth={active?2.5:2}/><span className="text-[10px] font-semibold">{item.label}</span></button></span>})}</div></nav>
    {createMenu}
    {showNotifications&&<div className="fixed inset-0 z-[55] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center" onMouseDown={event=>{if(event.target===event.currentTarget)setShowNotifications(false);}}><section aria-labelledby="notification-heading" className="max-h-[78svh] w-full max-w-md overflow-hidden rounded-[1.7rem] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="notification-heading" className="font-extrabold">Сповіщення</h2><p className="mt-0.5 text-xs text-slate-500">Збережені оновлення ваших поїздок</p></div><div className="flex items-center gap-3"><button disabled={!notificationPage.unreadCount} onClick={()=>void markAllNotificationsRead()} className="text-[11px] font-bold text-blue-700 disabled:text-slate-300">Прочитати все</button><button onClick={()=>setShowNotifications(false)} aria-label="Закрити сповіщення"><X size={20}/></button></div></div><div className="max-h-[68svh] overflow-y-auto p-3">{notificationsLoading&&notificationPage.items.length===0?<p className="p-6 text-center text-sm text-slate-500">Завантажуємо…</p>:notificationPage.items.length===0?<p className="p-6 text-center text-sm text-slate-500">Поки що сповіщень немає.</p>:<div className="space-y-2">{notificationPage.items.map(notification=><button key={notification.id} onClick={()=>void markNotificationRead(notification)} className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left ${notification.read_at?'bg-slate-50':'bg-blue-50'}`}><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read_at?'bg-slate-300':'bg-blue-600'}`}></span><span className="min-w-0 flex-1"><b className="block text-sm">{notification.title}</b><span className="mt-0.5 block text-xs leading-5 text-slate-600">{notification.body}</span><time className="mt-1 block text-[10px] text-slate-400">{formatDate(notification.created_at,{dateStyle:'medium',timeStyle:'short'})}</time></span></button>)}</div>}{notificationPage.nextCursor&&<button disabled={notificationsLoading} onClick={()=>void loadMoreNotifications()} className="mt-3 w-full rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-600 disabled:opacity-50">{notificationsLoading?'Завантажуємо…':'Завантажити раніші'}</button>}</div></section></div>}
    {proposalTarget&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center"><form onSubmit={sendProposal} className="w-full max-w-md rounded-[1.7rem] bg-white p-5 shadow-xl"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs text-slate-500">Ваша ціна для пасажира</p>{proposalNavigationCandidateId&&<p className="mt-1 text-[10px] text-emerald-700">Пропозиція прив’язана до підтвердженого збігу навігації; це ще не бронювання.</p>}<h2 className="font-extrabold">{proposalTarget.origin_name.split(',')[0]} → {proposalTarget.destination_name.split(',')[0]}</h2></div><button type="button" onClick={()=>{setProposalTarget(null);setProposalNavigationCandidateId(null);}} aria-label="Закрити"><X size={20}/></button></div><label className="mb-3 block text-xs font-bold text-slate-600">Перевірене авто<select required value={proposalVehicleId} onChange={event=>setProposalVehicleId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Оберіть авто</option>{vehicles.filter(v=>v.verification_status==='verified').map(v=><option key={v.id} value={v.id}>{v.make} {v.model} · {v.seat_count} місць</option>)}</select></label>{!vehicles.some(v=>v.verification_status==='verified')&&<p className="mb-3 text-xs leading-5 text-amber-700">Немає перевіреного авто. Спершу потрібно пройти перевірку перевізника.</p>}<div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-600">Ціна, грн<input required inputMode="decimal" value={proposalPrice} onChange={event=>setProposalPrice(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Загальна сума"/></label><label className="text-xs font-bold text-slate-600">Час виїзду<input required type="datetime-local" value={proposalDeparture} onChange={event=>setProposalDeparture(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-2 py-3 text-xs"/></label></div><label className="mt-3 block text-xs font-bold text-slate-600">Коментар<input value={proposalComment} onChange={event=>setProposalComment(event.target.value)} maxLength={1000} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Коротко про поїздку"/></label><button disabled={busy||!vehicles.some(v=>v.verification_status==='verified')} className="mt-4 w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white disabled:opacity-50">Надіслати пропозицію</button></form></div>}
    {counterTarget&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center"><form onSubmit={sendCounter} className="w-full max-w-md rounded-[1.7rem] bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs text-slate-500">Зустрічна пропозиція</p><h2 className="font-extrabold">Змінити суму або час</h2></div><button type="button" onClick={()=>setCounterTarget(null)} aria-label="Закрити"><X size={20}/></button></div><label className="mb-3 block text-xs font-bold text-slate-600">Загальна сума, грн<input required inputMode="decimal" value={counterPrice} onChange={event=>setCounterPrice(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><label className="mb-3 block text-xs font-bold text-slate-600">Час відправлення<input required type="datetime-local" value={counterDeparture} onChange={event=>setCounterDeparture(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><label className="block text-xs font-bold text-slate-600">Коментар<input value={counterComment} onChange={event=>setCounterComment(event.target.value)} maxLength={1000} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><button disabled={busy} className="mt-4 w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white">Надіслати зустрічну</button></form></div>}
    {showVehicleForm && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center"><form onSubmit={createVehicle} className="w-full max-w-md rounded-[1.7rem] bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">Додати автомобіль</h2><button type="button" onClick={()=>setShowVehicleForm(false)} aria-label="Закрити"><X size={20}/></button></div>{([['make','Марка'],['model','Модель']] as const).map(([key,label])=><label key={key} className="mb-3 block text-xs font-bold text-slate-600">{label}<input required value={vehicleForm[key]} onChange={event=>setVehicleForm({...vehicleForm,[key]:event.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500"/></label>)}<div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-600">Рік<input required type="number" min="1950" max={new Date().getFullYear()+1} value={vehicleForm.modelYear} onChange={event=>setVehicleForm({...vehicleForm,modelYear:Number(event.target.value)})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><label className="text-xs font-bold text-slate-600">Місця<input required type="number" min="1" max="20" value={vehicleForm.seats} onChange={event=>setVehicleForm({...vehicleForm,seats:Number(event.target.value)})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label></div><p className="my-3 text-xs leading-5 text-amber-700">Після додавання завантажте техпаспорт і посвідчення водія. Фото авто можна буде додати після підключення сховища.</p><button disabled={busy} className="w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white">{busy?'Зберігаємо…':'Зберегти автомобіль'}</button></form></div>}
    {showReportForm&&selectedBooking&&<div className="fixed inset-0 z-[55] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center"><form onSubmit={submitSafetyReport} className="w-full max-w-md rounded-[1.7rem] bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Безпека спільноти</p><h2 className="text-lg font-extrabold">Поскаржитися</h2></div><button type="button" onClick={()=>setShowReportForm(false)} aria-label="Закрити"><X size={20}/></button></div><p className="mb-3 text-xs text-slate-500">Скарга стосується учасника поїздки {selectedBooking.origin_name} → {selectedBooking.destination_name}. Не додавайте платіжні дані чи сторонні персональні відомості.</p><label className="mb-3 block text-xs font-bold text-slate-600">Категорія<select value={reportCategory} onChange={event=>setReportCategory(event.target.value as ApiModerationCase['category'])} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="safety">Питання безпеки</option><option value="harassment">Домагання або образи</option><option value="fraud">Підозра на шахрайство</option><option value="service">Якість поїздки</option><option value="other">Інше</option></select></label><label className="block text-xs font-bold text-slate-600">Опишіть ситуацію<textarea required minLength={10} maxLength={2000} value={reportDetails} onChange={event=>setReportDetails(event.target.value)} className="mt-1.5 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder="Що сталося? (10–2000 символів)"/></label><div className="mt-3 flex justify-end text-[10px] text-slate-400">{reportDetails.length}/2000</div><button disabled={busy||reportDetails.trim().length<10} className="mt-3 w-full rounded-xl bg-amber-600 py-3.5 font-bold text-white disabled:opacity-50">{busy?'Надсилаємо…':'Надіслати приватну скаргу'}</button></form></div>}
    {verificationTarget&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center"><form onSubmit={submitVerification} className="w-full max-w-md rounded-[1.7rem] bg-white p-5 shadow-xl"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs text-slate-500">Перевірка автомобіля</p><h2 className="font-extrabold">{verificationTarget.make} {verificationTarget.model}</h2></div><button type="button" onClick={()=>{setVerificationTarget(null);setRegistrationEvidence(null);setDriverLicenseEvidence(null);}} aria-label="Закрити"><X size={20}/></button></div><p className="mb-4 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Завантажте техпаспорт і посвідчення водія. Маршрути не показують ці документи; рішення ухвалює уповноважений модератор.</p><label className="mb-3 block text-xs font-bold text-slate-600">Свідоцтво про реєстрацію<input required type="file" accept="image/jpeg,image/png,application/pdf" onChange={event=>setRegistrationEvidence(event.target.files?.[0]??null)} className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2 text-xs"/></label><label className="block text-xs font-bold text-slate-600">Посвідчення водія<input required type="file" accept="image/jpeg,image/png,application/pdf" onChange={event=>setDriverLicenseEvidence(event.target.files?.[0]??null)} className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2 text-xs"/></label><p className="mt-2 text-[10px] text-slate-500">JPEG, PNG або PDF · до 8 МБ на файл</p><button disabled={busy} className="mt-4 w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white disabled:opacity-50">{busy?'Завантажуємо…':'Передати на перевірку'}</button></form></div>}
    {reviewingRecord&&<div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center"><section className="w-full max-w-lg rounded-[1.7rem] bg-white p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Перегляд документа</p><h2 className="font-extrabold">{reviewingRecord.display_name} · {reviewingRecord.verification_type==='vehicle'?'Техпаспорт':reviewingRecord.verification_type==='driver_license'?'Посвідчення водія':'Документ'}</h2></div><button onClick={()=>{setReviewingRecord(null);setReviewEvidenceUrl('');}} aria-label="Закрити"><X size={20}/></button></div><iframe title="Документ водія для перевірки" src={reviewEvidenceUrl} className="h-[48svh] w-full rounded-xl border border-slate-200 bg-slate-50"/><label className="mt-3 block text-xs font-bold text-slate-600">Причина відмови — обов’язкова для відхилення<textarea value={reviewNote} onChange={event=>setReviewNote(event.target.value)} maxLength={1000} className="mt-1.5 min-h-16 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder="Коротко опишіть невідповідність"/></label><div className="mt-3 grid grid-cols-2 gap-2"><button disabled={busy} onClick={()=>void decideVerification('rejected')} className="rounded-xl border border-rose-200 py-3 text-xs font-bold text-rose-700 disabled:opacity-50">Відхилити</button><button disabled={busy} onClick={()=>void decideVerification('approved')} className="rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white disabled:opacity-50">Схвалити документ</button></div></section></div>}
  </main>;
}
