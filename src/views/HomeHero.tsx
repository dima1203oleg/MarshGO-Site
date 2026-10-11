import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, BusFront, CalendarDays, ChevronRight, MapPin, Navigation, Search, Ticket } from 'lucide-react';

type HomeTrip = {
  id: string;
  origin: string;
  destination: string;
  departureAt: string;
  price?: string;
  status: 'active' | 'upcoming';
  onOpen: () => void;
};

const actions = [
  { title: 'Навігація', subtitle: 'Побудувати маршрут', tone: 'navigation', image: '/images/card_navigation_car.jpg', icon: Navigation },
  { title: 'Карта транспорту', subtitle: 'Зупинки, лінії, рух', tone: 'transport', image: '/images/hero_ukraine_mobility.jpg', icon: BusFront },
  { title: 'Знайти маршрут', subtitle: 'Усі види транспорту', tone: 'search', image: '/images/lviv_stop_banner.jpg', icon: Search },
  { title: 'Опублікувати поїздку', subtitle: 'Попутка / маршрут', tone: 'publish', image: '/images/welcome-road.jpg', icon: CalendarDays },
] as const;

const popularRoutes = [
  { city: 'Київ', image: '/images/welcome-kyiv-v1.jpg' },
  { city: 'Рівне', image: '/images/hero_mountain_bus.jpg' },
  { city: 'Тернопіль', image: '/images/lviv_stop_banner.jpg' },
] as const;

function formatDeparture(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Час не вказано';
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
  }).format(date);
}

export function HomeHero({
  onStartNavigation,
  onSearchTrip,
  onPlanTrip,
  onOpenMap,
  onSearchDestination,
  trip,
}: {
  onStartNavigation: () => void;
  onSearchTrip: () => void;
  onPlanTrip: () => void;
  onOpenMap: () => void;
  onSearchDestination: (city: string) => void;
  trip?: HomeTrip;
}) {
  const root = useRef<HTMLElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const element = root.current;
      if (!element || window.innerWidth >= 1024) { setAvailableHeight(null); return; }
      const top = element.getBoundingClientRect().top + window.scrollY;
      const shell = element.closest('.production-app');
      const reserved = shell ? parseFloat(getComputedStyle(shell).paddingBottom) || 0 : 0;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      setAvailableHeight(Math.max(300, Math.floor(viewport - top - reserved - 4)));
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  const runAction = (action: typeof actions[number]['tone']) => {
    if (action === 'navigation') onStartNavigation();
    if (action === 'transport') onOpenMap();
    if (action === 'search') onSearchTrip();
    if (action === 'publish') onPlanTrip();
  };

  return <main ref={root} className={`home-hero home-hero--canonical mx-auto flex w-full max-w-xl flex-col px-4 pb-1 pt-2 ${availableHeight ? 'overflow-hidden' : ''}`} style={availableHeight ? { height: availableHeight } : undefined}>
    <button type="button" onClick={onSearchTrip} className="home-city-pill mb-2 inline-flex min-h-9 shrink-0 items-center gap-2 self-start rounded-full border border-[#DFE7F1] bg-white px-3.5 text-sm font-bold text-[#14243B] shadow-sm">
      <MapPin size={16} className="text-blue-600"/> Львів <ChevronRight size={14} className="rotate-90 text-slate-400"/>
    </button>

    <section aria-label="Розумні поїздки" className="home-canonical-banner relative mb-3 flex shrink-0 flex-col justify-between overflow-hidden rounded-[26px] border border-white/80 p-4 shadow-[0_7px_22px_rgba(26,73,133,.12)]">
      <img src="/images/hero_mountain_bus.jpg" alt="" className="absolute inset-0 h-full w-full object-cover"/>
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/10"/>
      <div className="relative z-10 max-w-[73%]">
        <h1 className="text-[18px] font-black leading-tight tracking-tight text-[#102344]">Розумні поїздки</h1>
        <p className="mt-1 text-[14px] font-black leading-tight text-[#1769ED]">для міста і міжміста</p>
        <p className="mt-1 text-[10px] font-semibold text-slate-600">Люди · Транспорт · Можливості</p>
      </div>
    </section>

    {trip && <button type="button" onClick={trip.onOpen} aria-label={`${trip.status === 'active' ? 'Активна поїздка' : 'Запланована поїздка'} ${trip.origin} → ${trip.destination}`} className={`home-trip-card mb-3 flex min-h-[76px] w-full shrink-0 items-center gap-3 rounded-[24px] border px-3.5 py-3 text-left shadow-sm transition active:scale-[.99] ${trip.status === 'active' ? 'border-emerald-200/80 bg-[#E8F8F0]' : 'border-[#D8E8F6] bg-white'}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-100 bg-white text-emerald-700 shadow-sm"><Ticket size={21}/></span>
      <span className="min-w-0 flex-1">
        <span className={`mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.12em] ${trip.status === 'active' ? 'text-emerald-800' : 'text-blue-700'}`}><span className={`h-2 w-2 rounded-full ${trip.status === 'active' ? 'bg-emerald-500' : 'bg-blue-500'}`}/>{trip.status === 'active' ? 'Активна поїздка' : 'Запланована поїздка'}</span>
        <span className="block truncate text-[14px] font-black text-[#142642]">{trip.origin.split(',')[0]} → {trip.destination.split(',')[0]}</span>
        <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-600">{formatDeparture(trip.departureAt)}{trip.price ? ` · ${trip.price}` : ''}</span>
      </span>
      <ChevronRight size={19} className="shrink-0 text-emerald-700"/>
    </button>}

    <div className="home-action-grid grid grid-cols-2 gap-2.5" aria-label="Швидкі дії">
      {actions.map(({ title, subtitle, tone, image, icon: Icon }) => <button key={tone} type="button" onClick={() => runAction(tone)} className={`home-action-card home-action-card--${tone} relative flex min-h-[112px] flex-col items-start justify-between overflow-hidden rounded-[22px] border p-3 text-left text-white transition active:scale-[.98]`}>
        <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-active:scale-105"/>
        <span aria-hidden="true" className="home-action-tint absolute inset-0"/>
        <span className="relative z-10 grid h-10 w-10 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm"><Icon size={21} strokeWidth={2.4}/></span>
        <span className="relative z-10 flex w-full items-end justify-between gap-1">
          <span className="min-w-0"><span className="block text-[14px] font-black leading-tight tracking-tight drop-shadow">{title}</span><span className="mt-1 block text-[10px] font-semibold leading-snug text-white/95 drop-shadow">{subtitle}</span></span>
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-blue-700 shadow-sm"><ArrowRight size={17}/></span>
        </span>
      </button>)}
    </div>

    <section className="home-popular-routes mt-3 min-h-0" aria-labelledby="popular-routes-title">
      <div className="mb-2 flex items-center justify-between px-1"><h2 id="popular-routes-title" className="text-sm font-black text-[#132443]">Популярні напрямки</h2><button type="button" onClick={onSearchTrip} className="text-[10px] font-bold text-blue-600">Показати всі <ChevronRight className="inline" size={12}/></button></div>
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
        {popularRoutes.map(({ city, image }) => <button key={city} type="button" onClick={() => onSearchDestination(city)} className="home-popular-route relative h-[68px] min-w-[108px] flex-1 overflow-hidden rounded-2xl border border-white/70 bg-slate-200 text-left shadow-sm">
          <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover"/>
          <span className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent"/>
          <span className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-1 text-[10px] font-extrabold leading-tight text-white">Львів → {city}<ChevronRight size={13} className="shrink-0"/></span>
        </button>)}
      </div>
    </section>
  </main>;
}
