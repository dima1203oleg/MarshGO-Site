import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Navigation,
  Compass,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Volume2,
  VolumeX,
  Play,
  Square,
  Users,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { NavigationSession, MatchCandidate } from '../types';
import { MapPreview } from '../components/MapPreview';

interface NavigationViewProps {
  session: NavigationSession | null;
  onStartSession: (origin: string, destination: string) => void;
  onEndSession: () => void;
  onToggleOptIn: (enabled: boolean) => void;
  onAcceptCandidate: (candidateId: string) => void;
  onBack: () => void;
}

export const NavigationView: React.FC<NavigationViewProps> = ({
  session,
  onStartSession,
  onEndSession,
  onToggleOptIn,
  onAcceptCandidate,
  onBack
}) => {
  const [origin, setOrigin] = useState('Стрий');
  const [destination, setDestination] = useState('Львів');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSimulatedSpeed, setIsSimulatedSpeed] = useState(true);
  const [gpsStale, setGpsStale] = useState(false);
  const [dismissedCandidates, setDismissedCandidates] = useState<string[]>([]);
  const [acceptedNotice, setAcceptedNotice] = useState<string | null>(null);

  // Monitor visibility / background tab state (Foreground Beta requirement)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && session && session.matchmakingOptIn) {
        setGpsStale(true);
      } else {
        setGpsStale(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session]);

  const activeCandidate = session?.candidates.find(
    (c) => c.status === 'suggested' && !dismissedCandidates.includes(c.id)
  );

  const handleAccept = (candidate: MatchCandidate) => {
    onAcceptCandidate(candidate.id);
    setAcceptedNotice(`🎉 Додано зупинку: ${candidate.origin}. Маршрут перебудовано! (+${candidate.detourMinutes} хв, +${candidate.offeredBudget} грн)`);
    setTimeout(() => setAcceptedNotice(null), 5000);
  };

  const handleDismiss = (candidateId: string) => {
    setDismissedCandidates((prev) => [...prev, candidateId]);
  };

  return (
    <div className="min-h-screen bg-[#081B35] text-white flex flex-col pb-20 md:pb-8">
      {/* Top Navigation HUD Bar */}
      <div className="sticky top-0 z-30 bg-[#081B35]/95 backdrop-blur-md border-b border-[#1E293B] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Вийти з навігатора</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#38BDF8]">MARSHGO Navigation</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-[#38BDF8] border border-blue-500/30">
              Foreground Beta
            </span>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            aria-label="Звукові сповіщення"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-4 space-y-4 flex-1">
        {/* Background / Stale GPS Warning Banner */}
        {gpsStale && (
          <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2 animate-pulse">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Вкладку було згорнуто. Відповідно до правил безпеки Web GPS, підбір попутників призупинено до відновлення активного екрана.
            </span>
          </div>
        )}

        {/* Accepted toast alert */}
        {acceptedNotice && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold animate-fadeIn">
            {acceptedNotice}
          </div>
        )}

        {/* Main Route Map Container */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
          <MapPreview
            origin={session?.origin || origin}
            destination={session?.destination || destination}
            intermediateStops={session?.waypointStops.map((w) => w.name).slice(1, -1)}
            activeDetour={
              session?.matchmakingOptIn && activeCandidate
                ? {
                    minutes: activeCandidate.detourMinutes,
                    km: activeCandidate.detourKm,
                    pickupName: activeCandidate.origin,
                    dropoffName: activeCandidate.destination
                  }
                : undefined
            }
            className="h-80 sm:h-96"
          />

          {/* Foreground Beta status badge */}
          <div className="absolute top-12 left-3 z-20 flex items-center gap-2 bg-[#081B35]/80 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-700 text-[11px] text-slate-300">
            <div className={`w-2 h-2 rounded-full ${session ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`} />
            <span>{isSimulatedSpeed ? 'GPS Симуляція М-06' : 'Web Geolocation Live'}</span>
          </div>
        </div>

        {/* Navigation Control Panel */}
        {!session ? (
          /* Start navigation form */
          <div className="bg-[#0F284E] rounded-2xl border border-slate-700 p-5 space-y-4 shadow-lg">
            <div>
              <h2 className="text-base font-extrabold text-white">Побудова маршруту водія</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Введіть кінцеву точку. Навігатор побудує реальний автомобільний шлях. Оголошення створювати не потрібно!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Звідки:</label>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#081B35] border border-slate-600">
                  <MapPin className="w-4 h-4 text-[#1769F4]" />
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full text-xs font-bold text-white bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Куди:</label>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#081B35] border border-slate-600">
                  <MapPin className="w-4 h-4 text-[#16845C]" />
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full text-xs font-bold text-white bg-transparent focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => onStartSession(origin, destination)}
              className="w-full py-3.5 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white font-extrabold text-sm shadow-lg shadow-[#1769F4]/30 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Почати навігацію (Стрий → Львів)</span>
            </button>
          </div>
        ) : (
          /* Active Navigation HUD with Detour Prompt and Toggle */
          <div className="space-y-4">
            {/* Live stats HUD */}
            <div className="grid grid-cols-3 gap-3 bg-[#0F284E] rounded-2xl border border-slate-700 p-4 text-center">
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Залишилось</div>
                <div className="text-xl font-extrabold text-white tabular-nums">
                  {session.remainingDurationMinutes} хв
                </div>
              </div>
              <div className="border-x border-slate-700">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Відстань</div>
                <div className="text-xl font-extrabold text-[#38BDF8] tabular-nums">
                  {session.remainingDistanceKm} км
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Швидкість</div>
                <div className="text-xl font-extrabold text-emerald-400 tabular-nums">
                  85 км/год
                </div>
              </div>
            </div>

            {/* MANDATORY OPT-IN TOGGLE (Default OFF) */}
            <div className="bg-[#0F284E] rounded-2xl border border-slate-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">Підбирати попутників дорогою</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-[#38BDF8]">
                      Opt-in
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Дозволити алгоритму шукати заявки вздовж коридору траси (без публічного стеження).
                  </p>
                </div>

                {/* Toggle switch */}
                <button
                  type="button"
                  onClick={() => onToggleOptIn(!session.matchmakingOptIn)}
                  className={`w-14 h-8 rounded-full transition-colors p-1 flex items-center ${
                    session.matchmakingOptIn ? 'bg-[#16845C] justify-end' : 'bg-slate-700 justify-start'
                  }`}
                  aria-label="Увімкнути підбір попутників"
                >
                  <div className="w-6 h-6 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {!session.matchmakingOptIn && (
                <div className="text-[11px] text-slate-400 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700">
                  Режим підбору попутників вимкнено. Ви їдете приватно. Увімкніть тумблер вище, якщо хочете взяти попутника та розділити витрати на пальне.
                </div>
              )}
            </div>

            {/* ACTIVE CORRIDOR MATCH CANDIDATE PROMPT (FLOW D) */}
            {session.matchmakingOptIn && activeCandidate && (
              <div className="bg-gradient-to-r from-[#1769F4]/20 via-[#0F284E] to-[#16845C]/20 rounded-2xl border-2 border-[#1769F4] p-5 shadow-2xl space-y-4 animate-slideUp">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={activeCandidate.passengerAvatar}
                      alt={activeCandidate.passengerName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-[#38BDF8]"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-400">По дорозі є пасажир!</span>
                        <span className="text-[10px] font-bold px-1.5 rounded bg-emerald-500/20 text-emerald-300">
                          В коридорі траси
                        </span>
                      </div>
                      <h4 className="text-base font-extrabold text-white mt-0.5">
                        {activeCandidate.passengerName} ({activeCandidate.passengerCount} пас.)
                      </h4>
                      <div className="text-xs text-slate-300">
                        {activeCandidate.origin} → {activeCandidate.destination}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-300">Бюджет:</div>
                    <div className="text-xl font-black text-emerald-400 tabular-nums">
                      +{activeCandidate.offeredBudget} грн
                    </div>
                  </div>
                </div>

                {/* Road Detour Specs */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-[#081B35]/70 p-3 rounded-xl border border-slate-700">
                  <div>
                    <span className="text-slate-400">Додатковий час: </span>
                    <strong className="text-amber-400 font-bold">+{activeCandidate.detourMinutes} хвилини</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Відхилення: </span>
                    <strong className="text-[#38BDF8] font-bold">+{activeCandidate.detourKm} км</strong>
                  </div>
                </div>

                {/* Driving-safe large touch action buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => handleDismiss(activeCandidate.id)}
                    className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95"
                  >
                    <X className="w-4 h-4" />
                    <span>Пропустити</span>
                  </button>

                  <button
                    onClick={() => handleAccept(activeCandidate)}
                    className="py-3 rounded-xl bg-[#16845C] hover:bg-[#126b4a] text-white text-xs font-extrabold shadow-lg shadow-emerald-700/30 transition flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Check className="w-5 h-5 stroke-[3]" />
                    <span>Забрати (+{activeCandidate.offeredBudget} грн)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Waypoints list */}
            {session.waypointStops.length > 2 && (
              <div className="bg-[#0F284E] rounded-xl p-3 border border-slate-700 text-xs space-y-2">
                <span className="font-bold text-slate-300">Активні точки маршруту з пасажирами:</span>
                <div className="space-y-1">
                  {session.waypointStops.map((wp, i) => (
                    <div key={wp.id} className="flex items-center gap-2 text-slate-300">
                      <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-white">{wp.name}</span>
                      {wp.passengerName && (
                        <span className="text-[11px] text-[#38BDF8]">({wp.passengerName})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* End Navigation Action */}
            <button
              onClick={onEndSession}
              className="w-full py-3 rounded-xl bg-red-600/80 hover:bg-red-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Завершити навігацію (Зупинити GPS)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
