import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  CornerUpLeft,
  CornerUpRight,
  MessageCircle,
  MessageSquare,
  Navigation,
  Phone,
  PhoneCall,
  Send,
  Share2,
  ShieldAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import type { MapAdapter, MapStatus } from '../map/MapAdapter';
import { setMapPerspective, type MapPerspective } from '../map/mapMode';

export type LifecycleStage =
  | 'CONFIRMED'       // 1. Поїздка підтверджена
  | 'APPROACHING'     // 2. Водій наближається (живе наближення на карті)
  | 'ARRIVED'         // 3. Водій очікує у точці зустрічі
  | 'BOARDED'         // 4. Пасажир сів у авто / зустріч успішна
  | 'IN_TRANSIT'      // 5. Повноцінна активна навігація по маршруту
  | 'COMPLETED';      // 6. Поїздку завершено / оцінка

export type UserRole = 'passenger' | 'driver';

export interface CarpoolTripData {
  id: string;
  driverName: string;
  driverAvatarUrl: string;
  driverRating: number;
  driverReviewsCount: number;
  driverPhone: string;
  carMake: string;
  carModel: string;
  carPlate: string;
  carColor: string;
  carPhotoUrl: string;
  pickupLabel: string;
  pickupCoordinates: [number, number];
  destinationLabel: string;
  destinationCoordinates: [number, number];
  destinationPhotoUrl: string;
  priceUah: number;
  seatsTotal: number;
  seatsBooked: number;
  luggageInfo: string;
  plannedPickupTime: string;
  plannedArrivalTime: string;
  passengerName?: string;
  originName?: string;
  destinationName?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  seats?: number;
  driverTripsCount?: number;
}

const DEFAULT_TRIP: CarpoolTripData = {
  id: 'trip-camry-lviv-1',
  driverName: 'Олексій',
  driverAvatarUrl: '/images/driver_oleksiy.jpg',
  driverRating: 4.9,
  driverReviewsCount: 328,
  driverPhone: '+380 00 000 0000 (DEMO)',
  carMake: 'Toyota',
  carModel: 'Camry',
  carPlate: 'BC 0000 ДЕМО',
  carColor: 'Сірий (DEMO)',
  carPhotoUrl: '/images/toyota_camry_carpool.jpg',
  pickupLabel: 'вул. Малоголосківська, 12 (біля ТРЦ Fabrik, Львів)',
  pickupCoordinates: [24.0152, 49.8654],
  destinationLabel: 'вул. Наукова, 7, Львів (DEMO)',
  destinationCoordinates: [24.0041, 49.8032],
  destinationPhotoUrl: '/images/lviv_naukova_building.jpg',
  priceUah: 120,
  seatsTotal: 4,
  seatsBooked: 2,
  luggageInfo: 'Середній, до 2 шт.',
  plannedPickupTime: '09:49',
  plannedArrivalTime: '10:17',
};

// Simulated route points for driver approaching pickup
const APPROACH_ROUTE: [number, number][] = [
  [24.0280, 49.8520],
  [24.0250, 49.8550],
  [24.0220, 49.8590],
  [24.0180, 49.8620],
  [24.0152, 49.8654],
];

// Simulated main route from pickup to destination
const TRIP_ROUTE: [number, number][] = [
  [24.0152, 49.8654],
  [24.0160, 49.8600],
  [24.0180, 49.8500],
  [24.0150, 49.8400],
  [24.0120, 49.8300],
  [24.0080, 49.8200],
  [24.0050, 49.8100],
  [24.0041, 49.8032],
];

export interface RideshareLifecycleExperienceProps {
  trip?: Partial<CarpoolTripData>;
  initialStage?: LifecycleStage;
  initialRole?: UserRole;
  onClose: () => void;
  onCompleted?: (rating: number, review: string) => void;
}

