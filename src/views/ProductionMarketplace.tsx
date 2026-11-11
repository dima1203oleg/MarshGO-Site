import { FormEvent, KeyboardEvent, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowDownUp, ArrowLeft, ArrowRight, Ban, Bell, BookmarkCheck, BusFront, CalendarDays, CarFront, ChevronDown, ChevronRight, Coins,
  CircleUserRound, Clock3, Compass, Eye, EyeOff, FileDown, Flag, Home, LogOut, MapPin, MessageCircle, Minus, Navigation, Pencil,
  BadgeCheck, Plus, ScanLine, Search, ShieldCheck, Ticket, Users, WifiOff, X,
} from 'lucide-react';

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { BrandMark } from '../components/BrandMark';
import { CurrentCitySelector } from '../components/CurrentCitySelector';
import { VehiclePhoto } from '../components/VehiclePhoto';
import { passengersLabel } from '../domain/plural';
import { budgetLabel, isAppliedJourneyBudgetDraft, journeySearchBounds, MAX_JOURNEY_BUDGET_UAH, parseJourneyBudgetUah } from '../domain/journeySearchBounds';
import { TransportTypesPanel } from '../components/TransportTypesPanel';
import { DepartureDateTimePicker } from '../components/DepartureDateTimePicker';
import { HomeHero } from './HomeHero';
import { isMapToolbarContext, useMapAwareBottomNavigation } from './mapAwareBottomNavigation';
import './map-aware-bottom-navigation.css';
import { SavedJourneyCard } from '../design-system/journey/SavedJourneyCard';
import { isBookingSection, showsBookingList, showsSavedRoutes, tripsTabSubtitle, tripsTabs, type TripsSection } from './tripsSections';
import { OnboardingSlides } from '../components/OnboardingSlides';
import { DriverPhotoCard } from '../components/DriverPhotoCard';
import { OfferEditSheet, PendingChangeCard, offerStatusLabel } from '../components/TripManagement';
import { isAllActive, loadSelection, mergeSettledProviderGroups, providerCoveragePoints, saveSelection, toJourneyPreferences, transportTypes, type TransportSelection } from '../domain/transportPreferences';
import { MarshPassTicket } from './MarshPassTicket';
import { QrScanner } from '../components/QrScanner';
import type { ProfileSection } from './ProfileSections';
import { compactPlaceLabel, fullPlaceLabel } from '../domain/placeLabel';
import { canAutoDetectCity, cityNameFromPlaceLabel, isCurrentCityRequest, loadCurrentCity, saveCurrentCity, type CurrentCity } from '../domain/currentCity';
import { resolvePlaceAtCoordinates } from '../domain/mapPointSelection';
import { ApiAccountDeletionRequest, ApiBlockedUser, ApiBooking, ApiDemand, ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy, ApiMessage, ApiModerationCase, ApiNotification, ApiNotificationPage, ApiOffer, ApiPassengerNavigationMatch, ApiPlace, ApiProposal, ApiProposalRevision, ApiRescueResult, ApiRendezvous, ApiStoredJourney, ApiUser, ApiVehicle, ApiVehiclePhoto, ApiVerificationQueueItem, ApiVerificationRecord, ProductionApiError, productionApi } from '../services/productionApi';
import { realtimeStatusLabel, realtimeStatusTone, type RealtimeStatus } from '../services/realtimeChannel';
import { storedJourneyToApiJourney } from '../routing/storedJourneyView';
import { activatePassengerJourney, completePassengerJourney, isRestorableJourneyState } from '../services/journeyLifecycle';
import { bookingFailureMessage, boardingFailureMessage, deepLinkFailureMessage, isOfferNoLongerBookable, OFFER_NO_LONGER_BOOKABLE_TEXT, ticketFailureMessage } from './bookingFailureState';
import { refreshCommittedActionData } from './committedActionRefresh';
import { OfflineNavigationStore } from '../navigation/OfflineNavigationStore';
import { ActiveJourneyNavigationStore } from '../navigation/ActiveJourneyNavigationStore';
import { defaultKyivDateTime, formatKyivDateTimeInput, kyivDateTimeInputToDate, kyivDateTimeInputToIso } from '../domain/kyivTime';
import { useProductionTabRouter } from '../routing/useProductionTabRouter';
import { pathForProductionEntity, resumesActiveJourneyFrom, type ProductionTab } from '../routing/productionRoutes';
import { buildSearchRoute, parseSearchRoute } from '../routing/searchRouteState';
import { activePlaceOptionId, moveActivePlaceIndex, placeSuggestionKeyAction } from '../routing/placeSuggestionKeyboard';
import { PLACE_SEARCH_UNAVAILABLE_COPY, placeSearchFailure, placeSearchPending, placeSearchResults, type PlaceSearchState } from '../services/placeSearchRecovery';
import { currentPlaceBias } from '../platform/placeBias';
import { parseSharedNavigationDestination } from '../routing/navigationShare';
import { navigationDestinationName } from '../navigation/destinationName';
import { JourneyResultsPanel, JourneySearchPending } from './JourneyResultsPanel';
import { JOURNEY_SEARCH_DEADLINE_MS, journeySearchAbortMessage } from './journeyResultPresentation';
import { JOURNEY_SEARCH_UNAVAILABLE_COPY, journeySearchFailureKind } from './journeySearchRecovery';
import { JourneyRouteMapScreen } from './JourneyRouteMapScreen';
import { JourneyActiveNavigation } from './JourneyActiveNavigation';
const MobilityAdminPanel = lazy(() => import('./MobilityAdminPanel').then((module) => ({ default: module.MobilityAdminPanel })));
const ProfileSections = lazy(() => import('./ProfileSections').then((module) => ({ default: module.ProfileSections })));
const MapPointPicker = lazy(() => import('../components/MapPointPicker').then((module) => ({ default: module.MapPointPicker })));
const OfferRoutePreview = lazy(() => import('./OfferRoutePreview').then((module) => ({ default: module.OfferRoutePreview })));
const TransportMapView = lazy(() => import('./TransportMapView').then((module) => ({ default: module.TransportMapView })));
const ProductionNavigation = lazy(() => import('./ProductionNavigation').then((module) => ({ default: module.ProductionNavigation })));

type Tab = ProductionTab;
/**
 * Live-channel colours come from the theme registry: emerald-700 and amber-700 are
 * remapped for dark surfaces in `index.css`, emerald-600 (used here before) was not,
 * so the "online" label was washing out on graphite.
 */
const REALTIME_TONE_CLASS: Record<'online' | 'retrying' | 'offline', string> = {
  online: 'text-emerald-700',
  retrying: 'text-amber-700',
  offline: 'text-slate-400',
};
const formatMoney = (minor: number, currency: string) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
import { carpoolDepartureDateLabel, carpoolOffersFromOtherDate, showsCarpoolSorter } from './carpoolDatePresentation';
import { showsCarpoolSection } from './resultsDiagnostics';

const formatDate = (value: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) => new Intl.DateTimeFormat('uk-UA', { ...options, timeZone: 'Europe/Kyiv' }).format(new Date(value));
const tabItems: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Головна', icon: Home }, { id: 'search', label: 'Пошук', icon: Search },
  { id: 'trips', label: 'Поїздки', icon: Ticket }, { id: 'profile', label: 'Профіль', icon: CircleUserRound },
];
const demandRequirementLabels: Record<string, string> = { luggage: 'Багаж', pets: 'Тварини', childSeat: 'Дитяче крісло' };

/** Usable = level 1+ (plate and photo). Older servers only expose verification_status, so 'verified' also counts. */
const vehicleUsable = (vehicle: ApiVehicle) => (vehicle.trust_level ?? 0) >= 1 || vehicle.verification_status === 'verified';

/**
 * Auth input: the placeholder alone is not a label, so every field carries a real one.
 * A password reveal is the difference between a mistyped phone keyboard and a dead end.
 */
function AuthField({ id, label, value, onChange, type, autoComplete, placeholder, minLength, maxLength, invalid, describedBy }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: 'email' | 'password' | 'text';
  autoComplete: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold uppercase tracking-[.14em] text-blue-100/80">{label}</label>
      <div className="relative">
        <input id={id} required type={isPassword && revealed ? 'text' : type} value={value} onChange={(event) => onChange(event.target.value)}
          minLength={minLength} maxLength={maxLength} autoComplete={autoComplete} placeholder={placeholder}
          aria-invalid={invalid || undefined} aria-describedby={describedBy}
          className={`w-full rounded-xl border bg-white/10 px-4 py-3.5 text-[16px] text-white outline-none transition-[border-color,box-shadow] duration-[var(--mg-dur-fast)] placeholder:text-blue-100/55 focus:border-sky-300 focus:shadow-[0_0_0_3px_rgba(56,189,248,.26)] ${isPassword ? 'pr-12' : ''} ${invalid ? 'border-[#FF9CA7]/70' : 'border-white/20'}`} />
        {isPassword && <button type="button" onClick={() => setRevealed((current) => !current)} aria-pressed={revealed}
          aria-label={revealed ? 'Приховати пароль' : 'Показати пароль'}
          className="mg-press absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-blue-100/80">
          {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>}
      </div>
    </div>
  );
}

