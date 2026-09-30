import React from 'react';
import { Car, Download, Bell, Compass, Menu, X, HelpCircle, Search, Clock3, Shield } from 'lucide-react';
import { User } from '../types';
import { UserAvatar } from './UserAvatar';
import { ThemeToggle } from './ThemeToggle';

interface AppHeaderProps {
  user: User;
  onRoleSwitch: (role: 'passenger' | 'driver') => void;
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenInstall: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  demoMode: boolean;
  onToggleDemo: () => void;
  onStartTour?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  user, onRoleSwitch, currentView, onNavigate, onOpenInstall,
  isInstalled, demoMode, onToggleDemo, onStartTour
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const isDriver = user.activeRole === 'driver';
  const navigate = (view: string) => { onNavigate(view); setMenuOpen(false); };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 text-[#14243B] shadow-[0_4px_24px_rgba(20,36,59,.05)] backdrop-blur-xl">
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <button onClick={() => navigate('home')} className="flex shrink-0 items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="MARSHGO — головна">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-blue-500 to-blue-800 text-white shadow-lg shadow-blue-600/20"><svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" aria-hidden="true"><path d="M4 24 11 7l5 12 5-12 7 17" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 24 23 7" stroke="#7DD3FC" strokeWidth="4.5" strokeLinecap="round"/></svg></span>
          <span className="font-display text-[1.35rem] font-extrabold tracking-[-.07em] text-[#0A1930]">MARSH<span className="text-blue-600">GO</span></span>
        </button>

        <nav className="hidden items-center gap-7 text-[13px] font-semibold text-slate-600 lg:flex" aria-label="Основна навігація">
          <button onClick={() => navigate('home')} className={`transition hover:text-blue-700 ${currentView === 'home' ? 'text-blue-700' : ''}`}>Пошук</button>
          <button onClick={() => navigate('search')} className={`transition hover:text-blue-700 ${currentView === 'search' ? 'text-blue-700' : ''}`}>Усі рейси</button>
          <button onClick={() => navigate(isDriver ? 'driver-requests' : 'demand-new')} className="transition hover:text-blue-700">Біржа попиту</button>
          <button onClick={() => navigate('trips')} className={`transition hover:text-blue-700 ${currentView === 'trips' ? 'text-blue-700' : ''}`}>Мої поїздки</button>
          <button onClick={() => navigate('navigation')} className="inline-flex items-center gap-1.5 transition hover:text-blue-700"><Compass className="h-4 w-4 text-blue-600"/>Навігація</button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onToggleDemo} title="Перемкнути демонстраційний режим" className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-extrabold tracking-wide text-amber-800 md:flex"><span className={`h-1.5 w-1.5 rounded-full ${demoMode ? 'bg-amber-500' : 'bg-emerald-500'}`}/>{demoMode ? 'ДЕМО' : 'ПРЕВ’Ю'}</button>
          {!isInstalled && <button onClick={onOpenInstall} className="hidden items-center gap-2 rounded-full bg-[#101C30] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-900 sm:inline-flex"><Download className="h-4 w-4"/>Завантажити додаток</button>}
          <button onClick={() => navigate('messages')} aria-label="Повідомлення" className="relative hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:text-blue-700 sm:flex"><Bell className="h-[18px] w-[18px]"/><span className="absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full bg-blue-600"/></button>
          <button onClick={() => navigate(isDriver ? 'driver' : 'profile')} aria-label="Профіль" className="rounded-full ring-offset-2 transition hover:ring-2 hover:ring-blue-500"><UserAvatar src={user.avatar} name={user.name} size="sm" className="border border-slate-200"/></button>
          <button onClick={() => setMenuOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50 lg:hidden" aria-label={menuOpen ? 'Закрити меню' : 'Відкрити меню'}>{menuOpen ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}</button>
        </div>
      </div>

      {menuOpen && <div className="border-t border-slate-100 bg-white px-4 py-4 shadow-xl lg:hidden">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><span className="text-xs font-semibold text-slate-600">Перемкнути режим</span><div className="flex rounded-full border border-slate-200 bg-white p-1 text-xs"><button onClick={() => { onRoleSwitch('passenger'); setMenuOpen(false); }} className={`rounded-full px-3 py-1.5 font-bold ${!isDriver ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Пасажир</button><button onClick={() => { onRoleSwitch('driver'); setMenuOpen(false); }} className={`rounded-full px-3 py-1.5 font-bold ${isDriver ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Водій</button></div></div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <button onClick={() => navigate('home')} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 font-semibold"><Search className="h-4 w-4 text-blue-600"/>Пошук маршрутів</button>
            <button onClick={() => navigate('search')} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 font-semibold"><Car className="h-4 w-4 text-blue-600"/>Усі рейси</button>
            <button onClick={() => navigate(isDriver ? 'driver-requests' : 'demand-new')} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 font-semibold"><Compass className="h-4 w-4 text-blue-600"/>Біржа попиту</button>
            <button onClick={() => navigate('trips')} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 font-semibold"><Clock3 className="h-4 w-4 text-blue-600"/>Мої поїздки</button>
            <button onClick={() => navigate('driver-vehicle')} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 font-semibold"><Car className="h-4 w-4 text-blue-600"/>Мій автомобіль</button>
            <button onClick={() => navigate('messages')} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 font-semibold"><Bell className="h-4 w-4 text-blue-600"/>Повідомлення</button>
            {user.role === 'admin' && <button onClick={() => navigate('admin')} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 font-semibold"><Shield className="h-4 w-4 text-blue-600"/>Адмін панель</button>}
            <button onClick={onOpenInstall} className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 font-semibold text-blue-800"><Download className="h-4 w-4"/>Встановити додаток</button>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-100 p-3"><span className="text-xs font-semibold text-slate-600">Зовнішній вигляд</span><ThemeToggle variant="segmented"/></div>
          {onStartTour && <button onClick={() => { setMenuOpen(false); onStartTour(); }} className="flex w-full items-center gap-2 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-800"><HelpCircle className="h-4 w-4"/>Підказки по застосунку</button>}
          <p className="px-1 text-[10px] font-semibold text-slate-400">{demoMode ? 'Демонстраційні дані' : 'Попередній перегляд'}</p>
        </div>
      </div>}
    </header>
  );
};
