import { useMemo, useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  CornerDownRight,
  MapPin,
  Navigation,
  QrCode,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  type LifecycleStage,
  type RideshareSessionState,
  createInitialSessionState,
  rideshareLifecycleReducer,
  calculateStraightLineDistance,
  estimateEtaMinutes,
  formatDistanceUk,
} from '../domain/rideshareLifecycleMachine';

export interface RideshareLifecycleSimulatorProps {
  onClose?: () => void;
}

const STAGES_FLOW: { stage: LifecycleStage; label: string }[] = [
  { stage: 'PROPOSAL', label: '1. Пропозиція' },
  { stage: 'REQUESTED', label: '2. Запит' },
  { stage: 'BOOKING_CONFIRMED', label: '3. Підтверджено' },
  { stage: 'GPS_CONSENT_PENDING', label: '4. Згода GPS' },
  { stage: 'RENDEZVOUS_ACTIVE', label: '5. Зустріч на карті' },
  { stage: 'ARRIVED_AT_PICKUP', label: '6. Прибуття' },
  { stage: 'BOARDING_HANDSHAKE', label: '7. PIN/QR Посадка' },
  { stage: 'IN_TRANSIT', label: '8. Поїздка' },
  { stage: 'COMPLETED', label: '9. Завершено' },
  { stage: 'RATED_AND_HISTORY', label: '10. Оцінка & Історія' },
];

