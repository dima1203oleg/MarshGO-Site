import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircleUserRound, Home, Plus, Search, Ticket } from 'lucide-react';
import type { ApiJourney } from '../../src/services/productionApi';
import { JourneyActiveNavigation } from '../../src/views/JourneyActiveNavigation';
import '../../src/index.css';

// This route is deliberately invented and visibly disclosed as synthetic. It exercises
// the production camera/preview path without a login, server journey, or fabricated GPS.
const base = '2026-11-11T08:';
const journey = {
  id: 'visual-only-hyperflight', offerId: null, strategy: 'BALANCED', state: 'READY',
  totalDurationSeconds: 2_820, requestedDepartureAt: `${base}00:00+02:00`, waitingSeconds: 240,
  totalPriceMinor: 6_000, confirmedPriceMinor: 6_000, estimatedPriceMinMinor: null,
  estimatedPriceMaxMinor: null, walkingMeters: 640, transfers: 1, reliabilityScore: null,
  currency: 'UAH', priceStatus: 'LOCKED', legs: [
    {
      id: 'synthetic-walk-access', mode: 'WALK', transportType: 'walk', offerId: null,
      origin: { name: 'Тестовий початок', coordinates: [24.027, 49.842] },
      destination: { name: 'Тестова зупинка', coordinates: [24.026, 49.841] },
      departureAt: `${base}00:00+02:00`, arrivalAt: `${base}04:00+02:00`, durationSeconds: 240,
      distanceMeters: 135, priceMinor: 0, priceStatus: 'LOCKED', availabilityStatus: 'AVAILABLE',
      source: 'synthetic-visual-fixture', lastUpdatedAt: `${base}00:00+02:00`, routeAccuracy: 'VERIFIED',
      routeGeometry: [[24.027, 49.842], [24.0267, 49.8417], [24.026, 49.841]], driver: null, vehicle: null,
    },
    {
      id: 'synthetic-bus-a53', mode: 'BUS', transportType: 'bus', routeName: 'А53', offerId: null,
      origin: { name: 'Тестова зупинка', coordinates: [24.026, 49.841] },
      destination: { name: 'Тестова пересадка', coordinates: [24.032, 49.836] },
      departureAt: `${base}04:00+02:00`, arrivalAt: `${base}24:00+02:00`, durationSeconds: 1_200,
      distanceMeters: 1_850, priceMinor: 6_000, priceStatus: 'LOCKED', availabilityStatus: 'AVAILABLE',
      source: 'synthetic-visual-fixture', lastUpdatedAt: `${base}00:00+02:00`, headsign: 'Тестова пересадка', routeAccuracy: 'VERIFIED',
      routeGeometry: [[24.026, 49.841], [24.027, 49.84], [24.029, 49.839], [24.028, 49.8375], [24.03, 49.8365], [24.032, 49.836]], driver: null, vehicle: null,
    },
    {
      id: 'synthetic-walk-transfer', mode: 'WALK', transportType: 'walk', offerId: null,
      origin: { name: 'Тестова пересадка', coordinates: [24.032, 49.836] },
      destination: { name: 'Тестова платформа', coordinates: [24.0327, 49.8355] },
      departureAt: `${base}24:00+02:00`, arrivalAt: `${base}27:00+02:00`, durationSeconds: 180,
      distanceMeters: 92, priceMinor: 0, priceStatus: 'LOCKED', availabilityStatus: 'AVAILABLE',
      source: 'synthetic-visual-fixture', lastUpdatedAt: `${base}00:00+02:00`, routeAccuracy: 'VERIFIED',
      routeGeometry: [[24.032, 49.836], [24.0324, 49.8358], [24.0327, 49.8355]], driver: null, vehicle: null,
    },
    {
      id: 'synthetic-tram-8', mode: 'TRAM', transportType: 'tram', routeName: '№8', offerId: null,
      origin: { name: 'Тестова платформа', coordinates: [24.0327, 49.8355] },
      destination: { name: 'Тестовий фініш', coordinates: [24.039, 49.831] },
      departureAt: `${base}27:00+02:00`, arrivalAt: `${base}44:00+02:00`, durationSeconds: 1_020,
      distanceMeters: 1_750, priceMinor: 0, priceStatus: 'LOCKED', availabilityStatus: 'AVAILABLE',
      source: 'synthetic-visual-fixture', lastUpdatedAt: `${base}00:00+02:00`, headsign: 'Тестовий фініш', routeAccuracy: 'VERIFIED',
      routeGeometry: [[24.0327, 49.8355], [24.034, 49.8348], [24.035, 49.834], [24.036, 49.833], [24.0375, 49.832], [24.039, 49.831]], driver: null, vehicle: null,
    },
    {
      id: 'synthetic-walk-egress', mode: 'WALK', transportType: 'walk', offerId: null,
      origin: { name: 'Тестовий фініш', coordinates: [24.039, 49.831] },
      destination: { name: 'Тестове призначення', coordinates: [24.040, 49.830] },
      departureAt: `${base}44:00+02:00`, arrivalAt: `${base}48:00+02:00`, durationSeconds: 240,
      distanceMeters: 145, priceMinor: 0, priceStatus: 'LOCKED', availabilityStatus: 'AVAILABLE',
      source: 'synthetic-visual-fixture', lastUpdatedAt: `${base}00:00+02:00`, routeAccuracy: 'VERIFIED',
      routeGeometry: [[24.039, 49.831], [24.0395, 49.8305], [24.040, 49.830]], driver: null, vehicle: null,
    },
  ],
} as unknown as ApiJourney;

