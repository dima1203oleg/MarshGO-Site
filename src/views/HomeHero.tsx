import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, BusFront, CheckCircle2, ChevronLeft, ChevronRight, CirclePlus, MapPin, Navigation, QrCode, Search, ShieldCheck, Ticket } from 'lucide-react';
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

const actions = [
  { title: 'Навігація', subtitle: 'Побудувати маршрут', tone: 'navigation', icon: Navigation },
  { title: 'Опублікувати поїздку', subtitle: 'Попутка / маршрут', tone: 'publish', icon: CirclePlus },
  { title: 'Карта транспорту', subtitle: 'Зупинки, лінії, рух', tone: 'transport', icon: BusFront },
  { title: 'Знайти маршрут', subtitle: 'Усі види транспорту', tone: 'search', icon: Search },
] as const;

const popularRoutes = [
  { city: 'Київ', image: '/images/welcome-kyiv-v1.jpg' },
  { city: 'Рівне', image: '/images/welcome-road.jpg' },
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
  onPublishTrip,
  onOpenMap,
  onSearchDestination,
  trips = [],
}: {
  onStartNavigation: () => void;
  onSearchTrip: () => void;
  onPublishTrip: () => void;
  onOpenMap: () => void;
  onSearchDestination: (city: string) => void;
  trips?: HomeTrip[];
}) {
  const root = useRef<HTMLElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const [passIndex, setPassIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const marshPasses = selectHomeMarshPasses(trips);
  const activePass = marshPasses[passIndex] ?? marshPasses[0];

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
    if (action === 'publish') onPublishTrip();
  };

  return <main ref={root} className="home-hero home-hero--canonical mx-auto flex w-full max-w-xl flex-col px-4 pb-1 pt-2" style={availableHeight ? { height: availableHeight, overflowY: 'auto', overscrollBehaviorY: 'contain' } : undefined}>
    <button type="button" onClick={onSearchTrip} className="home-city-pill mg-press-subtle mb-2 inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full border border-[var(--mg-line)] bg-[var(--mg-surface-card)] px-3.5 text-sm font-bold text-[var(--mg-ink)] shadow-sm">
      <MapPin size={16} className="text-blue-600"/> Львів <ChevronRight size={14} className="rotate-90 text-slate-400"/>
    </button>

    {activePass ? <section className={`home-marshpass-slot mb-3 ${marshPasses.length > 1 ? 'home-marshpass-slot--multiple' : ''}`} aria-label="Активні MarshPass">
      <button type="button" onClick={activePass.onOpen} aria-label={`Відкрити MarshPass: ${activePass.origin.split(',')[0]} — ${activePass.destination.split(',')[0]}`} onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => {
        const endX = event.changedTouches[0]?.clientX;
        if (touchStartX.current === null || endX === undefined || marshPasses.length < 2) return;
        const delta = endX - touchStartX.current;
        if (Math.abs(delta) > 40) setPassIndex((index) => (index + (delta < 0 ? 1 : -1) + marshPasses.length) % marshPasses.length);
        touchStartX.current = null;
      }} className="home-marshpass-card flex h-full w-full flex-col justify-between overflow-hidden rounded-[var(--mg-radius-xl)] border border-blue-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-4 text-left shadow-lg transition active:scale-[.99]">
        <span className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-white shadow-sm"><Ticket size={17}/></span><span className="text-xs font-black tracking-[.12em] text-white">MARSHGO <span className="text-blue-400">MARSH PASS</span></span></span><span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-xs font-bold text-emerald-300"><CheckCircle2 size={12}/>{activePass.status === 'boarding' || activePass.status === 'in_progress' ? 'У дорозі' : 'Підтверджено'}</span></span>
        <span className="my-2 flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1"><span className="block truncate text-[19px] font-black leading-tight text-white">{activePass.origin.split(',')[0]}</span><span className="block text-xs font-semibold text-slate-300">{formatDeparture(activePass.departureAt)}</span></span><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400"><ArrowRight size={16}/></div><span className="min-w-0 flex-1 text-right"><span className="block truncate text-[19px] font-black leading-tight text-white">{activePass.destination.split(',')[0]}</span><span className="block text-xs font-semibold text-slate-300">{activePass.price ?? 'Ціна уточнюється'}</span></span></span>
        <span className="flex items-center justify-between gap-2 border-t border-dashed border-slate-700/80 pt-2.5"><span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-300"><ShieldCheck size={14} className="shrink-0 text-emerald-400"/><span className="truncate">{activePass.driverName ?? 'Приватна поїздка'}{activePass.seatCount ? ` · ${activePass.seatCount} ${activePass.seatCount === 1 ? 'місце' : 'місця'}` : ''}</span></span><span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm"><QrCode size={14}/>Відкрити квиток</span></span>
      </button>
      {marshPasses.length > 1 && <div className="mt-1.5 flex items-center justify-center gap-3"><button type="button" aria-label="Попередній MarshPass" onClick={() => setPassIndex((index) => (index - 1 + marshPasses.length) % marshPasses.length)} className="mg-press-subtle grid h-11 w-11 place-items-center rounded-full border border-slate-700 bg-slate-800 text-slate-100"><ChevronLeft size={16}/></button><span aria-live="polite" className="text-xs font-bold text-slate-300">{passIndex + 1} / {marshPasses.length}</span><button type="button" aria-label="Наступний MarshPass" onClick={() => setPassIndex((index) => (index + 1) % marshPasses.length)} className="mg-press-subtle grid h-11 w-11 place-items-center rounded-full border border-slate-700 bg-slate-800 text-slate-100"><ChevronRight size={16}/></button></div>}
    </section> : <section aria-label="Цифровий квиток MARSHGO MarshPass" className="home-canonical-banner home-banner home-marshpass-card relative mb-3 flex shrink-0 flex-col justify-between overflow-hidden rounded-[var(--mg-radius-xl)] border border-blue-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-3.5 shadow-[0_8px_24px_rgba(11,99,214,0.18)] text-left">
      <span aria-hidden="true" className="home-banner-media absolute inset-0 pointer-events-none hidden" />
      <span aria-hidden="true" className="home-banner-scrim absolute inset-0 pointer-events-none hidden" />
      <button type="button" onClick={onSearchTrip} aria-label="Отримати або переглянути квиток MarshPass" className="mg-press-subtle relative z-10 flex h-full w-full flex-col justify-between text-left">
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30"><Ticket size={17}/></span>
            <span className="text-xs font-black tracking-[.12em] text-white">MARSHGO <span className="text-blue-400">MARSH PASS</span></span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-400/30 px-2.5 py-0.5 text-xs font-bold text-blue-300">
            <CheckCircle2 size={12} className="text-blue-400"/>Єдиний квиток
          </span>
        </span>
        <span className="my-2 flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0">
            <span className="block text-[17px] font-black leading-tight text-white">Львів</span>
            <span className="block text-xs font-semibold text-slate-300">Місто та міжмісто</span>
          </span>
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-600/25 border border-blue-500/30 text-blue-400">
            <ArrowRight size={15}/>
          </div>
          <span className="min-w-0 text-right">
            <span className="block text-[17px] font-black leading-tight text-white">Куди завгодно</span>
            <span className="block text-xs font-semibold text-slate-300">Попутки · Транспорт</span>
          </span>
        </span>
        {/* The commission line and the ticket button share one row when they fit and
            wrap onto their own rows at 320 px, instead of truncating the claim to «0% к…». */}
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-dashed border-slate-700/80 pt-2">
          <span className="flex min-w-0 flex-1 basis-[9rem] items-center gap-1.5 text-xs font-semibold text-slate-300">
            <ShieldCheck size={14} className="shrink-0 text-emerald-400"/>
            <span className="truncate">QR-посадка · 0% комісії</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-900/30 transition">
            <QrCode size={13}/><span>Отримати квиток</span>
          </span>
        </span>
      </button>
    </section>}

    <div className="home-action-grid mg-stagger-list grid grid-cols-2 gap-2.5" aria-label="Швидкі дії">
      {actions.map(({ title, subtitle, tone, icon: Icon }, index) => <button key={tone} type="button" style={{ '--mg-stagger-i': index } as CSSProperties} onClick={() => runAction(tone)} className={`home-action-card home-action-card--${tone} mg-press relative flex min-h-[112px] flex-col items-center justify-center gap-3 overflow-hidden rounded-[var(--mg-radius-xl)] border p-3 text-center transition active:scale-[.98]`}>
        <span className="home-action-icon relative z-10 grid h-11 w-11 place-items-center rounded-2xl"><Icon size={22} strokeWidth={2.3}/></span>
        <span className="relative z-10 w-full">
          <span className="min-w-0"><span className="home-action-card__title block text-[15px] font-black leading-tight tracking-tight">{title}</span><span className="home-action-card__subtitle mt-1 block text-[12px] font-semibold leading-snug">{subtitle}</span></span>
        </span>
        <ArrowRight size={16} className="home-action-card__hint z-10" aria-hidden="true"/>
      </button>)}
    </div>

    <section className="home-popular-routes mt-3 min-h-0" aria-labelledby="popular-routes-title">
      <div className="mb-2 flex items-center justify-between px-1"><h2 id="popular-routes-title" className="text-[15px] font-black text-[var(--mg-ink)]">Популярні напрямки</h2><button type="button" onClick={onSearchTrip} className="mg-press-subtle inline-flex min-h-11 items-center gap-1 text-[12px] font-bold text-blue-600">Показати всі <ChevronRight className="inline" size={13}/></button></div>
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
        {popularRoutes.map(({ city, image }) => <button key={city} type="button" onClick={() => onSearchDestination(city)} className="home-popular-route mg-press relative h-[68px] min-w-[108px] flex-1 overflow-hidden rounded-2xl border border-white/70 bg-slate-200 text-left shadow-sm">
          <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover"/>
          <span className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"/>
          <span className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-1 text-[12px] font-extrabold leading-tight text-white">Львів → {city}<ChevronRight size={14} className="shrink-0"/></span>
        </button>)}
      </div>
    </section>
  </main>;
}