export function RideshareLifecycleSimulator({ onClose }: RideshareLifecycleSimulatorProps) {
  const [state, setState] = useState<RideshareSessionState>(() => createInitialSessionState());
  const [pinInput, setPinInput] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Змінилися плани');
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('Водій приїхав вчасно, авто охайне!');
  const [reviewTags, setReviewTags] = useState<string[]>(['Вчасно', 'Охайне авто', 'Комфортно']);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Sync entered pin from state
  useEffect(() => {
    if (state.enteredPin) {
      setPinInput(state.enteredPin);
    }
  }, [state.enteredPin]);

  const [inlineError, setInlineError] = useState<string | null>(null);

  const dispatch = (action: Parameters<typeof rideshareLifecycleReducer>[1]) => {
    setInlineError(null);
    try {
      const next = rideshareLifecycleReducer(state, action);
      setState(next);
    } catch (err) {
      setInlineError((err as Error).message);
    }
  };

  // Distance & ETA Calculations relative to pickup
  const pickupCoord = state.trip.pickup.coordinates;
  const driverCoord = state.driverTelemetry?.coordinates ?? pickupCoord;
  const passengerCoord = state.passengerTelemetry?.coordinates ?? pickupCoord;

  const driverDistMeters = useMemo(() => calculateStraightLineDistance(driverCoord, pickupCoord), [driverCoord, pickupCoord]);
  const passengerDistMeters = useMemo(() => calculateStraightLineDistance(passengerCoord, pickupCoord), [passengerCoord, pickupCoord]);

  const driverEtaMin = useMemo(() => estimateEtaMinutes(driverDistMeters, 'driving'), [driverDistMeters]);
  const passengerEtaMin = useMemo(() => estimateEtaMinutes(passengerDistMeters, 'walking'), [passengerDistMeters]);

  // Between participants
  const betweenDistMeters = useMemo(() => calculateStraightLineDistance(driverCoord, passengerCoord), [driverCoord, passengerCoord]);

  const isPassenger = state.activeRole === 'passenger';

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Top Banner: Synthetic Demo Indicator & Controls */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-2.5 z-20">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md">
                DEMO SIMULATOR
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
                Синтетичні дані Львів
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
              Повний життєвий цикл попутки без реальних API, GPS чи транзакцій
            </p>
          </div>
        </div>

        {/* Global Simulator Controls */}
        <div className="flex items-center gap-2">
          {/* Role Switcher */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SWITCH_ROLE', role: 'passenger' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                isPassenger
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <User size={13} />
              <span>Пасажир</span>
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SWITCH_ROLE', role: 'driver' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                !isPassenger
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Car size={13} />
              <span>Водій</span>
            </button>
          </div>

          {/* Fault Injector: Offline Toggle */}
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_OFFLINE' })}
            title={state.isOffline ? 'Підключити мережу' : 'Імітувати збій звʼязку (Offline)'}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              state.isOffline
                ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            {state.isOffline ? <WifiOff size={13} /> : <Wifi size={13} />}
            <span className="hidden md:inline">{state.isOffline ? 'Офлайн' : 'Онлайн'}</span>
          </button>

          {/* Fault Injector: Stale GPS */}
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_GPS_STALE', isStale: !state.isSimulatingGpsStale })}
            title="Імітувати втрату свіжих координат GPS"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              state.isSimulatingGpsStale
                ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300'
                : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <Clock size={13} />
            <span className="hidden md:inline">{state.isSimulatingGpsStale ? 'GPS Stale (>30s)' : 'GPS Fresh'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs"
            title="Перемкнути Light / Dark тему"
          >
            {isDarkMode ? '🌙' : '☀️'}
          </button>

          {/* Reset Simulator */}
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET_SIMULATOR' })}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Скинути симулятор до початкового стану"
          >
            <RotateCcw size={14} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Закрити симулятор"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </header>

      {/* Offline Warning Banner */}
      {state.isOffline && (
        <div className="bg-rose-600 text-white text-xs px-4 py-1.5 flex items-center justify-between font-medium">
          <div className="flex items-center gap-1.5">
            <WifiOff size={14} />
            <span>Немає зʼєднання з мережею (Симуляція). Дії на сервері недоступні.</span>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_OFFLINE', isOffline: false })}
            className="underline text-[11px] font-bold"
          >
            Відновити звʼязок
          </button>
        </div>
      )}

      {/* Stage Flow Timeline Navigator */}
      <nav aria-label="Етапи поїздки" className="flex items-center overflow-x-auto border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs scrollbar-none gap-2 z-10">
        {STAGES_FLOW.map((item, index) => {
          const isCurrent = state.stage === item.stage;
          const isPassed = STAGES_FLOW.findIndex((s) => s.stage === state.stage) > index;
          return (
            <div
              key={item.stage}
              className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                isCurrent
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/30'
                  : isPassed
                  ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'
                  : 'bg-transparent text-slate-400 dark:text-slate-500'
              }`}
            >
              {isPassed ? <Check size={12} className="stroke-[3]" /> : null}
              <span>{item.label}</span>
            </div>
          );
        })}
        {state.stage === 'CANCELLED' && (
          <div className="flex items-center gap-1 bg-rose-600 text-white px-2.5 py-1 rounded-lg font-bold">
            <AlertCircle size={12} />
            <span>Скасовано</span>
          </div>
        )}
      </nav>

      {/* Main Body: Dual-Pane or Mobile Stack */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left / Bottom Panel: Interactive Screen for Current Stage */}
        <div className="w-full md:w-[460px] flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-4 sm:p-6 shadow-sm">
          {/* Active View Header */}
          <div className="mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold tracking-wider uppercase text-blue-600 dark:text-blue-400">
                Поточний стан ({isPassenger ? 'Режим пасажира' : 'Режим водія'})
              </p>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {state.stage === 'PROPOSAL' && 'Пропозиція поїздки'}
                {state.stage === 'REQUESTED' && 'Запит на бронювання'}
                {state.stage === 'BOOKING_CONFIRMED' && 'Бронювання підтверджено'}
                {state.stage === 'GPS_CONSENT_PENDING' && 'Згода на обмін геопозицією'}
                {state.stage === 'GPS_DENIED' && 'Режим текстових орієнтирів (GPS вимкнено)'}
                {state.stage === 'RENDEZVOUS_ACTIVE' && 'Взаємне прямування до точки зустрічі'}
                {state.stage === 'ARRIVED_AT_PICKUP' && 'Водій на місці зустрічі'}
                {state.stage === 'BOARDING_HANDSHAKE' && 'Верифікація посадки (PIN / QR)'}
                {state.stage === 'IN_TRANSIT' && 'Поїздка за маршрутом'}
                {state.stage === 'COMPLETED' && 'Прибули в пункт призначення'}
                {state.stage === 'RATED_AND_HISTORY' && 'Поїздку збережено в історію'}
                {state.stage === 'CANCELLED' && 'Поїздку скасовано'}
              </h2>
            </div>
            {state.stage !== 'COMPLETED' && state.stage !== 'RATED_AND_HISTORY' && state.stage !== 'CANCELLED' && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Скасувати
              </button>
            )}
          </div>

          {/* Inline Error Banner for Transition & Action Validation (No crashes on offline/forbidden) */}
          {inlineError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between font-bold shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{inlineError}</span>
              </div>
              <button
                type="button"
                onClick={() => setInlineError(null)}
                className="text-rose-600 dark:text-rose-400 hover:text-rose-800 p-1 rounded-lg"
                aria-label="Закрити повідомлення про помилку"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* STAGE 1: PROPOSAL */}
          {state.stage === 'PROPOSAL' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={state.trip.driver.avatarUrl}
                    alt={state.trip.driver.name}
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-blue-500/30"
                  />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{state.trip.driver.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="flex items-center text-amber-500 font-bold">
                        <Star size={13} className="fill-amber-400 mr-0.5" />
                        {state.trip.driver.rating}
                      </span>
                      <span>•</span>
                      <span>{state.trip.driver.tripsCount} поїздок</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Точка посадки:</span>
                      <p className="text-slate-600 dark:text-slate-400">{state.trip.pickup.label}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CornerDownRight size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Призначення:</span>
                      <p className="text-slate-600 dark:text-slate-400">{state.trip.destination.label}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400">Час виїзду:</span>
                    <p className="font-bold">{state.trip.plannedDepartureTime}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Вільних місць:</span>
                    <p className="font-bold">{state.trip.seatsOffered - state.trip.seatsBooked} з {state.trip.seatsOffered}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Вартість DEMO:</span>
                    <p className="font-black text-sm text-blue-600 dark:text-blue-400">{state.trip.priceUah} ₴</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200">
                <p className="font-bold mb-1">Що робить пасажир?</p>
                <p>Пасажир переглядає деталі поїздки та бронює 1 місце з фіксованою ціною попутки.</p>
              </div>

              <button
                type="button"
                onClick={() => dispatch({ type: 'SUBMIT_REQUEST' })}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md hover:bg-blue-700 active:scale-[0.99] transition-all"
              >
                <span>Надіслати запит на бронювання (1 місце)</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* STAGE 2: REQUESTED */}
          {state.stage === 'REQUESTED' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                  <Clock size={16} className="animate-spin" />
                  <span>Очікування підтвердження водієм</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Запит від <strong>{state.trip.passenger.name}</strong> надіслано водієві {state.trip.driver.name}. Водій має 5 хвилин для підтвердження.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Дія симулятора</span>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Ви можете перемкнутися на роль Водія або натиснути кнопку нижче, щоб симулювати згоду водія:
                </p>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'CONFIRM_BOOKING' })}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow"
                >
                  <Check size={16} />
                  <span>Підтвердити запит (Дія водія)</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: BOOKING_CONFIRMED */}
          {state.stage === 'BOOKING_CONFIRMED' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <CheckCircle2 size={16} />
                  <span>Поїздку успішно підтверджено!</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Місце заброньовано. Перед виїздом сторони можуть узгодити взаємну геопозицію для зручного підʼїзду.
                </p>
              </div>

              <button
                type="button"
                onClick={() => dispatch({ type: 'PROMPT_GPS' })}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow"
              >
                <span>Перейти до узгодження обміну GPS</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* STAGE 4: GPS_CONSENT_PENDING */}
          {state.stage === 'GPS_CONSENT_PENDING' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                  <ShieldCheck size={18} />
                  <span>Приватність та згода на геолокацію</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Позиція передається <strong>лише під час активної зустрічі</strong> та лише за взаємної згоди обох сторін.
                  Дані не зберігаються на сторонніх серверах.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                  {/* Passenger Consent Card */}
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-slate-500 font-bold">1. Пасажир (Дмитро)</p>
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded ${
                        state.passengerGpsConsent ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}>
                        {state.passengerGpsConsent ? '✓ Надано' : '⏳ Очікується'}
                      </span>
                    </div>
                    {!state.passengerGpsConsent ? (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'GRANT_GPS_CONSENT', role: 'passenger' })}
                          className="py-2 px-2.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
                        >
                          Надати згоду
                        </button>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'DENY_GPS_CONSENT', role: 'passenger' })}
                          className="py-2 px-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 font-semibold text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          Відхилити
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Пасажир дозволив разовий обмін геопозицією
                      </p>
                    )}
                  </div>

                  {/* Driver Consent Card */}
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-slate-500 font-bold">2. Водій (Олексій)</p>
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded ${
                        state.driverGpsConsent ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}>
                        {state.driverGpsConsent ? '✓ Надано' : '⏳ Очікується'}
                      </span>
                    </div>
                    {!state.driverGpsConsent ? (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'GRANT_GPS_CONSENT', role: 'driver' })}
                          className="py-2 px-2.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
                        >
                          Надати згоду
                        </button>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'DENY_GPS_CONSENT', role: 'driver' })}
                          className="py-2 px-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 font-semibold text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          Відхилити
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Водій дозволив разовий обмін геопозицією
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Status & Guard for Meeting Unlock */}
              {(!state.passengerGpsConsent || !state.driverGpsConsent) ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 font-medium space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>🔒 Зустріч на карті заблоковано до згоди обох сторін</span>
                  </p>
                  <p className="text-[11px]">
                    {!state.passengerGpsConsent && !state.driverGpsConsent
                      ? 'Очікується дія від пасажира та водія.'
                      : !state.passengerGpsConsent
                      ? 'Очікується дія від пасажира.'
                      : 'Очікується дія від водія.'}
                  </p>
                </div>
              ) : null}

              {/* Explicit Deny fallback button */}
              <button
                type="button"
                onClick={() => dispatch({ type: 'DENY_GPS_CONSENT', role: state.activeRole })}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Не передавати свою геопозицію (текстові орієнтири)
              </button>
            </div>
          )}

          {/* STAGE 4a: GPS_DENIED */}
          {state.stage === 'GPS_DENIED' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                  <AlertTriangle size={16} />
                  <span>Обмін GPS відхилено</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Геолокація вимкнена. Зустріч проводиться за фіксованими орієнтирами посадки.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-800/40 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-400">Фіксоване місце посадки</h4>
                <div className="flex items-center gap-3">
                  <img
                    src={state.trip.pickup.landmarkPhotoUrl}
                    alt="Орієнтир"
                    className="h-16 w-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <div>
                    <p className="font-bold text-sm">{state.trip.pickup.label}</p>
                    <p className="text-xs text-slate-500">{state.trip.pickup.landmarkDescription}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dispatch({ type: 'DRIVER_ARRIVED' })}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all shadow"
              >
                Водій прибув на орієнтир (Симуляція)
              </button>
            </div>
          )}

          {/* STAGE 5: RENDEZVOUS_ACTIVE */}
          {state.stage === 'RENDEZVOUS_ACTIVE' && (
            <div className="space-y-4">
              {/* Telemetry Freshness Badge */}
              <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${state.isSimulatingGpsStale ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                  <span className="font-bold">
                    {state.isSimulatingGpsStale ? 'Втрата свіжих даних GPS (>30s)' : 'Живі дані GPS (Свіжі)'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {state.isSimulatingGpsStale ? 'Остання відома точка' : 'Точність ~5-8 м'}
                </span>
              </div>

              {/* Dynamic ETA & Distance Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40">
                  <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold mb-1">
                    <Car size={14} />
                    <span>Водій до точки</span>
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {formatDistanceUk(driverDistMeters)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    ETA: ~{driverEtaMin} хв (авто)
                  </p>
                </div>

                <div className="p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold mb-1">
                    <User size={14} />
                    <span>Пасажир до точки</span>
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {formatDistanceUk(passengerDistMeters)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    ETA: ~{passengerEtaMin} хв (пішки)
                  </p>
                </div>
              </div>

              {/* Landmark info */}
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center gap-3">
                <img
                  src={state.trip.pickup.landmarkPhotoUrl}
                  alt="Landmark"
                  className="h-14 w-16 rounded-xl object-cover border"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">{state.trip.pickup.label}</p>
                  <p className="text-slate-500 text-[11px]">{state.trip.pickup.landmarkDescription}</p>
                </div>
              </div>

              {/* Quick Communication Chips */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase">Швидкі повідомлення</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Я на місці', 'Трохи запізнююся на 3 хв', 'Стою біля входу ТРЦ'].map((msg) => (
                    <button
                      key={msg}
                      type="button"
                      onClick={() => alert(`Надіслано: "${msg}"`)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs hover:bg-slate-100 font-medium text-slate-700 dark:text-slate-300"
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => dispatch({ type: 'DRIVER_ARRIVED' })}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all shadow"
              >
                Водій прибув у точку зустрічі
              </button>
            </div>
          )}

          {/* STAGE 6: ARRIVED_AT_PICKUP */}
          {state.stage === 'ARRIVED_AT_PICKUP' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <Car size={18} />
                  <span>Водій на місці зустрічі!</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  {state.trip.vehicle.make} {state.trip.vehicle.model} ({state.trip.vehicle.plate}) чекає біля входу.
                </p>
              </div>

              {/* Car photo & Details */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-800/40">
                <img
                  src={state.trip.vehicle.photoUrl}
                  alt={state.trip.vehicle.model}
                  className="h-32 w-full object-cover"
                />
                <div className="p-3 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">{state.trip.vehicle.make} {state.trip.vehicle.model}</p>
                    <p className="text-slate-500">Колір: {state.trip.vehicle.color}</p>
                  </div>
                  <span className="font-mono font-black text-sm px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg border">
                    {state.trip.vehicle.plate}
                  </span>
                </div>
              </div>

              {/* Handshake trigger */}
              <button
                type="button"
                onClick={() => dispatch({ type: 'ENTER_PIN', pin: '' })}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all shadow flex items-center justify-center gap-2"
              >
                <QrCode size={16} />
                <span>Верифікувати посадку (Ввести PIN / QR)</span>
              </button>
            </div>
          )}

          {/* STAGE 7: BOARDING_HANDSHAKE */}
          {state.stage === 'BOARDING_HANDSHAKE' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-sm">
                  <Shield size={16} />
                  <span>Безпечна посадка пасажира</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Пасажир називає або показує 4-значний PIN-код, а водій вводить його для підтвердження того, що це саме ваш пасажир.
                </p>
              </div>

              {/* PIN Display & Input */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-center space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase">
                  {isPassenger ? 'Ваш код посадки для водія:' : 'Введіть код від пасажира:'}
                </p>

                {isPassenger ? (
                  <div className="inline-block py-2 px-6 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800">
                    <span className="font-mono text-3xl font-black tracking-widest text-blue-600 dark:text-blue-400">
                      {state.trip.verificationPin}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value);
                        dispatch({ type: 'ENTER_PIN', pin: e.target.value });
                      }}
                      placeholder="Введіть 4 цифри (4819)"
                      className="w-48 text-center font-mono text-2xl font-black tracking-widest py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {state.pinError && (
                      <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        {state.pinError}
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'CONFIRM_BOARDING_QR' })}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 underline"
                  >
                    <QrCode size={13} />
                    <span>Відсканувати QR замість PIN</span>
                  </button>
                </div>
              </div>

              {/* Fallback button to advance with valid PIN */}
              <button
                type="button"
                onClick={() => dispatch({ type: 'ENTER_PIN', pin: state.trip.verificationPin })}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all shadow flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                <span>Підтвердити правильний PIN ({state.trip.verificationPin})</span>
              </button>
            </div>
          )}

          {/* STAGE 8: IN_TRANSIT */}
          {state.stage === 'IN_TRANSIT' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-sm">
                    <Navigation size={16} className="animate-pulse" />
                    <span>Поїздка в процесі</span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">
                    Швидкість: 46 км/год
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full w-[65%]" />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Малоголосківська</span>
                  <span>Наукова (~12 хв)</span>
                </div>
              </div>

              {/* Safety controls during ride */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowSosModal(true)}
                  className="p-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold flex items-center justify-center gap-1.5"
                >
                  <ShieldAlert size={15} />
                  <span>Кнопка SOS</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert('Посилання на живий трек поїздки скопійовано в буфер (DEMO)')}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={15} />
                  <span>Поділитися поїздкою</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => dispatch({ type: 'COMPLETE_RIDE' })}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all shadow flex items-center justify-center gap-2"
              >
                <Check size={16} />
                <span>Прибули в пункт призначення (Завершити поїздку)</span>
              </button>
            </div>
          )}

          {/* STAGE 9: COMPLETED */}
          {state.stage === 'COMPLETED' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <CheckCircle2 size={18} />
                  <span>Поїздку успішно завершено!</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Ви прибули за адресою: {state.trip.destination.label}. Вартість: {state.trip.priceUah} ₴ (DEMO).
                </p>
              </div>

              {/* Review and Rating Form */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase">Оцініть поїздку</h4>

                {/* Stars */}
                <div className="flex items-center justify-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewStars(star)}
                      className="p-1 text-amber-400 hover:scale-110 transition-transform"
                    >
                      <Star
                        size={28}
                        className={star <= reviewStars ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}
                      />
                    </button>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {['Вчасно', 'Охайне авто', 'Комфортно', 'Приємна музика', 'Ввічливість'].map((tag) => {
                    const isSelected = reviewTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setReviewTags((prev) =>
                            isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                          );
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>

                {/* Comment */}
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Залиште коментар (опціонально)..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                />

                <button
                  type="button"
                  onClick={() => {
                    dispatch({
                      type: 'SUBMIT_RATING',
                      stars: reviewStars,
                      tags: reviewTags,
                      comment: reviewComment,
                    });
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors shadow"
                >
                  Зберегти відгук та записати в історію
                </button>
              </div>
            </div>
          )}

          {/* STAGE 10: RATED_AND_HISTORY */}
          {state.stage === 'RATED_AND_HISTORY' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <CheckCircle2 size={18} />
                  <span>Поїздку збережено в локальну історію</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Оцінка: {state.ratingStars}★. Відгук збережено.
                </p>
              </div>

              {/* History Entry Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold">{state.trip.pickup.label} → {state.trip.destination.label}</span>
                  <span className="font-black text-blue-600 dark:text-blue-400">{state.trip.priceUah} ₴</span>
                </div>
                <p className="text-slate-500 text-[11px]">Водій: {state.trip.driver.name} ({state.trip.vehicle.make} {state.trip.vehicle.model})</p>
                <div className="flex items-center gap-1 text-amber-500 font-bold">
                  {[...Array(state.ratingStars)].map((_, i) => (
                    <Star key={i} size={13} className="fill-amber-400" />
                  ))}
                  <span className="text-slate-600 dark:text-slate-400 text-xs ml-1">"{state.ratingComment}"</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dispatch({ type: 'RESET_SIMULATOR' })}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-opacity"
              >
                Почати новий сеанс симулятора
              </button>
            </div>
          )}

          {/* STAGE: CANCELLED */}
          {state.stage === 'CANCELLED' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-sm">
                  <AlertCircle size={18} />
                  <span>Поїздку скасовано</span>
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-400">
                  Причина: {state.cancellationReason ?? 'Не вказана'}. Ініціатор: {state.cancelledByRole === 'driver' ? 'Водій' : 'Пасажир'}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => dispatch({ type: 'RESET_SIMULATOR' })}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-opacity"
              >
                Перезапустити симулятор
              </button>
            </div>
          )}

          {/* Audit History Log */}
          <div className="mt-auto pt-6">
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-bold hover:text-slate-700 dark:hover:text-slate-300">
                Журнал переходів стану ({state.historyLog.length})
              </summary>
              <div className="mt-2 space-y-1 max-h-36 overflow-y-auto font-mono text-[11px] p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {state.historyLog.length === 0 && <p className="text-slate-400">Подій ще немає</p>}
                {state.historyLog.map((log, idx) => (
                  <div key={idx} className="border-b border-slate-200/50 dark:border-slate-700/50 pb-1">
                    <span className="text-blue-500 font-bold">{log.fromStage} → {log.toStage}</span>: {log.action}
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>

        {/* Right / Top Panel: Interactive Synthetic Vector Map */}
        <div className="flex-1 relative bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4 overflow-hidden min-h-[300px]">
          {/* Map Overlay Badge */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs font-bold">
              <Compass size={14} className="text-blue-500" />
              <span>Львів: Малоголосківська ↔ Наукова</span>
            </div>
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-lg border text-[11px] text-slate-500 font-mono">
              Пряма дистанція між учасниками: {formatDistanceUk(betweenDistMeters)}
            </div>
          </div>

          {/* Synthetic Vector Map Viewport */}
          <div className="relative w-full max-w-lg aspect-square max-h-[500px] rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden flex items-center justify-center">
            {/* SVG Roads & Grid */}
            <svg className="absolute inset-0 w-full h-full stroke-slate-200 dark:stroke-slate-800" strokeWidth="1">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              {/* Simulated streets */}
              <line x1="20%" y1="10%" x2="80%" y2="90%" stroke="#94a3b8" strokeWidth="4" strokeDasharray="6 4" />
              <line x1="10%" y1="60%" x2="90%" y2="40%" stroke="#94a3b8" strokeWidth="3" />
            </svg>

            {/* Central Pickup Waypoint */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center pointer-events-none">
              <div className="relative flex items-center justify-center">
                <span className="absolute h-10 w-10 rounded-full bg-blue-500/20 animate-ping" />
                <div className="h-7 w-7 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-white">
                  <MapPin size={15} />
                </div>
              </div>
              <span className="mt-1 font-bold text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded shadow">
                Точка зустрічі
              </span>
            </div>

            {/* Driver Marker */}
            {state.driverGpsConsent && (
              <div
                className="absolute z-20 flex flex-col items-center transition-all duration-700 pointer-events-none"
                style={{
                  top: state.stage === 'ARRIVED_AT_PICKUP' || state.stage === 'BOARDING_HANDSHAKE' ? '48%' : '26%',
                  left: state.stage === 'ARRIVED_AT_PICKUP' || state.stage === 'BOARDING_HANDSHAKE' ? '50%' : '32%',
                }}
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-500 border-2 border-white shadow-lg text-white">
                  <Car size={16} />
                </div>
                <span className="mt-0.5 font-bold text-[10px] bg-amber-600 text-white px-1.5 py-0.2 rounded shadow">
                  Водій ({formatDistanceUk(driverDistMeters)})
                </span>
              </div>
            )}

            {/* Passenger Marker */}
            {state.passengerGpsConsent && (
              <div
                className="absolute z-20 flex flex-col items-center transition-all duration-700 pointer-events-none"
                style={{
                  top: state.stage === 'ARRIVED_AT_PICKUP' || state.stage === 'BOARDING_HANDSHAKE' ? '52%' : '74%',
                  left: state.stage === 'ARRIVED_AT_PICKUP' || state.stage === 'BOARDING_HANDSHAKE' ? '50%' : '68%',
                }}
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500 border-2 border-white shadow-lg text-white">
                  <User size={16} />
                </div>
                <span className="mt-0.5 font-bold text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded shadow">
                  Ви ({formatDistanceUk(passengerDistMeters)})
                </span>
              </div>
            )}

            {/* Landmark fallback graphic if GPS denied */}
            {state.stage === 'GPS_DENIED' && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center text-white">
                <MapPin size={36} className="text-amber-400 mb-2 animate-bounce" />
                <h3 className="font-extrabold text-base mb-1">Режим фіксованих орієнтирів</h3>
                <p className="text-xs text-slate-300 max-w-xs mb-3">
                  Живу карту вимкнено через відмову GPS. Зустріч відбувається за текстовим орієнтиром:
                </p>
                <div className="bg-white/10 p-3 rounded-2xl border border-white/20 text-xs text-left max-w-xs">
                  <p className="font-bold">{state.trip.pickup.label}</p>
                  <p className="text-slate-300 text-[11px]">{state.trip.pickup.landmarkDescription}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 text-[11px] text-slate-400 text-center">
            Синтетична картографічна проекція з перевіркою свіжості координат (Freshness)
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Скасувати поїздку?</h3>
            <p className="text-xs text-slate-500">Оберіть причину скасування:</p>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
            >
              <option value="Змінилися плани">Змінилися плани</option>
              <option value="Водій затримується">Водій затримується</option>
              <option value="Не можу знайти точку зустрічі">Не можу знайти точку зустрічі</option>
              <option value="Інша причина">Інша причина</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  dispatch({ type: 'CANCEL_RIDE', reason: cancelReason, role: state.activeRole });
                }}
                className="py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
              >
                Так, скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOS Modal */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-rose-300 dark:border-rose-900 space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600">
              <ShieldAlert size={24} />
            </div>
            <h3 className="font-black text-base text-slate-900 dark:text-white">Екстрена допомога (SOS)</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              У випадку небезпеки звʼяжіться з екстреними службами або довіреним контактом:
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => alert('Виклик 112 (DEMO SIMULATOR)')}
                className="w-full py-3 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                Зателефонувати 112 (Служба порятунку)
              </button>
              <button
                type="button"
                onClick={() => setShowSosModal(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