function Fixture() {
  const [previewLeg, setPreviewLeg] = useState(0);
  useEffect(() => {
    document.title = `MARSHGO — HyperFlight preview · етап ${previewLeg + 1}/5 · GPS без змін`;
    const disclosure = document.getElementById('fixture-disclosure');
    if (disclosure) disclosure.textContent = `ДЕМО · тестові дані · GPS вимкнено · ${previewLeg + 1}/5`;
  }, [previewLeg]);
  return <main className="production-app route-immersive-shell min-h-[100svh]">
    <output aria-label="Стан тестового перегляду" data-testid="hyperflight-fixture-state" className="sr-only">
      Переглядається етап {previewLeg + 1} із 5. Геолокація не передається.
    </output>
    <JourneyActiveNavigation journey={journey} reserveBottomNavigation onExit={() => undefined} onPreviewStageChange={setPreviewLeg}/>
    <nav data-testid="global-bottom-navigation" aria-label="Основна навігація — візуальний макет" className="app-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pt-2 backdrop-blur-xl">
      <div className="app-tabbar-inner mx-auto grid w-full max-w-xl grid-cols-5 items-center px-1">
        <div className="flex flex-col items-center gap-1 px-1 py-1 text-[var(--mg-blue-ink)]"><Home size={20}/><span className="text-xs font-semibold">Головна</span></div>
        <div className="flex flex-col items-center gap-1 px-1 py-1 text-[var(--mg-ink-secondary)]"><Search size={20}/><span className="text-xs font-semibold">Пошук</span></div>
        <div className="app-create-button -mt-5 grid h-14 w-14 place-items-center justify-self-center rounded-full bg-[var(--mg-action)] text-white shadow-lg shadow-[#0B63D6]/30"><Plus size={25}/></div>
        <div className="flex flex-col items-center gap-1 px-1 py-1 text-[var(--mg-ink-secondary)]"><Ticket size={20}/><span className="text-xs font-semibold">Поїздки</span></div>
        <div className="flex flex-col items-center gap-1 px-1 py-1 text-[var(--mg-ink-secondary)]"><CircleUserRound size={20}/><span className="text-xs font-semibold">Профіль</span></div>
      </div>
    </nav>
  </main>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing HyperFlight preview root');
const fixtureWindow = window as Window & { __marshgoHyperflightRoot?: ReturnType<typeof createRoot> };
const fixtureRoot = fixtureWindow.__marshgoHyperflightRoot ??= createRoot(root);
fixtureRoot.render(<StrictMode><Fixture/></StrictMode>);
