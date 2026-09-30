import React from 'react';
import { Search, Compass, Plus, Clock, User as UserIcon, MessageSquare } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenActionDrawer: () => void;
  isDriver: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenActionDrawer,
  isDriver
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#DFE7F1] pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="grid grid-cols-5 h-16 items-center px-2">
        {/* Tab 1: Search */}
        <button
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            currentView === 'home' || currentView === 'search' ? 'text-[#1769F4]' : 'text-[#62718A]'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-1">Пошук</span>
        </button>

        {/* Tab 2: Requests / Demands */}
        <button
          onClick={() => onNavigate(isDriver ? 'driver-requests' : 'demand-new')}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            currentView === 'demand-new' || currentView === 'driver-requests'
              ? 'text-[#1769F4]'
              : 'text-[#62718A]'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-1">Заявки</span>
        </button>

        {/* Tab 3: Central Action Button (+) */}
        <div className="flex items-center justify-center -mt-5">
          <button
            onClick={onOpenActionDrawer}
            className="w-13 h-13 rounded-full bg-[#1769F4] text-white flex items-center justify-center shadow-lg shadow-[#1769F4]/30 hover:bg-[#1358CE] active:scale-95 transition-transform border-4 border-white"
            aria-label="Створити поїздку або запит"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab 4: My Trips */}
        <button
          onClick={() => onNavigate('trips')}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            currentView === 'trips' ? 'text-[#1769F4]' : 'text-[#62718A]'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-1">Поїздки</span>
        </button>

        {/* Tab 5: Profile / Driver */}
        <button
          onClick={() => onNavigate(isDriver ? 'driver' : 'profile')}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            currentView === 'profile' || currentView === 'driver' ? 'text-[#1769F4]' : 'text-[#62718A]'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-1">{isDriver ? 'Водій' : 'Профіль'}</span>
        </button>
      </div>
    </nav>
  );
};