export function RideshareLifecycleExperience({
  trip: initialTripData,
  initialStage = 'CONFIRMED',
  initialRole = 'passenger',
  onClose,
  onCompleted,
}: RideshareLifecycleExperienceProps) {
  const trip = useMemo(() => ({
    ...DEFAULT_TRIP,
    ...initialTripData,
    pickupLabel: initialTripData?.pickupLabel ?? initialTripData?.pickupAddress ?? initialTripData?.originName ?? DEFAULT_TRIP.pickupLabel,
    destinationLabel: initialTripData?.destinationLabel ?? initialTripData?.dropoffAddress ?? initialTripData?.destinationName ?? DEFAULT_TRIP.destinationLabel,
    driverReviewsCount: initialTripData?.driverReviewsCount ?? initialTripData?.driverTripsCount ?? DEFAULT_TRIP.driverReviewsCount,
    seatsBooked: initialTripData?.seatsBooked ?? initialTripData?.seats ?? DEFAULT_TRIP.seatsBooked,
  }), [initialTripData]);
  const [stage, setStage] = useState<LifecycleStage>(initialStage);
  const [role, setRole] = useState<UserRole>(initialRole);

  // Map and Navigation states
  const [perspective, setPerspectiveState] = useState<MapPerspective>('3d');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [_mapStatus, setMapStatus] = useState<MapStatus>('available');
  const mapAdapter = useRef<MapAdapter | null>(null);

  // Interactive Live simulation tick
  const [progressRatio, setProgressRatio] = useState(0.2); // 0.0 to 1.0 along current route
  const [currentSpeed, setCurrentSpeed] = useState(42);
  const [speedLimit] = useState(50);
  const [activeLaneIndex] = useState(1);
  const [hasTrafficWarning, setHasTrafficWarning] = useState(false);
  const [trafficDetourAccepted, setTrafficDetourAccepted] = useState(false);

  // Modals
  const [showCallModal, setShowCallModal] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [showHazardModal, setShowHazardModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Chat messages state
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: 'me' | 'other'; text: string; time: string }>>([
    { id: '1', sender: 'other', text: 'Добрий день! Виїжджаю за 3 хвилини.', time: '09:42' },
    { id: '2', sender: 'me', text: 'Вітаю! Чекатиму біля центрального входу ТРЦ.', time: '09:43' },
  ]);
  const [chatInputText, setChatInputText] = useState('');

  // Rating & Review state
  const [ratingStars, setRatingStars] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Ввічливий', 'Чисте авто']);
  const [reviewComment, setReviewComment] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Ukrainian speech synthesis helper
  const announceVoice = useCallback((text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'uk-UA';
      utterance.rate = 1.05;
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('uk'));
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore
    }
  }, [voiceEnabled]);

  // Voice announcement on stage changes
  useEffect(() => {
    if (stage === 'APPROACHING') {
      announceVoice('Водій наближається до точки зустрічі. Прибуття через дві хвилини.');
    } else if (stage === 'ARRIVED') {
      announceVoice('Водій прибув у точку зустрічі та очікує на вас.');
    } else if (stage === 'BOARDED') {
      announceVoice('Ви зустрілися! Гарної поїздки.');
    } else if (stage === 'IN_TRANSIT') {
      announceVoice('Через триста метрів поверніть праворуч на вулицю Стрийська.');
    } else if (stage === 'COMPLETED') {
      announceVoice('Ви прибули до пункту призначення. Поїздку завершено.');
    }
  }, [stage, announceVoice]);

  // Interpolated driver position
  const activeRoute = stage === 'IN_TRANSIT' ? TRIP_ROUTE : APPROACH_ROUTE;
  const currentVehiclePosition = useMemo((): [number, number] => {
    if (stage === 'ARRIVED' || stage === 'BOARDED') return trip.pickupCoordinates;
    if (stage === 'COMPLETED') return trip.destinationCoordinates;
    if (activeRoute.length === 0) return trip.pickupCoordinates;
    const indexFloat = progressRatio * (activeRoute.length - 1);
    const low = Math.floor(indexFloat);
    const high = Math.min(activeRoute.length - 1, low + 1);
    const frac = indexFloat - low;
    const p1 = activeRoute[low];
    const p2 = activeRoute[high];
    return [
      p1[0] + (p2[0] - p1[0]) * frac,
      p1[1] + (p2[1] - p1[1]) * frac,
    ];
  }, [stage, activeRoute, progressRatio, trip.pickupCoordinates, trip.destinationCoordinates]);

  // Live simulation ticker for moving car
  useEffect(() => {
    if (stage !== 'APPROACHING' && stage !== 'IN_TRANSIT') return;
    const interval = setInterval(() => {
      setProgressRatio((prev) => {
        const next = prev + 0.04;
        if (next >= 0.98) {
          if (stage === 'APPROACHING') setStage('ARRIVED');
          if (stage === 'IN_TRANSIT') setStage('COMPLETED');
          return 1.0;
        }
        return next;
      });
      // Slight speed variation
      setCurrentSpeed((s) => Math.min(58, Math.max(38, s + Math.floor(Math.random() * 5) - 2)));
    }, 1800);
    return () => clearInterval(interval);
  }, [stage]);

  // Waypoints for the map
  const mapWaypoints = useMemo(() => [
    {
      coordinate: trip.pickupCoordinates,
      kind: 'origin' as const,
      label: 'Точка зустрічі',
    },
    {
      coordinate: trip.destinationCoordinates,
      kind: 'destination' as const,
      label: 'Пункт призначення',
    },
  ], [trip.pickupCoordinates, trip.destinationCoordinates]);

  // Send a chat message
  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInputText.trim()) return;
    const newMsg = {
      id: String(Date.now()),
      sender: 'me' as const,
      text: chatInputText.trim(),
      time: new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInputText('');
    triggerToast('Повідомлення надіслано водію');
  };

  const handleSendCannedMessage = (text: string) => {
    const newMsg = {
      id: String(Date.now()),
      sender: 'me' as const,
      text,
      time: new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
    };
    setChatMessages((prev) => [...prev, newMsg]);
    triggerToast(`Надіслано: "${text}"`);
  };

  const handleToggle3D = () => {
    const next: MapPerspective = perspective === '3d' ? '2d' : '3d';
    setPerspectiveState(next);
    setMapPerspective(next);
    mapAdapter.current?.setPerspective?.(next);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const text = `Слідкуйте за моєю поїздкою в MarshGO з водієм ${trip.driverName} (${trip.carMake} ${trip.carModel}): ${url}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'MarshGO Live Ride', text, url });
        return;
      } catch {
        // fallback
      }
    }
    await navigator.clipboard.writeText(url);
    triggerToast('Посилання на відстеження скопійовано в буфер');
  };

  // Maneuver instructions for stage 5
  const activeManeuver = useMemo(() => {
    if (progressRatio < 0.35) {
      return {
        dist: '300 м',
        text: 'Поверніть праворуч на вул. Стрийська',
        icon: CornerUpRight,
        lanes: [false, true, true, false],
        sign: 'вул. Стрийська',
      };
    }
    if (progressRatio < 0.7) {
      return {
        dist: '1.2 км',
        text: 'Прямо на просп. Червоної Калини',
        icon: ArrowUp,
        lanes: [true, true, true, false],
        sign: 'просп. Червоної Калини',
      };
    }
    return {
      dist: '800 м',
      text: 'Тримайтеся ліворуч на Київ / Чоп',
      icon: CornerUpLeft,
      lanes: [true, true, false, false],
      sign: 'Київ  E40  Чоп',
    };
  }, [progressRatio]);

  return (
    <div
      data-testid="rideshare-lifecycle-experience"
      className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-[#06101E] text-white font-sans select-none"
    >
      <div role="note" className="shrink-0 bg-amber-300 px-3 py-1.5 text-center text-[11px] font-extrabold text-slate-950">
        ДЕМО: маршрут, GPS та ETA симульовані — не використовувати для реальної поїздки.
      </div>
      {/* ─── TOAST NOTIFICATION ─── */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 rounded-2xl bg-emerald-500/90 backdrop-blur-md px-4 py-2.5 text-xs font-bold text-white shadow-xl shadow-emerald-950/40 animate-fade-in"
        >
          <CheckCircle2 size={16} />
          {toastMessage}
        </div>
      )}

      {/* ─── TOP STATUS & STAGE CONTROL BAR ─── */}
      <header className="relative z-30 flex shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#071524]/90 backdrop-blur-md px-4 py-2.5 pt-[max(.6rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Повернутися назад"
            className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800/80 text-slate-200 hover:bg-slate-700 active:scale-95 transition"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-white">
                MARSH<span className="text-[#00C2FF]">GO</span>
              </span>
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#00C2FF] border border-[#00C2FF]/30">
                Попутка
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              {role === 'passenger' ? 'Пасажирський режим' : 'Водійський режим'} · {trip.driverName} ({trip.carMake})
            </p>
          </div>
        </div>

        {/* Role switcher & quick toggles */}
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-xl bg-slate-800/80 p-0.5 border border-slate-700/60 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setRole('passenger')}
              className={`rounded-lg px-2.5 py-1 transition ${
                role === 'passenger'
                  ? 'bg-[#00C2FF] text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Пасажир
            </button>
            <button
              type="button"
              onClick={() => setRole('driver')}
              className={`rounded-lg px-2.5 py-1 transition ${
                role === 'driver'
                  ? 'bg-emerald-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Водій
            </button>
          </div>

          <button
            type="button"
            onClick={handleShare}
            aria-label="Поділитися поїздкою"
            className="grid h-9 w-9 place-items-center rounded-xl bg-slate-800/80 text-slate-200 hover:bg-slate-700 transition"
          >
            <Share2 size={16} />
          </button>
        </div>
      </header>

      {/* ─── STAGE PROGRESS STEPPER TABS (1-5) ─── */}
      <nav aria-label="Етапи поїздки" className="relative z-20 shrink-0 border-b border-slate-800/60 bg-[#06101E]/95 px-3 py-1.5 flex gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'CONFIRMED' as const, num: '1', label: 'Підтверджено' },
          { id: 'APPROACHING' as const, num: '2', label: 'Наближається' },
          { id: 'ARRIVED' as const, num: '3', label: 'На місці' },
          { id: 'BOARDED' as const, num: '4', label: 'Зустрілися' },
          { id: 'IN_TRANSIT' as const, num: '5', label: 'Навігація' },
          { id: 'COMPLETED' as const, num: '6', label: 'Прибули' },
        ].map((item) => {
          const isActive = stage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setStage(item.id);
                setProgressRatio(item.id === 'IN_TRANSIT' ? 0.3 : item.id === 'APPROACHING' ? 0.4 : 0);
              }}
              className={`flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-bold transition ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-[#00C2FF] text-white shadow-md shadow-blue-900/30 ring-1 ring-white/20'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-extrabold ${
                isActive ? 'bg-white text-blue-700' : 'bg-slate-700 text-slate-300'
              }`}>
                {item.num}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ─── MAIN MAP CANVAS WITH LIVE VEHICLE & GLOW ROUTE ─── */}
      <div className="relative flex-1 min-h-[30svh] overflow-hidden bg-[#0A1626]">
        <MarshGoMap
          route={stage === 'IN_TRANSIT' ? TRIP_ROUTE : APPROACH_ROUTE}
          routeWaypoints={mapWaypoints}
          routeFitPadding={{ top: 70, right: 30, bottom: 220, left: 30 }}
          vehicle={currentVehiclePosition}
          heading={stage === 'IN_TRANSIT' ? 185 : 45}
          overlays={true}
          focusMode={stage === 'IN_TRANSIT'}
          onStatus={setMapStatus}
          onAdapter={(adapter) => {
            mapAdapter.current = adapter;
            if (adapter) {
              const currentRoute = stage === 'IN_TRANSIT' ? TRIP_ROUTE : APPROACH_ROUTE;
              adapter.focusCoordinates?.(currentRoute, { top: 70, right: 30, bottom: 220, left: 30 }, 15);
            }
          }}
        />

        {/* ─── FLOATING HUD OVERLAYS ─── */}

        {/* Top Floating Pill: Driver status */}
        {(stage === 'CONFIRMED' || stage === 'APPROACHING') && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-emerald-500/40 bg-[#071C22]/95 backdrop-blur-md px-3.5 py-1.5 text-xs font-extrabold text-emerald-400 shadow-xl shadow-black/40">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            <span>Водій прямує до вас · Прибуде за 3 хв</span>
          </div>
        )}

        {/* Floating Bubble over pickup point */}
        {stage !== 'IN_TRANSIT' && stage !== 'COMPLETED' && (
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full rounded-2xl border border-[#00C2FF]/50 bg-[#081B30]/95 px-3 py-1.5 text-center shadow-xl backdrop-blur-md"
            style={{ left: '50%', top: '48%' }}
          >
            <p className="text-[10px] font-extrabold text-[#00C2FF] uppercase tracking-wider">
              {stage === 'ARRIVED' ? '🟢 Водій очікує на місці' : 'Точка зустрічі'}
            </p>
            <p className="text-xs font-bold text-white truncate max-w-[200px]">
              вул. Малоголосківська, 12
            </p>
          </div>
        )}

        {/* Floating Controls (Right Side) */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
          {/* 3D button */}
          <button
            type="button"
            onClick={handleToggle3D}
            aria-label="3D перспектива"
            className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-700/80 bg-[#0B1C2D]/90 text-xs font-extrabold text-white shadow-lg backdrop-blur hover:bg-slate-800 transition active:scale-95"
          >
            {perspective === '3d' ? '3D' : '2D'}
          </button>

          {/* Voice toggle */}
          <button
            type="button"
            onClick={() => {
              setVoiceEnabled((v) => !v);
              triggerToast(voiceEnabled ? 'Голосові підказки вимкнено' : 'Голосові підказки увімкнено');
            }}
            aria-label={voiceEnabled ? 'Вимкнути звук' : 'Увімкнути звук'}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-700/80 bg-[#0B1C2D]/90 text-white shadow-lg backdrop-blur hover:bg-slate-800 transition active:scale-95"
          >
            {voiceEnabled ? <Volume2 size={18} className="text-[#00C2FF]" /> : <VolumeX size={18} className="text-slate-400" />}
          </button>

          {/* Hazard / situation button */}
          <button
            type="button"
            onClick={() => setShowHazardModal(true)}
            aria-label="Повідомити про ситуацію на дорозі"
            className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-500/40 bg-[#1A180E]/90 text-amber-400 shadow-lg backdrop-blur hover:bg-amber-950 transition active:scale-95"
          >
            <AlertTriangle size={18} />
          </button>

          {/* Emergency SOS button */}
          <button
            type="button"
            onClick={() => setShowSosModal(true)}
            aria-label="SOS Безпека"
            className="grid h-11 w-11 place-items-center rounded-2xl border border-rose-500/40 bg-[#230C12]/90 text-rose-400 shadow-lg backdrop-blur hover:bg-rose-950 transition active:scale-95"
          >
            <ShieldAlert size={18} />
          </button>
        </div>

        {/* ─── TURN-BY-TURN HUD (When Stage is IN_TRANSIT) ─── */}
        {stage === 'IN_TRANSIT' && (
          <div className="absolute top-3 left-3 right-16 z-20 flex flex-col gap-2 pointer-events-auto">
            {/* Main Maneuver Banner */}
            <div className="overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-[#064E3B] to-[#022C22] p-3 text-white shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/30 border border-emerald-400/40">
                  <activeManeuver.icon size={30} className="text-white" strokeWidth={2.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black tracking-tight">{activeManeuver.dist}</span>
                    <span className="rounded bg-emerald-400/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-emerald-300">
                      Наступний маневр
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-bold text-emerald-100">
                    {activeManeuver.text}
                  </p>
                </div>
              </div>

              {/* Lane Guidance Indicators */}
              <div className="mt-2.5 flex items-center justify-between border-t border-emerald-600/30 pt-2 text-[11px]">
                <div className="flex items-center gap-1.5" aria-label="Смуги руху">
                  {activeManeuver.lanes.map((isTurnLane, idx) => (
                    <div
                      key={idx}
                      className={`grid h-7 w-6 place-items-center rounded border text-xs font-black ${
                        idx === activeLaneIndex
                          ? 'border-white bg-white text-emerald-950 shadow-md ring-2 ring-[#00C2FF]'
                          : isTurnLane
                          ? 'border-emerald-300 bg-emerald-700/60 text-emerald-100'
                          : 'border-emerald-800 bg-emerald-950/40 text-emerald-600'
                      }`}
                    >
                      ↑
                    </div>
                  ))}
                  <span className="ml-1 text-[10px] text-emerald-200">Тримайтеся 2-ї смуги</span>
                </div>

                {/* Highway sign badge */}
                <div className="rounded-lg bg-[#0047AB] px-2.5 py-1 text-[10px] font-black tracking-wide text-white border border-blue-300/40 shadow-sm">
                  {activeManeuver.sign}
                </div>
              </div>
            </div>

            {/* Traffic jam warning banner */}
            {(hasTrafficWarning || progressRatio > 0.45 && progressRatio < 0.7) && (
              <div className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-[#2D0F14]/90 p-2.5 shadow-lg backdrop-blur animate-pulse">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                  <span className="text-xs font-bold text-rose-200">Затор попереду · +6 хв</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTrafficDetourAccepted(true);
                    triggerToast('Обхідний маршрут активовано (-4 хв)');
                  }}
                  className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white shadow hover:bg-rose-500 transition"
                >
                  {trafficDetourAccepted ? 'Маршрут оновлено' : 'Об’їзд'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Speedometer & Speed limit widget (Stage 5) */}
        {stage === 'IN_TRANSIT' && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-[#071524]/95 p-2 shadow-2xl backdrop-blur-md">
            {/* Speed limit Ukrainian round sign */}
            <div className="grid h-11 w-11 place-items-center rounded-full border-[3px] border-rose-600 bg-white font-black text-slate-950 text-sm shadow-inner">
              {speedLimit}
            </div>
            {/* Speed readout */}
            <div className="px-1 text-center">
              <span className="block text-xl font-black text-white leading-none">
                {currentSpeed}
              </span>
              <span className="block text-[9px] font-bold text-slate-400 uppercase">
                км/год
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── BOTTOM SHEET: INTERACTIVE LIFECYCLE CONTROLS ─── */}
      <section className="relative z-30 shrink-0 border-t border-slate-800/90 bg-gradient-to-b from-[#0B1D30] to-[#06101E] px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] shadow-2xl">
        {/* Drag handle pill */}
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-700/70" />

        {/* ── STAGE 1: CONFIRMED OVERVIEW ── */}
        {stage === 'CONFIRMED' && (
          <div className="space-y-3">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 border border-emerald-500/30">
                  Поїздку підтверджено
                </span>
                <h2 className="mt-1 text-lg font-black text-white">
                  {role === 'passenger' ? 'Водій вже в дорозі до вас' : 'Ви прямуєте до пасажира'}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-[#00C2FF]">{trip.priceUah} ₴</span>
                <p className="text-[10px] text-slate-400">0% комісії</p>
              </div>
            </div>

            {/* Driver & Car Profile Card */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0E243A]/70 p-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={trip.driverAvatarUrl}
                    alt={trip.driverName}
                    className="h-13 w-13 rounded-2xl object-cover ring-2 ring-[#00C2FF]/60"
                  />
                  <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-[#0E243A]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <b className="text-sm font-black text-white">{trip.driverName}</b>
                    <span className="flex items-center text-xs font-bold text-amber-400">
                      ★ {trip.driverRating}
                    </span>
                    <span className="text-[10px] text-slate-400">({trip.driverReviewsCount})</span>
                  </div>
                  <p className="text-xs font-bold text-slate-200">
                    {trip.carMake} {trip.carModel} · <span className="text-slate-400">{trip.carPlate}</span>
                  </p>
                  <p className="text-[10px] text-slate-400">Колір: {trip.carColor}</p>
                </div>
              </div>

              <img
                src={trip.carPhotoUrl}
                alt="Авто"
                className="h-12 w-20 rounded-xl object-cover border border-slate-700/60 shadow-sm"
              />
            </div>

            {/* Quick Action Contact Bar */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShowCallModal(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-bold text-white hover:bg-slate-700 active:scale-95 transition"
              >
                <Phone size={14} className="text-emerald-400" />
                Подзвонити
              </button>
              <button
                type="button"
                onClick={() => setShowChatDrawer(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-bold text-white hover:bg-slate-700 active:scale-95 transition"
              >
                <MessageSquare size={14} className="text-[#00C2FF]" />
                Чат
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-bold text-white hover:bg-slate-700 active:scale-95 transition"
              >
                <Share2 size={14} className="text-violet-400" />
                Поділитися
              </button>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => {
                setStage('APPROACHING');
                setProgressRatio(0.4);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-[#00C2FF] py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-blue-900/30 hover:opacity-95 active:scale-98 transition"
            >
              <Navigation size={18} />
              Відкрити живе наближення на карті
            </button>
          </div>
        )}

        {/* ── STAGE 2: APPROACHING ON MAP ── */}
        {stage === 'APPROACHING' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold text-emerald-400 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  Водій вже поруч
                </p>
                <h2 className="text-xl font-black text-white">
                  1 хв · 120 метрів
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400">Посадка</span>
                <p className="text-xs font-black text-white">{trip.plannedPickupTime}</p>
              </div>
            </div>

            {/* Approach Progress Indicator */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                <span>Пасажир на місці</span>
                <span>Наближення авто</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-[#00C2FF] to-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.round(progressRatio * 100)}%` }}
                />
              </div>
            </div>

            {/* Buttons: I'm here & Contact */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStage('ARRIVED')}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950 shadow-lg shadow-emerald-950/40 hover:bg-emerald-400 active:scale-95 transition"
              >
                <Check size={16} />
                Я на місці зустрічі
              </button>
              <button
                type="button"
                onClick={() => setShowChatDrawer(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-bold text-white hover:bg-slate-700 active:scale-95 transition"
              >
                <MessageCircle size={15} className="text-[#00C2FF]" />
                Написати водію
              </button>
            </div>
          </div>
        )}

        {/* ── STAGE 3: ARRIVED AT MEETING POINT ── */}
        {stage === 'ARRIVED' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-3.5">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={18} />
                <b className="text-sm font-black">Водій очікує у точці зустрічі!</b>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                {trip.carMake} {trip.carModel} · номер <span className="font-extrabold text-white">{trip.carPlate}</span> (колір {trip.carColor})
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStage('BOARDED')}
                className="w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/40 hover:bg-emerald-400 active:scale-98 transition"
              >
                {role === 'passenger' ? 'Я вже підходжу' : 'Пасажир підходить'}
              </button>
              <button
                type="button"
                onClick={() => setShowCallModal(true)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 py-3.5 text-xs font-bold text-white hover:bg-slate-700 active:scale-98 transition"
              >
                Зателефонувати
              </button>
            </div>
          </div>
        )}

        {/* ── STAGE 4: BOARDED / MEETING CELEBRATION ── */}
        {stage === 'BOARDED' && (
          <div className="space-y-3 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-emerald-500/20 border border-emerald-400/50 shadow-xl">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Ви зустрілися!</h2>
              <p className="text-xs text-slate-300">
                Поїздка розпочалася · {trip.driverName} ({trip.carMake} {trip.carModel})
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0E243A]/70 p-3 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">До пункту призначення:</span>
                <span className="font-black text-[#00C2FF]">28 хв · 18 км</span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-400 truncate">
                {trip.destinationLabel}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setStage('IN_TRANSIT');
                setProgressRatio(0.1);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-[#00C2FF] py-3.5 text-sm font-black text-slate-950 shadow-xl shadow-blue-900/40 hover:opacity-95 active:scale-98 transition"
            >
              <Navigation size={18} />
              Відкрити навігацію
            </button>
          </div>
        )}

        {/* ── STAGE 5: ACTIVE TURN-BY-TURN IN TRANSIT ── */}
        {stage === 'IN_TRANSIT' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white">28 хв</span>
                  <span className="text-xs font-bold text-slate-400">· 18 км</span>
                </div>
                <p className="text-xs text-slate-400">
                  Прибуття о <span className="font-bold text-white">{trip.plannedArrivalTime}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStage('COMPLETED')}
                className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs font-extrabold text-rose-300 hover:bg-rose-900 active:scale-95 transition"
              >
                Завершити
              </button>
            </div>

            {/* In-ride Controls Strip */}
            <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold text-slate-300">
              <button
                type="button"
                onClick={() => setShowChatDrawer(true)}
                className="flex flex-col items-center gap-1 rounded-xl bg-slate-800/70 p-2 hover:bg-slate-700 transition"
              >
                <MessageSquare size={16} className="text-[#00C2FF]" />
                Чат
              </button>
              <button
                type="button"
                onClick={() => setShowCallModal(true)}
                className="flex flex-col items-center gap-1 rounded-xl bg-slate-800/70 p-2 hover:bg-slate-700 transition"
              >
                <Phone size={16} className="text-emerald-400" />
                Дзвінок
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex flex-col items-center gap-1 rounded-xl bg-slate-800/70 p-2 hover:bg-slate-700 transition"
              >
                <Share2 size={16} className="text-violet-400" />
                Поділитися
              </button>
              <button
                type="button"
                onClick={() => setShowSosModal(true)}
                className="flex flex-col items-center gap-1 rounded-xl bg-rose-950/60 p-2 text-rose-300 hover:bg-rose-900 transition"
              >
                <ShieldAlert size={16} className="text-rose-400" />
                SOS
              </button>
            </div>
          </div>
        )}

        {/* ── STAGE 6: ARRIVED / RATING SCREEN ── */}
        {stage === 'COMPLETED' && (
          <div className="space-y-3">
            {/* Landmark Photo & Arrival Badge */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-700">
              <img
                src={trip.destinationPhotoUrl}
                alt={trip.destinationLabel}
                className="h-28 w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 flex flex-col justify-end">
                <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[9px] font-black uppercase text-slate-950 w-fit">
                  Ви прибули
                </span>
                <p className="mt-1 text-xs font-black text-white truncate">
                  {trip.destinationLabel}
                </p>
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-lg font-black text-white">Поїздку завершено</h2>
              <p className="text-xs text-slate-400">
                Дякуємо, що користуєтесь MarshGO! Оцініть водія {trip.driverName}.
              </p>
            </div>

            {/* 5-Star Rating Buttons */}
            <div className="flex justify-center gap-2" aria-label="Оцінка">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingStars(star)}
                  className={`grid h-10 w-10 place-items-center rounded-2xl text-xl font-bold transition active:scale-95 ${
                    star <= ratingStars
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-900/40'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Quick Feedback Tags */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {['Ввічливий', 'Чисте авто', 'Вчасно', 'Плавне водіння', 'Безпечно'].map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setSelectedTags((prev) =>
                        isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                      );
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                      isSelected
                        ? 'bg-[#00C2FF] text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Comment field */}
            <input
              type="text"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Коментар або побажання водієві (необов’язково)"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#00C2FF]"
            />

            {/* Submit & Close Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onCompleted?.(ratingStars, reviewComment);
                  triggerToast('Дякуємо за відгук! Оцінку збережено');
                  setTimeout(onClose, 800);
                }}
                className="w-full rounded-2xl bg-blue-600 py-3 text-xs font-black text-white hover:bg-blue-500 active:scale-95 transition"
              >
                Оцінити поїздку
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 active:scale-95 transition"
              >
                На головну
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─── MODAL: PHONE CALL ─── */}
      {showCallModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-[#0B1E32] p-5 shadow-2xl text-center space-y-4">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/20 border border-emerald-400/40">
              <PhoneCall size={28} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Дзвінок водієві</h3>
              <p className="text-xs text-slate-300">
                {trip.driverName} ({trip.carMake} {trip.carModel})
              </p>
              <p className="mt-2 text-base font-black text-[#00C2FF] font-mono tracking-wider">
                {trip.driverPhone}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <a
                href={`tel:${trip.driverPhone}`}
                onClick={() => setShowCallModal(false)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950 hover:bg-emerald-400 active:scale-95 transition"
              >
                <Phone size={14} />
                Подзвонити
              </a>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(trip.driverPhone);
                  triggerToast('Номер телефону скопійовано');
                  setShowCallModal(false);
                }}
                className="rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-bold text-white hover:bg-slate-700 active:scale-95 transition"
              >
                Скопіювати
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowCallModal(false)}
              className="text-xs font-bold text-slate-400 hover:text-white"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      {/* ─── DRAWER: INSTANT CHAT ─── */}
      {showChatDrawer && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="h-[80svh] w-full max-w-xl mx-auto rounded-t-3xl border-t border-slate-700 bg-[#071728] flex flex-col overflow-hidden shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-[#0B1E32]">
              <div className="flex items-center gap-2.5">
                <img
                  src={trip.driverAvatarUrl}
                  alt={trip.driverName}
                  className="h-9 w-9 rounded-xl object-cover ring-1 ring-[#00C2FF]"
                />
                <div>
                  <b className="block text-sm font-black text-white">{trip.driverName}</b>
                  <span className="block text-[10px] text-emerald-400 font-bold">● В мережі · Водій</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChatDrawer(false)}
                aria-label="Закрити чат"
                className="grid h-8 w-8 place-items-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Canned Responses */}
            <div className="border-b border-slate-800/80 bg-[#091B2E] px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar">
              {[
                'Я вже на місці біля входу',
                'Підійду через 2 хвилини',
                'В якому ви ряду?',
                'Бачу ваше авто',
              ].map((canned) => (
                <button
                  key={canned}
                  type="button"
                  onClick={() => handleSendCannedMessage(canned)}
                  className="shrink-0 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-[11px] font-bold text-slate-200 hover:border-[#00C2FF] hover:text-white transition active:scale-95"
                >
                  {canned}
                </button>
              ))}
            </div>

            {/* Message History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[80%] ${
                    msg.sender === 'me' ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-xs font-medium leading-relaxed ${
                      msg.sender === 'me'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="mt-0.5 text-[9px] text-slate-500 px-1">{msg.time}</span>
                </div>
              ))}
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendMessage} className="border-t border-slate-800 bg-[#0B1E32] p-3 flex gap-2">
              <input
                type="text"
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
                placeholder="Напишіть повідомлення водієві…"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-[#00C2FF]"
              />
              <button
                type="submit"
                disabled={!chatInputText.trim()}
                aria-label="Надіслати"
                className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-500 active:scale-95 transition"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: SOS SAFETY ─── */}
      {showSosModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-rose-500/40 bg-[#1F0A0E] p-5 shadow-2xl text-center space-y-4">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/20 border border-rose-500/50">
              <ShieldAlert size={32} className="text-rose-500" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Центр Безпеки MarshGO</h3>
              <p className="text-xs text-slate-300">
                Якщо виникла небезпека або аварійна ситуація, негайно зв’яжіться з екстреними службами.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <a
                href="tel:102"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-xs font-black text-white hover:bg-rose-500 active:scale-95 transition"
              >
                <Phone size={16} />
                Викликати Поліцію (102)
              </a>
              <a
                href="tel:103"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/60 py-3 text-xs font-bold text-rose-200 hover:bg-rose-900 active:scale-95 transition"
              >
                <Phone size={16} />
                Швидка Допомога (103)
              </a>
              <button
                type="button"
                onClick={handleShare}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-bold text-white hover:bg-slate-700 transition"
              >
                <Share2 size={16} />
                Надіслати GPS довіреній особі
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSosModal(false)}
              className="text-xs font-bold text-slate-400 hover:text-white"
            >
              Повернутися до поїздки
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL: HAZARD / TRAFFIC SITUATION ─── */}
      {showHazardModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-[#0B1E32] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" />
                Ситуація на дорозі
              </h3>
              <button
                type="button"
                onClick={() => setShowHazardModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { title: 'Затор', icon: '🚗' },
                { title: 'ДТП', icon: '💥' },
                { title: 'Ремонт дороги', icon: '🚧' },
                { title: 'Перешкода', icon: '⚠️' },
              ].map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    triggerToast(`Дякуємо! Позначку "${item.title}" додано на карту`);
                    setShowHazardModal(false);
                    setHasTrafficWarning(true);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-800/80 p-3.5 text-xs font-bold text-white hover:border-amber-400 hover:bg-slate-700 active:scale-95 transition"
                >
                  <span className="text-2xl">{item.icon}</span>
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