export function ProductionMarketplace() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [showLogin, setShowLogin] = useState(false);
  const [authIntro, setAuthIntro] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingPermissionMessage, setOnboardingPermissionMessage] = useState('');
  const [currentCity, setCurrentCity] = useState<CurrentCity>(() => loadCurrentCity());
  const [cityLocationBusy, setCityLocationBusy] = useState(false);
  const [cityLocationMessage, setCityLocationMessage] = useState('');
  const currentCityRef = useRef(currentCity);
  const currentCityRevision = useRef(0);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [searchOriginPlace, setSearchOriginPlace] = useState<ApiPlace | null>(null);
  const [searchDestinationPlace, setSearchDestinationPlace] = useState<ApiPlace | null>(null);
  const [routePlaceField, setRoutePlaceField] = useState<'origin' | 'destination' | null>(null);
  const [routePlaceSearch, setRoutePlaceSearch] = useState<PlaceSearchState>(placeSearchPending);
  const [routePlaceActive, setRoutePlaceActive] = useState(-1);
  const [date, setDate] = useState(() => defaultKyivDateTime(1, 8).slice(0, 10));
  const [seats, setSeats] = useState(1);
  const [journeyDeparture, setJourneyDeparture] = useState(() => defaultKyivDateTime(1, 8));
  const [departurePickerOpen, setDeparturePickerOpen] = useState(false);
  const [journeyArrivalBy, setJourneyArrivalBy] = useState<string | null>(null);
  const [arrivalPickerOpen, setArrivalPickerOpen] = useState(false);
  const [journeyBudgetUah, setJourneyBudgetUah] = useState<number | null>(null);
  const [journeyDirectOnly, setJourneyDirectOnly] = useState(false);
  const [customJourneyBudgetOpen, setCustomJourneyBudgetOpen] = useState(false);
  const [customJourneyBudgetDraft, setCustomJourneyBudgetDraft] = useState('');
  const [transportPickerOpen, setTransportPickerOpen] = useState(false);
  const [journeyStrategy, setJourneyStrategy] = useState<ApiJourneyStrategy>('BALANCED');
  const [journeyResult, setJourneyResult] = useState<ApiJourneySearchResult | null>(null);
  const [selectedRouteMap, setSelectedRouteMap] = useState<ApiJourney | null>(null);
  const [selectedRouteGroup, setSelectedRouteGroup] = useState<ApiJourney[]>([]);
  const [selectedRouteRecommendation, setSelectedRouteRecommendation] = useState<string | undefined>();
  const [chosenJourneyId, setChosenJourneyId] = useState<string | null>(null);
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
  const [proposalsUnavailable, setProposalsUnavailable] = useState(false);
  const [proposalRevisions, setProposalRevisions] = useState<Record<string, ApiProposalRevision[]>>({});
  const [proposalTarget, setProposalTarget] = useState<ApiDemand | null>(null);
  const [proposalNavigationCandidateId, setProposalNavigationCandidateId] = useState<string | null>(null);
  const [counterTarget, setCounterTarget] = useState<ApiProposal | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [placeField, setPlaceField] = useState<'origin' | 'destination' | null>(null);
  const [placeSearch, setPlaceSearch] = useState<PlaceSearchState>(placeSearchPending);
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
  const [offerPlaceSearch, setOfferPlaceSearch] = useState<PlaceSearchState>(placeSearchPending);
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
  const { tab, setTab, activateTab, route, locationKey, setRoutePath, notFound, goHome } = useProductionTabRouter();
  const [showResults, setShowResults] = useState(false);
  // Every tab tap remounts the icons so the dock-pop replays even when the
  // tapped tab is already active and aria-current never changes.
  const [tabPopTick, setTabPopTick] = useState(0);
  const [picker, setPicker] = useState<{ form: 'search' | 'offer' | 'demand'; field: 'origin' | 'destination' } | null>(null);
  const [profileSection, setProfileSection] = useState<ProfileSection | null>(null);
  const [transportSelection, setTransportSelection] = useState<TransportSelection>(() => loadSelection());
  const [navAutoStart, setNavAutoStart] = useState(false);
  const [navInitialDestination, setNavInitialDestination] = useState<ApiPlace | null>(() => route?.tab === 'navigation' ? parseSharedNavigationDestination(window.location.search) : null);
  const [navigationMounted, setNavigationMounted] = useState(tab === 'navigation');
  const [navigationActive, setNavigationActive] = useState(false);
  useEffect(() => { if (tab === 'navigation') setNavigationMounted(true); }, [tab]);
  const onNavigationSessionActiveChange = useCallback((active: boolean) => setNavigationActive(active), []);
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const [editingOffer, setEditingOffer] = useState<ApiOffer | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<ApiVehicle | null>(null);
  const [tripsSection, setTripsSection] = useState<TripsSection>('upcoming');
  const tripsSectionChosen = useRef(false);
  const tripsTabsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // All five sections share one pill strip. At 320–360 px they overflow it, so
    // the chosen section must be scrolled fully into view instead of sitting half
    // outside the rounded container. Whichever neighbour is cut by that scroll has
    // to fade out: a label sliced mid-word («ивні») reads as a rendering bug.
    if (tab !== 'trips') return;
    const strip = tripsTabsRef.current;
    if (!strip) return;
    const syncEdges = () => {
      strip.dataset.fadeStart = strip.scrollLeft > 4 ? 'true' : 'false';
      strip.dataset.fadeEnd = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4 ? 'true' : 'false';
    };
    strip.addEventListener('scroll', syncEdges, { passive: true });
    window.addEventListener('resize', syncEdges, { passive: true });
    syncEdges();
    const active = strip.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (active) {
      const stripRect = strip.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      if (activeRect.left < stripRect.left || activeRect.right > stripRect.right) {
        strip.scrollLeft += activeRect.left - stripRect.left - (strip.clientWidth - activeRect.width) / 2;
      }
    }
    syncEdges();
    return () => {
      strip.removeEventListener('scroll', syncEdges);
      window.removeEventListener('resize', syncEdges);
    };
  }, [tab, tripsSection]);
  const handleTripsTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: TripsSection) => {
    const currentIndex = tripsTabs.findIndex(([section]) => section === current);
    const nextIndex = event.key === 'ArrowRight' ? (currentIndex + 1) % tripsTabs.length
      : event.key === 'ArrowLeft' ? (currentIndex - 1 + tripsTabs.length) % tripsTabs.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? tripsTabs.length - 1
      : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextSection = tripsTabs[nextIndex][0];
    tripsSectionChosen.current = true;
    setTripsSection(nextSection);
    requestAnimationFrame(() => tripsTabsRef.current?.querySelector<HTMLButtonElement>(`[data-trips-tab="${nextSection}"]`)?.focus());
  };
  const [providerGroups, setProviderGroups] = useState<Awaited<ReturnType<typeof productionApi.providersByTransport>> | null>(null);
  useEffect(() => {
    if (!transportPickerOpen || tab !== 'search') return;
    const previous = document.body.style.overflow;
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setTransportPickerOpen(false); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKeyDown); };
  }, [transportPickerOpen, tab]);
  const [offerSort, setOfferSort] = useState<'earliest' | 'cheapest' | 'fastest'>('earliest');
  const [pendingPlannerSearch, setPendingPlannerSearch] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<ApiOffer | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<ApiStoredJourney | null>(null);
  const [activeJourneyNavigation, setActiveJourneyNavigation] = useState<ApiJourney | null>(null);
  const [journeyNotice, setJourneyNotice] = useState('');
  const activeJourneyStore = useMemo(() => new ActiveJourneyNavigationStore(), []);
  const pendingNavigationRestore = useRef<{ journeyId: string; legIndex: number } | null>(null);
  const restoredNavigationStage = useRef<number | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ApiBooking | null>(null);
  const [visibleBookingTicket, setVisibleBookingTicket] = useState<{ bookingId: string; token: string } | null>(null);
  const [boardingTicketInput, setBoardingTicketInput] = useState<Record<string, string>>({});
  const [boardingScanBookingId, setBoardingScanBookingId] = useState<string | null>(null);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [olderMessagesAvailable, setOlderMessagesAvailable] = useState(false);
  const [olderMessageCursor, setOlderMessageCursor] = useState<string | null>(null);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [unreadConversations, setUnreadConversations] = useState<Record<string, number>>({});
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('closed');
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [messageDraft, setMessageDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [journeySearchStartedAt, setJourneySearchStartedAt] = useState<number | null>(null);
  const [journeySearchUnavailable, setJourneySearchUnavailable] = useState<string | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<ApiBooking | null>(null);
  const [bookingToConfirm, setBookingToConfirm] = useState<ApiOffer | null>(null);
  const [unbookableOfferId, setUnbookableOfferId] = useState<string | null>(null);
  const [exportingData, setExportingData] = useState(false);
  const [deletionRequest, setDeletionRequest] = useState<ApiAccountDeletionRequest | null>(null);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [statusMessage, setStatusMessageText] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);
  const setStatusMessage = useCallback((message: string, isError = false) => {
    setStatusIsError(isError);
    setStatusMessageText(message);
  }, []);
  const [authError, setAuthError] = useState('');
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
  const [vehicleForm, setVehicleForm] = useState({ make: '', model: '', modelYear: new Date().getFullYear(), seats: 4, plate: '' });
  const [vehicleFormPhoto, setVehicleFormPhoto] = useState<File | null>(null);
  const routedEntityKey = useRef('');
  const bookingsPollCooldownUntil = useRef(0);
  const hydratedSearchLocation = useRef<string | null>(null);
  const journeySearchAbort = useRef<AbortController | null>(null);

  const commitCurrentCity = useCallback((next: CurrentCity) => {
    currentCityRevision.current += 1;
    currentCityRef.current = next;
    setCurrentCity(next);
    saveCurrentCity(next);
  }, []);
  const locateCurrentCity = useCallback(async (): Promise<boolean> => {
    const requestRevision = currentCityRevision.current;
    setCityLocationBusy(true);
    setCityLocationMessage('');
    try {
      if (!navigator.geolocation) throw new Error('Геолокація недоступна на цьому пристрої.');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, maximumAge: 120_000, timeout: 12_000 }));
      const place = await productionApi.reverseGeocode(position.coords.latitude, position.coords.longitude);
      const name = cityNameFromPlaceLabel(place.label);
      if (!name) throw new Error('Геокодер не повернув назву населеного пункту.');
      if (!isCurrentCityRequest(requestRevision, currentCityRevision.current)) return false;
      commitCurrentCity({ name, source: 'gps', verified: true });
      return true;
    } catch {
      if (isCurrentCityRequest(requestRevision, currentCityRevision.current)) {
        setCityLocationMessage('Не вдалося визначити місто. Збережений вибір не змінено; можна знайти місто вручну.');
      }
      return false;
    } finally { setCityLocationBusy(false); }
  }, [commitCurrentCity]);

  // Do not trigger a permission prompt on startup. Refresh GPS only when the browser already
  // reports a grant; a manually selected city remains authoritative until the user asks for GPS.
  useEffect(() => {
    let active = true;
    const refreshGrantedLocation = async () => {
      const revision = currentCityRevision.current;
      if (!navigator.geolocation || !navigator.permissions?.query || currentCityRef.current.source === 'manual') return;
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (!active || !canAutoDetectCity(currentCityRef.current, permission.state)) return;
        const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 }));
        const place = await productionApi.reverseGeocode(position.coords.latitude, position.coords.longitude);
        const name = cityNameFromPlaceLabel(place.label);
        if (active && name && isCurrentCityRequest(revision, currentCityRevision.current)) commitCurrentCity({ name, source: 'gps', verified: true });
      } catch { /* Keep the last confirmed city; startup never asks for permission. */ }
    };
    void refreshGrantedLocation();
    return () => { active = false; };
  }, [commitCurrentCity]);

  const refreshUnreadConversations = useCallback(async () => {
    const unread = await productionApi.conversationUnreadCounts();
    setUnreadConversations(Object.fromEntries(unread.filter((item) => item.booking_id).map((item) => [item.booking_id!, item.unread_count])));
  }, []);
  const refreshBookings = useCallback(async () => {
    setBookings(await productionApi.bookings());
    await refreshUnreadConversations().catch(() => undefined);
  }, [refreshUnreadConversations]);
  useEffect(() => { rendezvousSessionsRef.current = rendezvousSessions; }, [rendezvousSessions]);
  const refreshJourneys = useCallback(async () => setJourneys(await productionApi.journeys()), []);
  const finishJourneyNavigation = useCallback((journeyId: string) => {
    setActiveJourneyNavigation(null);
    setJourneyNotice('');
    void (async () => {
      const outcome = await completePassengerJourney(productionApi, journeyId);
      if (!outcome.confirmed) setStatusMessage(outcome.message);
      await refreshJourneys().catch(() => undefined);
    })();
  }, [refreshJourneys]);
  const refreshNotifications = useCallback(async () => setNotificationPage(await productionApi.notifications()), []);
  const refreshBlockedUsers = useCallback(async () => setBlockedUsers(await productionApi.blockedUsers()), []);
  const refreshMyOffers = useCallback(async () => setMyOffers(await productionApi.myOffers()), []);
  const refreshVehicles = useCallback(async () => {
    const [nextVehicles, nextVerification] = await Promise.all([productionApi.vehicles(), productionApi.verificationRecords()]);
    const photos = await Promise.all(nextVehicles.map(async (vehicle) => [vehicle.id, await productionApi.vehiclePhotos(vehicle.id).catch(() => [])] as const));
    setVehicles(nextVehicles); setVerificationRecords(nextVerification); setVehiclePhotos(Object.fromEntries(photos));
  }, []);
  const refreshMyDemands = useCallback(async () => setMyDemands(await productionApi.myDemands()), []);
  const refreshPassengerNavigationMatches = useCallback(async () => {
    const matches = await productionApi.myNavigationMatches();
    setPassengerNavigationMatches(matches);
    return matches;
  }, []);
  const refreshOpenDemands = useCallback(async () => setOpenDemands(await productionApi.openDemands()), []);
  const loadDemandProposals = useCallback(async (demandId: string) => {
    try { return { proposals: await productionApi.demandProposals(demandId), unavailable: false }; }
    catch { return { proposals: [] as ApiProposal[], unavailable: true }; }
  }, []);
  const refreshAdminQueue = useCallback(async () => setAdminQueue(await productionApi.adminVerificationQueue()), []);
  const refreshModerationCases = useCallback(async () => setModerationCases(await productionApi.moderationCases('all')), []);

  useEffect(() => {
    if (!user || loading || tab !== 'admin' || !user.roles.some((role) => role === 'admin' || role === 'moderator')) return;
    void Promise.all([refreshAdminQueue(), refreshModerationCases()]).catch((error: unknown) => {
      setStatusMessage(error instanceof Error ? error.message : 'Черга модерації недоступна.');
    });
  }, [loading, refreshAdminQueue, refreshModerationCases, tab, user?.id, user?.roles.join(',')]);
  // Until the user picks a section, show the first one that has trips (active → upcoming → past). Declared before any early return.
  const activeTripCount = bookings.filter((booking) => booking.status === 'boarding' || booking.status === 'in_progress').length;
  const upcomingTripCount = bookings.filter((booking) => booking.status === 'confirmed').length + journeys.length; // saved journeys belong to "Майбутні"
  const pastTripCount = bookings.filter((booking) => booking.status !== 'boarding' && booking.status !== 'in_progress' && booking.status !== 'confirmed').length;
  useEffect(() => {
    if (tripsSectionChosen.current) return;
    setTripsSection(activeTripCount > 0 ? 'active' : upcomingTripCount > 0 ? 'upcoming' : pastTripCount > 0 ? 'past' : 'upcoming');
  }, [activeTripCount, upcomingTripCount, pastTripCount]);

  const changeTransportSelection = (selection: TransportSelection) => { setTransportSelection(selection); saveSelection(selection); };
  // A long-distance journey can start outside a feed city and finish inside one.
  // Discover coverage at both endpoints so the origin alone does not hide a usable destination provider.
  useEffect(() => {
    if (!user) { setProviderGroups(null); return; }
    let current = true;
    setProviderGroups(null);
    const points = providerCoveragePoints(searchOriginPlace, searchDestinationPlace);
    void Promise.allSettled(points.map((point) => productionApi.providersByTransport(point))).then((results) => {
      if (!current) return;
      const discovery = mergeSettledProviderGroups(results);
      // Partial endpoint discovery is not complete coverage. Keep the existing
      // unverified state so users see the warning and the API can decide routes.
      setProviderGroups(discovery && discovery.failedCount === 0 ? discovery.groups : null);
    });
    return () => { current = false; };
  }, [user, searchOriginPlace, searchDestinationPlace]);

  useEffect(() => {
    if (route?.kind === 'tab' && route.tab === 'home' && tab === 'home') {
      setShowResults(false);
      return;
    }
    if (!user || loading || tab !== 'search' || route?.kind !== 'tab'
      || hydratedSearchLocation.current === locationKey) return;
    hydratedSearchLocation.current = locationKey;
    const parsed = parseSearchRoute(window.location.search);
    if (!parsed) {
      if (route.tab === 'home') setShowResults(false);
      return;
    }
    setOrigin(parsed.origin.label);
    setDestination(parsed.destination.label);
    setSearchOriginPlace(parsed.origin);
    setSearchDestinationPlace(parsed.destination);
    setDate(parsed.date);
    setSeats(parsed.passengers);
    setJourneyDeparture(parsed.departure);
    setJourneyStrategy(parsed.strategy);
    setJourneyResult(null);
    if (parsed.mode === 'planner') {
      // A planner link must land on results, not on a «параметри відновлено» screen: the
      // search itself needs the restored state, so it is queued until React commits it.
      setPendingPlannerSearch(true);
      return;
    }
    setShowResults(true);

    let active = true;
    void productionApi.offers({
      origin: parsed.origin.label,
      destination: parsed.destination.label,
      date: parsed.date,
      seats: parsed.passengers,
      originCoordinates: [parsed.origin.longitude, parsed.origin.latitude],
      destinationCoordinates: [parsed.destination.longitude, parsed.destination.latitude],
    }).then((nextOffers) => {
      if (active) setOffers(nextOffers);
    }).catch((error: unknown) => {
      if (active) setStatusMessage(error instanceof Error ? error.message : 'Не вдалося відновити результати пошуку.');
    });
    return () => { active = false; };
  }, [loading, locationKey, route?.kind, route?.tab, tab, user?.id]);

  useEffect(() => {
    if (!showResults) return;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    return () => window.cancelAnimationFrame(frame);
  }, [showResults, locationKey]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
    void StatusBar.setStyle({ style: user ? Style.Light : Style.Dark }).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    productionApi.restoreSession().then(async (restored) => {
      // A browser that never held a session has nothing to restore: skip the
      // whole authenticated fan-out instead of asking for a profile we do not own.
      if (!restored) return;
      const currentUser = await productionApi.me();
      setUser(currentUser);
      const [currentDeletionRequest] = await Promise.all([productionApi.accountDeletionRequest(), refreshBookings(), refreshJourneys(), refreshNotifications(), refreshVehicles(), refreshBlockedUsers(), ...(currentUser.roles.includes('driver') ? [refreshMyOffers(), refreshOpenDemands()] : []), ...(currentUser.roles.includes('passenger') ? [refreshMyDemands(), refreshPassengerNavigationMatches()] : [])]);
      setDeletionRequest(currentDeletionRequest);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setAuthError('Сервер не відповідає. Перевірте з’єднання та спробуйте увійти ще раз.');
      }
    }).finally(() => setLoading(false));
  }, [refreshBlockedUsers, refreshBookings, refreshJourneys, refreshMyOffers, refreshPassengerNavigationMatches, refreshVehicles]);

  // Starting navigation is one tap and one record. Nothing but the pointer is
  // stored: no token, no coordinates, no GPS history, no price snapshot.
  const startJourneyNavigation = (journey: ApiJourney) => {
    restoredNavigationStage.current = null;
    pendingNavigationRestore.current = null;
    if (user) activeJourneyStore.write({ journeyId: journey.id, legIndex: 0, ownerUserId: user.id });
    // The URL carries the journey so a reload or a relaunched PWA can ask the
    // server for the same itinerary instead of sending the passenger back to
    // an empty search box.
    setRoutePath(pathForProductionEntity('journey', journey.id));
    setActiveJourneyNavigation(journey);
    setJourneyNotice('');
    void activatePassengerJourney(productionApi, journey.id, journey.legs[0]?.id).then(async (outcome) => {
      if (!outcome.confirmed) {
        activeJourneyStore.clear();
        setJourneyNotice(outcome.message);
        return;
      }
      await refreshJourneys().catch(() => undefined);
    });
  };

  // Leaving navigation on purpose means the passenger is no longer riding it,
  // so the pointer is dropped with the screen; a killed or backgrounded app
  // never reaches this and still resumes.
  const exitJourneyNavigation = () => {
    activeJourneyStore.clear();
    pendingNavigationRestore.current = null;
    restoredNavigationStage.current = null;
    setActiveJourneyNavigation(null);
  };

  const keepActiveJourneyStage = (journeyId: string, legIndex: number) => {
    activeJourneyStore.updateStage(journeyId, legIndex);
  };

  /**
   * A record only invites the deep-link loader below to re-open a journey; the
   * server response, not the stored snapshot, decides whether it still exists,
   * still belongs to this account and has not finished.
   */
  const resumeActiveNavigation = useCallback((journey: ApiStoredJourney) => {
    const pending = pendingNavigationRestore.current;
    if (!pending || pending.journeyId !== journey.id) return;
    pendingNavigationRestore.current = null;
    if (!isRestorableJourneyState(journey.state)) {
      activeJourneyStore.clear();
      return;
    }
    restoredNavigationStage.current = pending.legIndex;
    setActiveJourneyNavigation(storedJourneyToApiJourney(journey));
  }, [activeJourneyStore]);

  // Reopening the app after a crash, a swipe-away or a night on the shelf: read
  // the pointer once the session is resolved, and only for its own owner.
  useEffect(() => {
    if (loading || !user) return;
    const record = activeJourneyStore.readForUser(user.id);
    if (!record) {
      pendingNavigationRestore.current = null;
      return;
    }
    if (pendingNavigationRestore.current?.journeyId === record.journeyId) return;
    pendingNavigationRestore.current = { journeyId: record.journeyId, legIndex: record.legIndex };
    // Only a reopen at the default entry point may take over the screen. A /map,
    // /navigate or /trips deep link, and any offer/booking/chat/journey link, is a
    // destination the passenger asked for; the pending restore above still lets a
    // /journeys/<id> link recover the stage once the server answers.
    if (!resumesActiveJourneyFrom(route)) return;
    if (!setRoutePath(pathForProductionEntity('journey', record.journeyId))) {
      pendingNavigationRestore.current = null;
      activeJourneyStore.clear();
    }
  }, [activeJourneyStore, loading, route?.entityId, route?.kind, route?.tab, setRoutePath, user]);

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
          const proposalResult = await loadDemandProposals(entityId);
          if (!active) return;
          setSelectedDemand(demand); setSelectedDemandIsOwned(owned); setProposals(proposalResult.proposals); setProposalsUnavailable(proposalResult.unavailable);
          activateTab(owned ? 'my-demands' : 'requests');
        } else if (route.kind === 'journey') {
          const journey = await productionApi.journey(entityId);
          if (!active) return;
          setSelectedRouteMap(storedJourneyToApiJourney(journey));
          resumeActiveNavigation(journey);
          setSelectedOffer(null);
          setSelectedJourney(journey);
          activateTab('trips');
        } else if (route.kind === 'conversation') {
          const conversation = await productionApi.conversationById(entityId);
          const currentBookings = await productionApi.bookings();
          const booking = currentBookings.find((item) => item.id === conversation.booking_id);
          if (!booking) throw new Error('Розмова недоступна для цього облікового запису.');
          const history = await productionApi.messagePage(conversation.id);
          const readState = await productionApi.markConversationRead(conversation.id).catch(() => null);
          if (!active) return;
          setBookings(currentBookings); setSelectedBooking(booking); setMessages(history.messages);
          setOlderMessagesAvailable(history.hasMore); setOlderMessageCursor(history.nextCursor);
          if (readState) setUnreadConversations((current) => ({ ...current, [booking.id]: readState.unread_count }));
          activateTab('chat');
        }
      } catch (error) {
        if (!active) return;
        // A journey the server will not hand back — deleted, finished, or owned
        // by someone else — must not stay as a promise to reopen.
        if (route.kind === 'journey' && pendingNavigationRestore.current?.journeyId === entityId) {
          pendingNavigationRestore.current = null;
          activeJourneyStore.clear();
        }
        setStatusMessage(deepLinkFailureMessage(error));
        activateTab(route.tab);
      }
    };
    void load();
    return () => { active = false; };
  }, [activateTab, activeJourneyStore, loadDemandProposals, loading, resumeActiveNavigation, route?.entityId, route?.kind, route?.tab, user?.id, user?.roles.join(',')]);

  useEffect(() => {
    if (!user) return;
    return productionApi.subscribeRealtime((event) => {
      void refreshNotifications().catch(() => undefined);
      if (event.type === 'conversation.message.created') {
        if (event.data.sender_id !== user.id) void refreshUnreadConversations().catch(() => undefined);
        return;
      }
      if (event.type === 'journey.updated') {
        void refreshJourneys().catch(() => setStatusMessage('Маршрут не оновився. Оновіть список поїздок.'));
        setStatusMessage(event.data.state === 'READY' ? 'Ваш маршрут готов, бронювання збережене.'
          : event.data.state === 'PARTIALLY_RESERVED' ? 'Бронювання попутки підтверджене. Квитки на інші сегменти маршруту оформлюються окремо.'
            : 'Стан маршруту змінився. Перевірте актуальні варіанти.');
        return;
      }
      if (event.type === 'booking.change-requested') setStatusMessage('Водій змінив умови поїздки. Перегляньте зміни в «Поїздках» і погодьтеся або відмовтеся.');
      if (event.type === 'trip.cancelled') setStatusMessage('Водій скасував поїздку. Ваше бронювання скасовано.');
      if (event.type === 'trip.updated') setStatusMessage('Водій оновив поїздку. Перевірте актуальні деталі.');
      if (event.type.startsWith('booking.') || event.type.startsWith('trip.')) {
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
            .then((matches) => {
              if (matches.some((match) => match.candidate_id === event.data.candidate_id && match.status === 'driver_interested')) {
                setStatusMessage('Водій зацікавився вашою заявкою на маршрут.');
              }
            })
            .catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Не вдалося оновити пропозиції водіїв.'));
        }
        return;
      }
      if (!event.type.startsWith('proposal.')) return;
      const refreshes: Promise<unknown>[] = [];
      if (user.roles.includes('driver')) refreshes.push(refreshOpenDemands());
      if (user.roles.includes('passenger')) refreshes.push(refreshMyDemands());
      if (selectedDemand) refreshes.push(loadDemandProposals(selectedDemand.id).then((result) => {
        setProposals(result.proposals); setProposalsUnavailable(result.unavailable);
      }));
      void Promise.all(refreshes).catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Цінова пропозиція змінилася. Оновіть список.'));
    }, () => undefined);
  }, [loadDemandProposals, refreshBookings, refreshJourneys, refreshMyDemands, refreshMyOffers, refreshNotifications, refreshOpenDemands, refreshPassengerNavigationMatches, refreshUnreadConversations, selectedDemand?.id, user?.id, user?.roles.join(',')]);

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
      if (document.visibilityState !== 'visible') return;
      if (Date.now() < bookingsPollCooldownUntil.current) return;
      void refreshBookings().catch((error: unknown) => {
        // A 429 means every further 3s tick would only deepen the throttle; pause the poll instead of storming the API.
        if (error instanceof ProductionApiError && error.code === 'rate_limit_exceeded') {
          bookingsPollCooldownUntil.current = Date.now() + 60_000;
          setStatusMessage('Сервер просить робити запити рідше. Автооновлення поїздок призупинено на хвилину.');
          return;
        }
        setStatusMessage(error instanceof Error ? error.message : 'Стан поїздок не оновився.');
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refreshBookings, tab, user?.id]);

  useEffect(() => {
    if (tab !== 'chat' || !selectedBooking) { setRealtimeStatus('closed'); return; }
    let disposed = false;
    let unsubscribeEvents: () => void = () => { /* No listener exists until the conversation is resolved. */ };
    let unsubscribeStatus: () => void = () => { /* The channel status is read once the conversation exists. */ };
    void productionApi.conversation(selectedBooking.id).then((conversation) => {
      if (disposed) return;
      unsubscribeEvents = productionApi.subscribeRealtime((event) => {
        if (event.type !== 'conversation.message.created') return;
        if (event.data.conversation_id !== conversation.id) return;
        setMessages((current) => current.some((message) => message.id === event.data.id)
          ? current : [...current, event.data]);
        if (document.visibilityState === 'visible') {
          void productionApi.markConversationRead(conversation.id)
            .then((readState) => {
              const bookingId = selectedBooking.id;
              setUnreadConversations((current) => ({ ...current, [bookingId]: readState.unread_count }));
            })
            .catch(() => undefined);
        }
      }, () => undefined);
      // The passenger sees the honest state of the live channel: online, retrying, or
      // offline with the history still readable. Reconnecting is not an error screen.
      unsubscribeStatus = productionApi.onRealtimeStatus((status: RealtimeStatus) => {
        setRealtimeStatus(status);
        if (status !== 'online') return;
        void productionApi.messagePage(conversation.id).then(async (history) => {
          if (disposed) return;
          setMessages((current) => {
            const merged = new Map(history.messages.map((message) => [message.id, message]));
            for (const message of current) merged.set(message.id, message);
            return [...merged.values()].sort((left, right) => left.created_at.localeCompare(right.created_at));
          });
          setOlderMessagesAvailable((current) => current || history.hasMore);
          setOlderMessageCursor((current) => current ?? history.nextCursor);
          if (document.visibilityState === 'visible') {
            await productionApi.markConversationRead(conversation.id);
            await refreshUnreadConversations().catch(() => undefined);
          }
        }).catch(() => undefined);
      });
    }).catch((error: unknown) => {
      if (!disposed) setStatusMessage(error instanceof Error ? error.message : 'Чат недоступний.');
    });
    return () => {
      disposed = true;
      unsubscribeEvents();
      unsubscribeStatus();
      setRealtimeStatus('closed');
    };
  }, [refreshUnreadConversations, selectedBooking?.id, tab]);

  useEffect(() => {
    const syncConnectivity = () => setIsOffline(navigator.onLine === false);
    syncConnectivity();
    window.addEventListener('online', syncConnectivity);
    window.addEventListener('offline', syncConnectivity);
    return () => { window.removeEventListener('online', syncConnectivity); window.removeEventListener('offline', syncConnectivity); };
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setStatusMessage(''); setAuthError('');
    try {
      const currentUser = await productionApi.login(authEmail, authPassword);
      setUser(currentUser);
      const refreshedUser = await productionApi.me(); setUser(refreshedUser);
      await Promise.all([refreshBookings(), refreshJourneys(), refreshVehicles(), refreshBlockedUsers(), ...(refreshedUser.roles.includes('driver') ? [refreshMyOffers(), refreshOpenDemands()] : []), ...(refreshedUser.roles.includes('passenger') ? [refreshMyDemands(), refreshPassengerNavigationMatches()] : [])]);
      setShowLogin(false);
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Помилка входу. Перевірте email та пароль.'); }
    finally { setBusy(false); }
  };

  const handlePasswordResetRequest = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setStatusMessage(''); setAuthError('');
    try {
      const result = await productionApi.requestPasswordReset(authEmail.trim());
      setStatusMessage(result.message);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Відновлення пароля тимчасово недоступне. Спробуйте пізніше.');
    } finally { setBusy(false); }
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setStatusMessage(''); setAuthError('');
    try {
      const currentUser = await productionApi.register({ email: authEmail, password: authPassword, displayName: authDisplayName });
      setUser(currentUser);
      const refreshedUser = await productionApi.me(); setUser(refreshedUser);
      await Promise.all([refreshBookings(), refreshJourneys(), refreshVehicles(), refreshBlockedUsers(), ...(refreshedUser.roles.includes('driver') ? [refreshMyOffers(), refreshOpenDemands()] : []), ...(refreshedUser.roles.includes('passenger') ? [refreshMyDemands(), refreshPassengerNavigationMatches()] : [])]);
      setShowLogin(false);
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Помилка реєстрації. Перевірте дані.'); }
    finally { setBusy(false); }
  };

  const searchJourney = async () => {
    if (customJourneyBudgetOpen) {
      const draftBudget = parseJourneyBudgetUah(customJourneyBudgetDraft);
      if (!isAppliedJourneyBudgetDraft(customJourneyBudgetDraft, journeyBudgetUah)) {
        setStatusMessage(draftBudget === null ? 'Вкажіть власний бюджет або скасуйте редагування.' : 'Застосуйте нову суму або скасуйте редагування бюджету.');
        return;
      }
    }
    if (!origin.trim() || !destination.trim()) { setStatusMessage('Вкажіть початок і кінець маршруту.'); return; }
    if (!searchOriginPlace || !searchDestinationPlace) { setStatusMessage('Щоб побудувати маршрут, оберіть обидві точки зі списку підказок.'); return; }
    const departure = kyivDateTimeInputToDate(journeyDeparture);
    if (!departure || departure.getTime() <= Date.now()) {
      setStatusMessage('Час відправлення вже минув — оберіть майбутню годину у вікні «Час маршруту».');
      setDeparturePickerOpen(true);
      return;
    }
    const arrivalBy = journeyArrivalBy ? kyivDateTimeInputToDate(journeyArrivalBy) : null;
    if (journeyArrivalBy && (!arrivalBy || arrivalBy.getTime() <= departure.getTime() + 60_000)) {
      setStatusMessage('«По» має бути пізніше за «З» принаймні на хвилину — інакше маршруту вистачить часу лише на старт.');
      setArrivalPickerOpen(true);
      return;
    }
    // Only one search may own the results screen: a replaced run must stay silent, or its late
    // rejection would hide the new pending card and clear the new busy flag.
    journeySearchAbort.current?.abort('superseded');
    const controller = new AbortController();
    journeySearchAbort.current = controller;
    const deadlineId = window.setTimeout(() => controller.abort('timeout'), JOURNEY_SEARCH_DEADLINE_MS);
    setBusy(true); setStatusMessage(''); setJourneySearchUnavailable(null); setJourneySearchStartedAt(Date.now()); setShowResults(true); setChosenJourneyId(null);
    try {
      setJourneyResult(null);
      const result = await productionApi.searchJourneys({
        origin: { name: searchOriginPlace.label, coordinates: [searchOriginPlace.longitude, searchOriginPlace.latitude] },
        destination: { name: searchDestinationPlace.label, coordinates: [searchDestinationPlace.longitude, searchDestinationPlace.latitude] },
        departureAt: departure.toISOString(), passengers: seats, strategy: journeyStrategy,
        preferences: { ...toJourneyPreferences(transportSelection, providerGroups), ...journeySearchBounds(journeyDeparture, journeyArrivalBy, journeyBudgetUah, journeyDirectOnly) },
        signal: controller.signal,
      });
      setJourneyResult(result); setShowResults(true);
      const searchPath = buildSearchRoute({
        origin: searchOriginPlace, destination: searchDestinationPlace, date, passengers: seats,
        departure: journeyDeparture, strategy: journeyStrategy, mode: 'planner',
      });
      hydratedSearchLocation.current = searchPath;
      setRoutePath(searchPath);
      try {
        setOffers(await productionApi.offers({
          origin: searchOriginPlace.label, destination: searchDestinationPlace.label, date, seats,
          originCoordinates: [searchOriginPlace.longitude, searchOriginPlace.latitude],
          destinationCoordinates: [searchDestinationPlace.longitude, searchDestinationPlace.latitude],
        }));
      } catch (error) {
        setOffers([]);
        setStatusMessage(error instanceof Error ? `Попутки не вдалося отримати: ${error.message}` : 'Попутки тимчасово недоступні.');
      }
    } catch (error) {
      if (journeySearchAbort.current === controller) {
        // The results screen has no status line, so a failed search must return to the form
        // where the message is actually rendered.
        setShowResults(false);
        const message = error instanceof Error ? error.message : '';
        const failureKind = journeySearchFailureKind(error);
        const needsSignIn = failureKind === 'auth' || /authentication required|unauthorized/i.test(message);
        if (controller.signal.aborted) setStatusMessage(journeySearchAbortMessage(controller.signal.reason));
        else if (needsSignIn) setStatusMessage('Щоб отримати реальні пропозиції, увійдіть в акаунт і повторіть пошук.', true);
        else if (failureKind === 'unavailable') setJourneySearchUnavailable(JOURNEY_SEARCH_UNAVAILABLE_COPY);
        else setStatusMessage(message || 'Не вдалося побудувати маршрут.', true);
      }
    }
    finally {
      window.clearTimeout(deadlineId);
      if (journeySearchAbort.current === controller) {
        journeySearchAbort.current = null;
        setBusy(false); setJourneySearchStartedAt(null);
      }
    }
  };

  const cancelJourneySearch = () => { journeySearchAbort.current?.abort('cancelled'); };

  useEffect(() => {
    if (!pendingPlannerSearch) return;
    setPendingPlannerSearch(false);
    void searchJourney();
  }, [pendingPlannerSearch, searchJourney]);

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
    setRoutePlaceField(field); setRoutePlaceSearch(placeSearchPending()); setPlaceSearchBusy(true); setStatusMessage('');
    try { setRoutePlaceSearch(placeSearchResults(await productionApi.suggestPlaces(query, await currentPlaceBias()))); }
    catch (error) {
      const next = placeSearchFailure(error);
      setRoutePlaceSearch(next);
      if (!next.unavailable) setStatusMessage(error instanceof Error ? error.message : 'Пошук місця недоступний.');
    }
    finally { setPlaceSearchBusy(false); }
  };

  const choosePickedPlace = (place: ApiPlace) => {
    if (!picker) return;
    const { form, field } = picker;
    if (form === 'search') {
      if (field === 'origin') { setSearchOriginPlace(place); setOrigin(place.label); } else { setSearchDestinationPlace(place); setDestination(place.label); }
      setRoutePlaceSearch(placeSearchPending()); setRoutePlaceField(null);
    } else if (form === 'offer') {
      if (field === 'origin') { setOfferOrigin(place); setOfferOriginText(place.label); } else { setOfferDestination(place); setOfferDestinationText(place.label); }
    } else if (field === 'origin') { setDemandOrigin(place); setDemandOriginText(place.label); } else { setDemandDestination(place); setDemandDestinationText(place.label); }
    setPicker(null);
  };

  const useMyLocationAsOrigin = async () => {
    if (!navigator.geolocation) { setStatusMessage('Геолокація недоступна на цьому пристрої.'); return; }
    setStatusMessage('');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000 }));
      const { place, addressResolved } = await resolvePlaceAtCoordinates(
        position.coords.latitude,
        position.coords.longitude,
        (latitude, longitude) => productionApi.reverseGeocode(latitude, longitude),
      );
      setSearchOriginPlace(place); setOrigin(place.label); setRoutePlaceSearch(placeSearchPending()); setRoutePlaceField(null);
      if (!addressResolved) setStatusMessage('GPS-точку встановлено за координатами. Адресу зараз не вдалося визначити.');
    } catch (error) { setStatusMessage(error instanceof Error && error.message ? error.message : 'Не вдалося визначити місцезнаходження. Дозвольте геолокацію в браузері.'); }
  };

  const chooseSearchPlace = (place: ApiPlace) => {
    if (routePlaceField === 'origin') { setSearchOriginPlace(place); setOrigin(place.label); }
    if (routePlaceField === 'destination') { setSearchDestinationPlace(place); setDestination(place.label); }
    setRoutePlaceSearch(placeSearchPending()); setRoutePlaceField(null);
  };

  useEffect(() => {
    if (!routePlaceField) {
      setPlaceSearchBusy(false);
      return;
    }
    const query = (routePlaceField === 'origin' ? origin : destination).trim();
    if (query.length < 3) {
      setRoutePlaceSearch(placeSearchPending());
      setPlaceSearchBusy(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const lookup = async () => {
      const bias = await currentPlaceBias();
      if (controller.signal.aborted) return;
      const places = await productionApi.suggestPlaces(query, bias, controller.signal);
      if (!cancelled && !controller.signal.aborted) setRoutePlaceSearch(placeSearchResults(places));
    };
    const timer = window.setTimeout(() => {
      setPlaceSearchBusy(true);
      void lookup()
        .catch((error: unknown) => {
          if (cancelled || controller.signal.aborted) return;
          const next = placeSearchFailure(error);
          setRoutePlaceSearch(next);
          if (!next.unavailable) setStatusMessage(error instanceof Error ? error.message : 'Пошук місця недоступний.');
        })
        .finally(() => { if (!cancelled && !controller.signal.aborted) setPlaceSearchBusy(false); });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort('superseded');
    };
  }, [destination, origin, routePlaceField]);

  useEffect(() => { setRoutePlaceActive(-1); }, [routePlaceSearch.suggestions, routePlaceField]);

  useEffect(() => {
    if (!showCreateMenu) return undefined;
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setShowCreateMenu(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCreateMenu]);

  const routePlaceKeyDown = (event: { key: string; preventDefault(): void }, field: 'origin' | 'destination') => {
    const listOpen = routePlaceField === field && routePlaceSearch.suggestions.length > 0;
    const action = placeSuggestionKeyAction(event.key, listOpen, routePlaceActive);
    if (action === 'none') return;
    event.preventDefault();
    if (action === 'highlight_next') { setRoutePlaceActive(moveActivePlaceIndex(routePlaceActive, routePlaceSearch.suggestions.length, 1)); return; }
    if (action === 'highlight_prev') { setRoutePlaceActive(moveActivePlaceIndex(routePlaceActive, routePlaceSearch.suggestions.length, -1)); return; }
    if (action === 'dismiss') { setRoutePlaceSearch(placeSearchPending()); setRoutePlaceField(null); return; }
    if (action === 'accept') { chooseSearchPlace(routePlaceSearch.suggestions[routePlaceActive]); return; }
    void searchRoutePlace(field);
  };

  const refreshRescueCandidates = (cancelledBookings: ApiBooking[]) => {
    for (const cancelled of cancelledBookings) {
      setBookingRescues(current => ({ ...current, [cancelled.id]: { loading: true, failed: false } }));
      void productionApi.bookingRescue(cancelled.id)
        .then(result => setBookingRescues(current => ({ ...current, [cancelled.id]: { loading: false, failed: false, result } })))
        .catch(() => setBookingRescues(current => ({ ...current, [cancelled.id]: { loading: false, failed: true } })));
    }
  };

  const rescueJourneyForBooking = (booking: ApiBooking) => journeys.find(journey =>
    journey.state === 'REPLANNING' && journey.legs.some(leg => leg.bookingId === booking.id && leg.state === 'CANCELLED'),
  );

  const book = async (offer: ApiOffer) => {
    if (busy) return;
    setBusy(true); setStatusMessage(''); setUnbookableOfferId(null);
    try {
      await productionApi.book(offer.id, seats, journeyBookingLink ?? undefined);
      // Booking is already committed by the API. A background refresh of an
      // incomplete search form must not turn that success into a UI error.
      const refreshed = await refreshCommittedActionData([
        refreshBookings,
        ...(journeyBookingLink ? [refreshJourneys] : []),
      ]);
      setStatusMessage(refreshed
        ? journeyBookingLink
          ? 'Місце заброньовано. Маршрут збережено.'
          : 'Місця заброньовано. Підтвердження збережено.'
        : 'Бронювання підтверджено. Список поїздок оновиться після повторного відкриття.');
      // A replacement booking changes the inventory shown by Rescue cards.
      // Re-query the server so a second replacement is never offered with a
      // stale seat count until the passenger reloads the page.
      refreshRescueCandidates(bookings.filter(item => item.status === 'cancelled' && !item.current_user_is_driver));
      setBookingToConfirm(null);
      setSelectedOffer(null); setJourneyBookingLink(null); setTab('trips');
    } catch (error) {
      setStatusMessage(bookingFailureMessage(error));
      setBookingToConfirm(null);
      // A rejected or unanswered request may still have committed server-side,
      // and the seat count on screen is already known to be stale: reconcile
      // both from the server instead of letting the passenger retry blind.
      await refreshBookings().catch(() => undefined);
      void productionApi.offer(offer.id)
        .then((fresh) => {
          setOffers((previous) => previous.map((item) => (item.id === fresh.id ? fresh : item)));
          // The detail card the passenger is looking at is the stale copy, so it
          // must be replaced too — otherwise the CTA stays enabled and invites
          // the same rejection again.
          setSelectedOffer((current) => (current && current.id === fresh.id ? fresh : current));
        })
        .catch((refreshError) => {
          // The public offer endpoint only serves bookable offers, so a 404 is
          // itself the server's answer: seats ran out, the trip was cancelled or
          // it already departed. Marking it unbookable keeps the truth instead of
          // leaving a live CTA over a stale seat count or an invented number.
          if (isOfferNoLongerBookable(refreshError)) {
            setUnbookableOfferId(offer.id);
            setOffers((previous) => previous.filter((item) => item.id !== offer.id));
          }
        });
    }
    finally { setBusy(false); }
  };

  const cancelTrip = (booking: ApiBooking) => {
    setBookingToCancel(booking);
  };

  const confirmCancelTrip = async (booking: ApiBooking) => {
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.cancelBooking(booking.id);
      const refreshed = await refreshCommittedActionData([refreshBookings, refreshJourneys]);
      refreshRescueCandidates([
        ...bookings.filter(item => item.status === 'cancelled' && !item.current_user_is_driver && item.id !== booking.id),
        { ...booking, status: 'cancelled' },
      ].filter(item => !item.current_user_is_driver));
      setBookingToCancel(null);
      // A cancelled booking moves to "Минулі"; follow it so the rescue alternatives stay in view.
      tripsSectionChosen.current = true; setTripsSection('past');
      setStatusMessage(!refreshed
        ? 'Бронювання скасовано. Список поїздок оновиться після повторного відкриття.'
        : booking.current_user_is_driver
          ? 'Бронювання скасовано, місця повернено. Пасажиру надіслано оновлення.'
          : 'Бронювання скасовано. Перевіряємо актуальні поїздки поруч із цим маршрутом.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося скасувати бронювання.'); }
    finally { setBusy(false); }
  };

  const showBookingTicket = async (booking: ApiBooking) => {
    setBusy(true); setStatusMessage('');
    try {
      const currentBookings = await productionApi.bookings();
      setBookings(currentBookings);
      const currentBooking = currentBookings.find((candidate) => candidate.id === booking.id);
      if (!currentBooking || currentBooking.current_user_is_driver || !['confirmed', 'boarding'].includes(currentBooking.status)) {
        throw new Error('Квиток доступний пасажиру лише для підтвердженого бронювання. Оновіть список поїздок.');
      }
      const ticket = await productionApi.bookingTicket(currentBooking.id);
      setVisibleBookingTicket({ bookingId: currentBooking.id, token: ticket.token });
    } catch (error) { setStatusMessage(ticketFailureMessage(error)); setVisibleBookingTicket(null); }
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
      const refreshed = await refreshCommittedActionData([async () => {
        const next = await productionApi.bookingRendezvous(booking.id);
        setRendezvousSessions((current) => ({ ...current, [booking.id]: next }));
      }]);
      setStatusMessage(refreshed
        ? 'Поточне місце надіслано учаснику бронювання. Воно автоматично зникне за 5 хвилин.'
        : 'Місце надіслано учаснику бронювання. Дані зустрічі оновляться після повторного відкриття.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося отримати геолокацію. Перевірте дозвіл пристрою.'); }
    finally { setRendezvousBusy(null); }
  };

  const rendezvousAction = async (booking: ApiBooking, action: 'approaching' | 'arrived' | 'delayed') => {
    const session = rendezvousSessions[booking.id];
    if (!session) return;
    setRendezvousBusy(booking.id); setStatusMessage('');
    try {
      await productionApi.rendezvousStatus(session.id, action);
      const refreshed = await refreshCommittedActionData([async () => {
        const next = await productionApi.bookingRendezvous(booking.id);
        setRendezvousSessions((current) => ({ ...current, [booking.id]: next }));
      }]);
      if (!refreshed) setStatusMessage('Статус зустрічі надіслано. Дані оновляться після повторного відкриття.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося оновити статус зустрічі.'); }
    finally { setRendezvousBusy(null); }
  };

  const rendezvousBoarding = async (booking: ApiBooking) => {
    const session = rendezvousSessions[booking.id];
    if (!session) return;
    setRendezvousBusy(booking.id); setStatusMessage('');
    try {
      await productionApi.rendezvousBoarding(session.id);
      const refreshed = await refreshCommittedActionData([async () => {
        const next = await productionApi.bookingRendezvous(booking.id);
        setRendezvousSessions((current) => ({ ...current, [booking.id]: next }));
      }]);
      if (!refreshed) setStatusMessage('Посадку підтверджено. Дані зустрічі оновляться після повторного відкриття.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Посадка ще не готова.'); }
    finally { setRendezvousBusy(null); }
  };

  const endRendezvous = async (booking: ApiBooking) => {
    const session = rendezvousSessions[booking.id];
    if (!session) return;
    setRendezvousBusy(booking.id); setStatusMessage('');
    try {
      await productionApi.endRendezvous(session.id);
      const refreshed = await refreshCommittedActionData([async () => {
        const next = await productionApi.bookingRendezvous(booking.id);
        setRendezvousSessions((current) => ({ ...current, [booking.id]: next }));
      }]);
      if (!refreshed) setStatusMessage('Обмін місцем завершено. Дані оновляться після повторного відкриття.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося завершити обмін місцем.'); }
    finally { setRendezvousBusy(null); }
  };

  const confirmBoarding = async (booking: ApiBooking, scannedTicket?: string) => {
    const ticket = (scannedTicket ?? boardingTicketInput[booking.id] ?? '').trim();
    if (!ticket) { setStatusMessage('Введіть підписаний токен квитка пасажира.'); return; }
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.markBoarding(booking.id, ticket);
      setBoardingTicketInput((current) => ({ ...current, [booking.id]: '' }));
      const refreshed = await refreshCommittedActionData([refreshBookings]);
      setStatusMessage(refreshed ? 'Посадку підтверджено.' : 'Посадку підтверджено. Стан поїздки оновиться після повторного відкриття.');
    } catch (error) { setStatusMessage(boardingFailureMessage(error)); }
    finally { setBusy(false); setBoardingScanBookingId(null); }
  };

  const startTrip = async (booking: ApiBooking) => {
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.startTrip(booking.id);
      const refreshed = await refreshCommittedActionData([refreshBookings]);
      setStatusMessage(refreshed ? 'Поїздку розпочато.' : 'Поїздку розпочато. Стан оновиться після повторного відкриття.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося розпочати поїздку.'); }
    finally { setBusy(false); }
  };

  const confirmTripCompletion = async (booking: ApiBooking) => {
    setBusy(true); setStatusMessage('');
    try {
      const result = await productionApi.confirmTripCompletion(booking.id);
      const refreshed = await refreshCommittedActionData([refreshBookings]);
      setStatusMessage(!refreshed
        ? 'Ваше підтвердження збережено. Стан поїздки оновиться після повторного відкриття.'
        : result.status === 'completed' ? 'Поїздку завершено за підтвердженнями обох учасників.' : `Завершення підтверджено вами · ${result.confirmations} з ${result.requiredConfirmations}. Очікуємо другого учасника.`);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося підтвердити завершення.'); }
    finally { setBusy(false); }
  };

  const submitBookingReview = async (booking: ApiBooking) => {
    setReviewSubmitting(true);
    try {
      await productionApi.createBookingReview(booking.id, { rating: reviewRating, comment: reviewComment.trim() || undefined });
      setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, current_user_has_review: true } : item));
      setReviewBookingId(null);
      setReviewComment('');
      setStatusMessage('Дякуємо! Ваш відгук збережено.');
      await refreshBookings().catch(() => {
        setStatusMessage('Відгук збережено на сервері. Не вдалося оновити список зараз; стан оновиться після повторного завантаження.');
      });
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Не вдалося зберегти відгук. Перевірте з’єднання та спробуйте ще раз.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openChat = async (booking: ApiBooking) => {
    setSelectedBooking(booking); setMessages([]); setOlderMessagesAvailable(false); setOlderMessageCursor(null); setBusy(true); setStatusMessage('');
    try {
      const conversation = await productionApi.conversation(booking.id);
      const history = await productionApi.messagePage(conversation.id);
      setMessages(history.messages); setOlderMessagesAvailable(history.hasMore); setOlderMessageCursor(history.nextCursor);
      const readState = await productionApi.markConversationRead(conversation.id).catch(() => null);
      if (readState) setUnreadConversations((current) => ({ ...current, [booking.id]: readState.unread_count }));
      setRoutePath(pathForProductionEntity('conversation', conversation.id));
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Чат недоступний.'); }
    finally { setBusy(false); }
  };

  const loadOlderMessages = async () => {
    if (!selectedBooking || !olderMessagesAvailable || !olderMessageCursor || loadingOlderMessages) return;
    setLoadingOlderMessages(true); setStatusMessage('');
    try {
      const conversation = await productionApi.conversation(selectedBooking.id);
      const page = await productionApi.messagePage(conversation.id, olderMessageCursor);
      setMessages((current) => {
        const merged = new Map(current.map((message) => [message.id, message]));
        for (const message of page.messages) merged.set(message.id, message);
        return [...merged.values()].sort((left, right) => left.created_at.localeCompare(right.created_at));
      });
      setOlderMessagesAvailable(page.hasMore); setOlderMessageCursor(page.nextCursor);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Не вдалося завантажити попередні повідомлення.');
    } finally { setLoadingOlderMessages(false); }
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
    setPlaceField(field); setPlaceSearchBusy(true); setPlaceSearch(placeSearchPending()); setStatusMessage('');
    try { setPlaceSearch(placeSearchResults(await productionApi.suggestPlaces(query, await currentPlaceBias()))); }
    catch (error) {
      const next = placeSearchFailure(error);
      setPlaceSearch(next);
      if (!next.unavailable) setStatusMessage(error instanceof Error ? error.message : 'Пошук місця недоступний.');
    }
    finally { setPlaceSearchBusy(false); }
  };

  const searchOfferPlace = async (field: 'origin' | 'destination') => {
    const query = field === 'origin' ? offerOriginText.trim() : offerDestinationText.trim();
    if (query.length < 3) { setStatusMessage('Введіть щонайменше 3 символи для пошуку місця.'); return; }
    setOfferPlaceField(field); setOfferPlaceSearch(placeSearchPending()); setPlaceSearchBusy(true); setStatusMessage('');
    try { setOfferPlaceSearch(placeSearchResults(await productionApi.suggestPlaces(query, await currentPlaceBias()))); }
    catch (error) {
      const next = placeSearchFailure(error);
      setOfferPlaceSearch(next);
      if (!next.unavailable) setStatusMessage(error instanceof Error ? error.message : 'Пошук місця недоступний.');
    }
    finally { setPlaceSearchBusy(false); }
  };

  const chooseOfferPlace = (place: ApiPlace) => {
    if (offerPlaceField === 'origin') { setOfferOrigin(place); setOfferOriginText(place.label); }
    if (offerPlaceField === 'destination') { setOfferDestination(place); setOfferDestinationText(place.label); }
    setOfferPlaceSearch(placeSearchPending()); setOfferPlaceField(null);
  };

  const publishOffer = async (event: FormEvent) => {
    event.preventDefault();
    const vehicle = vehicles.find((item) => item.id === offerVehicleId && vehicleUsable(item));
    const departure = kyivDateTimeInputToDate(offerDeparture);
    const priceMinor = Math.round(Number(offerPrice.replace(',', '.')) * 100);
    if (!offerOrigin || !offerDestination) { setStatusMessage('Оберіть звідки і куди зі списку підказок — так мапа отримає реальні точки.'); return; }
    if (!vehicle) { setStatusMessage('Оберіть своє авто після проходження перевірки.'); return; }
    if (!departure || departure <= new Date()) { setStatusMessage('Час відправлення має бути коректним київським часом у майбутньому.'); return; }
    if (!Number.isInteger(priceMinor) || priceMinor < 1) { setStatusMessage('Ціна за місце має бути більшою за 0.'); return; }
    if (!Number.isInteger(offerSeats) || offerSeats < 1 || offerSeats > vehicle.seat_count) { setStatusMessage('Кількість місць не може перевищувати місткість авто.'); return; }
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.createOffer({
        vehicleId: vehicle.id, originName: navigationDestinationName(offerOrigin.label), destinationName: navigationDestinationName(offerDestination.label),
        origin: [offerOrigin.longitude, offerOrigin.latitude], destination: [offerDestination.longitude, offerDestination.latitude],
        departureAt: departure.toISOString(), pricePerSeatMinor: priceMinor, seats: offerSeats,
      });
      const refreshed = await refreshCommittedActionData([refreshMyOffers, refreshBookings]);
      setStatusMessage(refreshed
        ? 'Поїздку опубліковано.'
        : 'Поїздку опубліковано. Список оновиться після повторного відкриття.');
      setOfferOrigin(null); setOfferDestination(null); setOfferOriginText(''); setOfferDestinationText('');
      setOfferPlaceSearch(placeSearchPending()); setTab('trips');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setStatusMessage(/invalid offer fields/i.test(message)
        ? 'Сервер не прийняв поїздку: перевірте назви місць (до 120 символів), авто, час відправлення, ціну та кількість місць.'
        : message || 'Не вдалося опублікувати поїздку.');
    }
    finally { setBusy(false); }
  };

  const choosePlace = (place: ApiPlace) => {
    if (placeField === 'origin') { setDemandOrigin(place); setDemandOriginText(place.label); }
    if (placeField === 'destination') { setDemandDestination(place); setDemandDestinationText(place.label); }
    setPlaceSearch(placeSearchPending()); setPlaceField(null);
  };

  const publishDemand = async (event: FormEvent) => {
    event.preventDefault();
    if (!demandOrigin || !demandDestination) { setStatusMessage('Оберіть обидва місця зі списку підказок — так пошук буде точним.'); return; }
    const earliest = kyivDateTimeInputToDate(demandEarliest); const latest = kyivDateTimeInputToDate(demandLatest);
    if (!earliest || !latest || latest < earliest) { setStatusMessage('Перевірте часовий інтервал за київським часом.'); return; }
    const budget = demandBudget.trim() ? Math.round(Number(demandBudget.replace(',', '.')) * 100) : undefined;
    if (demandBudget.trim() && (!Number.isFinite(budget) || budget! < 1)) { setStatusMessage('Бюджет має бути додатною сумою.'); return; }
    setBusy(true); setStatusMessage('');
    try {
      const demand = await productionApi.createDemand({
        originName: navigationDestinationName(demandOrigin.label), destinationName: navigationDestinationName(demandDestination.label),
        origin: [demandOrigin.longitude, demandOrigin.latitude], destination: [demandDestination.longitude, demandDestination.latitude],
        earliestDeparture: earliest.toISOString(), latestDeparture: latest.toISOString(), passengers: demandPassengers,
        ...(budget === undefined ? {} : { budgetMinor: budget }), budgetType: demandBudgetType, notes: demandNotes, requirements: demandRequirements,
      });
      const refreshed = await refreshCommittedActionData([refreshMyDemands]);
      setStatusMessage(refreshed ? 'Заявку опубліковано.' : 'Заявку опубліковано. Список оновиться після повторного відкриття.');
      setSelectedDemand(demand); setSelectedDemandIsOwned(true); setProposals([]); setProposalsUnavailable(false); setRoutePath(pathForProductionEntity('demand', demand.id)); activateTab('my-demands');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setStatusMessage(/invalid passenger demand/i.test(message)
        ? 'Сервер не прийняв заявку: перевірте назви місць (до 120 символів) та часовий інтервал.'
        : message || 'Не вдалося опублікувати заявку.');
    }
    finally { setBusy(false); }
  };

  const viewDemand = async (demand: ApiDemand, isOwned: boolean) => {
    setSelectedDemand(demand); setSelectedDemandIsOwned(isOwned); setProposals([]); setProposalsUnavailable(false); setProposalRevisions({}); setBusy(true); setStatusMessage('');
    setRoutePath(pathForProductionEntity('demand', demand.id)); activateTab(isOwned ? 'my-demands' : 'requests');
    try {
      const result = await loadDemandProposals(demand.id);
      setProposals(result.proposals); setProposalsUnavailable(result.unavailable);
      return !result.unavailable;
    } finally { setBusy(false); }
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
      const verified = vehicles.find((vehicle) => vehicleUsable(vehicle) && vehicle.is_active) ?? vehicles.find((vehicle) => vehicleUsable(vehicle));
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
      const refreshed = await refreshCommittedActionData([refreshOpenDemands]);
      setProposalTarget(null); setProposalNavigationCandidateId(null);
      const proposalsRefreshed = await viewDemand(proposalTarget, false);
      setStatusMessage(refreshed && proposalsRefreshed
        ? 'Цінову пропозицію надіслано пасажиру.'
        : 'Пропозицію надіслано. Список оновиться після повторного відкриття.');
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
      await productionApi.acceptProposal(proposal.id);
      const refreshed = await refreshCommittedActionData([refreshBookings, refreshMyDemands]);
      setStatusMessage(refreshed
        ? 'Домовленість підтверджено, бронювання створено.'
        : 'Домовленість підтверджено. Список поїздок оновиться після повторного відкриття.');
      setSelectedDemand(null); setTab('trips');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося підтвердити бронювання.'); }
    finally { setBusy(false); }
  };

  const confirmNavigationMatch = async (candidateId: string) => {
    setBusy(true); setStatusMessage('');
    try {
      await productionApi.confirmNavigationMatch(candidateId);
      const refreshed = await refreshCommittedActionData([refreshPassengerNavigationMatches]);
      setStatusMessage(refreshed
        ? 'Взаємний інтерес підтверджено. Ціну та бронювання ще потрібно погодити.'
        : 'Взаємний інтерес підтверджено. Список оновиться після повторного відкриття.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося підтвердити взаємний інтерес.'); }
    finally { setBusy(false); }
  };

  const cancelDemand = async (demand: ApiDemand) => {
    setBusy(true);
    try {
      await productionApi.cancelDemand(demand.id);
      const refreshed = await refreshCommittedActionData([refreshMyDemands]);
      setStatusMessage(refreshed ? 'Заявку скасовано.' : 'Заявку скасовано. Список оновиться після повторного відкриття.');
      if (selectedDemand?.id===demand.id) setSelectedDemand(null);
    }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося скасувати заявку.'); }
    finally { setBusy(false); }
  };

  const createVehicle = async (event: FormEvent) => {
    event.preventDefault();
    if (!vehicleFormPhoto) { setStatusMessage('Додайте фото автомобіля: воно обов’язкове.'); return; }
    setBusy(true);
    try {
      const created = await productionApi.createVehicle(vehicleForm);
      try { await productionApi.uploadVehiclePhoto(created.id, vehicleFormPhoto); }
      catch { await refreshCommittedActionData([refreshVehicles]); setShowVehicleForm(false); setStatusMessage('Автомобіль додано, але фото не завантажилося. Повторіть завантаження фото в картці авто перед публікацією поїздки.'); return; }
      const refreshed = await refreshCommittedActionData([refreshVehicles]);
      setShowVehicleForm(false); setVehicleFormPhoto(null); setVehicleForm({ ...vehicleForm, make: '', model: '', plate: '' });
      setStatusMessage(refreshed
        ? 'Автомобіль і фото збережено. Документи можна подати окремо на перевірку.'
        : 'Автомобіль і фото збережено. Список авто оновиться після повторного відкриття.');
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
    try {
      await productionApi.setPrimaryVehiclePhoto(vehicleId, photoId);
      const refreshed = await refreshCommittedActionData([refreshVehicles]);
      if (!refreshed) setStatusMessage('Головне фото змінено. Список авто оновиться після повторного відкриття.');
    }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося змінити головне фото.'); }
    finally { setBusy(false); }
  };

  const moveVehiclePhoto = async (vehicleId: string, photoId: string, direction: -1 | 1) => {
    const photos = vehiclePhotos[vehicleId] ?? [];
    const index = photos.findIndex((photo) => photo.id === photoId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= photos.length) return;
    const reordered = [...photos];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setBusy(true);
    try {
      const result = await productionApi.reorderVehiclePhotos(vehicleId, reordered.map((photo) => photo.id));
      const byId = new Map(photos.map((photo) => [photo.id, photo]));
      setVehiclePhotos((current) => ({ ...current, [vehicleId]: result.photoIds.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []) }));
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Не вдалося змінити порядок фото.'); }
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
      setMessages([]); setRealtimeStatus('closed'); setSelectedBooking(null); setTab('trips');
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
    exitJourneyNavigation();
    setUser(null); setBookings([]); setJourneys([]); setNotificationPage({ items: [], nextCursor: null, unreadCount: 0 }); setShowNotifications(false); setBlockedUsers([]); setVehicles([]); setOffers([]); setShowLogin(true);
  };

  const logoutAllDevices = async () => {
    await productionApi.logoutAll();
    new OfflineNavigationStore().clear();
    exitJourneyNavigation();
    setProfileSection(null); setUser(null); setBookings([]); setJourneys([]); setNotificationPage({ items: [], nextCursor: null, unreadCount: 0 }); setShowNotifications(false); setBlockedUsers([]); setVehicles([]); setOffers([]); setShowLogin(true);
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
    setConfirmDeletion(false);
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

  const continueToLogin = () => {
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

  // Keep this hook in the same position on loading, public and authenticated
  // renders. The protected-screen early returns below used to skip it for the
  // first render and trigger React's "Rendered more hooks" crash after restore.
  const mapToolbarContext = isMapToolbarContext({
    tab,
    activeJourneyNavigation: Boolean(activeJourneyNavigation),
    selectedRouteMap: Boolean(selectedRouteMap),
    selectedJourney: Boolean(selectedJourney),
  });
  const { visible: mapNavigationVisible, onMapEdgePointerDown } = useMapAwareBottomNavigation(mapToolbarContext);

  if (loading) return <main className="grid min-h-[100svh] place-items-center bg-[var(--mg-canvas)] text-sm text-slate-500">Завантажуємо захищену сесію…</main>;
  if (!user || showLogin) return (
    <main className={`auth-screen relative flex min-h-[100svh] overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-safe ${authIntro ? 'auth-intro-screen' : ''} ${onboardingStep > 0 ? 'bg-[#f4f8ff] text-[var(--mg-ink-primary)] dark:bg-[var(--mg-surface-secondary)] dark:text-[var(--mg-ink-primary)]' : 'bg-[#081b35] text-white'} ${authIntro ? 'items-stretch' : onboardingStep > 0 ? 'h-[100svh] max-h-[100svh] items-stretch' : 'items-end sm:items-center sm:justify-center'}`}>
      {authIntro && <img src="/images/welcome-kyiv-v1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_58%]" />}
      <div className={`absolute inset-0 ${authIntro ? 'bg-[linear-gradient(180deg,rgba(4,17,37,.45)_0%,rgba(5,22,44,.08)_34%,rgba(5,15,29,.28)_57%,rgba(3,10,19,.9)_100%)]' : onboardingStep > 0 ? 'bg-[linear-gradient(180deg,#f4f8ff_0%,#ffffff_58%,#edf4ff_100%)] dark:bg-[linear-gradient(180deg,#0D1E36_0%,#10263F_58%,#0B1B31_100%)]' : 'auth-screen__shade--login'}`} />
      {!authIntro && onboardingStep === 0 && <div className="absolute inset-x-0 bottom-0 h-[48%] bg-[linear-gradient(0deg,rgba(4,10,18,.88),transparent)]" />}
      <section className={`relative z-10 mx-auto flex w-full max-w-md flex-col ${authIntro ? 'min-h-[calc(100svh-env(safe-area-inset-top))] items-center pb-1 text-center' : 'pb-2'}`}>
        {!authIntro && onboardingStep === 0 && <button onClick={() => { setAuthIntro(true); setShowLogin(false); setStatusMessage(''); setAuthError(''); }} className="mb-6 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10" aria-label="Назад"><ArrowLeft size={19}/></button>}
        {authIntro ? <>
          <div className="mt-[max(3rem,10svh)] flex flex-col items-center drop-shadow-[0_2px_16px_rgba(4,12,28,.3)]">
            <BrandMark size="lg" className="mb-3 ring-1 ring-white/60 shadow-[0_0_38px_rgba(56,189,248,.42)]" />
            <strong className="text-[2rem] font-extrabold tracking-tight">MARSH<span className="text-sky-400">GO</span></strong>
            <p className="mt-1 text-xs text-white/85">Один маршрут. Усі способи доїхати.</p>
            <p className="mt-1 text-xs text-white/75">Попутки · міські поїздки · подорожі Україною</p>
          </div>
          <div className="mt-auto w-full pb-5 pt-8 text-left drop-shadow-[0_2px_12px_rgba(0,0,0,.55)]">
            <p className="text-xs font-bold uppercase tracking-[.27em] text-blue-100">Україна ближче</p>
            <h1 className="mt-2 text-[2.15rem] font-extrabold leading-[1.08] tracking-tight">Усі способи<br/>доїхати — в одному<br/>застосунку.</h1>
            <p className="mt-3 max-w-sm text-sm leading-5 text-blue-50/90">Знайдіть попутку, сплануйте маршрут і домовтеся про поїздку в одному місці.</p>
          </div>
          <div className="w-full">
            <button onClick={() => { setAuthIntro(false); setOnboardingStep(1); setShowLogin(false); }} className="mg-press min-h-11 w-full rounded-2xl bg-[var(--mg-action)] px-5 py-[1.05rem] text-sm font-bold text-white shadow-lg shadow-blue-950/45 hover:bg-[var(--mg-action-hover)]">Почати</button>
            <button onClick={() => { setAuthIntro(false); setOnboardingStep(0); setShowLogin(true); }} className="mg-press mt-3 min-h-11 w-full rounded-2xl border border-white/50 bg-slate-950/25 px-5 py-3.5 text-sm font-semibold backdrop-blur-sm">У мене вже є акаунт</button>
          </div>
        </> : onboardingStep > 0 ? <OnboardingSlides step={onboardingStep as 1 | 2 | 3} permissionMessage={onboardingPermissionMessage}
          onNext={() => setOnboardingStep(Math.min(3, onboardingStep + 1))} onBack={() => onboardingStep === 1 ? setAuthIntro(true) : setOnboardingStep(onboardingStep - 1)}
          onSkip={continueToLogin} onFinish={continueToLogin} onRequestLocation={requestOnboardingLocation}/> : <>
        <div className="mb-8 flex items-center gap-3"><BrandMark/><div><strong className="text-2xl tracking-tight">MARSH<span className="text-sky-400">GO</span></strong><p className="text-xs text-blue-100/80">Один маршрут. Усі способи доїхати.</p></div></div>
        {authMode === 'login' ? <>
          <h1 className="text-3xl font-extrabold">Вхід до MARSHGO</h1><p className="mt-2 text-sm text-blue-100/80">Увійдіть за email та паролем.</p>
          <form onSubmit={handleLogin} aria-describedby={authError ? 'auth-error' : undefined} className="mt-6 space-y-3">
            <AuthField id="login-email" label="Email" type="email" autoComplete="email" placeholder="name@example.com" value={authEmail} onChange={setAuthEmail} invalid={!!authError} describedBy={authError ? 'auth-error' : undefined} />
            <AuthField id="login-password" label="Пароль" type="password" autoComplete="current-password" minLength={8} value={authPassword} onChange={setAuthPassword} invalid={!!authError} describedBy={authError ? 'auth-error' : undefined} />
            <button type="submit" disabled={busy} className="mg-press mt-1 min-h-11 w-full rounded-2xl bg-[var(--mg-action)] px-5 py-4 font-bold text-white shadow-lg shadow-blue-950/40 hover:bg-[var(--mg-action-hover)] disabled:opacity-60">{busy ? 'Входимо…' : 'Увійти'}</button>
          </form>
          <button type="button" onClick={() => { setAuthMode('reset'); setStatusMessage(''); setAuthError(''); }} className="mt-1 min-h-11 w-full rounded-xl px-3 text-sm text-blue-100 hover:text-white">Забули пароль?</button>
          <button type="button" onClick={() => { setAuthMode('register'); setStatusMessage(''); setAuthError(''); }} className="mt-2 min-h-11 w-full rounded-xl px-3 text-sm text-blue-100 hover:text-white">Немає акаунта? Зареєструватися</button>
        </> : authMode === 'register' ? <>
          <h1 className="text-3xl font-extrabold">Реєстрація</h1><p className="mt-2 text-sm text-blue-100/80">Створіть акаунт MARSHGO.</p>
          <form onSubmit={handleRegister} aria-describedby={authError ? 'auth-error' : undefined} className="mt-6 space-y-3">
            <AuthField id="register-name" label="Ваше ім'я" type="text" autoComplete="name" minLength={2} maxLength={80} placeholder="Як вас називати водіям" value={authDisplayName} onChange={setAuthDisplayName} invalid={!!authError} describedBy={authError ? 'auth-error' : undefined} />
            <AuthField id="register-email" label="Email" type="email" autoComplete="email" placeholder="name@example.com" value={authEmail} onChange={setAuthEmail} invalid={!!authError} describedBy={authError ? 'auth-error' : undefined} />
            <AuthField id="register-password" label="Пароль" type="password" autoComplete="new-password" minLength={8} placeholder="Щонайменше 8 символів" value={authPassword} onChange={setAuthPassword} invalid={!!authError} describedBy={authError ? 'auth-error' : undefined} />
            <button type="submit" disabled={busy} className="mg-press mt-1 min-h-11 w-full rounded-2xl bg-[var(--mg-action)] px-5 py-4 font-bold text-white shadow-lg shadow-blue-950/40 hover:bg-[var(--mg-action-hover)] disabled:opacity-60">{busy ? 'Реєструємо…' : 'Зареєструватися'}</button>
          </form>
          <button type="button" onClick={() => { setAuthMode('login'); setStatusMessage(''); setAuthError(''); }} className="mt-2 min-h-11 w-full rounded-xl px-3 text-sm text-blue-100 hover:text-white">Вже є акаунт? Увійти</button>
        </> : <>
          <h1 className="text-3xl font-extrabold">Відновлення пароля</h1><p className="mt-2 text-sm text-blue-100/80">Введіть email свого акаунта.</p>
          <form onSubmit={handlePasswordResetRequest} aria-describedby={authError ? 'auth-error' : undefined} className="mt-6 space-y-3">
            <AuthField id="reset-email" label="Email" type="email" autoComplete="email" placeholder="name@example.com" value={authEmail} onChange={setAuthEmail} invalid={!!authError} describedBy={authError ? 'auth-error' : undefined} />
            <button type="submit" disabled={busy} className="mg-press mt-1 min-h-11 w-full rounded-2xl bg-[var(--mg-action)] px-5 py-4 font-bold text-white shadow-lg shadow-blue-950/40 hover:bg-[var(--mg-action-hover)] disabled:opacity-60">{busy ? 'Перевіряємо…' : 'Надіслати посилання'}</button>
          </form>
          <button type="button" onClick={() => { setAuthMode('login'); setStatusMessage(''); setAuthError(''); }} className="mt-2 min-h-11 w-full rounded-xl px-3 text-sm text-blue-100 hover:text-white">Повернутися до входу</button>
        </>}
        {authError && <p id="auth-error" role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#FF9CA7]/45 bg-[rgba(255,90,106,.15)] px-3.5 py-3 text-sm leading-5 text-[#FFE2E6]"><AlertCircle size={16} className="mt-0.5 shrink-0 text-[#FF9CA7]"/><span className="min-w-0 flex-1">{authError}</span></p>}
        {statusMessage && <p role="status" className="mt-4 rounded-xl bg-white/10 p-3 text-sm text-white">{statusMessage}</p>}
        {!authIntro && <p className="mt-5 flex gap-2 text-xs leading-5 text-blue-100/70"><ShieldCheck size={16} className="shrink-0"/>Захищено шифруванням. Дані не передаються третім особам.</p>}
        </>}
      </section>
    </main>
  );

  if (notFound) return <main className="grid min-h-[70svh] place-items-center px-5 text-center"><div role="alert" className="max-w-md rounded-3xl bg-white p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--mg-blue-ink)]">404</p><h1 className="mt-2 text-2xl font-extrabold">Сторінку не знайдено</h1><p className="mt-2 text-sm text-slate-500">Перевірте адресу або поверніться до головної сторінки MARSHGO.</p><button onClick={goHome} className="mg-press mt-5 min-h-11 rounded-xl bg-[var(--mg-action)] px-5 py-3 text-sm font-bold text-white hover:bg-[var(--mg-action-hover)]">На головну</button></div></main>;

  const status = statusMessage ? <div role={statusIsError ? 'alert' : 'status'} className={`mx-auto mt-3 flex w-full max-w-xl items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${statusIsError ? 'mg-feedback-error' : 'border-blue-100 bg-blue-50 text-blue-800 dark:border-[var(--mg-line)] dark:bg-[var(--mg-blue-tint)] dark:text-[var(--mg-blue-ink)]'}`}>{statusIsError && <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true"/>}{statusIsError && <span className="sr-only">Помилка: </span>}<span className="min-w-0 flex-1">{statusMessage}</span><button type="button" aria-label="Закрити повідомлення" onClick={() => setStatusMessage('')} className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-blue-100"><X size={16}/></button></div> : null;
  const placeUnavailableNotice = (retry: () => void) => (
    <div role="alert" className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--mg-border-medium)] bg-white px-3 py-2 text-xs leading-5 text-[var(--mg-ink-secondary)] dark:bg-[var(--mg-surface-primary)]">
      <span className="min-w-0 flex-1">{PLACE_SEARCH_UNAVAILABLE_COPY}</span>
      <button type="button" onClick={retry} disabled={placeSearchBusy} className="min-h-11 shrink-0 rounded-lg px-3 text-xs font-bold text-[var(--mg-blue-ink)] disabled:opacity-50">{placeSearchBusy ? '…' : 'Повторити'}</button>
    </div>
  );
  const unreadMessageCount = Object.values(unreadConversations).reduce((total, count) => total + count, 0);
  const applyCustomJourneyBudget = () => {
    const budget = parseJourneyBudgetUah(customJourneyBudgetDraft);
    if (budget === null) return;
    setJourneyBudgetUah(budget);
    setCustomJourneyBudgetOpen(false);
    setCustomJourneyBudgetDraft('');
    setStatusMessage('');
  };
  const header = <header className="app-header mx-auto flex w-full max-w-xl items-center gap-2 px-3 pb-3 pt-[max(.8rem,env(safe-area-inset-top))] sm:px-5">
    <div className="app-header-brand flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2.5"><BrandMark size="sm"/><div className="app-header-brand-copy min-w-0"><strong className="whitespace-nowrap text-base tracking-tight text-[var(--mg-ink-primary)] dark:text-[var(--mg-ink-primary)] sm:text-[18px]">MARSH<span className="text-[var(--mg-blue-ink)]">GO</span></strong><p className="-mt-1 truncate text-xs text-[var(--mg-ink-secondary)] dark:text-[var(--mg-ink-secondary)]">Усі поїздки в одному місці</p></div></div>
    <CurrentCitySelector city={currentCity} onSelect={(choice) => { setCityLocationMessage(''); commitCurrentCity({ ...choice, source: 'manual' }); }} onLocate={locateCurrentCity} locating={cityLocationBusy} locationMessage={cityLocationMessage}/>
    <div className="app-header-actions ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
      <button onClick={() => setTab('chat')} aria-label={`Повідомлення${unreadMessageCount ? `, непрочитаних ${unreadMessageCount}` : ''}`} className="app-header-icon-button relative grid h-11 w-11 place-items-center rounded-full"><MessageCircle size={19}/>{unreadMessageCount>0&&<span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-xs font-bold text-white">{unreadMessageCount>99?'99+':unreadMessageCount}</span>}</button>
      <button onClick={() => void openNotifications()} aria-label={`Сповіщення${notificationPage.unreadCount ? `, непрочитаних ${notificationPage.unreadCount}` : ''}`} className="app-header-icon-button relative grid h-11 w-11 place-items-center rounded-full"><Bell size={19}/>{notificationPage.unreadCount>0&&<span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-xs font-bold text-white">{notificationPage.unreadCount>99?'99+':notificationPage.unreadCount}</span>}</button>
    </div>
  </header>;

  const searchForm = <form onSubmit={(event) => { event.preventDefault(); void searchJourney(); }} className="journey-search-card rounded-[1.7rem] border border-white bg-white p-3 shadow-[0_10px_28px_rgba(31,67,114,.08)] dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)] dark:shadow-[0_10px_28px_rgba(0,0,0,.3)]">
    <div className="relative">
      <div role="group" aria-label="Початкова точка" className="flex items-center gap-2 rounded-t-2xl bg-[var(--mg-surface-tint)] px-3 py-3"><MapPin size={19} className="shrink-0 text-blue-600"/><label className="min-w-0 flex-1"><small className="block text-xs text-[var(--mg-muted)]">Звідки</small><input required title={origin || undefined} value={origin} onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Будь ласка, вкажіть пункт відправлення')} onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')} onFocus={() => setRoutePlaceField('origin')} onChange={(event) => {setOrigin(event.target.value);setSearchOriginPlace(null);setRoutePlaceField('origin');}} onKeyDown={(event) => routePlaceKeyDown(event, 'origin')} className="w-full bg-transparent text-sm font-bold outline-none" placeholder="Місто відправлення" role="combobox" aria-autocomplete="list" aria-expanded={routePlaceField === 'origin' && routePlaceSearch.suggestions.length > 0} aria-controls="route-place-origin-list" aria-activedescendant={activePlaceOptionId('route-place-origin-list', routePlaceActive)} /></label><button type="button" aria-label={origin ? 'Очистити початкову точку' : 'Визначити мою локацію'} title={origin ? 'Очистити' : 'Моя локація'} onClick={()=>{ if (origin) { setOrigin(''); setSearchOriginPlace(null); setRoutePlaceSearch(placeSearchPending()); return; } void useMyLocationAsOrigin(); }} data-field-action={origin ? 'clear' : 'locate'} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl search-field-action">{origin ? <X size={16}/> : <Navigation size={16}/>}</button></div>
      {routePlaceField==='origin'&&routePlaceSearch.suggestions.length>0&&<div role="listbox" id="route-place-origin-list" aria-label="Варіанти місць відправлення" className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:divide-[#1E3044] dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)]">{routePlaceSearch.suggestions.map((place,index)=><button key={place.providerId} type="button" role="option" id={`route-place-origin-list-option-${index}`} aria-selected={routePlaceActive===index} onClick={()=>chooseSearchPlace(place)} className={`block w-full px-3 py-2.5 text-left text-xs text-slate-800 hover:bg-blue-50 dark:text-slate-100 dark:hover:bg-[#16293D] ${routePlaceActive===index?'bg-blue-50 font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200':''}`}>{place.label}</button>)}</div>}
      {routePlaceField==='origin'&&routePlaceSearch.unavailable&&placeUnavailableNotice(()=>void searchRoutePlace('origin'))}
      <div className="relative ml-[21px] h-4 border-l-2 border-dotted border-slate-300"><button type="button" onClick={() => { setOrigin(destination); setDestination(origin); setSearchOriginPlace(searchDestinationPlace); setSearchDestinationPlace(searchOriginPlace); setRoutePlaceSearch(placeSearchPending()); setRoutePlaceField(null); }} className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-blue-600 shadow-sm dark:bg-[var(--mg-surface-elevated)] dark:text-blue-400 dark:border dark:border-[#283e54]" aria-label="Поміняти місцями"><ArrowDownUp size={17}/></button></div>
      <div role="group" aria-label="Кінцева точка" className="flex items-center gap-2 rounded-b-2xl bg-[var(--mg-surface-tint)] px-3 py-3"><MapPin size={19} className="shrink-0 text-rose-500"/><label className="min-w-0 flex-1"><small className="block text-xs text-[var(--mg-muted)]">Куди</small><input required title={destination || undefined} value={destination} onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Будь ласка, вкажіть пункт призначення')} onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')} onFocus={() => setRoutePlaceField('destination')} onChange={(event) => {setDestination(event.target.value);setSearchDestinationPlace(null);setRoutePlaceField('destination');}} onKeyDown={(event) => routePlaceKeyDown(event, 'destination')} className="w-full bg-transparent text-sm font-bold outline-none" placeholder="Місто призначення" role="combobox" aria-autocomplete="list" aria-expanded={routePlaceField === 'destination' && routePlaceSearch.suggestions.length > 0} aria-controls="route-place-destination-list" aria-activedescendant={activePlaceOptionId('route-place-destination-list', routePlaceActive)} /></label>{destination ? <button type="button" aria-label="Очистити кінцеву точку" title="Очистити" onClick={() => { setDestination(''); setSearchDestinationPlace(null); setRoutePlaceSearch(placeSearchPending()); }} data-field-action="clear" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl search-field-action"><X size={16}/></button> : <button type="button" aria-label="Обрати на мапі" title="Обрати на мапі" onClick={() => { setRoutePlaceField(null); setRoutePlaceSearch(placeSearchPending()); setPicker({ form: 'search', field: 'destination' }); }} data-field-action="pick" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl search-field-action"><MapPin size={16}/></button>}</div>
      {routePlaceField==='destination'&&routePlaceSearch.suggestions.length>0&&<div role="listbox" id="route-place-destination-list" aria-label="Варіанти місць призначення" className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:divide-[#1E3044] dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)]">{routePlaceSearch.suggestions.map((place,index)=><button key={place.providerId} type="button" role="option" id={`route-place-destination-list-option-${index}`} aria-selected={routePlaceActive===index} onClick={()=>chooseSearchPlace(place)} className={`block w-full px-3 py-2.5 text-left text-xs text-slate-800 hover:bg-blue-50 dark:text-slate-100 dark:hover:bg-[#16293D] ${routePlaceActive===index?'bg-blue-50 font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200':''}`}>{place.label}</button>)}</div>}
      {routePlaceField==='destination'&&routePlaceSearch.unavailable&&placeUnavailableNotice(()=>void searchRoutePlace('destination'))}
    </div>
    {/*
     * The board gives a place row exactly one trailing 44 px control. Two pin glyphs per row cost
     * 52 px of place text on a 390 px screen, which is what cut «Аеропорт, Торгмаш…» mid-word, so the
     * map picker moved here and names the field it fills instead of hiding behind an icon.
     */}
        <div className={`search-trip-details mt-2 grid grid-cols-2 gap-2${journeyArrivalBy ? ' search-trip-details--armed' : ''}`}>
      <button type="button" aria-label="Вибрати дату й час відправлення" onClick={() => setDeparturePickerOpen(true)} className="trip-tile min-w-0 text-left"><Clock3 size={16} className="shrink-0 text-emerald-600"/><span className="min-w-0"><small>З</small><span className="trip-tile__value block truncate">{new Intl.DateTimeFormat('uk-UA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Kyiv'}).format(kyivDateTimeInputToDate(journeyDeparture) ?? new Date())}</span></span></button>
      <div className={`trip-tile min-w-0 ${journeyArrivalBy ? 'justify-between' : ''}`}>
        <button type="button" aria-label="Вибрати дату й час прибуття" onClick={() => { if (!journeyArrivalBy) setJourneyArrivalBy(`${journeyDeparture.slice(0, 10)}T20:00`); setArrivalPickerOpen(true); }} className="flex min-w-0 flex-1 items-center gap-2 text-left"><CalendarDays size={16} className={`shrink-0 ${journeyArrivalBy ? 'text-blue-600' : 'text-slate-400'}`}/><span className="min-w-0"><small>По</small><span className="trip-tile__value block truncate">{journeyArrivalBy ? new Intl.DateTimeFormat('uk-UA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Kyiv'}).format(kyivDateTimeInputToDate(journeyArrivalBy) ?? new Date()) : 'Без обмеження'}</span></span></button>
        {journeyArrivalBy && <button type="button" aria-label="Скасувати обмеження прибуття" onClick={() => setJourneyArrivalBy(null)} className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"><X size={17}/></button>}
      </div>
    </div>
    <div className="search-trip-details search-trip-details--stack mt-2 grid grid-cols-2 gap-2">
      <div className="trip-tile trip-tile--stepper min-w-0 justify-between">
        <span className="flex min-w-0 items-center gap-2"><Users size={16} className="shrink-0 text-slate-500"/><span className="min-w-0"><small>Пасажири</small><span className="trip-tile__value block" aria-live="polite">{passengersLabel(seats)}</span></span></span>
        <span className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => setSeats(Math.max(1,seats-1))} disabled={seats<=1} className="size-11 rounded-[.85rem] text-slate-600 transition active:scale-95 disabled:opacity-30" aria-label="Менше пасажирів"><Minus size={17}/></button><button type="button" onClick={() => setSeats(Math.min(8,seats+1))} disabled={seats>=8} className="size-11 rounded-[.85rem] text-blue-600 transition active:scale-95 disabled:opacity-30" aria-label="Більше пасажирів"><Plus size={17}/></button></span>
      </div>
      <label className="trip-tile relative min-w-0 cursor-pointer">
        <Coins size={16} className="shrink-0 text-amber-500"/>
        <span className="min-w-0"><small>Орієнтовний бюджет</small><span className="trip-tile__value block truncate">{customJourneyBudgetOpen && journeyBudgetUah === null ? 'Вкажіть суму' : budgetLabel(journeyBudgetUah)}</span></span>
        <ChevronDown size={15} className="ml-auto shrink-0 text-slate-400"/>
        <select aria-label="Орієнтовний бюджет на поїздку" value={customJourneyBudgetOpen ? 'custom' : journeyBudgetUah ?? ''} onChange={(event) => {
          const value = event.target.value;
          if (value === 'custom') {
            setCustomJourneyBudgetOpen(true);
            setCustomJourneyBudgetDraft(journeyBudgetUah === null ? '' : String(journeyBudgetUah));
            return;
          }
          setCustomJourneyBudgetOpen(false);
          setCustomJourneyBudgetDraft('');
          setJourneyBudgetUah(value === '' ? null : Number(value));
        }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
          {journeyBudgetUah !== null && ![50, 100, 200, 300, 500, 1000].includes(journeyBudgetUah) && <option value={journeyBudgetUah}>{`До ${journeyBudgetUah} грн`}</option>}
          {[null, 50, 100, 200, 300, 500, 1000].map((value) => <option key={String(value)} value={value ?? ''}>{value === null ? 'Без обмеження' : `До ${value} грн`}</option>)}
          <option value="custom">Свій варіант…</option>
        </select>
      </label>
    </div>
    {customJourneyBudgetOpen && <div className="mt-2 min-w-0 rounded-xl border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-secondary)] p-3">
      <label className="block min-w-0 text-xs font-semibold text-[var(--mg-ink-secondary)]" htmlFor="custom-journey-budget">Власний бюджет, грн
        <input id="custom-journey-budget" type="number" inputMode="numeric" min={1} max={MAX_JOURNEY_BUDGET_UAH} step={1} value={customJourneyBudgetDraft} onChange={(event) => setCustomJourneyBudgetDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyCustomJourneyBudget(); } }} aria-describedby="custom-journey-budget-hint" className="mt-1 min-h-11 w-full rounded-xl border border-[var(--mg-border-medium)] bg-[var(--mg-surface-primary)] px-3 text-base font-bold text-[var(--mg-ink-primary)] focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)]" placeholder="Наприклад, 450" />
        <small id="custom-journey-budget-hint" className="mt-1 block text-[var(--mg-ink-muted)]">Ціла сума від 1 до {MAX_JOURNEY_BUDGET_UAH.toLocaleString('uk-UA')} грн. Попереднє значення збережеться, доки не застосуєте нове.</small>
      </label>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={() => { setCustomJourneyBudgetOpen(false); setCustomJourneyBudgetDraft(''); setStatusMessage(''); }} className="min-h-11 shrink-0 rounded-xl border border-[var(--mg-border-medium)] bg-[var(--mg-surface-primary)] px-3 text-sm font-semibold text-[var(--mg-ink-secondary)]">Скасувати</button>
        <button type="button" onClick={applyCustomJourneyBudget} disabled={parseJourneyBudgetUah(customJourneyBudgetDraft) === null} className="min-h-11 shrink-0 rounded-xl bg-[var(--mg-action)] px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Застосувати</button>
      </div>
    </div>}
    <TransportTypesPanel compact selection={transportSelection} groups={providerGroups} onChange={changeTransportSelection}
      onManageProviders={() => setTransportPickerOpen(true)}/>
    <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-secondary)] px-3 py-1.5">
      <input type="checkbox" checked={journeyDirectOnly} onChange={(event) => setJourneyDirectOnly(event.target.checked)} className="size-5 shrink-0 accent-[var(--mg-action)]" />
      <span className="shrink-0 text-xs font-bold text-[var(--mg-ink-primary)]">Без пересадок</span>
      <span className="ml-auto min-w-0 truncate text-xs font-semibold text-[var(--mg-ink-secondary)]">один вид транспорту</span>
    </label>
    <button type="submit" disabled={busy || isOffline} aria-label={isOffline ? 'Знайти маршрут: потрібне з’єднання з інтернетом' : undefined} className="search-submit mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 disabled:opacity-60">{isOffline ? <WifiOff size={17}/> : <Search size={17}/>}{busy ? 'Шукаємо…' : isOffline ? 'Немає з’єднання' : 'Знайти маршрут'}{!isOffline && <ArrowRight size={17}/>}</button>
  </form>;

  const sortedOffers = [...offers].sort((a, b) => offerSort === 'cheapest' ? a.price_per_seat_minor - b.price_per_seat_minor
    : offerSort === 'fastest' ? (a.duration_s ?? Infinity) - (b.duration_s ?? Infinity) : Date.parse(a.departure_at) - Date.parse(b.departure_at));
  const cheapestPrice = offers.length > 1 && new Set(offers.map((item) => item.price_per_seat_minor)).size > 1 ? Math.min(...offers.map((item) => item.price_per_seat_minor)) : null;
  const fastestDuration = offers.length > 1 && new Set(offers.map((item) => item.duration_s)).size > 1 ? Math.min(...offers.map((item) => item.duration_s ?? Infinity)) : null;
  const offerCard = (offer: ApiOffer, _index: number) => { const dur = offer.duration_s ? `${Math.floor(offer.duration_s/3600)} год ${Math.round((offer.duration_s%3600)/60)} хв` : null; const t = (v: string) => formatDate(v,{hour:'2-digit',minute:'2-digit'}); return <button key={offer.id} onClick={() => { setJourneyBookingLink(null); setSelectedJourney(null); setSelectedOffer(offer); setRoutePath(pathForProductionEntity('offer', offer.id)); }} className="journey-offer-card w-full rounded-[1.35rem] border border-[#E5EDF7] bg-white p-4 text-left shadow-[0_4px_16px_rgba(30,64,100,.06)]">
    <div className="mb-3 flex items-center justify-between"><span className="flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-[#E8F8F1] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#0A6B4F]">Community · Попутка</span>{cheapestPrice!==null&&offer.price_per_seat_minor===cheapestPrice&&<span className="rounded-full bg-[#FFF4DB] px-2.5 py-1 text-xs font-bold text-[#8A5A12]">Найдешевша</span>}{fastestDuration!==null&&Number.isFinite(fastestDuration)&&offer.duration_s===fastestDuration&&<span className="rounded-full bg-[#EAF3FF] px-2.5 py-1 text-xs font-bold text-[var(--mg-blue)]">Найшвидша</span>}</span></div>
    {offer.vehicle_photo_url&&<div className="mb-3 overflow-hidden rounded-xl"><VehiclePhoto url={offer.vehicle_photo_url} alt={`Автомобіль водія ${offer.driver_name}`}/></div>}
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[1.15rem] font-extrabold leading-tight text-[#0E1F35]">{t(offer.departure_at)} – {offer.arrival_at ? t(offer.arrival_at) : '—'}<span className="ml-1.5 align-middle text-xs font-bold text-[#526477] dark:text-[var(--mg-ink-secondary)]">{carpoolDepartureDateLabel(offer.departure_at)}</span>{offer.other_date === true && <span className="ml-1.5 rounded-full bg-[#FFF4DB] px-2 py-0.5 align-middle text-xs font-bold text-[#8A5A12]">інша дата</span>}</p><p className="mt-1 truncate text-xs font-semibold text-slate-600">{offer.origin_name.split(',')[0]} → {offer.destination_name.split(',')[0]}</p>{dur&&<p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400"><Clock3 size={11}/>{dur} · {offer.available_seats} вільних місць</p>}</div><div className="shrink-0 text-right"><b className="text-[1.15rem] font-extrabold text-[#0E1F35]">{formatMoney(offer.price_per_seat_minor,offer.currency)}</b><p className="text-xs text-slate-400">за місце</p></div></div>
    <div className="mt-3 flex items-center justify-between border-t border-[#EEF3F9] pt-3"><span className="flex min-w-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EAF3FF] text-xs font-bold text-[var(--mg-blue)]">{offer.driver_name.slice(0,1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-xs font-bold text-[#0E1F35]">{offer.driver_name}</span>{offer.review_count > 0 ? <span className="text-xs font-bold text-amber-500">★ {Number(offer.average_rating).toFixed(1)} <span className="font-medium text-slate-400">({offer.review_count})</span></span> : <span className="text-xs font-medium text-slate-400">Новий водій</span>}</span></span><span className="rounded-xl bg-[var(--mg-action)] px-5 py-2 text-xs font-bold text-white">Вибрати</span></div>
  </button>; };

  const searchScreen = <div className="home-screen search-screen mx-auto w-full max-w-xl px-5 pb-8">
    <section className="home-intro"><p className="home-greeting relative z-[1] text-xs font-semibold text-[var(--mg-blue-ink)]">Пошук</p><h1 className="home-title relative z-[1] mt-0.5 text-[1.35rem] font-extrabold leading-tight tracking-tight text-[#0E1F35]">Куди їдемо?</h1><p className="home-description relative z-[1] mt-1 text-xs text-[var(--mg-muted)]">Усі види транспорту в одному пошуку.</p></section>
    <div className="home-search-panel mt-4">{searchForm}</div>
  </div>;

  // Start screen: just start navigating, or say where you are going. Navigation itself opens on its own screen.
  // Role comes from the action, not from a global switch: navigation is for everyone (passenger matching starts only with a verified vehicle),
  // searching is the passenger scenario, planning asks "how are you travelling?".
  const homeTrips = [
    ...bookings
      .filter((booking) => ['boarding', 'in_progress', 'confirmed'].includes(booking.status))
      .map((booking) => ({
        id: booking.id,
        kind: 'booking' as const,
        currentUserIsDriver: booking.current_user_is_driver,
        origin: booking.origin_name,
        destination: booking.destination_name,
        departureAt: booking.departure_at,
        price: formatMoney(booking.total_price_minor, booking.currency),
        driverName: booking.driver_name,
        seatCount: booking.seat_count,
        status: booking.status,
      })),
    ...journeys
      .filter((journey) => ['ACTIVE', 'PLANNED', 'READY', 'PARTIALLY_RESERVED'].includes(journey.state))
      .map((journey) => ({
        id: journey.id,
        kind: 'journey' as const,
        currentUserIsDriver: false,
        origin: journey.origin_name,
        destination: journey.destination_name,
        departureAt: journey.requested_departure_at,
        price: journey.confirmed_price_minor !== null ? formatMoney(journey.confirmed_price_minor, 'UAH')
          : journey.total_price_minor !== null ? formatMoney(journey.total_price_minor, 'UAH') : undefined,
        status: journey.state === 'ACTIVE' ? 'active' as const : 'upcoming' as const,
      })),
  ].sort((a, b) => Number(['boarding', 'in_progress', 'ACTIVE'].includes(b.status)) - Number(['boarding', 'in_progress', 'ACTIVE'].includes(a.status))
    || Date.parse(a.departureAt) - Date.parse(b.departureAt));

  const publishDriverTrip = () => {
    if (!user.roles.includes('driver')) { setStatusMessage('Спершу активуйте роль водія у профілі.'); setTab('profile'); return; }
    setTab('offer-new');
    void refreshVehicles().catch((error) => setStatusMessage(error instanceof Error ? error.message : 'Автомобілі недоступні.'));
  };

  const homeScreen = <HomeHero
    onStartNavigation={() => { setNavAutoStart(true); setTab('navigation'); }}
    onSearchTrip={() => { setNavAutoStart(false); setTab('search'); }}
    onOpenTrips={() => { setTripsSection('upcoming'); tripsSectionChosen.current = true; setTab('trips'); }}
    onPublishTrip={() => { setNavAutoStart(false); publishDriverTrip(); }}
    onOpenMap={() => { setNavAutoStart(false); setTab('map'); }}
    onSearchDestination={(city, from) => {
      setOrigin(from);
      setDestination(city);
      setSearchOriginPlace(null);
      setSearchDestinationPlace(null);
      setNavAutoStart(false);
      setTab('search');
    }}
    trips={homeTrips.map((trip) => ({ ...trip, onOpen: () => {
      if (trip.kind === 'booking') {
        const booking = bookings.find((candidate) => candidate.id === trip.id);
        if (booking) void showBookingTicket(booking);
        else setStatusMessage('Бронювання більше не доступне. Оновіть розділ поїздок.');
        return;
      }
      setTab('trips');
      setRoutePath(pathForProductionEntity(trip.kind, trip.id));
    } }))}
  />;

  const resultsOriginLabel = searchOriginPlace?.label ?? origin;
  const resultsDestinationLabel = searchDestinationPlace?.label ?? destination;
  const displayRoute = `${compactPlaceLabel(resultsOriginLabel)} → ${compactPlaceLabel(resultsDestinationLabel)}`;
  const fullRoute = `${fullPlaceLabel(resultsOriginLabel)} → ${fullPlaceLabel(resultsDestinationLabel)}`;
  const returnToSearch = () => { setShowResults(false); setTab('search'); };
  // The compact query strip under the route keeps the searched moment and filters visible after
  // the big form is gone; otherwise a stale filter silently explains a missing mode.
  const activeFilterLabels = transportSelection.active
    .map(id => transportTypes.find(type => type.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  const filterSummary = activeFilterLabels.length === 0 ? 'види транспорту не вибрано'
    : isAllActive(transportSelection) ? 'усі види транспорту'
      : `${activeFilterLabels.slice(0, 3).join(', ')}${activeFilterLabels.length > 3 ? ` +${activeFilterLabels.length - 3}` : ''}`;
  const resultCount = journeyResult?.journeys.length ?? 0;
  const resultCountLabel = `${resultCount} ${new Intl.PluralRules('uk-UA').select(resultCount) === 'one' ? 'маршрут' : new Intl.PluralRules('uk-UA').select(resultCount) === 'few' ? 'маршрути' : 'маршрутів'}`;

  const carpoolSection = showsCarpoolSection(offers.length, journeyResult !== null) ? <>
    {showsCarpoolSorter(sortedOffers.length, journeyResult !== null) && <div className="no-scrollbar mb-4 flex items-center gap-2 overflow-x-auto pb-1"><span className="shrink-0 text-xs font-semibold text-[var(--mg-ink-secondary)] dark:text-[var(--mg-ink-secondary)]">Сортувати:</span>{([['earliest','Найраніше'],['cheapest','Найдешевше'],['fastest','Найшвидше']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={offerSort===key} onClick={()=>setOfferSort(key)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors min-h-11 ${offerSort===key?'border-[var(--mg-action)] bg-[var(--mg-blue-tint)] text-[var(--mg-blue-ink)]':'border-[var(--mg-border-subtle)] bg-white text-[var(--mg-ink-secondary)] dark:text-[var(--mg-ink-secondary)]'}`}>{label}</button>)}</div>}
    <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Попутки MARSHGO</h2><span className="text-xs text-[var(--mg-ink-secondary)] dark:text-[var(--mg-ink-secondary)]">{offers.length} варіантів</span></div>
    {carpoolOffersFromOtherDate(offers) && <p role="status" className="mb-3 rounded-2xl bg-[#FFF4DB] px-4 py-3 text-xs font-bold text-[#8A5A12]">На обрану дату попуток немає — показуємо пропозиції з сусідніх дат. Перевірте дату перед бронюванням.</p>}
    {offers.length ? <div className="space-y-3">{sortedOffers.map(offerCard)}</div> : <div className="rounded-2xl bg-white p-6 text-center dark:bg-[var(--mg-surface-primary)]"><Search className="mx-auto text-slate-300"/><p className="mt-2 font-bold">Немає попуток за цими умовами</p><p className="mt-1 text-sm text-slate-500">Спробуйте змінити дату або кількість пасажирів.</p></div>}
  </> : null;
  const resultsScreen = <section aria-label="Результати пошуку маршрутів" className="journey-results mx-auto flex min-h-[100svh] w-full max-w-xl flex-col px-4 pb-3 pt-[max(.45rem,env(safe-area-inset-top))] text-[#0B1730] dark:text-[var(--mg-ink-primary)]">
    <header className="journey-results-header mb-2 border-b border-slate-100 pb-1.5 dark:border-slate-800">
      <h1 className="sr-only">Результати маршрутів: {displayRoute}</h1>
      <div className="flex min-h-12 items-center gap-2">
        <button type="button" onClick={returnToSearch} aria-label="Назад до пошуку" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800"><ArrowLeft size={19}/></button>
        <p title={fullRoute} className="line-clamp-2 min-w-0 flex-1 break-words text-xs font-bold leading-[14px]"><span className="text-[var(--mg-ink-secondary)] dark:text-[var(--mg-ink-secondary)]">Маршрут: </span>{displayRoute}</p>
        <button type="button" onClick={returnToSearch} aria-label="Змінити маршрут пошуку" title="Змінити маршрут" className="flex h-11 shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 text-xs font-bold text-slate-700 transition hover:border-blue-400 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-slate-100 dark:hover:border-blue-500 dark:hover:text-blue-300"><Pencil size={12}/>Змінити</button>
      </div>
      <p data-testid="journey-results-query" className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 px-1 text-xs font-semibold leading-4 tabular-nums text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1"><CalendarDays size={12} className="shrink-0" aria-hidden="true"/>{formatDate(journeyDeparture, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        <span aria-hidden="true">·</span>
        <span className="min-w-0 truncate" title={filterSummary}>{filterSummary}</span>
        {journeyResult && <><span aria-hidden="true">·</span><span className="font-bold text-slate-700 dark:text-slate-200">{resultCountLabel}</span></>}
      </p>
    </header>
    {journeyResult ? <><JourneyResultsPanel result={journeyResult} chosenJourneyId={chosenJourneyId} onOpenMap={(journey, alternatives, recommendation) => { setChosenJourneyId(journey.id); setSelectedRouteMap(journey); setSelectedRouteGroup([journey, ...alternatives]); setSelectedRouteRecommendation(recommendation); }} onRetry={() => void searchJourney()}/>{carpoolSection}</> : journeySearchStartedAt !== null ? <JourneySearchPending startedAt={journeySearchStartedAt} onCancel={cancelJourneySearch}/> : carpoolSection}
  </section>;

  const visibleBookings = route?.kind === 'booking' && route.entityId ? bookings.filter((booking) => booking.id === route.entityId) : bookings;
  const upcomingOffers = myOffers.filter((offer) => (offer.status ?? 'published') === 'published' && new Date(offer.departure_at).getTime() > Date.now());
  const pastOffers = myOffers.filter((offer) => !upcomingOffers.includes(offer));
  const bookingSection = (booking: ApiBooking) => booking.status === 'boarding' || booking.status === 'in_progress' ? 'active' : booking.status === 'confirmed' ? 'upcoming' : 'past';
  const sectionBookings = route?.kind === 'booking' && route.entityId ? visibleBookings : visibleBookings.filter((booking) => bookingSection(booking) === tripsSection);
  const tripSectionCounts = { active: visibleBookings.filter((b) => bookingSection(b) === 'active').length, upcoming: visibleBookings.filter((b) => bookingSection(b) === 'upcoming').length, past: visibleBookings.filter((b) => bookingSection(b) === 'past').length };

  const tripsScreen = <div className="mx-auto w-full max-w-xl px-5 pb-8"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.08em] text-[var(--mg-blue-ink)]">{tripsTabSubtitle[tripsSection]}</p><h1 className="mt-0.5 text-2xl font-extrabold">Мої поїздки</h1></div><div ref={tripsTabsRef} role="tablist" aria-label="Розділи поїздок" data-testid="trips-section-tabs" className="no-scrollbar mb-4 flex snap-x scroll-px-1 gap-1 overflow-x-auto rounded-2xl bg-[#EEF3F9] p-1 text-xs dark:bg-[var(--mg-surface-secondary)]">{tripsTabs.map(([key, label]) => { const count = isBookingSection(key) ? tripSectionCounts[key] : 0; return <button key={key} type="button" role="tab" id={`trips-tab-${key}`} data-trips-tab={key} aria-controls="trips-content" tabIndex={tripsSection===key?0:-1} aria-selected={tripsSection===key} onKeyDown={(event)=>handleTripsTabKeyDown(event,key)} onClick={()=>{tripsSectionChosen.current=true;setTripsSection(key);}} className={`flex min-h-11 shrink-0 grow snap-start items-center justify-center whitespace-nowrap rounded-xl px-0.5 py-2 font-bold transition-colors ${tripsSection===key?'bg-white text-[var(--mg-blue-ink)] shadow-sm':'text-[var(--mg-ink-secondary)] dark:text-[var(--mg-ink-secondary)]'}`}>{label}{count>0?` · ${count}`:''}</button>; })}</div>
  <div id="trips-content" role="tabpanel" aria-labelledby={`trips-tab-${tripsSection}`} tabIndex={0}>
    {showsSavedRoutes(tripsSection) && journeys.length > 0 && <section className="mb-5" aria-label="Збережені маршрути"><div className="mb-2 flex items-center justify-between"><h2 className="font-extrabold">Збережені маршрути</h2><button onClick={() => void refreshJourneys().catch(error => setStatusMessage(error instanceof Error ? error.message : 'Маршрути недоступні.'))} className="min-h-11 rounded-lg px-2 text-xs font-bold text-[var(--mg-blue-ink)] dark:text-[var(--mg-blue-ink)]">Оновити</button></div><div className="space-y-2.5">{journeys.map(journey => <SavedJourneyCard key={journey.id} journey={journey} departureLabel={formatDate(journey.requested_departure_at, { day: 'numeric', month: 'short' })} onOpen={() => setRoutePath(pathForProductionEntity('journey', journey.id))}/>)}</div></section>}
    {showsSavedRoutes(tripsSection) && !journeys.length && (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
          <BookmarkCheck size={24} />
        </div>
        <p className="mt-3 font-extrabold text-[var(--mg-ink-primary)]">Збережених маршрутів немає</p>
        <p className="mt-1 text-xs text-[var(--mg-ink-secondary)]">Знайдіть потрібний маршрут містом або областю та збережіть його для швидкого доступу.</p>
        <button onClick={() => setTab('search')} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95">
          Знайти маршрут
        </button>
      </div>
    )}
    {tripsSection === 'requests' && <section className="mb-5" aria-label="Запити"><div className="space-y-2"><button type="button" onClick={()=>setTab('my-demands')} className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm"><span><b className="block text-sm text-[var(--mg-ink-primary)]">Мої запити на поїздку</b><small className="text-xs text-slate-500">{myDemands.length ? `${myDemands.length} — переглянути пропозиції водіїв` : 'Створіть запит кнопкою «+»'}</small></span><ChevronRight size={17} className="text-slate-400"/></button>{user.roles.includes('driver')&&<button type="button" onClick={()=>setTab('requests')} className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm"><span><b className="block text-sm text-[var(--mg-ink-primary)]">Запити пасажирів</b><small className="text-xs text-slate-500">Відкриті запити, на які можна запропонувати ціну</small></span><ChevronRight size={17} className="text-slate-400"/></button>}</div></section>}
    {tripsSection === 'upcoming' && user.roles.includes('driver')&&<section className="mb-5"><div className="mb-2 flex items-center justify-between"><h2 className="font-extrabold">Мої оголошення</h2><button onClick={()=>void refreshMyOffers().catch(error=>setStatusMessage(error instanceof Error?error.message:'Оголошення недоступні.'))} className="inline-flex min-h-11 items-center text-xs font-bold text-[var(--mg-blue-ink)]">Оновити</button></div>{upcomingOffers.length?<div className="space-y-2">{upcomingOffers.map((offer)=><article key={offer.id} className="rounded-2xl p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><b className="min-w-0 truncate" title={`${fullPlaceLabel(offer.origin_name)} → ${fullPlaceLabel(offer.destination_name)}`}>{compactPlaceLabel(offer.origin_name)} → {compactPlaceLabel(offer.destination_name)}</b><span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{offerStatusLabel[offer.status??'published']??offer.status}</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(offer.departure_at)} · {offer.available_seats}/{offer.total_seats} місць</p><p className="mt-1 text-xs font-bold text-blue-700">{formatMoney(offer.price_per_seat_minor,offer.currency)} за місце{offer.duration_s?` · ${Math.floor(offer.duration_s/3600)} год ${Math.round(offer.duration_s%3600/60)} хв`:''}</p><button type="button" onClick={()=>setEditingOffer(offer)} className="mt-3 w-full rounded-xl bg-[var(--mg-blue-tint)] py-2.5 text-xs font-bold text-[var(--mg-blue)]">Редагувати або скасувати</button></article>)}</div>:<div className="rounded-2xl border border-slate-200/80 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-[var(--mg-ink-secondary)]">Запланованих поїздок немає. Створіть оголошення кнопкою «+».</p></div>}</section>}
    {tripsSection === 'past' && pastOffers.length>0 && <section className="mb-5"><h2 className="mb-2 font-extrabold">Мої минулі оголошення</h2><div className="space-y-2">{pastOffers.map((offer)=><article key={offer.id} className="rounded-2xl p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><b className="min-w-0 truncate" title={`${fullPlaceLabel(offer.origin_name)} → ${fullPlaceLabel(offer.destination_name)}`}>{compactPlaceLabel(offer.origin_name)} → {compactPlaceLabel(offer.destination_name)}</b><span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{offerStatusLabel[offer.status??'']??offer.status}</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(offer.departure_at)} · {formatMoney(offer.price_per_seat_minor,offer.currency)} за місце</p></article>)}</div></section>}
    {!showsBookingList(tripsSection) && !(route?.kind === 'booking' && tripsSection !== 'saved') ? null : sectionBookings.length ? <div className="space-y-3">{sectionBookings.map((booking)=>{
      const statusLabel: Record<string, string> = { confirmed: 'Підтверджено', boarding: 'Посадка', in_progress: 'У дорозі', completed: 'Завершено', cancelled: 'Скасовано' };
      const rendezvous = rendezvousSessions[booking.id];
      const rendezvousStatus: Record<string, string> = { SCHEDULED: 'Очікує часу зустрічі', ACTIVE: 'Обмін місцем активний', DRIVER_APPROACHING: 'Водій наближається', PASSENGER_APPROACHING: 'Пасажир прямує до точки', DRIVER_WAITING: 'Водій на місці', PASSENGER_WAITING: 'Пасажир на місці', BOTH_NEARBY: 'Обидва підтвердили прибуття', BOARDING: 'Посадка розпочалася', CANCELLED: 'Обмін місцем завершено', COMPLETED: 'Зустріч завершена', EXPIRED: 'Час зустрічі минув' };
      return <article key={booking.id} className="rounded-[1.4rem] p-4 shadow-sm">
        <div className="flex items-center justify-between"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${booking.status==='confirmed'?'bg-emerald-50 text-emerald-700':booking.status==='completed'?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-600'}`}>{statusLabel[booking.status] ?? booking.status}</span><span className="text-xs text-slate-400">{formatDate(booking.departure_at,{day:'numeric',month:'short'})}</span></div>
        <h2 className="mt-3 text-lg font-extrabold" title={`${fullPlaceLabel(booking.origin_name)} → ${fullPlaceLabel(booking.destination_name)}`}>{compactPlaceLabel(booking.origin_name)} <span className="text-blue-600">→</span> {compactPlaceLabel(booking.destination_name)}</h2><p className="mt-1 text-xs text-slate-500">{formatDate(booking.departure_at)} · {booking.seat_count} місця · {formatMoney(booking.total_price_minor,booking.currency)}</p>
        {booking.pending_change&&booking.status==='confirmed'&&!booking.current_user_is_driver&&<PendingChangeCard change={booking.pending_change} currency={booking.currency} onDecided={(message)=>{setStatusMessage(message);void refreshBookings();}}/>}
        {['confirmed','boarding','in_progress'].includes(booking.status)&&<section className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-3"><div className="flex items-center justify-between gap-2"><div><b className="block text-xs">Зустріч із {booking.current_user_is_driver?booking.passenger_name:booking.driver_name}</b><small className="text-xs text-slate-500">Точка посадки · {rendezvous?.pickup.label??booking.origin_name}</small></div>{rendezvous&&<span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-700">{rendezvousStatus[rendezvous.state]??rendezvous.state}</span>}</div>{!rendezvous?<button disabled={rendezvousBusyId===booking.id} onClick={()=>void loadRendezvous(booking)} className="mt-2 w-full rounded-xl bg-white py-2.5 text-xs font-bold text-blue-700 disabled:opacity-50">{rendezvousBusyId===booking.id?'Завантажуємо…':'Відкрити зустріч'}</button>:<><p className="mt-2 text-xs text-slate-600">За планом · {formatDate(rendezvous.plannedPickupAt)}{rendezvous.driverArrivedAt&&' · водій на місці'}{rendezvous.passengerArrivedAt&&' · ви на місці'}</p>{rendezvous.locationSharingEnabled&&<p className="mt-1 text-xs text-slate-500">Останнє місце: {rendezvous.locations[booking.current_user_is_driver?'passenger':'driver']?.freshness==='LIVE'?'оновлено, доступне учаснику бронювання':rendezvous.locations[booking.current_user_is_driver?'passenger':'driver']?.freshness==='STALE'?'застаріло':'ще не надіслано'}. Точні координати не зберігаються.</p>}{!rendezvous.locationSharingEnabled&&['SCHEDULED','ACTIVATING'].includes(rendezvous.state)&&<button disabled={rendezvousBusyId===booking.id||Date.now()<Date.parse(rendezvous.activationAt)} onClick={()=>void activateRendezvous(booking)} className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">{Date.now()<Date.parse(rendezvous.activationAt)?`Обмін місцем доступний ${formatDate(rendezvous.activationAt,{hour:'2-digit',minute:'2-digit'})}`:'Увімкнути короткочасний обмін місцем'}</button>}{rendezvous.locationSharingEnabled&&<><div className="mt-2 grid grid-cols-2 gap-2"><button disabled={rendezvousBusyId===booking.id} onClick={()=>void sendRendezvousLocation(booking)} className="rounded-xl bg-white py-2.5 text-xs font-bold text-blue-700 disabled:opacity-50">Надіслати моє місце</button><button disabled={rendezvousBusyId===booking.id} onClick={()=>void rendezvousAction(booking,'arrived')} className="rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white disabled:opacity-50">Я на місці</button></div><button disabled={rendezvousBusyId===booking.id} onClick={()=>void rendezvousAction(booking,'approaching')} className="mt-2 w-full rounded-xl bg-white py-2 text-xs font-semibold text-slate-700">Я пряму до точки посадки</button>{rendezvous.state==='BOTH_NEARBY'&&<button disabled={rendezvousBusyId===booking.id} onClick={()=>void rendezvousBoarding(booking)} className="mt-2 w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white disabled:opacity-50">Підтвердити зустріч і посадку</button>}<button disabled={rendezvousBusyId===booking.id} onClick={()=>void endRendezvous(booking)} className="mt-2 w-full py-1 text-xs font-semibold text-slate-500">Завершити обмін місцем</button></>}</>}</section>}
        {['confirmed','boarding'].includes(booking.status)&&!booking.current_user_is_driver&&<div className="mt-3"><button disabled={busy} onClick={()=>void showBookingTicket(booking)} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-3 text-xs font-bold text-white transition active:scale-[.99] disabled:opacity-60">{visibleBookingTicket?.bookingId===booking.id?'Оновити квиток':'Показати квиток для посадки'}</button></div>}
        {booking.status==='confirmed'&&booking.current_user_is_driver&&<div className="mt-3 rounded-xl bg-slate-50 p-3"><button type="button" data-testid="boarding-scan-button" data-booking-id={booking.id} disabled={busy} aria-pressed={boardingScanBookingId===booking.id} onClick={()=>{setStatusMessage('');setBoardingScanBookingId((current)=>current===booking.id?null:booking.id);}} className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white disabled:opacity-50"><ScanLine size={15} className="mr-1.5 inline"/>Сканувати QR квитка</button>{boardingScanBookingId===booking.id&&<QrScanner onClose={()=>setBoardingScanBookingId(null)} onToken={(token)=>{setBoardingTicketInput((current)=>({...current,[booking.id]:token}));void confirmBoarding(booking, token);}}/>}<label className="mt-2 block text-xs font-bold text-slate-600">Або введіть токен квитка вручну<textarea value={boardingTicketInput[booking.id]??''} onChange={(event)=>setBoardingTicketInput((current)=>({...current,[booking.id]:event.target.value}))} className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-normal" placeholder="Вставте підписаний токен квитка" /></label><button disabled={busy||!boardingTicketInput[booking.id]?.trim()} title={boardingTicketInput[booking.id]?.trim()?'':'Спершу відскануйте або вставте квиток пасажира'} aria-disabled={!boardingTicketInput[booking.id]?.trim()} onClick={()=>void confirmBoarding(booking)} className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">Підтвердити посадку</button></div>}
        {booking.status==='boarding'&&booking.current_user_is_driver&&<button disabled={busy} onClick={()=>void startTrip(booking)} className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-xs font-bold text-white disabled:opacity-50">Почати поїздку</button>}
        {booking.status==='in_progress'&&<div className="mt-3 rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-800">Завершення: {booking.completion_confirmation_count}/2 учасники</p>{!booking.current_user_confirmed_completion&&<button disabled={busy} onClick={()=>void confirmTripCompletion(booking)} className="mt-2 w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white disabled:opacity-50">Підтвердити завершення</button>}{booking.current_user_confirmed_completion&&<p className="mt-1 text-xs text-emerald-700">Ваше підтвердження збережено на сервері.</p>}</div>}
        {booking.status==='completed'&&(booking.current_user_has_review?<p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800" role="status">Дякуємо! Ваш відгук збережено.</p>:reviewBookingId===booking.id?<form data-testid="booking-review-form" onSubmit={(event)=>{event.preventDefault();void submitBookingReview(booking);}} className="mt-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3"><label className="block text-xs font-bold text-slate-700">Оцініть {booking.current_user_is_driver?booking.passenger_name:booking.driver_name}</label><div className="mt-2 flex gap-1" aria-label="Оцінка поїздки">{[1,2,3,4,5].map(value=><button key={value} type="button" aria-pressed={reviewRating===value} aria-label={`${value} з 5`} onClick={()=>setReviewRating(value)} className={`grid h-11 w-11 place-items-center rounded-lg text-xl ${reviewRating>=value?'text-amber-500':'text-slate-300'}`}>★</button>)}</div><label className="mt-2 block text-xs font-semibold text-slate-600">Коментар (необов’язково)<textarea value={reviewComment} onChange={(event)=>setReviewComment(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-normal" placeholder="Поділіться враженням про поїздку" /></label><div className="mt-2 flex gap-2"><button type="submit" disabled={reviewSubmitting} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">{reviewSubmitting?'Зберігаємо…':'Надіслати відгук'}</button><button type="button" disabled={reviewSubmitting} onClick={()=>setReviewBookingId(null)} className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-600">Скасувати</button></div></form>:<button data-testid="booking-review-open" onClick={()=>{setReviewRating(5);setReviewComment('');setReviewBookingId(booking.id);}} className="mt-3 w-full rounded-xl bg-amber-50 py-2.5 text-xs font-bold text-amber-800">Оцінити поїздку</button>)}
        {booking.status==='cancelled'&&!booking.current_user_is_driver&&<section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs text-slate-800">Інші поїздки MARSHGO поруч</b>{bookingRescues[booking.id]?.result&&<small className="text-xs text-slate-500">Перевірено {formatDate(bookingRescues[booking.id].result!.checked_at,{hour:'2-digit',minute:'2-digit'})}</small>}</div>{bookingRescues[booking.id]?.loading?<p className="mt-2 text-xs text-slate-500">Шукаємо опубліковані поїздки з вільними місцями…</p>:bookingRescues[booking.id]?.failed?<p className="mt-2 text-xs text-amber-800">Не вдалося перевірити актуальні поїздки. Спробуйте оновити список пізніше.</p>:bookingRescues[booking.id]?.result?.alternatives.length?<div className="mt-2 space-y-2">{bookingRescues[booking.id].result!.alternatives.map(alternative=><button key={alternative.id} data-testid="rescue-alternative" data-offer-id={alternative.id} onClick={()=>{const journey=rescueJourneyForBooking(booking);setJourneyBookingLink(journey?{journeyId:journey.id,journeyLegId:journey.legs.find(leg=>leg.bookingId===booking.id&&leg.state==='CANCELLED')!.id}:null);setSeats(booking.seat_count);setSelectedOffer(alternative);}} className="w-full rounded-xl bg-white p-3 text-left shadow-sm"><span className="flex items-center justify-between gap-2"><b className="text-xs">{alternative.origin_name} → {alternative.destination_name}</b><b className="shrink-0 text-sm text-blue-700">{formatMoney(alternative.price_per_seat_minor*booking.seat_count,alternative.currency)}</b></span><span className="mt-1 flex justify-between text-xs text-slate-500"><span>{formatDate(alternative.departure_at,{hour:'2-digit',minute:'2-digit'})} · {alternative.available_seats} вільних</span><span>{alternative.rescue_match==='ALONG_CANCELLED_ROUTE'?`${((alternative.route_origin_distance_m??0)/1000).toFixed(1)} км від маршруту`:`${(alternative.origin_distance_m/1000).toFixed(1)} км від посадки`}</span></span><span className="mt-1 block text-xs text-slate-500">{alternative.rescue_match==='ALONG_CANCELLED_ROUTE'?'Початок уздовж вашого маршруту':'Поруч із початковою точкою'}</span><span className="mt-1 block text-xs text-[var(--mg-muted)]">{alternative.source} · наявність перевірена зараз</span></button>)}</div>:bookingRescues[booking.id]?.result?<p className="mt-2 text-xs text-slate-500">На цей час не знайдено опублікованих поїздок із потрібною кількістю місць у межах 20 км від точок маршруту.</p>:null}</section>}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs text-slate-500">{booking.current_user_is_driver ? `Пасажир · ${booking.passenger_name}` : `Водій · ${booking.driver_name}`}</span><div className="flex items-center gap-2">{booking.status==='confirmed'&&<button disabled={busy} onClick={()=>void cancelTrip(booking)} className="inline-flex min-h-11 items-center rounded-xl bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">Скасувати</button>}{(()=>{const unreadCount=unreadConversations[booking.id]??0;return <button aria-label={unreadCount>0?`Написати · ${unreadCount} непрочитаних`:'Написати'} onClick={()=>void openChat(booking)} className="relative flex min-h-11 items-center gap-1 rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700"><MessageCircle size={14}/>Написати{unreadCount>0&&<span aria-hidden="true" className="grid h-4 min-w-4 place-items-center rounded-full bg-blue-600 px-1 text-xs text-white">{unreadCount}</span>}</button>;})()}</div></div>
      </article>;
    })}</div> : (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-7 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
          <Ticket size={28} />
        </div>
        <p className="mt-3 text-base font-extrabold text-[var(--mg-ink-primary)]">Поки що немає поїздок</p>
        <p className="mt-1 text-xs text-[var(--mg-ink-secondary)]">Знайдіть потрібний маршрут, перегляньте деталі та забронюйте місце або квиток.</p>
        <button onClick={() => setTab('search')} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95">
          Знайти поїздку
        </button>
      </div>
    )}
  </div>
  </div>;

  const chatScreen = <div className="mx-auto flex min-h-[65svh] w-full max-w-xl flex-col px-5 pb-5"><div className="mb-4 flex items-center gap-3"><button onClick={()=>{setSelectedBooking(null);setTab('trips');}} aria-label="Повернутися до поїздок" className="grid h-11 w-11 place-items-center rounded-full bg-white"><ArrowLeft size={18}/></button><div className="min-w-0 flex-1"><h1 className="truncate font-extrabold">{selectedBooking ? (selectedBooking.current_user_is_driver ? selectedBooking.passenger_name : selectedBooking.driver_name) : 'Чати'}</h1><p className="truncate text-xs text-slate-500">{selectedBooking ? `${compactPlaceLabel(selectedBooking.origin_name)} → ${compactPlaceLabel(selectedBooking.destination_name)}` : 'Повідомлення за бронюваннями'}</p></div>{selectedBooking&&<><button disabled={busy} onClick={()=>{setReportCategory('safety');setReportDetails('');setShowReportForm(true);}} aria-label="Поскаржитися на співрозмовника" title="Поскаржитися" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700 disabled:opacity-50"><Flag size={18}/></button><button disabled={busy} onClick={()=>void blockBookingContact()} aria-label="Заблокувати співрозмовника" title="Заблокувати співрозмовника" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600 disabled:opacity-50"><Ban size={18}/></button></>}</div>
    {!selectedBooking ? <div className="space-y-3">{bookings.length ? bookings.map(booking=><button key={booking.id} onClick={()=>void openChat(booking)} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] p-4 text-left shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-[var(--mg-blue-tint)] dark:text-[var(--mg-blue-ink)]"><MessageCircle size={18}/></span><span className="min-w-0 flex-1"><b className="block text-sm">{compactPlaceLabel(booking.origin_name)} → {compactPlaceLabel(booking.destination_name)}</b><small className="text-slate-500">{booking.driver_name} · {formatDate(booking.departure_at,{day:'numeric',month:'short'})}</small></span>{(unreadConversations[booking.id]??0)>0&&<span aria-label={`${unreadConversations[booking.id]} непрочитаних повідомлень`} className="grid h-6 min-w-6 place-items-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">{unreadConversations[booking.id]}</span>}<ChevronRight size={17} className="text-slate-400"/></button>) : (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
          <MessageCircle size={24} />
        </div>
        <p className="mt-3 font-extrabold text-[var(--mg-ink-primary)]">Поки що немає повідомлень</p>
        <p className="mt-1 text-xs text-[var(--mg-ink-secondary)]">Чат зі співрозмовником відкривається автоматично після підтвердження бронювання поїздки.</p>
        <button type="button" onClick={() => setTab('trips')} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95">
          Переглянути мої поїздки
        </button>
      </div>
    )}</div> : <>
      <div className="mb-3 rounded-xl bg-white px-3 py-2 text-center text-xs text-slate-500">Бронювання · {selectedBooking.origin_name} → {selectedBooking.destination_name}<span className={`ml-2 font-semibold ${REALTIME_TONE_CLASS[realtimeStatusTone(realtimeStatus) as 'online' | 'retrying' | 'offline']}`} role="status" aria-live="polite">{realtimeStatusLabel(realtimeStatus)}</span></div>
      {olderMessagesAvailable&&<button type="button" onClick={()=>void loadOlderMessages()} disabled={loadingOlderMessages} className="mb-2 self-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm disabled:opacity-50">{loadingOlderMessages?'Завантажуємо…':'Завантажити попередні повідомлення'}</button>}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[var(--mg-border-subtle)] p-3">{messages.length ? messages.map((item)=><div key={item.id} className={`max-w-[84%] rounded-2xl px-3 py-2.5 text-sm ${item.sender_id===user.id?'ml-auto rounded-br-md bg-blue-600 text-white':'rounded-bl-md bg-white shadow-sm'}`}><p>{item.body}</p><small className={`mt-1 block text-xs ${item.sender_id===user.id?'text-blue-100':'text-slate-400'}`}>{formatDate(item.created_at,{hour:'2-digit',minute:'2-digit'})}</small></div>) : <div className="py-10 text-center text-sm text-slate-500">Почніть розмову з водієм або пасажиром.</div>}</div>
      <form onSubmit={sendMessage} className="mt-3 flex gap-2 rounded-full bg-white p-2 shadow-sm"><input aria-label="Повідомлення" value={messageDraft} onChange={event=>setMessageDraft(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" placeholder="Напишіть повідомлення…" maxLength={4000}/><button type="submit" aria-label="Надіслати повідомлення" disabled={busy||!messageDraft.trim()} className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white disabled:opacity-50"><ArrowRight size={18}/></button></form>
    </>}
  </div>;

  const confirmDeleteVehicle = async (vehicle: ApiVehicle) => {
    setBusy(true); setStatusMessage('');
    try {
      const result = await productionApi.deleteVehicle(vehicle.id);
      setVehicleToDelete(null);
      await refreshVehicles();
      setStatusMessage(result.activatedVehicleId ? 'Авто видалено. Активним стало інше ваше авто.' : 'Авто видалено.');
    } catch (error) {
      setVehicleToDelete(null);
      setStatusMessage(error instanceof Error && /upcoming trips/i.test(error.message) ? 'Авто використовується в майбутніх поїздках. Спершу змініть авто в цих поїздках або скасуйте їх.' : error instanceof Error ? error.message : 'Не вдалося видалити авто.');
    } finally { setBusy(false); }
  };

  const vehicleCard = (vehicle: ApiVehicle) => {
    const records = verificationRecords.filter((record) => record.vehicle_id === vehicle.id);
    const reviewPending = records.some((record) => record.status === 'pending');
    const reviewRejected = records.some((record) => record.status === 'rejected');
    const latestRejected = records
      .filter((record) => record.status === 'rejected')
      .sort((a, b) => Date.parse(b.reviewed_at ?? b.created_at) - Date.parse(a.reviewed_at ?? a.created_at))[0];
    const photos = vehiclePhotos[vehicle.id] ?? [];
    return <article key={vehicle.id} className="rounded-xl bg-[var(--mg-surface-tint)] p-3">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-blue-600"><CarFront size={19}/></span><div className="min-w-0 flex-1"><b className="block text-sm">{vehicle.make} {vehicle.model}</b><small className="text-slate-500">{vehicle.plate ? `${vehicle.plate} · ` : ''}{vehicle.model_year} · {vehicle.seat_count} місць</small><div className="mt-1 flex flex-wrap gap-1">{vehicleUsable(vehicle) ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">✓ Авто додано</span> : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">Додайте {vehicle.plate ? 'фото' : 'номер і фото'}</span>}{(vehicle.trust_level ?? 0) >= 2 && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">✓ Автомобіль підтверджено</span>}{(vehicle.trust_level ?? 0) >= 3 && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">✓ Водій підтверджений</span>}</div></div>{vehicle.is_active?<span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Активне</span>:<button onClick={async()=>{setBusy(true);try{await productionApi.activateVehicle(vehicle.id);await refreshVehicles();}catch(error){setStatusMessage(error instanceof Error?error.message:'Не вдалося активувати авто.');}finally{setBusy(false);}}} className="text-xs font-bold text-blue-600">Обрати</button>}</div>
      {photos.length>0?<div className="mt-3 grid grid-cols-3 gap-2">{photos.map((photo,index)=><div key={photo.id} className="relative overflow-hidden rounded-lg bg-white"><img src={photo.url} alt={`${vehicle.make} ${vehicle.model}`} className="aspect-[4/3] w-full object-cover"/><div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-slate-950/70 px-1.5 py-1 text-xs text-white"><div className="flex items-center gap-1"><button type="button" disabled={busy||index===0} onClick={()=>void moveVehiclePhoto(vehicle.id,photo.id,-1)} aria-label={`Перемістити фото ${index+1} вище`} className="px-1 font-bold disabled:opacity-40">↑</button><button type="button" disabled={busy||index===photos.length-1} onClick={()=>void moveVehiclePhoto(vehicle.id,photo.id,1)} aria-label={`Перемістити фото ${index+1} нижче`} className="px-1 font-bold disabled:opacity-40">↓</button></div><button type="button" onClick={()=>void setPrimaryVehiclePhoto(vehicle.id,photo.id)} className="truncate font-bold">{photo.is_primary?'Головне':'Головне фото'}</button><button type="button" onClick={()=>void deleteVehiclePhoto(vehicle.id,photo.id)} aria-label="Видалити фото">×</button></div></div>)}</div>:<p className="mt-2 text-xs text-slate-500">Фото потрібне для публікації поїздки.</p>}
      {user.roles.includes('driver')&&(photos.length>=3?<p className="mt-2 text-center text-xs text-slate-500">Максимум 3 фото. Видаліть одне, щоб додати інше.</p>:<label className="mt-2 flex w-full cursor-pointer items-center justify-center rounded-lg bg-white py-2 text-xs font-bold text-blue-700">{busy?'Зачекайте…':photos.length===0?'Додати фото авто (обов’язково)':`Додати ще фото (${photos.length}/3)`}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadVehiclePhoto(vehicle.id,file);event.currentTarget.value='';}} className="sr-only"/></label>)}
      <button type="button" onClick={()=>setVehicleToDelete(vehicle)} className="mt-2 w-full rounded-lg py-2 text-xs font-bold text-rose-600">Видалити авто</button>
      {vehicle.verification_status==='rejected'&&latestRejected&&<p role="status" className="mt-2 rounded-lg border border-rose-100 bg-rose-50 p-2.5 text-xs leading-5 text-rose-800"><b>Потрібно виправити документи.</b> Причина: {latestRejected.review_note||'Модератор попросив подати документи повторно.'} Після виправлення їх можна надіслати ще раз.</p>}
      {(vehicle.trust_level ?? (vehicle.verification_status === 'verified' ? 3 : 0)) < 3&&<button disabled={reviewPending} onClick={()=>{setRegistrationEvidence(null);setDriverLicenseEvidence(null);setVerificationTarget(vehicle);}} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-xs font-bold text-blue-700 disabled:text-slate-400"><ShieldCheck size={14}/>{reviewPending?'Документи на перевірці':reviewRejected?'Надіслати повторно':'Підвищити довіру: додати документи (необов’язково)'}</button>}
    </article>;
  };

  // The section screens arrive as a lazy chunk, which over a slow link leaves a
  // fully blank profile with no way back; this keeps the header chrome visible.
  const profileSectionPending = <div aria-busy="true" className="mx-auto w-full max-w-xl px-5 pb-8">
    <div className="mb-4 flex items-center gap-3">
      <button onClick={() => setProfileSection(null)} aria-label="Назад до профілю" className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-sm dark:bg-[var(--mg-surface-tint)] dark:text-slate-200"><ArrowLeft size={18} /></button>
      <span className="mg-skeleton block h-6 w-40 rounded-lg" />
    </div>
    <div className="space-y-3">
      <span className="mg-skeleton block h-16 rounded-2xl" />
      <span className="mg-skeleton block h-28 rounded-2xl" />
      <span className="mg-skeleton block h-28 rounded-2xl" />
    </div>
    <p className="sr-only">Завантажуємо розділ профілю…</p>
  </div>;

  const profileScreen = <div className="mx-auto w-full max-w-xl px-5 pb-8"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--mg-blue-ink)]">Обліковий запис</p><h1 className="mt-1 text-2xl font-extrabold">Профіль</h1></div>
    <div className="flex items-center gap-4 rounded-[1.4rem] border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] p-5 shadow-sm"><span className="grid h-14 w-14 shrink-0 overflow-hidden place-items-center rounded-full bg-blue-100 text-xl font-extrabold text-blue-700 dark:bg-[var(--mg-blue-tint)] dark:text-[var(--mg-blue-ink)]">{user.driver_photo_url?<img src={user.driver_photo_url} alt="" className="h-full w-full object-cover"/>:user.display_name.slice(0,1).toUpperCase()}</span><div className="min-w-0 flex-1"><b className="text-lg">{user.display_name}</b><p className="text-sm text-slate-500">{user.phone_e164}</p><p className={`mt-1 flex items-center gap-1 text-xs ${user.is_verified ? 'text-emerald-700' : 'text-[#526477] dark:text-[var(--mg-ink-secondary)]'}`}>{user.is_verified ? <><ShieldCheck size={14}/> Номер підтверджено</> : 'Профіль не верифіковано'}</p></div></div>
    <DriverPhotoCard photoUrl={user.driver_photo_url} isDriver={user.roles.includes('driver')} onChange={(url, message) => { setUser((current) => current ? { ...current, driver_photo_url: url } : current); setStatusMessage(message); }}/>
    <div className="mt-4 rounded-[1.4rem] border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-extrabold">Мій автомобіль</h2><p className="text-xs text-slate-500">Авто, прив’язані до вашого акаунта</p></div><button onClick={()=>user.roles.includes('driver')?setShowVehicleForm(true):setStatusMessage('Спершу активуйте роль водія.')} className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" aria-label="Додати авто"><Plus size={19}/></button></div>
      {vehicles.length ? <div className="space-y-2">{vehicles.map(vehicleCard)}</div> : <p className="rounded-xl bg-[var(--mg-surface-tint)] p-3 text-sm text-[var(--mg-ink-secondary)] dark:text-[var(--mg-ink-secondary)]">Автомобілів ще не додано.</p>}
      {user.roles.includes('driver')
        ? <p role="status" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--mg-surface-tint)] py-3 text-sm font-bold text-[var(--mg-blue-ink)]"><BadgeCheck size={16} aria-hidden="true"/>Роль водія активна</p>
        : <button onClick={()=>void enableDriver()} disabled={busy} className="mt-3 min-h-11 w-full rounded-xl bg-[var(--mg-action)] py-3 text-sm font-bold text-white transition active:scale-[.99] disabled:opacity-45">Увімкнути роль водія</button>}
    </div>
    <section className="mt-4 rounded-[1.4rem] border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><Ban size={17} className="text-rose-600"/><div><h2 className="font-extrabold">Заблоковані користувачі</h2><p className="text-xs text-slate-500">Керуйте приватним списком блокувань</p></div></div>{blockedUsers.length? <div className="space-y-2">{blockedUsers.map((blocked)=><div key={blocked.user_id} className="flex items-center gap-3 rounded-xl bg-[var(--mg-surface-tint)] p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">{blocked.display_name.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{blocked.display_name}</b><small className="text-slate-500">Заблоковано {formatDate(blocked.created_at,{day:'numeric',month:'short',year:'numeric'})}</small></span><button disabled={busy} onClick={()=>void unblockContact(blocked)} className="inline-flex min-h-11 items-center rounded-lg bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300 disabled:opacity-50">Розблокувати</button></div>)}</div>:<p className="rounded-xl bg-[var(--mg-surface-tint)] p-3 text-sm text-slate-500">Список порожній. Заблокувати контакт можна з його чату.</p>}</section>
    <div className="mt-4 overflow-hidden rounded-[1.4rem] border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] shadow-sm">{([['documents','Документи','Статус перевірки документів і авто'],['settings','Налаштування','Тема та безпека входу'],['privacy','Приватність і геолокація','Як MARSHGO обробляє вашу точку зустрічі та дані'],['safety','Безпека та скарги','Екстрені номери і правила для попутників'],['help','Допомога','Відповіді на часті питання'],['sources','Джерела даних','Звідки беруться розклади й умови використання']] as Array<[ProfileSection,string,string]>).map(([id,title,sub])=><button key={id} onClick={()=>setProfileSection(id)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-4 text-left transition hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/50 last:border-0"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><ShieldCheck size={17}/></span><span className="flex-1"><b className="block text-sm">{title}</b><small className="text-slate-400">{sub}</small></span><ChevronRight size={17} className="text-slate-400"/></button>)}</div>
    {user.roles.some((role)=>role==='admin'||role==='moderator')&&<button onClick={()=>setTab('admin')} className="mt-3 flex w-full items-center justify-between rounded-xl border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] p-4 text-left shadow-sm"><span><b className="block text-sm">Модерація та скарги</b><small className="text-slate-500">Захищені черги перевірки документів і безпеки</small></span><ChevronRight size={17} className="text-slate-400"/></button>}
    <section className="mt-4 rounded-[1.4rem] border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] p-4 shadow-sm"><h2 className="font-extrabold">Конфіденційність і дані</h2><p className="mt-1 text-xs leading-5 text-slate-500">Завантажте копію даних профілю, автомобілів, бронювань і заявок, які зберігає MARSHGO.</p><button type="button" disabled={exportingData} onClick={()=>void downloadPersonalData()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60"><FileDown size={17}/>{exportingData?'Готуємо файл…':'Завантажити мої дані (JSON)'}</button><p className="mt-2 text-xs leading-4 text-slate-400">Файл формується з вашого автентифікованого профілю. Чужі дані до нього не включаються.</p></section>
    <section className="mt-4 rounded-[1.4rem] border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] p-4 shadow-sm"><h2 className="font-extrabold">Видалення акаунта</h2>{deletionRequest?.status==='cooling_off'?<><p className="mt-1 text-xs leading-5 text-amber-800">Запит очікує скасування до {deletionRequest.cooling_off_until?formatDate(deletionRequest.cooling_off_until,{dateStyle:'medium',timeStyle:'short'}):'завершення періоду очікування'}. Дані ще не видалені; цей deployment не має автоматичного purge worker.</p><button type="button" disabled={deletionBusy} onClick={()=>void cancelDeletion()} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-60">{deletionBusy?'Оновлюємо…':'Скасувати запит'}</button></>:deletionRequest?.status==='cancelled'?<><p className="mt-1 text-xs text-slate-500">Попередній запит скасовано. Дані залишаються в акаунті.</p><button type="button" disabled={deletionBusy} onClick={()=>setConfirmDeletion(true)} className="mt-3 w-full rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-60">Подати новий запит</button></>:deletionRequest?<p className="mt-1 text-xs leading-5 text-slate-500">Статус останнього запиту: {({pending:'очікує',cancelled:'скасовано',completed:'виконано'} as Record<string,string>)[deletionRequest.status] ?? deletionRequest.status}. Зверніться до підтримки для уточнення подальшої обробки.</p>:<><p className="mt-1 text-xs leading-5 text-slate-500">Запит відкриває період очікування із можливістю скасування. Фактичне стирання потребує окремої обробки даних і не відбувається натисканням кнопки.</p><button type="button" disabled={deletionBusy} onClick={()=>setConfirmDeletion(true)} className="mt-3 w-full rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-60">{deletionBusy?'Надсилаємо…':'Подати запит на видалення'}</button></>}</section>
    <button onClick={()=>void logout()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] py-3 text-sm font-bold text-rose-600 shadow-sm transition active:scale-95"><LogOut size={16}/>Вийти</button>
  </div>;

  const adminScreen = <div className="mx-auto w-full max-w-xl px-5 pb-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--mg-blue-ink)]">Тільки персонал</p><h1 className="text-2xl font-extrabold">Перевірка документів</h1></div><button onClick={()=>void refreshAdminQueue().catch((error:unknown)=>setStatusMessage(error instanceof Error?error.message:'Черга недоступна.'))} className="inline-flex min-h-11 items-center rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--mg-blue-ink)]">Оновити</button></div><p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Документи містять чутливі дані. Відкриття й рішення журналюються; схвалення одного документа ще не верифікує авто.</p>{adminQueue.length?<div className="space-y-3">{adminQueue.map(record=><article key={record.id} className="rounded-2xl p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">{record.verification_type==='vehicle'?'Реєстраційний документ':record.verification_type==='driver_license'?'Посвідчення водія':record.verification_type}</p><h2 className="mt-1 font-extrabold">{record.display_name}</h2><p className="mt-1 text-xs text-slate-500">{record.make&&record.model?`${record.make} ${record.model} · ${record.model_year} · ${record.seat_count} місць`:'Документ профілю'}</p><p className="mt-1 text-xs text-slate-400">Подано {formatDate(record.created_at)}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Очікує</span></div><button disabled={busy} onClick={()=>void openVerificationEvidence(record)} className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-xs font-bold text-white disabled:opacity-50">Відкрити та перевірити документ</button></article>)}</div>:<div className="rounded-2xl bg-white p-6 text-center"><ShieldCheck className="mx-auto text-emerald-600"/><p className="mt-2 font-bold">Черга порожня</p><p className="mt-1 text-xs text-slate-500">Нові подання з’являться після завантаження водієм документів.</p></div>}</div>;

  const moderationScreen = <section className="mb-5 rounded-[1.4rem] bg-[#eef4ff] p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">Безпека спільноти</p><h2 className="text-lg font-extrabold">Скарги користувачів</h2></div><button onClick={()=>void refreshModerationCases().catch(error=>setStatusMessage(error instanceof Error?error.message:'Черга скарг недоступна.'))} className="inline-flex min-h-11 items-center rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--mg-blue-ink)]">Оновити</button></div>{moderationCases.length? <div className="space-y-3">{moderationCases.map(report=><article key={report.id} className="rounded-2xl p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-rose-600">{({safety:'Безпека',harassment:'Домагання',fraud:'Шахрайство',service:'Якість сервісу',other:'Інше'} as const)[report.category]}</p><h3 className="mt-1 text-sm font-extrabold">{report.reporter_name} · {report.reported_user_name}</h3><p className="mt-1 text-xs text-slate-500">{report.origin_name&&report.destination_name?`${report.origin_name} → ${report.destination_name}`:'Бронювання недоступне'} · {formatDate(report.created_at)}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{report.details}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${report.status==='open'?'bg-amber-50 text-amber-700':report.status==='in_review'?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-600'}`}>{report.status==='open'?'Нова':report.status==='in_review'?'У роботі':report.status==='resolved'?'Вирішена':'Відхилена'}</span></div>{report.status==='open'&&<button disabled={busy} onClick={()=>void reviewModerationCase(report,'in_review')} className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">Взяти у роботу</button>}{report.status==='in_review'&&<><label className="mt-3 block text-xs font-semibold text-slate-600">Рішення й коротке обґрунтування<textarea value={moderationNotes[report.id]??''} onChange={event=>setModerationNotes(current=>({...current,[report.id]:event.target.value}))} maxLength={1000} className="mt-1.5 min-h-16 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder="Опишіть перевірку та вжиті заходи"/></label><div className="mt-2 grid grid-cols-2 gap-2"><button disabled={busy} onClick={()=>void reviewModerationCase(report,'resolved','no_action')} className="rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white disabled:opacity-50">Підтвердити, без блокування</button><button disabled={busy} onClick={()=>void reviewModerationCase(report,'dismissed','no_action')} className="rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">Відхилити скаргу</button>{user.roles.includes('admin')&&<button disabled={busy} onClick={()=>void reviewModerationCase(report,'resolved','suspend_account')} className="col-span-2 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">Призупинити акаунт і відкликати сесії</button>}</div></>}</article>)}</div>:<div className="rounded-xl bg-white p-4 text-sm text-slate-500">Скарг у черзі немає.</div>}</section>;
  const adminDashboard = user?.roles.some((role) => role === 'admin' || role === 'moderator')
    ? <div className="mx-auto w-full max-w-xl px-5 pb-5">{moderationScreen}{adminScreen}{user?.roles.includes('admin') && <Suspense fallback={null}><MobilityAdminPanel/></Suspense>}</div>
    : <section aria-label="Доступ до адміністрування" className="grid min-h-[70svh] place-items-center px-5 text-center"><div className="max-w-md rounded-3xl bg-white p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-700">403</p><h1 className="mt-2 text-2xl font-extrabold">Доступ заборонено</h1><p className="mt-2 text-sm text-slate-500">Цей розділ доступний лише модераторам і адміністраторам.</p><button onClick={goHome} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">На головну</button></div></section>;

  const publishableVehicles = vehicles.filter((vehicle) => vehicleUsable(vehicle) && (vehiclePhotos[vehicle.id]?.length ?? 0) > 0);
  const offerFormScreen = <div className="mx-auto w-full max-w-xl px-5 pb-5">
    <div className="mb-4 flex items-center gap-3"><button onClick={()=>setTab('home')} className="grid h-11 w-11 place-items-center rounded-full bg-white"><ArrowLeft size={18}/></button><div><p className="text-xs text-slate-500">Попутки MARSHGO</p><h1 className="font-extrabold">Опублікувати поїздку</h1></div></div>
    <form onSubmit={publishOffer} className="space-y-3 rounded-[1.5rem] bg-white p-4 shadow-sm">
      {([['origin','Звідки',offerOriginText,setOfferOriginText,offerOrigin],['destination','Куди',offerDestinationText,setOfferDestinationText,offerDestination]] as const).map(([field,label,value,setValue,selected])=><div key={field} className="rounded-xl bg-[var(--mg-surface-tint)] p-3"><label htmlFor={`offer-${field}`} className="block text-xs font-semibold text-[var(--mg-muted)]">{label}</label><div className="mt-1 flex items-center gap-2"><MapPin size={16} className={field==='origin'?'text-emerald-600':'text-rose-500'}/><input id={`offer-${field}`} required value={value} onChange={event=>{setValue(event.target.value);if(field==='origin')setOfferOrigin(null);else setOfferDestination(null);}} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" placeholder="Пошук адреси або міста"/><button type="button" aria-label={`Знайти ${field==='origin'?'початкову точку':'пункт призначення'}`} title={`Знайти ${field==='origin'?'початкову точку':'пункт призначення'}`} onClick={()=>void searchOfferPlace(field)} disabled={placeSearchBusy} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-blue-700">{placeSearchBusy&&offerPlaceField===field?'…':<Search size={15}/>}</button><button type="button" aria-label={`Обрати ${field==='origin'?'початкову точку':'пункт призначення'} на мапі`} title={`Обрати ${field==='origin'?'початкову точку':'пункт призначення'} на мапі`} onClick={()=>setPicker({form:'offer',field})} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-[var(--mg-blue)]"><MapPin size={15}/></button></div>{selected&&<p className="mt-1 text-xs text-emerald-700">Місце підтверджено</p>}{offerPlaceField===field&&offerPlaceSearch.suggestions.length>0&&<div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:divide-[#1E3044] dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)]">{offerPlaceSearch.suggestions.map(place=><button key={place.providerId} type="button" onClick={()=>chooseOfferPlace(place)} className="block w-full px-3 py-2.5 text-left text-xs text-slate-800 hover:bg-blue-50 dark:text-slate-100 dark:hover:bg-[#16293D]">{place.label}</button>)}</div>}{offerPlaceField===field&&offerPlaceSearch.unavailable&&placeUnavailableNotice(()=>void searchOfferPlace(field))}</div>)}
      <label className="block rounded-xl bg-[var(--mg-surface-tint)] p-3 text-xs font-semibold text-[var(--mg-muted)]">Час відправлення · Київ<input required type="datetime-local" min={formatKyivDateTimeInput(new Date(Date.now()+60_000))} value={offerDeparture} onChange={event=>setOfferDeparture(event.target.value)} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800 outline-none"/></label>
      <label className="block rounded-xl bg-[var(--mg-surface-tint)] p-3 text-xs font-semibold text-[var(--mg-muted)]">Перевірений автомобіль<select required value={offerVehicleId} onChange={event=>{setOfferVehicleId(event.target.value);const selected=vehicles.find(vehicle=>vehicle.id===event.target.value);if(selected)setOfferSeats(Math.min(offerSeats,selected.seat_count));}} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800"><option value="">Оберіть авто</option>{publishableVehicles.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.seat_count} місць</option>)}</select></label>
      {publishableVehicles.length===0&&<div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Для публікації потрібне перевірене авто зі справжнім фото. Додайте авто й фото в профілі та дочекайтеся перевірки документів.<button type="button" onClick={()=>setTab('profile')} className="ml-1 font-bold underline">Відкрити профіль</button></div>}
      <div className="grid grid-cols-2 gap-2"><label className="rounded-xl bg-[var(--mg-surface-tint)] p-3 text-xs font-semibold text-[var(--mg-muted)]">Ціна за місце, грн<input required inputMode="decimal" value={offerPrice} onChange={event=>setOfferPrice(event.target.value)} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800 outline-none"/></label><label className="rounded-xl bg-[var(--mg-surface-tint)] p-3 text-xs font-semibold text-[var(--mg-muted)]">Місця<select value={offerSeats} onChange={event=>setOfferSeats(Number(event.target.value))} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800">{Array.from({length:Math.max(1,vehicles.find(vehicle=>vehicle.id===offerVehicleId)?.seat_count??1)},(_,index)=>index+1).map(count=><option key={count} value={count}>{count}</option>)}</select></label></div>
      <button disabled={busy||!publishableVehicles.some(vehicle=>vehicle.id===offerVehicleId)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white disabled:opacity-50">{busy?'Публікуємо…':'Опублікувати поїздку'}<ArrowRight size={17}/></button>
      <p className="text-xs leading-4 text-[var(--mg-ink-muted)]">Для приватних поїздок MARSHGO не бере комісію. Відстань і час у дорозі можуть змінюватися залежно від маршруту.</p>
    </form>
  </div>;

  const demandFormScreen = <div className="mx-auto w-full max-w-xl px-5 pb-5">
    <div className="mb-4 flex items-center gap-3"><button onClick={()=>setTab('home')} className="grid h-11 w-11 place-items-center rounded-full bg-white"><ArrowLeft size={18}/></button><div><p className="text-xs text-[var(--mg-muted)]">Запит на попутку</p><h1 className="font-extrabold">Шукаю поїздку</h1></div><button onClick={()=>{setSelectedDemand(null);setTab('my-demands');}} className="ml-auto text-xs font-bold text-[var(--mg-blue-ink)]">Мої заявки</button></div>
    <form onSubmit={publishDemand} className="space-y-3 rounded-[1.5rem] bg-white p-4 shadow-sm">
      {([['origin','Звідки',demandOriginText,setDemandOriginText,demandOrigin],['destination','Куди',demandDestinationText,setDemandDestinationText,demandDestination]] as const).map(([field,label,value,setValue,selected])=><div key={field} className="rounded-xl bg-[var(--mg-surface-tint)] p-3"><label htmlFor={`demand-${field}`} className="block text-xs font-semibold text-[var(--mg-muted)]">{label}</label><div className="mt-1 flex items-center gap-2"><MapPin size={16} className={field==='origin'?'text-emerald-600':'text-rose-500'}/><input id={`demand-${field}`} required value={value} onChange={event=>{setValue(event.target.value);if(field==='origin')setDemandOrigin(null);else setDemandDestination(null);}} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" placeholder="Пошук адреси або міста"/><button type="button" aria-label={`Знайти ${field==='origin'?'початкову точку':'пункт призначення'}`} title={`Знайти ${field==='origin'?'початкову точку':'пункт призначення'}`} onClick={()=>void searchPlace(field)} disabled={placeSearchBusy} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-blue-700">{placeSearchBusy&&placeField===field?'…':<Search size={15}/>}</button><button type="button" aria-label={`Обрати ${field==='origin'?'початкову точку':'пункт призначення'} на мапі`} title={`Обрати ${field==='origin'?'початкову точку':'пункт призначення'} на мапі`} onClick={()=>setPicker({form:'demand',field})} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-[var(--mg-blue)]"><MapPin size={15}/></button></div>{selected&&<p className="mt-1 text-xs text-emerald-700">Місце підтверджено</p>}{placeField===field&&placeSearch.suggestions.length>0&&<div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:divide-[#1E3044] dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)]">{placeSearch.suggestions.map(place=><button key={place.providerId} type="button" onClick={()=>choosePlace(place)} className="block w-full px-3 py-2.5 text-left text-xs text-slate-800 hover:bg-blue-50 dark:text-slate-100 dark:hover:bg-[#16293D]">{place.label}</button>)}</div>}{placeField===field&&placeSearch.unavailable&&placeUnavailableNotice(()=>void searchPlace(field))}</div>)}
      <div className="grid grid-cols-2 gap-2"><label className="rounded-xl bg-[var(--mg-surface-tint)] p-3 text-xs font-semibold text-[var(--mg-muted)]">Не раніше<input required type="datetime-local" value={demandEarliest} onChange={event=>setDemandEarliest(event.target.value)} className="mt-1 block w-full bg-transparent text-xs font-bold text-slate-800 outline-none"/></label><label className="rounded-xl bg-[var(--mg-surface-tint)] p-3 text-xs font-semibold text-[var(--mg-muted)]">Не пізніше<input required type="datetime-local" value={demandLatest} onChange={event=>setDemandLatest(event.target.value)} className="mt-1 block w-full bg-transparent text-xs font-bold text-slate-800 outline-none"/></label></div>
      <div className="grid grid-cols-2 gap-2"><label className="rounded-xl bg-[var(--mg-surface-tint)] p-3 text-xs font-semibold text-[var(--mg-muted)]">Пасажири<select value={demandPassengers} onChange={event=>setDemandPassengers(Number(event.target.value))} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800">{Array.from({length:8},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label><label className="rounded-xl bg-[var(--mg-surface-tint)] p-3 text-xs font-semibold text-[var(--mg-muted)]">Бюджет, грн<input inputMode="decimal" value={demandBudget} onChange={event=>setDemandBudget(event.target.value)} className="mt-1 block w-full bg-transparent text-sm font-bold text-slate-800 outline-none" placeholder="Не вказано"/></label></div>
      <label className="block rounded-xl bg-[var(--mg-surface-tint)] p-3 text-xs font-semibold text-[var(--mg-muted)]">Тип бюджету<select value={demandBudgetType} onChange={event=>setDemandBudgetType(event.target.value as 'total_all'|'per_seat')} className="mt-1 block w-full bg-transparent text-xs font-bold text-slate-800"><option value="total_all">За всю поїздку</option><option value="per_seat">За одне місце</option></select></label>
      <div className="rounded-xl bg-[var(--mg-surface-tint)] p-3"><p className="mb-2 text-xs font-semibold text-[var(--mg-muted)]">Потреби пасажирів</p><div className="flex flex-wrap gap-2">{([['luggage','Багаж'],['pets','Тварини'],['childSeat','Дитяче крісло']] as const).map(([key,label])=><label key={key} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600"><input type="checkbox" checked={demandRequirements[key]} onChange={event=>setDemandRequirements({...demandRequirements,[key]:event.target.checked})} className="accent-blue-600"/>{label}</label>)}</div></div>
      <label className="block rounded-xl bg-[var(--mg-surface-tint)] p-3 text-xs font-semibold text-[var(--mg-muted)]">Додаткові умови<textarea value={demandNotes} onChange={event=>setDemandNotes(event.target.value)} maxLength={1000} rows={2} className="mt-1 block w-full resize-none bg-transparent text-sm text-slate-800 outline-none" placeholder="Що ще важливо водієві знати?"/></label>
      <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white disabled:opacity-50">{busy?'Публікуємо…':'Опублікувати заявку'}<ArrowRight size={17}/></button>
      <p className="text-xs leading-4 text-slate-400">Оберіть місця з підказок, щоб зберегти точні точки маршруту.</p>
    </form>
  </div>;

  const proposalCard = (proposal: ApiProposal) => {
    const myRole = selectedDemandIsOwned ? 'passenger' : 'driver';
    const isMyTurn = proposal.last_actor_role !== myRole && proposal.status === 'pending';
    const needsDriverAgreement = !selectedDemandIsOwned && proposal.last_actor_role === 'passenger' && proposal.status === 'pending';
    const passengerCanConfirm = selectedDemandIsOwned && proposal.last_actor_role === 'driver' && proposal.status === 'pending';
    return <article key={proposal.id} className="rounded-2xl p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><b className="text-sm">{proposal.driver_name}</b><p className="text-xs text-slate-500">{proposal.make} {proposal.model} · {proposal.model_year}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${proposal.status==='pending'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-500'}`}>{proposal.status==='pending'?'Переговори':proposal.status==='expired'?'Пропозиція більше не актуальна':proposal.status==='accepted'?'Бронювання створено':proposal.status==='rejected'?'Закрито':'Відкликано'}</span></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-500">{formatDate(proposal.departure_at)}</span><b className="text-lg">{formatMoney(proposal.price_minor,proposal.currency)}</b></div>{proposal.last_comment&&<p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{proposal.last_comment}</p>}
      <button onClick={()=>void loadProposalHistory(proposal.id)} className="mt-3 text-xs font-bold text-blue-600">Історія переговорів</button>
      {proposalRevisions[proposal.id]&&<div className="mt-2 space-y-1 border-l-2 border-blue-100 pl-3">{proposalRevisions[proposal.id].map(revision=><p key={revision.revision_number} className="text-xs text-slate-500">{revision.actor_role==='driver'?'Водій':'Пасажир'} · {formatMoney(revision.price_minor,'UAH')} · {formatDate(revision.created_at,{hour:'2-digit',minute:'2-digit'})}{revision.comment?` · ${revision.comment}`:''}</p>)}</div>}
      {proposal.status==='pending'&&<div className="mt-3 grid grid-cols-1 gap-2">{isMyTurn&&<button onClick={()=>{setCounterTarget(proposal);setCounterPrice(String((proposal.price_minor/100).toFixed(2)));setCounterDeparture(formatKyivDateTimeInput(proposal.departure_at));setCounterComment('');}} className="rounded-xl border border-blue-200 py-2.5 text-xs font-bold text-blue-700">Змінити ціну або час</button>}{needsDriverAgreement&&<button disabled={busy} onClick={()=>void agreeProposal(proposal)} className="rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white">Погодити зустрічну ціну</button>}{passengerCanConfirm&&<button disabled={busy} onClick={()=>void confirmProposal(proposal)} className="rounded-xl bg-blue-600 py-3 text-xs font-bold text-white">Підтвердити домовленість і бронювання</button>}</div>}</article>;
  };

  const demandDetailScreen = (owned: boolean) => selectedDemand ? <div className="mx-auto w-full max-w-xl px-5 pb-5"><div className="mb-4 flex items-center gap-3"><button onClick={()=>setSelectedDemand(null)} className="grid h-11 w-11 place-items-center rounded-full bg-white"><ArrowLeft size={18}/></button><div><p className="text-xs text-slate-500">{owned?'Моя заявка':'Заявка пасажира'}</p><h1 className="font-extrabold">{selectedDemand.origin_name.split(',')[0]} → {selectedDemand.destination_name.split(',')[0]}</h1></div></div><div data-surface="card" className="mb-3 rounded-2xl p-4 shadow-sm"><p className="text-sm font-bold">{formatDate(selectedDemand.earliest_departure)} – {formatDate(selectedDemand.latest_departure,{hour:'2-digit',minute:'2-digit'})}</p><p className="mt-1 text-xs text-slate-500">{passengersLabel(selectedDemand.passenger_count)} · {selectedDemand.budget_minor===null?'Бюджет не вказано':`${formatMoney(selectedDemand.budget_minor,'UAH')} ${selectedDemand.budget_type==='per_seat'?'за місце':'за всіх'}`}</p>{selectedDemand.notes&&<p className="mt-2 text-xs text-slate-600">{selectedDemand.notes}</p>}{owned&&selectedDemand.status==='open'&&<button onClick={()=>void cancelDemand(selectedDemand)} className="mt-3 text-xs font-bold text-rose-600">Скасувати заявку</button>}</div><div className="mb-2 flex items-center justify-between"><h2 className="font-extrabold">Пропозиції водіїв</h2>{!proposalsUnavailable&&<span className="text-xs text-slate-500">{proposals.length}</span>}</div>{proposalsUnavailable?<div role="status" className="rounded-2xl bg-white p-4 text-sm text-slate-600"><p>Не вдалося оновити пропозиції. Спробуйте ще раз.</p><button onClick={()=>selectedDemand&&void viewDemand(selectedDemand,owned)} className="mt-2 inline-flex min-h-11 items-center rounded-xl px-3 font-bold text-[var(--mg-action)]">Оновити пропозиції</button></div>:proposals.length?<div className="space-y-3">{proposals.map(proposalCard)}</div>:<p className="rounded-2xl bg-white p-4 text-sm text-slate-500">Пропозицій поки немає.</p>}</div> : null;

  const myDemandsScreen = selectedDemand && selectedDemandIsOwned ? demandDetailScreen(true) : <div className="mx-auto w-full max-w-xl px-5 pb-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--mg-blue-ink)]">Пасажир</p><h1 className="text-2xl font-extrabold">Мої заявки</h1></div><div className="flex gap-2"><button onClick={()=>void refreshPassengerNavigationMatches().catch(error=>setStatusMessage(error instanceof Error?error.message:'Підбір недоступний.'))} className="inline-flex min-h-11 items-center rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--mg-blue-ink)]">Оновити</button><button onClick={()=>{setSelectedDemand(null);setTab('demand');}} className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white"><Plus size={20}/></button></div></div>{passengerNavigationMatches.length>0&&<section className="mb-4 space-y-2"><h2 className="px-1 text-sm font-extrabold">Водії поруч із маршрутом</h2>{passengerNavigationMatches.map(match=><article key={match.candidate_id} className="rounded-2xl border border-blue-100 p-4 shadow-sm dark:border-[#1D4E80]"><div className="flex items-start justify-between gap-3"><div><b className="text-sm">{match.origin_name.split(',')[0]} → {match.destination_name.split(',')[0]}</b><p className="mt-1 text-xs text-slate-500">Забір орієнтовно {formatDate(match.pickup_eta,{hour:'2-digit',minute:'2-digit'})} · відхилення +{(match.detour_distance_m/1000).toFixed(1)} км / +{Math.round(match.detour_duration_s/60)} хв</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{match.status==='passenger_confirmed'?'Взаємний інтерес':'Є інтерес водія'}</span></div>{match.status==='driver_interested'?<><p className="mt-2 text-xs text-slate-500">Підтвердьте, якщо цей маршрут і час вам підходять. Це ще не бронювання.</p><button disabled={busy} onClick={()=>void confirmNavigationMatch(match.candidate_id)} className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">Підтвердити взаємний інтерес</button></>:<p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Взаємний інтерес підтверджено. Водій може надіслати ціну у пропозиції до цієї заявки; бронювання ще немає.</p>}</article>)}</section>}{myDemands.length?<div className="space-y-3">{myDemands.map(demand=><button key={demand.id} data-testid={`owned-demand-${demand.id}`} onClick={()=>void viewDemand(demand,true)} className="w-full rounded-2xl bg-white p-4 text-left shadow-sm"><div className="flex items-center justify-between"><b>{demand.origin_name.split(',')[0]} → {demand.destination_name.split(',')[0]}</b><span className="text-xs text-slate-400">{({open:'Відкрита',cancelled:'Скасована',accepted:'Прийнята',expired:'Прострочена',closed:'Закрита',matched:'Є збіг'} as Record<string,string>)[demand.status] ?? demand.status}</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(demand.earliest_departure)} · {passengersLabel(demand.passenger_count)}</p><p className="mt-2 text-xs font-bold text-blue-600">{demand.budget_minor===null?'Без вказаного бюджету':`${formatMoney(demand.budget_minor,'UAH')} ${demand.budget_type==='per_seat'?'за місце':'за всіх'}`} · {demand.proposal_count ?? 0} пропозицій</p></button>)}</div>:<div className="rounded-2xl bg-white p-6 text-center"><Compass className="mx-auto text-slate-300"/><p className="mt-2 font-bold">Ви ще не публікували запитів</p><button onClick={()=>setTab('demand')} className="mg-press mt-3 min-h-11 rounded-xl bg-[var(--mg-action)] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--mg-action-hover)]">Створити заявку</button></div>}</div>;

  const requestsScreen = selectedDemand && !selectedDemandIsOwned ? demandDetailScreen(false) : (
    <div className="mx-auto w-full max-w-xl px-5 pb-5">
      <div className="mb-4 flex items-center justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--mg-blue-ink)]">Для водія</p><h1 className="text-2xl font-extrabold">Заявки пасажирів</h1></div>
        <button onClick={() => { void refreshOpenDemands().catch((error: unknown) => setStatusMessage(error instanceof Error ? error.message : 'Заявки недоступні.')); }} className="inline-flex min-h-11 items-center rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--mg-blue-ink)]">Оновити</button>
      </div>
      <p className="mb-3 rounded-xl border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-tint)] px-3 py-2.5 text-xs leading-5 text-[var(--mg-ink-secondary)]">Перевірте маршрут, час і вимоги заявки перед надсиланням пропозиції.</p>
      {openDemands.length ? <div className="space-y-3">
        {openDemands.map((demand) => <article key={demand.id} data-testid={`open-demand-${demand.id}`} className="rounded-2xl p-4 shadow-sm">
          <button onClick={() => { void viewDemand(demand, false); }} className="w-full text-left">
            <div className="flex items-start justify-between gap-2"><b>{demand.origin_name.split(',')[0]} → {demand.destination_name.split(',')[0]}</b><ChevronRight size={17} className="shrink-0 text-slate-400"/></div>
            <p className="mt-1 text-xs text-slate-500">{formatDate(demand.earliest_departure)} – {formatDate(demand.latest_departure, { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="mt-1 text-xs text-slate-500">{passengersLabel(demand.passenger_count)} · {demand.budget_minor === null ? 'Бюджет не вказано' : `${formatMoney(demand.budget_minor, 'UAH')} ${demand.budget_type === 'per_seat' ? 'за місце' : 'за всіх'}`}</p>
            {demand.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-600">{demand.notes}</p>}
            {Object.entries(demand.requirements ?? {}).some(([, enabled]) => enabled === true) && <p className="mt-2 text-xs font-semibold text-blue-700">{Object.entries(demand.requirements ?? {}).filter(([, enabled]) => enabled === true).map(([key]) => demandRequirementLabels[key] ?? key).join(' · ')}</p>}
          </button>
          <button disabled={!vehicles.some((vehicle) => vehicleUsable(vehicle)) || busy} onClick={() => {
            setProposalNavigationCandidateId(null);
            setProposalTarget(demand);
            setProposalDeparture(formatKyivDateTimeInput(demand.earliest_departure));
            const proposedTotal = demand.budget_minor === null ? null : demand.budget_minor / 100 * (demand.budget_type === 'per_seat' ? demand.passenger_count : 1);
            setProposalPrice(proposedTotal === null ? '' : String(proposedTotal.toFixed(2)));
            const verified = vehicles.find((vehicle) => vehicleUsable(vehicle) && vehicle.is_active) ?? vehicles.find((vehicle) => vehicleUsable(vehicle));
            setProposalVehicleId(verified?.id ?? '');
          }} className="mg-press mt-3 min-h-11 w-full rounded-xl bg-[var(--mg-action)] px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[var(--mg-action-hover)] disabled:bg-slate-200 disabled:text-slate-500">
            {vehicles.some((vehicle) => vehicleUsable(vehicle)) ? 'Запропонувати ціну' : 'Потрібне перевірене авто'}
          </button>
        </article>)}
      </div> : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">Відкритих заявок зараз немає.</p>}
    </div>
  );

  const createMenu = showCreateMenu ? <div className="fixed inset-0 z-[var(--mg-z-overlay)] flex items-end justify-center bg-slate-950/35 p-3 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreateMenu(false); }}><section role="dialog" aria-modal="true" aria-labelledby="create-menu-title" className="mg-rise w-full max-w-md rounded-[var(--mg-radius-2xl)] bg-white p-4 shadow-xl"><div className="mb-3 flex items-center justify-between"><h2 id="create-menu-title" className="font-extrabold">Швидкі дії</h2><button type="button" onClick={() => setShowCreateMenu(false)} aria-label="Закрити" className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-600"><X size={20}/></button></div><div className="space-y-2">{([
    { label: 'Навігація', hint: 'Ведення до точки', icon: Navigation, pick: () => { setNavAutoStart(true); setTab('navigation'); } },
    { label: 'Карта транспорту', hint: 'Зупинки, лінії, рух', icon: BusFront, pick: () => setTab('map') },
    { label: 'Опублікувати поїздку', hint: 'Маршрут, авто й ціна', icon: CarFront, pick: publishDriverTrip },
    { label: 'Знайти маршрут', hint: 'Усі види транспорту', icon: Search, pick: () => setTab('search') },
  ] as const).map((action) => { const Icon = action.icon; return <button key={action.label} type="button" onClick={() => { setShowCreateMenu(false); action.pick(); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-blue-50 p-3 text-left"><Icon className="shrink-0 text-blue-600" size={20}/><span className="min-w-0"><b className="block text-sm">{action.label}</b><small className="block text-[var(--mg-muted)]">{action.hint}</small></span></button>; })}</div><p className="mt-3 border-t border-slate-100 px-1 pt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Пасажир</p><button type="button" onClick={() => { setShowCreateMenu(false); setSelectedDemand(null); setSelectedDemandIsOwned(false); setProposals([]); setProposalsUnavailable(false); setTab('demand'); }} className="mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl bg-slate-50 p-3 text-left"><Compass className="shrink-0 text-slate-500" size={19}/><span className="min-w-0"><b className="block text-sm">Створити запит</b><small className="block text-[var(--mg-muted)]">Маршрут і ваш бюджет</small></span></button></section></div> : null;
  const renderBottomTab = (item: (typeof tabItems)[number]) => { const Icon = item.icon; const active = tab === item.id || (tab === 'navigation' && item.id === 'home'); return <button key={item.id} aria-current={active ? 'page' : undefined} onClick={() => { setTabPopTick(tick => tick + 1); setTab(item.id); if (item.id === 'home') setShowResults(false); setSelectedOffer(null); setSelectedBooking(null); setSelectedJourney(null); setSelectedRouteMap(null); setSelectedRouteGroup([]); setSelectedRouteRecommendation(undefined); setJourneyBookingLink(null); }} className={`flex w-full min-w-0 flex-col items-center gap-1 px-1 py-1 ${active ? 'text-[var(--mg-blue-ink)]' : 'text-[var(--mg-ink-secondary)]'}`}><Icon key={`${item.id}-${tabPopTick}`} size={20} strokeWidth={active ? 2.5 : 2}/><span className="text-xs font-semibold">{item.label}</span></button>; };


  const pickerPlace = !picker ? null : picker.form === 'search' ? (picker.field === 'origin' ? searchOriginPlace : searchDestinationPlace)
    : picker.form === 'offer' ? (picker.field === 'origin' ? offerOrigin : offerDestination) : (picker.field === 'origin' ? demandOrigin : demandDestination);
  const pointPicker = picker ? <Suspense fallback={<div aria-busy="true" className="fixed inset-0 z-50 grid place-items-center bg-[var(--mg-canvas)] dark:bg-[var(--mg-surface-secondary)]"><div className="text-center"><p className="text-sm font-extrabold text-[var(--mg-ink-primary)] dark:text-white">{picker.field === 'origin' ? 'Звідки' : 'Куди'}</p><span className="mg-skeleton mt-3 block h-40 w-64 rounded-2xl" /><button onClick={() => setPicker(null)} className="mt-3 min-h-11 rounded-xl px-4 text-sm font-bold text-[var(--mg-action)]">Скасувати</button><p className="sr-only">Готуємо вибір точки на мапі…</p></div></div>}><MapPointPicker title={picker.field === 'origin' ? 'Звідки' : 'Куди'} initial={pickerPlace ? { latitude: pickerPlace.latitude, longitude: pickerPlace.longitude } : null} onConfirm={choosePickedPlace} onClose={() => setPicker(null)}/></Suspense> : null;

  const detailOfferBlocked = selectedOffer !== null && unbookableOfferId === selectedOffer.id;

  const routeMapScreen = (journey: ApiJourney, onClose: () => void, alternatives: ApiJourney[] = [], recommendation?: string) => <JourneyRouteMapScreen
    key={journey.id}
    journey={journey}
    alternativeDepartures={alternatives.filter(alternative => alternative.id !== journey.id)}
    onSelectAlternative={alternative => { setSelectedRouteMap(alternative); setSelectedRouteRecommendation(undefined); }}
    recommendation={recommendation}
    onBack={onClose}
    onBookOffer={(offerId, journeyId, journeyLegId) => { onClose(); void openJourneyOffer(offerId, journeyId, journeyLegId); }}
    // One tap: the selected itinerary becomes the active navigation map. The
    // route screen stays behind it, so exiting restores the same journey and
    // no destination is ever asked for again.
    onStartJourney={() => startJourneyNavigation(journey)}
  />;

  const screen = activeJourneyNavigation ? <JourneyActiveNavigation
    journey={activeJourneyNavigation}
    notice={journeyNotice}
    onFinish={() => finishJourneyNavigation(activeJourneyNavigation.id)}
    initialLegIndex={restoredNavigationStage.current}
    onStageChange={(legIndex) => keepActiveJourneyStage(activeJourneyNavigation.id, legIndex)}
    onExit={exitJourneyNavigation}
  />
    : selectedRouteMap ? routeMapScreen(selectedRouteMap, () => { setSelectedRouteMap(null); setSelectedRouteGroup([]); setSelectedRouteRecommendation(undefined); }, selectedRouteGroup, selectedRouteRecommendation)
    : selectedJourney ? routeMapScreen(storedJourneyToApiJourney(selectedJourney), () => { setSelectedJourney(null); setTab('trips'); })
    : selectedOffer ? <div className="mx-auto w-full max-w-xl px-5 pb-5"><div className="mb-4 flex items-center gap-3"><button onClick={()=>{setSelectedOffer(null);setJourneyBookingLink(null);setTab('search');}} className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-sm"><ArrowLeft size={18}/></button><div><p className="text-xs text-slate-500">Деталі поїздки</p><h1 className="font-extrabold">{selectedOffer.origin_name.split(',')[0]} → {selectedOffer.destination_name.split(',')[0]}</h1></div></div><div className="mb-3"><Suspense fallback={null}><OfferRoutePreview offer={selectedOffer}/></Suspense></div><div className="mb-3 overflow-hidden rounded-[1.4rem]"><VehiclePhoto url={selectedOffer.vehicle_photo_url} alt={`Авто водія ${selectedOffer.driver_name}`}/></div><div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">COMMUNITY · Попутка</span><div className="mt-5 grid grid-cols-2 gap-4"><div><small className="text-slate-400">Відправлення</small><p className="mt-1 text-xl font-extrabold">{formatDate(selectedOffer.departure_at,{hour:'2-digit',minute:'2-digit'})}</p><b>{selectedOffer.origin_name.split(',')[0]}</b></div><div className="text-right"><small className="text-slate-400">Прибуття</small><p className="mt-1 text-xl font-extrabold">{selectedOffer.arrival_at?formatDate(selectedOffer.arrival_at,{hour:'2-digit',minute:'2-digit'}):'—'}</p><b>{selectedOffer.destination_name.split(',')[0]}</b></div></div><div className="my-4 border-t border-slate-100"/><ol aria-label="Маршрут поїздки" className="relative ml-1 space-y-5 border-l-2 border-dashed border-[#BBD7FB] pl-5"><li className="relative"><span className="absolute -left-[1.72rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-[var(--mg-action)] shadow"/><p className="text-sm font-extrabold text-[var(--mg-ink-primary)]">{formatDate(selectedOffer.departure_at,{hour:'2-digit',minute:'2-digit'})} · {selectedOffer.origin_name.split(',')[0]}</p><p className="text-xs text-slate-400">Посадка</p></li>{selectedOffer.distance_m&&selectedOffer.duration_s?<li className="text-xs font-semibold text-[var(--mg-muted)]">{(selectedOffer.distance_m/1000).toFixed(0)} км · {Math.floor(selectedOffer.duration_s/3600)} год {Math.round((selectedOffer.duration_s%3600)/60)} хв дорогою</li>:null}<li className="relative"><span className="absolute -left-[1.72rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#EF4444] shadow"/><p className="text-sm font-extrabold text-[var(--mg-ink-primary)]">{selectedOffer.arrival_at?formatDate(selectedOffer.arrival_at,{hour:'2-digit',minute:'2-digit'}):'—'} · {selectedOffer.destination_name.split(',')[0]}</p><p className="text-xs text-slate-400">Висадка</p></li></ol><div className="my-4 border-t border-slate-100"/><p className="flex items-center gap-3 text-sm"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">{selectedOffer.driver_name.slice(0,1)}</span><span><b>{selectedOffer.driver_name}</b><small className="block text-[var(--mg-muted)]">{selectedOffer.review_count?`★ ${Number(selectedOffer.average_rating).toFixed(1)} · ${selectedOffer.review_count} відгуків`:'Новий водій'}</small></span></p><div className="mt-5 flex justify-between text-sm"><span className="text-slate-500">Вільні місця</span><b>{detailOfferBlocked?'—':selectedOffer.available_seats}</b></div>{detailOfferBlocked&&<p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-800">{OFFER_NO_LONGER_BOOKABLE_TEXT}</p>}<div className="mt-3 flex justify-between text-sm"><span className="text-slate-500">Вартість за {seats} {seats===1?'місце':'місця'}</span><b className="text-lg">{formatMoney(selectedOffer.price_per_seat_minor*seats,selectedOffer.currency)}</b></div><p className="mt-1 text-right text-xs text-slate-400">MARSHGO Community · комісія платформи 0%</p><button data-testid="offer-book-button" data-offer-id={selectedOffer.id} disabled={busy||detailOfferBlocked||selectedOffer.available_seats<seats} title={detailOfferBlocked?'Ця поїздка більше недоступна для бронювання':selectedOffer.available_seats<seats?'Недостатньо вільних місць для такої кількості пасажирів':''} onClick={()=>{setStatusMessage('');setBookingToConfirm(selectedOffer);}} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white disabled:opacity-50">{detailOfferBlocked?'Недоступно для бронювання':selectedOffer.available_seats<seats?'Недостатньо місць':'Забронювати місце'}<ArrowRight size={17}/></button></div></div> : tab==='navigation' ? null : tab==='map' ? <Suspense fallback={<div className="grid min-h-[100svh] place-items-center bg-[var(--mg-canvas)] text-sm text-slate-500">Завантажуємо карту…</div>}><TransportMapView onBack={()=>setTab('search')} cityName={currentCity.name} onCitySelected={(name)=>commitCurrentCity({name,source:'manual',verified:true})}/></Suspense> : tab==='home' ? (showResults ? resultsScreen : homeScreen) : tab==='search' ? (showResults ? resultsScreen : searchScreen) : tab==='trips' ? tripsScreen : tab==='chat' ? chatScreen : tab==='profile' ? (profileSection ? <Suspense fallback={profileSectionPending}><ProfileSections section={profileSection} onBack={()=>setProfileSection(null)} vehicles={vehicles} records={verificationRecords} onLogoutAll={logoutAllDevices} onExportData={downloadPersonalData} onRequestDeletion={()=>setConfirmDeletion(true)} onOpenSafetyReport={()=>{setProfileSection(null);setTab('trips');}}/></Suspense> : profileScreen) : tab==='admin' ? adminDashboard : tab==='demand' ? demandFormScreen : tab==='offer-new' ? offerFormScreen : tab==='requests' ? requestsScreen : myDemandsScreen;

  const navigationOverlay = navigationMounted ? <Suspense fallback={null}><ProductionNavigation isPresented={tab === 'navigation'} onSessionActiveChange={onNavigationSessionActiveChange} autoStart={navAutoStart} initialDestination={navInitialDestination} onAddVehicle={() => { setNavAutoStart(false); setNavInitialDestination(null); setTab('profile'); }} onBack={() => { setNavAutoStart(false); setNavInitialDestination(null); setTab('home'); }} onOpenDemand={(demandId, candidateId) => void openNavigationDemand(demandId, candidateId)}/></Suspense> : null;

  const ticketBooking = visibleBookingTicket ? bookings.find((booking) => booking.id === visibleBookingTicket.bookingId) ?? null : null;
  const hideSharedHeader = tab === 'navigation' || Boolean(activeJourneyNavigation || selectedRouteMap || selectedJourney || selectedOffer || (showResults && (tab === 'search' || tab === 'home')));

  const immersiveRouteView = Boolean(activeJourneyNavigation || selectedRouteMap);
  return <main onPointerDownCapture={onMapEdgePointerDown} className={`production-app min-h-[100svh] bg-[var(--mg-canvas)] text-[var(--mg-ink-primary)] ${tab === 'home' && !showResults ? 'home-viewport-shell' : ''} ${immersiveRouteView ? 'route-immersive-shell' : 'pb-[var(--mg-global-nav-clearance)]'} ${mapToolbarContext ? 'map-toolbar-map-context' : ''}`}>
    {!hideSharedHeader && header}
    {isOffline && !hideSharedHeader && <div className="mx-auto w-full max-w-xl px-5"><p role="status" aria-live="polite" data-testid="offline-notice" className="mg-fade flex items-start gap-2 rounded-2xl border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-tint)] px-3 py-2.5 text-xs font-semibold leading-snug text-[var(--mg-ink-secondary)]">
      <WifiOff size={15} aria-hidden="true" className="mt-px shrink-0"/>
      <span>Немає з’єднання. Деякі дані можуть бути неактуальними.</span>
    </p></div>}
    {(!immersiveRouteView || Boolean(selectedOffer)) && status}
    {journeySearchUnavailable && !immersiveRouteView && <div role="alert" className="mx-auto mt-3 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-[var(--mg-border-medium)] bg-[var(--mg-surface-tint)] px-4 py-3 text-sm text-[var(--mg-ink-secondary)]">
      <span className="min-w-0 flex-1">{journeySearchUnavailable}</span>
      <button type="button" onClick={() => void searchJourney()} disabled={busy} className="min-h-11 shrink-0 rounded-lg px-3 text-xs font-bold text-[var(--mg-blue-ink)] disabled:opacity-50">{busy ? '…' : 'Повторити пошук'}</button>
    </div>}
    <div className={immersiveRouteView ? '' : 'pt-1'}>{screen}</div>
    {navigationOverlay}
    {navigationActive && tab !== 'navigation' && <button type="button" onClick={() => setTab('navigation')} aria-label="Повернутися до активної навігації" className="fixed right-3 z-[var(--mg-z-overlay)] flex items-center gap-2 rounded-full border border-blue-200 bg-white/95 px-3 py-2 text-xs font-bold text-blue-700 shadow-lg backdrop-blur" style={{ bottom: 'calc(var(--mg-global-nav-clearance) + .5rem)' }}><Navigation size={16}/>Навігація · Повернутися</button>}
    {pointPicker}
    <nav data-testid="global-bottom-navigation" data-map-context={mapToolbarContext ? 'true' : undefined} data-map-visible={mapToolbarContext ? String(mapNavigationVisible) : undefined} aria-label="Основна навігація" className="app-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pt-2 backdrop-blur-xl"><div className="app-tabbar-inner mx-auto grid w-full max-w-xl grid-cols-5 items-center px-1">
      {tabItems.slice(0, 2).map(renderBottomTab)}
      <button onClick={() => setShowCreateMenu(true)} aria-label="Створити поїздку або запит" aria-haspopup="dialog" aria-expanded={showCreateMenu} className="app-create-button mg-press col-start-3 row-start-1 -mt-5 grid h-14 w-14 place-items-center justify-self-center rounded-full bg-[var(--mg-action)] text-white shadow-lg shadow-[#0B63D6]/30 transition-transform motion-safe:duration-[var(--mg-dur-fast)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><Plus size={25}/><span className="desktop-create-label">Створити</span></button>
      {tabItems.slice(2).map(renderBottomTab)}
    </div></nav>
    {createMenu}
    <DepartureDateTimePicker open={departurePickerOpen} title="Виїзд" caption="Виберіть дату й час виїзду" timeLabel="Виїзд" value={journeyDeparture} onChange={(value) => { setJourneyDeparture(value); setDate(value.slice(0, 10)); if (journeyArrivalBy && value >= journeyArrivalBy) setJourneyArrivalBy(null); }} onClose={() => setDeparturePickerOpen(false)}/>
    <DepartureDateTimePicker open={arrivalPickerOpen} title="Прибути до" caption="Повернемо лише маршрути, що прибувають не пізніше цього часу" timeLabel="Прибути до" minDate={journeyDeparture.slice(0, 10)} value={journeyArrivalBy ?? journeyDeparture} onChange={(value) => setJourneyArrivalBy(value)} onClose={() => setArrivalPickerOpen(false)}/>
    {tab==='search'&&transportPickerOpen&&<div className="fixed inset-0 z-[var(--mg-z-picker-scrim)] flex items-end justify-center bg-slate-950/55 px-2 pt-[max(.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setTransportPickerOpen(false);}}><section role="dialog" aria-modal="true" aria-labelledby="transport-picker-title" className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[var(--mg-radius-3xl)] bg-white shadow-2xl sm:rounded-[var(--mg-radius-3xl)]"><header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3"><div><h2 id="transport-picker-title" className="font-extrabold">Провайдери</h2><p className="text-xs text-slate-500">Джерела для обраних видів транспорту</p></div><button type="button" onClick={()=>setTransportPickerOpen(false)} aria-label="Закрити вибір провайдерів" className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-600"><X size={19}/></button></header><div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><TransportTypesPanel providersOnly selection={transportSelection} groups={providerGroups} onChange={changeTransportSelection}/></div></section></div>}
    {showNotifications&&<div className="fixed inset-0 z-[var(--mg-z-scrim)] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center" onMouseDown={event=>{if(event.target===event.currentTarget)setShowNotifications(false);}}><section role="dialog" aria-modal="true" aria-labelledby="notification-heading" className="max-h-[78svh] w-full max-w-md overflow-hidden rounded-[var(--mg-radius-3xl)] bg-white shadow-2xl"><div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2"><div className="min-w-0 flex-1 pl-2"><h2 id="notification-heading" className="truncate font-extrabold">Сповіщення</h2><p className="mt-0.5 truncate text-xs text-slate-500">Оновлення ваших поїздок</p></div><div className="flex shrink-0 items-center gap-1"><button disabled={!notificationPage.unreadCount} onClick={()=>void markAllNotificationsRead()} className="min-h-11 whitespace-nowrap rounded-full px-2 text-xs font-bold text-blue-700 disabled:text-slate-300">Прочитати все</button><button onClick={()=>setShowNotifications(false)} aria-label="Закрити сповіщення" className="grid h-11 w-11 place-items-center rounded-full text-slate-500"><X size={20}/></button></div></div><div className="max-h-[68svh] overflow-y-auto p-3">{notificationsLoading&&notificationPage.items.length===0?<p className="p-6 text-center text-sm text-slate-500">Завантажуємо…</p>:notificationPage.items.length===0?<p className="p-6 text-center text-sm text-slate-500">Поки що сповіщень немає.</p>:<div className="space-y-2">{notificationPage.items.map(notification=><button key={notification.id} onClick={()=>void markNotificationRead(notification)} className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left ${notification.read_at?'bg-slate-50':'bg-blue-50'}`}><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read_at?'bg-slate-300':'bg-blue-600'}`}></span><span className="min-w-0 flex-1"><b className="block text-sm">{notification.title}</b><span className="mt-0.5 block text-xs leading-5 text-slate-600">{notification.body}</span><time className="mt-1 block text-xs text-[var(--mg-muted)]">{formatDate(notification.created_at,{dateStyle:'medium',timeStyle:'short'})}</time></span></button>)}</div>}{notificationPage.nextCursor&&<button disabled={notificationsLoading} onClick={()=>void loadMoreNotifications()} className="mt-3 w-full rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-600 disabled:opacity-50">{notificationsLoading?'Завантажуємо…':'Завантажити раніші'}</button>}</div></section></div>}
    {proposalTarget&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center"><form role="dialog" aria-modal="true" aria-labelledby="proposal-dialog-title" onSubmit={sendProposal} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[var(--mg-radius-3xl)] bg-white p-5 shadow-xl"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs text-slate-500">Ваша ціна для пасажира</p>{proposalNavigationCandidateId&&<p className="mt-1 text-xs text-emerald-700">Пропозиція прив’язана до підтвердженого збігу навігації; це ще не бронювання.</p>}<h2 id="proposal-dialog-title" className="font-extrabold">{proposalTarget.origin_name.split(',')[0]} → {proposalTarget.destination_name.split(',')[0]}</h2></div><button type="button" onClick={()=>{setProposalTarget(null);setProposalNavigationCandidateId(null);}} aria-label="Закрити"><X size={20}/></button></div><label className="mb-3 block text-xs font-bold text-slate-600">Перевірене авто<select required value={proposalVehicleId} onChange={event=>setProposalVehicleId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Оберіть авто</option>{vehicles.filter(v=>v.verification_status==='verified').map(v=><option key={v.id} value={v.id}>{v.make} {v.model} · {v.seat_count} місць</option>)}</select></label>{!vehicles.some(v=>v.verification_status==='verified')&&<p className="mb-3 text-xs leading-5 text-amber-700">Немає перевіреного авто. Спершу потрібно пройти перевірку перевізника.</p>}<div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-600">Ціна, грн<input required inputMode="decimal" value={proposalPrice} onChange={event=>setProposalPrice(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Загальна сума"/></label><label className="text-xs font-bold text-slate-600">Час виїзду<input required type="datetime-local" value={proposalDeparture} onChange={event=>setProposalDeparture(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-2 py-3 text-xs"/></label></div><label className="mt-3 block text-xs font-bold text-slate-600">Коментар<input value={proposalComment} onChange={event=>setProposalComment(event.target.value)} maxLength={1000} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Коротко про поїздку"/></label><button disabled={busy||!vehicles.some(v=>v.verification_status==='verified')} className="mt-4 w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white disabled:opacity-50">Надіслати пропозицію</button></form></div>}
    {counterTarget&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center"><form role="dialog" aria-modal="true" aria-labelledby="counter-dialog-title" onSubmit={sendCounter} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[var(--mg-radius-3xl)] bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs text-slate-500">Зустрічна пропозиція</p><h2 id="counter-dialog-title" className="font-extrabold">Змінити суму або час</h2></div><button type="button" onClick={()=>setCounterTarget(null)} aria-label="Закрити"><X size={20}/></button></div><label className="mb-3 block text-xs font-bold text-slate-600">Загальна сума, грн<input required inputMode="decimal" value={counterPrice} onChange={event=>setCounterPrice(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><label className="mb-3 block text-xs font-bold text-slate-600">Час відправлення<input required type="datetime-local" value={counterDeparture} onChange={event=>setCounterDeparture(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><label className="block text-xs font-bold text-slate-600">Коментар<input value={counterComment} onChange={event=>setCounterComment(event.target.value)} maxLength={1000} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><button disabled={busy} className="mt-4 w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white">Надіслати зустрічну</button></form></div>}
    {showVehicleForm && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center"><form role="dialog" aria-modal="true" aria-labelledby="vehicle-dialog-title" onSubmit={createVehicle} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[var(--mg-radius-3xl)] bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 id="vehicle-dialog-title" className="text-lg font-extrabold">Додати автомобіль</h2><button type="button" onClick={()=>setShowVehicleForm(false)} aria-label="Закрити"><X size={20}/></button></div>{([['make','Марка'],['model','Модель']] as const).map(([key,label])=><label key={key} className="mb-3 block text-xs font-bold text-slate-600">{label}<input required value={vehicleForm[key]} onChange={event=>setVehicleForm({...vehicleForm,[key]:event.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500"/></label>)}<label className="mb-3 block text-xs font-bold text-slate-600">Номерний знак<input required value={vehicleForm.plate} onChange={event=>setVehicleForm({...vehicleForm,plate:event.target.value.toUpperCase()})} placeholder="AA1234BB" autoCapitalize="characters" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm uppercase outline-none focus:border-blue-500"/></label><label className="mb-3 block text-xs font-bold text-slate-600">Фото автомобіля<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setVehicleFormPhoto(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full text-xs"/></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-600">Рік<input required type="number" min="1950" max={new Date().getFullYear()+1} value={vehicleForm.modelYear} onChange={event=>setVehicleForm({...vehicleForm,modelYear:Number(event.target.value)})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><label className="text-xs font-bold text-slate-600">Місця<input required type="number" min="1" max="20" value={vehicleForm.seats} onChange={event=>setVehicleForm({...vehicleForm,seats:Number(event.target.value)})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label></div><p className="my-3 rounded-xl bg-[var(--mg-surface-tint)] p-3 text-xs leading-5 text-[var(--mg-muted)]">Фото потрібне для публікації поїздки. Документи можна подати окремо для перевірки авто та водія.</p><button disabled={busy} className="w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white">{busy?'Зберігаємо…':'Зберегти автомобіль'}</button></form></div>}
    {showReportForm&&selectedBooking&&<div className="fixed inset-0 z-[var(--mg-z-scrim)] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center"><form role="dialog" aria-modal="true" aria-labelledby="safety-report-dialog-title" onSubmit={submitSafetyReport} className="w-full max-w-md rounded-[var(--mg-radius-3xl)] bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Безпека спільноти</p><h2 id="safety-report-dialog-title" className="text-lg font-extrabold">Поскаржитися</h2></div><button type="button" onClick={()=>setShowReportForm(false)} aria-label="Закрити"><X size={20}/></button></div><p className="mb-3 text-xs text-slate-500">Скарга стосується учасника поїздки {selectedBooking.origin_name} → {selectedBooking.destination_name}. Не додавайте платіжні дані чи сторонні персональні відомості.</p><label className="mb-3 block text-xs font-bold text-slate-600">Категорія<select value={reportCategory} onChange={event=>setReportCategory(event.target.value as ApiModerationCase['category'])} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="safety">Питання безпеки</option><option value="harassment">Домагання або образи</option><option value="fraud">Підозра на шахрайство</option><option value="service">Якість поїздки</option><option value="other">Інше</option></select></label><label className="block text-xs font-bold text-slate-600">Опишіть ситуацію<textarea required minLength={10} maxLength={2000} value={reportDetails} onChange={event=>setReportDetails(event.target.value)} className="mt-1.5 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder="Що сталося? (10–2000 символів)"/></label><div className="mt-3 flex justify-end text-xs text-slate-400">{reportDetails.length}/2000</div><button disabled={busy||reportDetails.trim().length<10} className="mt-3 w-full rounded-xl bg-amber-700 py-3.5 font-bold text-white disabled:opacity-50">{busy?'Надсилаємо…':'Надіслати приватну скаргу'}</button></form></div>}
    {verificationTarget&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center"><form role="dialog" aria-modal="true" aria-labelledby="verification-dialog-title" onSubmit={submitVerification} className="w-full max-w-md rounded-[var(--mg-radius-3xl)] bg-white p-5 shadow-xl"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs text-slate-500">Перевірка автомобіля</p><h2 id="verification-dialog-title" className="font-extrabold">{verificationTarget.make} {verificationTarget.model}</h2></div><button type="button" onClick={()=>{setVerificationTarget(null);setRegistrationEvidence(null);setDriverLicenseEvidence(null);}} aria-label="Закрити"><X size={20}/></button></div><p className="mb-4 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Завантажте техпаспорт і посвідчення водія. Маршрути не показують ці документи; рішення ухвалює уповноважений модератор.</p><label className="mb-3 block text-xs font-bold text-slate-600">Свідоцтво про реєстрацію<input required type="file" accept="image/jpeg,image/png,application/pdf" onChange={event=>setRegistrationEvidence(event.target.files?.[0]??null)} className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2 text-xs"/></label><label className="block text-xs font-bold text-slate-600">Посвідчення водія<input required type="file" accept="image/jpeg,image/png,application/pdf" onChange={event=>setDriverLicenseEvidence(event.target.files?.[0]??null)} className="mt-1.5 block w-full rounded-xl border border-slate-200 p-2 text-xs"/></label><p className="mt-2 text-xs text-slate-500">JPEG, PNG або PDF · до 8 МБ на файл</p><button disabled={busy} className="mt-4 w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white disabled:opacity-50">{busy?'Завантажуємо…':'Передати на перевірку'}</button></form></div>}
    {reviewingRecord&&<div className="fixed inset-0 z-[var(--mg-z-scrim-raised)] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="evidence-dialog-title" className="w-full max-w-lg rounded-[var(--mg-radius-3xl)] bg-white p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Перегляд документа</p><h2 id="evidence-dialog-title" className="font-extrabold">{reviewingRecord.display_name} · {reviewingRecord.verification_type==='vehicle'?'Техпаспорт':reviewingRecord.verification_type==='driver_license'?'Посвідчення водія':'Документ'}</h2></div><button onClick={()=>{setReviewingRecord(null);setReviewEvidenceUrl('');}} aria-label="Закрити"><X size={20}/></button></div><iframe title="Документ водія для перевірки" src={reviewEvidenceUrl} className="h-[48svh] w-full rounded-xl border border-slate-200 bg-slate-50"/><label className="mt-3 block text-xs font-bold text-slate-600">Причина відмови — обов’язкова для відхилення<textarea value={reviewNote} onChange={event=>setReviewNote(event.target.value)} maxLength={1000} className="mt-1.5 min-h-16 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder="Коротко опишіть невідповідність"/></label><div className="mt-3 grid grid-cols-2 gap-2"><button disabled={busy} onClick={()=>void decideVerification('rejected')} className="rounded-xl border border-rose-200 py-3 text-xs font-bold text-rose-700 disabled:opacity-50">Відхилити</button><button disabled={busy} onClick={()=>void decideVerification('approved')} className="rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white disabled:opacity-50">Схвалити документ</button></div></section></div>}
    {vehicleToDelete&&<div className="fixed inset-0 z-[var(--mg-z-map-control)] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center"><section role="alertdialog" aria-modal="true" aria-labelledby="delete-vehicle-title" aria-describedby="delete-vehicle-description" className="w-full max-w-md rounded-[var(--mg-radius-3xl)] bg-white p-5 shadow-2xl"><h2 id="delete-vehicle-title" className="text-lg font-extrabold">Видалити {vehicleToDelete.make} {vehicleToDelete.model}?</h2><p id="delete-vehicle-description" className="mt-2 text-sm leading-6 text-slate-600">{vehicleToDelete.is_active?'Це активне авто: активним стане інше ваше авто, якщо воно є. ':''}Минулі поїздки збережуть інформацію про це авто. Якщо воно вже в майбутній поїздці, видалення не буде виконано.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" autoFocus onClick={()=>setVehicleToDelete(null)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Залишити</button><button type="button" disabled={busy} onClick={()=>void confirmDeleteVehicle(vehicleToDelete)} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Видаляємо…':'Так, видалити'}</button></div></section></div>}
    {editingOffer&&<OfferEditSheet offer={editingOffer} vehicles={vehicles.filter(vehicleUsable)} onClose={()=>setEditingOffer(null)} onDone={(message)=>{setEditingOffer(null);setStatusMessage(message);void Promise.all([refreshMyOffers(),refreshBookings()]).catch(()=>undefined);}}/>}
    {confirmDeletion&&<div className="fixed inset-0 z-[var(--mg-z-map-control)] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:items-center"><section role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" aria-describedby="delete-account-description" className="w-full max-w-md rounded-[var(--mg-radius-3xl)] border border-slate-200/80 bg-white p-5 shadow-2xl dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)] dark:text-slate-100"><h2 id="delete-account-title" className="text-lg font-extrabold text-[#0E1F35] dark:text-white">Подати запит на видалення акаунта?</h2><p id="delete-account-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Дані не видаляться одразу: запит можна скасувати протягом періоду очікування.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" autoFocus onClick={()=>setConfirmDeletion(false)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Залишити акаунт</button><button type="button" disabled={deletionBusy} onClick={()=>void requestDeletion()} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50">Так, подати запит</button></div></section></div>}
    {ticketBooking&&<MarshPassTicket
      originName={ticketBooking.origin_name}
      destinationName={ticketBooking.destination_name}
      departureAt={ticketBooking.departure_at}
      arrivalAt={ticketBooking.arrival_at ?? null}
      durationSeconds={ticketBooking.duration_s ?? null}
      priceLabel={formatMoney(ticketBooking.total_price_minor, ticketBooking.currency)}
      seatCount={ticketBooking.seat_count}
      status={ticketBooking.status}
      bookingReference={ticketBooking.id.slice(0, 8).toUpperCase()}
      driverName={ticketBooking.driver_name}
      token={visibleBookingTicket!.token}
      onClose={() => setVisibleBookingTicket(null)}
      onRefresh={() => void showBookingTicket(ticketBooking)}
      onCancelBooking={() => { setVisibleBookingTicket(null); setBookingToCancel(ticketBooking); }}
    />}
    {bookingToCancel&&<div className="fixed inset-0 z-[var(--mg-z-map-control)] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:items-center"><section role="alertdialog" aria-modal="true" aria-labelledby="cancel-booking-title" aria-describedby="cancel-booking-description" className="w-full max-w-md rounded-[var(--mg-radius-3xl)] border border-slate-200/80 bg-white p-5 shadow-2xl dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)] dark:text-slate-100"><h2 id="cancel-booking-title" className="text-lg font-extrabold text-[#0E1F35] dark:text-white">Скасувати бронювання?</h2><p id="cancel-booking-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Місця буде повернено поїздці. {bookingToCancel.current_user_is_driver?'Пасажира буде сповіщено.':'Після скасування можна буде перевірити інші поїздки за маршрутом.'}</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={busy} autoFocus onClick={()=>setBookingToCancel(null)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50">Залишити бронювання</button><button type="button" disabled={busy} onClick={()=>void confirmCancelTrip(bookingToCancel)} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50">{busy?'Скасовуємо…':'Так, скасувати'}</button></div></section></div>}
    {bookingToConfirm&&<div className="fixed inset-0 z-[var(--mg-z-map-control)] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:items-center"><section role="alertdialog" aria-modal="true" aria-labelledby="confirm-booking-title" aria-describedby="confirm-booking-description" className="w-full max-w-md rounded-[var(--mg-radius-3xl)] border border-slate-200/80 bg-white p-5 shadow-2xl dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)] dark:text-slate-100"><h2 id="confirm-booking-title" className="text-lg font-extrabold text-[#0E1F35] dark:text-white">Підтвердити бронювання?</h2><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Маршрут</dt><dd className="text-right font-bold text-slate-900 dark:text-white">{bookingToConfirm.origin_name.split(',')[0]} → {bookingToConfirm.destination_name.split(',')[0]}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Дата й відправлення</dt><dd className="text-right font-bold text-slate-900 dark:text-white">{formatDate(bookingToConfirm.departure_at,{weekday:'short',day:'numeric',month:'short'})} · {formatDate(bookingToConfirm.departure_at,{hour:'2-digit',minute:'2-digit'})}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Посадка</dt><dd className="text-right text-slate-800 dark:text-slate-200">{bookingToConfirm.origin_name}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Висадка</dt><dd className="text-right text-slate-800 dark:text-slate-200">{bookingToConfirm.destination_name}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Водій</dt><dd className="text-right text-slate-800 dark:text-slate-200">{bookingToConfirm.driver_name}{bookingToConfirm.review_count?` · ★ ${Number(bookingToConfirm.average_rating).toFixed(1)}`:' · Новий водій'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Місця</dt><dd className="text-right font-bold text-slate-900 dark:text-white">{seats} · вільних зараз: {bookingToConfirm.available_seats}</dd></div><div className="flex justify-between gap-3 border-t border-slate-100 pt-2 dark:border-slate-800"><dt className="text-slate-500 dark:text-slate-400">До сплати водієві</dt><dd className="text-right text-lg font-extrabold text-[#0B6EF3] dark:text-[var(--mg-blue)]">{formatMoney(bookingToConfirm.price_per_seat_minor*seats,bookingToConfirm.currency)}</dd></div></dl><p id="confirm-booking-description" className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Скасувати можна самостійно, доки бронювання підтверджене (до підтвердження посадки) — місця одразу повернуться поїздці. Комісія MARSHGO — 0%, оплату узгоджуєте з водієм.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={busy} autoFocus onClick={()=>setBookingToConfirm(null)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50">Повернутися</button><button data-testid="confirm-booking-button" type="button" disabled={busy||bookingToConfirm.available_seats<seats} onClick={()=>void book(bookingToConfirm)} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50">{busy?'Забронюємо…':`Підтвердити за ${formatMoney(bookingToConfirm.price_per_seat_minor*seats,bookingToConfirm.currency)}`}</button></div></section></div>}
  </main>;
}
