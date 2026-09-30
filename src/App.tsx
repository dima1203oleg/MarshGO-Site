import React, { useState, useEffect, Suspense } from 'react';
import { storage } from './services/storage';
import { usePWA } from './services/pwa';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { ActionDrawer } from './components/ActionDrawer';
import { PWAInstallModal } from './components/PWAInstallModal';
import { OnboardingTour } from './components/OnboardingTour';

const HomeView = React.lazy(() => import('./views/HomeView').then((module) => ({ default: module.HomeView })));
const SearchView = React.lazy(() => import('./views/SearchView').then((module) => ({ default: module.SearchView })));
const OfferDetailView = React.lazy(() => import('./views/OfferDetailView').then((module) => ({ default: module.OfferDetailView })));
const DemandNewView = React.lazy(() => import('./views/DemandNewView').then((module) => ({ default: module.DemandNewView })));
const DemandDetailView = React.lazy(() => import('./views/DemandDetailView').then((module) => ({ default: module.DemandDetailView })));
const DriverDashboardView = React.lazy(() => import('./views/DriverDashboardView').then((module) => ({ default: module.DriverDashboardView })));
const DriverRequestsView = React.lazy(() => import('./views/DriverRequestsView').then((module) => ({ default: module.DriverRequestsView })));
const DriverOfferNewView = React.lazy(() => import('./views/DriverOfferNewView').then((module) => ({ default: module.DriverOfferNewView })));
const DriverVehicleView = React.lazy(() => import('./views/DriverVehicleView').then((module) => ({ default: module.DriverVehicleView })));
const NavigationView = React.lazy(() => import('./views/NavigationView').then((module) => ({ default: module.NavigationView })));
const MyTripsView = React.lazy(() => import('./views/MyTripsView').then((module) => ({ default: module.MyTripsView })));
const MessagesView = React.lazy(() => import('./views/MessagesView').then((module) => ({ default: module.MessagesView })));
const ProfileView = React.lazy(() => import('./views/ProfileView').then((module) => ({ default: module.ProfileView })));
const AdminView = React.lazy(() => import('./views/AdminView').then((module) => ({ default: module.AdminView })));

import { TransportCategory, Booking } from './types';
import { WifiOff } from 'lucide-react';
import { themeService } from './services/theme';
import { ProductionMarketplace } from './views/ProductionMarketplace';

export function App() {
  if (import.meta.env.PROD) return <ProductionMarketplace />;
  return <DemoApp />;
}

