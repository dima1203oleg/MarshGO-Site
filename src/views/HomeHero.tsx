import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, BusFront, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, MapPin, Navigation, QrCode, Search, ShieldCheck, Ticket } from 'lucide-react';
import { selectHomeMarshPasses } from '../domain/marshPass';

type HomeTrip = {
  id: string;
  kind: 'booking' | 'journey';
  currentUserIsDriver?: boolean;
  origin: string;
  destination: string;
  departureAt: string;
  price?: string;
  status: string;
  driverName?: string;
  seatCount?: number;
  onOpen: () => void;
};

const banners = [
  { eyebrow: 'MARSHGO · ПОПУТКИ', title: 'Попутчики знайдуться на твоєму маршруті', description: 'Опублікуй поїздку й розділи витрати на дорогу.', image: '/images/hero_mountain_bus.jpg', action: 'publish' as const, actionLabel: 'Опублікувати поїздку' },
  { eyebrow: 'МІСТО ТА МІЖМІСТО', title: 'Усі способи доїхати в одному пошуку', description: 'Попутки, міський транспорт і подорожі Україною.', image: '/images/card_navigation_car.jpg', action: 'search' as const, actionLabel: 'Знайти маршрут' },
];

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
  trips = [],
}: {
  onStartNavigation: () => void;
  onSearchTrip: () => void;
  onPlanTrip: () => void;
  onOpenMap: () => void;
  onSearchDestination: (city: string) => void;
  trips?: HomeTrip[];
}) {
  const root = useRef<HTMLElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [passIndex, setPassIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const marshPasses = selectHomeMarshPasses(trips);
  const activePass = marshPasses[passIndex] ?? marshPasses[0];
  const activeBanner = banners[bannerIndex] ?? banners[0];

  useEffect(() => {
    if (marshPasses.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setBannerIndex((index) => (index + 1) % banners.length), 5000);
    return () => window.clearInterval(timer);
  }, [marshPasses.length]);

  useEffect(() => setPassIndex((index) => Math.min(index, Math.max(0, marshPasses.length - 1))), [marshPasses.length]);

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

    {activePass ? <section className={`home-marshpass-slot mb-3 ${marshPasses.length > 1 ? 'home-marshpass-slot--multiple' : ''}`} aria-label="Активні MarshPass">
      <button type="button" onClick={activePass.onOpen} aria-label={`Відкрити MarshPass: ${activePass.origin.split(',')[0]} — ${activePass.destination.split(',')[0]}`} onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => {
        const endX = event.changedTouches[0]?.clientX;
        if (touchStartX.current === null || endX === undefined || marshPasses.length < 2) return;
        const delta = endX - touchStartX.current;
        if (Math.abs(delta) > 40) setPassIndex((index) => (index + (delta < 0 ? 1 : -1) + marshPasses.length) % marshPasses.length);
        touchStartX.current = null;
      }} className="home-marshpass-card flex h-full w-full flex-col justify-between overflow-hidden rounded-[22px] border p-3.5 text-left transition active:scale-[.99]">
        <span className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-white"><Ticket size={17}/></span><span className="text-[11px] font-black tracking-[.1em]">MARSHGO <span className="text-blue-600 dark:text-blue-300">MARSH PASS</span></span></span><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"><CheckCircle2 size={12}/>{activePass.status === 'boarding' || activePass.status === 'in_progress' ? 'У дорозі' : 'Підтверджено'}</span></span>
        <span className="my-1 flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1"><span className="block truncate text-[18px] font-black leading-tight">{activePass.origin.split(',')[0]}</span><span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-300">{formatDeparture(activePass.departureAt)}</span></span><ArrowRight size={19} className="shrink-0 text-blue-600 dark:text-blue-300"/><span className="min-w-0 flex-1 text-right"><span className="block truncate text-[18px] font-black leading-tight">{activePass.destination.split(',')[0]}</span><span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-300">{activePass.price ?? 'Ціна уточнюється'}</span></span></span>
        <span className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2 dark:border-slate-700/80"><span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300"><ShieldCheck size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400"/><span className="truncate">{activePass.driverName ?? 'Приватна поїздка'}{activePass.seatCount ? ` · ${activePass.seatCount} ${activePass.seatCount === 1 ? 'місце' : 'місця'}` : ''}</span></span><span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300"><QrCode size={14}/>Відкрити квиток</span></span>
      </button>
      {marshPasses.length > 1 && <div className="mt-1.5 flex items-center justify-center gap-3"><button type="button" aria-label="Попередній MarshPass" onClick={() => setPassIndex((index) => (index - 1 + marshPasses.length) % marshPasses.length)} className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-[#16202B] dark:text-slate-100"><ChevronLeft size={16}/></button><span aria-live="polite" className="text-[10px] font-bold text-slate-500 dark:text-slate-300">{passIndex + 1} / {marshPasses.length}</span><button type="button" aria-label="Наступний MarshPass" onClick={() => setPassIndex((index) => (index + 1) % marshPasses.length)} className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-[#16202B] dark:text-slate-100"><ChevronRight size={16}/></button></div>}
    </section> : <section aria-label="MARSHGO: банер про поїздки" className="home-canonical-banner home-banner relative mb-3 flex shrink-0 flex-col justify-between overflow-hidden rounded-[26px] border border-white/80 p-4 shadow-[0_7px_22px_rgba(26,73,133,.12)]">
      <img src={activeBanner.image} alt="" className="absolute inset-0 h-full w-full object-cover"/>
      <span aria-hidden="true" className="home-banner-scrim absolute inset-0"/>
      <div className="relative z-10 max-w-[78%]"><p className="text-[9px] font-black uppercase tracking-[.16em] text-blue-700 dark:text-blue-300">{activeBanner.eyebrow}</p><h1 className="mt-1 text-[16px] font-black leading-tight tracking-tight text-[#102344] dark:text-white">{activeBanner.title}</h1><p className="mt-1 text-[10px] font-semibold leading-snug text-slate-600 dark:text-slate-200">{activeBanner.description}</p></div>
      <div className="relative z-10 flex items-center justify-between"><button type="button" onClick={activeBanner.action === 'publish' ? onPlanTrip : onSearchTrip} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-blue-600 px-3.5 text-[11px] font-bold text-white shadow-md shadow-blue-900/20">{activeBanner.actionLabel}<ArrowRight size={14}/></button><div className="flex items-center gap-1.5" role="group" aria-label="Банери MARSHGO">{banners.map((banner, index) => <button key={banner.eyebrow} type="button" aria-label={`Показати банер ${index + 1}: ${banner.eyebrow}`} aria-pressed={bannerIndex === index} onClick={() => setBannerIndex(index)} className={`h-2.5 rounded-full transition-all ${bannerIndex === index ? 'w-5 bg-blue-600' : 'w-2.5 bg-slate-400/60'}`}/>)}</div></div>
    </section>}

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