function DemoApp() {
  const [, setTick] = useState(0);

  // Subscribe to storage and theme changes for reactive state across all components
  useEffect(() => {
    const unsubStorage = storage.subscribe(() => setTick((t) => t + 1));
    const unsubTheme = themeService.subscribe(() => setTick((t) => t + 1));
    return () => {
      unsubStorage();
      unsubTheme();
    };
  }, []);

  // Navigation State
  const [currentView, setCurrentView] = useState<string>('home');
  const [searchCategory, setSearchCategory] = useState<TransportCategory>('all');
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [selectedDemandId, setSelectedDemandId] = useState<string>('');
  const [lastBooking, setLastBooking] = useState<Booking | null>(null);

  // Search parameters
  const [searchParams, setSearchParams] = useState({
    origin: 'Одеса',
    destination: 'Київ',
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date()),
    passengers: 2
  });

  // Action Drawer & PWA Modals
  const [isActionDrawerOpen, setIsActionDrawerOpen] = useState(false);
  const [isPWAModalOpen, setIsPWAModalOpen] = useState(false);

  // Onboarding Tour state (active for new users, dismissible, replayable anytime)
  const [isOnboardingTourOpen, setIsOnboardingTourOpen] = useState<boolean>(() => {
    try {
      const completed = localStorage.getItem('mg_onboarding_completed');
      return !completed;
    } catch {
      return false;
    }
  });

  const handleStartTour = () => {
    setCurrentView('home');
    setIsOnboardingTourOpen(true);
  };

  // PWA hook
  const { isInstallable, isInstalled, isIOS, isOnline, install } = usePWA();

  // Load current data from storage
  const user = storage.getUser();
  const vehicle = storage.getVehicle();
  const vehicles = storage.getVehicles();
  const activeVehicleId = storage.getActiveVehicleId();
  const offers = storage.getOffers();
  const demands = storage.getDemands();
  const bookings = storage.getBookings();
  const navSession = storage.getActiveNavSession();
  const demoMode = storage.getDemoMode();
  const selectedOffer = storage.getOfferById(selectedOfferId);
  const selectedDemand = storage.getDemandById(selectedDemandId);

  // Handlers
  const handleSearchSubmit = (params: { origin: string; destination: string; date: string; passengers: number }) => {
    setSearchParams(params);
    setCurrentView('search');
  };

  const handleSelectOffer = (offerId: string) => {
    setSelectedOfferId(offerId);
    setCurrentView('offer-detail');
  };

  const handleBookOffer = (offerId: string, seats: number) => {
    try {
      const booking = storage.bookOffer(offerId, seats);
      setLastBooking(booking);
    } catch {
      // In-app error handling without window.alert
    }
  };

  const handleCreateDemandFromSearch = (params: { origin: string; destination: string; date: string; passengers: number }) => {
    setSearchParams(params);
    setCurrentView('demand-new');
  };

  const handleDemandCreated = (params: any) => {
    const demand = storage.createDemand(params);
    setSelectedDemandId(demand.id);
    setCurrentView('demand-detail');
  };

  const handleAcceptProposal = (proposalId: string) => {
    const booking = storage.acceptProposal(proposalId);
    setLastBooking(booking);
  };

  const handleCounterOffer = (proposalId: string, amount: number, comment?: string) => {
    storage.counterOffer(proposalId, amount, comment);
  };

  const handleDriverOfferCreated = (offerData: any) => {
    storage.createOffer(offerData);
    setCurrentView('search');
  };

  const handleResetData = () => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('mg_')) localStorage.removeItem(key);
    }
    window.location.reload();
  };

  const isDriver = user.activeRole === 'driver';

  return (
    <div className="min-h-screen bg-[#F5F8FD] flex flex-col font-sans selection:bg-[#1769F4] selection:text-white">
      {/* Offline Status Warning */}
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs font-semibold px-4 py-2 text-center flex items-center justify-center gap-2 sticky top-0 z-50 shadow">
          <WifiOff className="w-4 h-4 animate-pulse" />
          <span>Офлайн режим — відображаються збережені дані та маршрути.</span>
        </div>
      )}

      {/* Top Header */}
      <AppHeader
        user={user}
        onRoleSwitch={(role) => storage.switchRole(role)}
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenInstall={() => setIsPWAModalOpen(true)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        demoMode={demoMode}
        onToggleDemo={() => storage.setDemoMode(!demoMode)}
        onStartTour={handleStartTour}
      />

      {/* View Router */}
      <div className="flex-1">
        <Suspense fallback={<div role="status" className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-4 text-sm font-semibold text-slate-500">Завантажуємо розділ…</div>}>
        {currentView === 'home' && (
          <HomeView
            onSearch={handleSearchSubmit}
            onNavigate={(view) => setCurrentView(view)}
            onCategoryClick={(category) => {
              setSearchCategory(category);
              setCurrentView('search');
            }}
          />
        )}

        {currentView === 'search' && (
          <SearchView
            offers={offers}
            searchParams={searchParams}
            initialCategory={searchCategory}
            onSelectOffer={handleSelectOffer}
            onCreateDemandFromSearch={handleCreateDemandFromSearch}
            onBack={() => setCurrentView('home')}
          />
        )}

        {currentView === 'offer-detail' && selectedOffer && (
          <OfferDetailView
            offer={selectedOffer}
            onBack={() => setCurrentView('search')}
            onBook={handleBookOffer}
            bookingSuccess={lastBooking}
            onViewBooking={() => setCurrentView('trips')}
          />
        )}
        {currentView === 'offer-detail' && !selectedOffer && (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Поїздку не знайдено</h2>
            <p className="mt-2 text-sm text-slate-500">Оголошення могло стати недоступним або посилання застаріло.</p>
            <button onClick={() => setCurrentView('search')} className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Повернутися до пошуку</button>
          </div>
        )}

        {currentView === 'demand-new' && (
          <DemandNewView
            initialRoute={searchParams}
            onBack={() => setCurrentView('home')}
            onCreated={handleDemandCreated}
          />
        )}

        {currentView === 'demand-detail' && selectedDemand && (
          <DemandDetailView
            demand={selectedDemand}
            proposals={storage.getProposalsForDemand(selectedDemandId)}
            onBack={() => setCurrentView('home')}
            onAcceptProposal={handleAcceptProposal}
            onCounterOffer={handleCounterOffer}
            onOpenChat={() => setCurrentView('messages')}
          />
        )}
        {currentView === 'demand-detail' && !selectedDemand && (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Запит не знайдено</h2>
            <p className="mt-2 text-sm text-slate-500">Він міг бути скасований або посилання застаріло.</p>
            <button onClick={() => setCurrentView('home')} className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">На головну</button>
          </div>
        )}

        {currentView === 'driver' && (
          <DriverDashboardView
            user={user}
            vehicle={vehicle}
            vehicles={vehicles}
            onNavigate={(view) => setCurrentView(view)}
          />
        )}

        {currentView === 'driver-requests' && (
          <DriverRequestsView
            demands={demands}
            onBack={() => setCurrentView('driver')}
            onSubmitProposal={(demandId, price, comment) => {
              storage.submitProposal(demandId, price, comment);
              setSelectedDemandId(demandId);
              setCurrentView('demand-detail');
            }}
            onQuickAcceptBudget={(demandId, budget) => {
              storage.submitProposal(demandId, budget, 'Погоджуюсь на ваш бюджет.');
              setSelectedDemandId(demandId);
              setCurrentView('demand-detail');
            }}
          />
        )}

        {currentView === 'driver-offer-new' && (
          <DriverOfferNewView
            vehicle={vehicle}
            vehicles={vehicles}
            onBack={() => setCurrentView('driver')}
            onOfferCreated={handleDriverOfferCreated}
            onAddVehicle={(newVeh) => storage.addVehicle(newVeh)}
          />
        )}

        {currentView === 'driver-vehicle' && (
          <DriverVehicleView
            vehicle={vehicle}
            vehicles={vehicles}
            activeVehicleId={activeVehicleId}
            onBack={() => setCurrentView('driver')}
            onUpdateVehicle={(upd) => storage.updateVehicle(upd)}
            onAddPhoto={(url, cap) => storage.addVehiclePhoto(url, cap)}
            onRemovePhoto={(id) => storage.removeVehiclePhoto(id)}
            onSetPrimaryPhoto={(id) => storage.setPrimaryVehiclePhoto(id)}
            onSetActiveVehicle={(id) => storage.setActiveVehicleId(id)}
            onAddVehicle={(newVeh) => storage.addVehicle(newVeh)}
          />
        )}

        {currentView === 'navigation' && (
          <NavigationView
            session={navSession}
            onStartSession={(orig, dest) => storage.startNavigationSession(orig, dest)}
            onEndSession={() => storage.endNavigationSession()}
            onToggleOptIn={(enabled) => storage.setMatchmakingOptIn(enabled)}
            onAcceptCandidate={(candId) => storage.acceptNavigationMatch(candId)}
            onBack={() => setCurrentView('home')}
          />
        )}

        {currentView === 'trips' && (
          <MyTripsView
            bookings={bookings}
            onCancelBooking={(id) => storage.cancelBooking(id)}
            onRateTrip={(id, rating, comment, tags) => {
              storage.submitReview({ bookingId: id, rating, comment, tags });
            }}
            onNavigate={(view) => setCurrentView(view)}
          />
        )}

        {currentView === 'messages' && (
          <MessagesView
            messages={storage.getMessages('conv_dmd_01')}
            onSendMessage={(txt) => {
              storage.addMessage('conv_dmd_01', {
                id: `msg_${Date.now()}`,
                conversationId: 'conv_dmd_01',
                senderId: user.id,
                senderName: user.name,
                text: txt,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              });
            }}
            onBack={() => setCurrentView('home')}
          />
        )}

        {currentView === 'profile' && (
          <ProfileView
            user={user}
            vehicle={vehicle}
            vehicles={vehicles}
            activeVehicleId={activeVehicleId}
            bookings={bookings}
            onRoleSwitch={(role) => storage.switchRole(role)}
            onNavigate={(view) => setCurrentView(view)}
            onResetData={handleResetData}
            onUpdateAvatar={(avatar) => storage.updateUser({ avatar })}
            onStartTour={handleStartTour}
            onSetActiveVehicle={(id) => storage.setActiveVehicleId(id)}
            onAddVehicle={(newVeh) => storage.addVehicle(newVeh)}
            onDeleteVehicle={(id) => storage.deleteVehicle(id)}
          />
        )}

        {currentView === 'admin' && user.role === 'admin' && (
          <AdminView
            user={user}
            vehicle={vehicle}
            offers={offers}
            demands={demands}
            demoMode={demoMode}
            onToggleDemo={() => storage.setDemoMode(!demoMode)}
            onBack={() => setCurrentView('home')}
          />
        )}
        </Suspense>
      </div>

      {/* Mobile 5-Tab Bottom Navigation Bar */}
      <BottomNav
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenActionDrawer={() => setIsActionDrawerOpen(true)}
        isDriver={isDriver}
      />

      {/* Plus Action Drawer Modal */}
      <ActionDrawer
        isOpen={isActionDrawerOpen}
        onClose={() => setIsActionDrawerOpen(false)}
        onSelectAction={(action) => {
          if (action === 'demand_new') setCurrentView('demand-new');
          if (action === 'driver_offer_new') setCurrentView('driver-offer-new');
          if (action === 'navigation') setCurrentView('navigation');
        }}
      />

      {/* PWA Install Guide Modal */}
      <PWAInstallModal
        isOpen={isPWAModalOpen}
        onClose={() => setIsPWAModalOpen(false)}
        isIOS={isIOS}
        isInstallable={isInstallable}
        onInstall={install}
      />

      {/* Interactive Onboarding Tour */}
      <OnboardingTour
        isOpen={isOnboardingTourOpen}
        onClose={() => setIsOnboardingTourOpen(false)}
        onNavigateHome={() => setCurrentView('home')}
        onNavigateDemandNew={() => setCurrentView('demand-new')}
      />
    </div>
  );
}

export default App;
