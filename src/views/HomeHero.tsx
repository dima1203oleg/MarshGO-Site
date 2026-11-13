import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, BusFront, CheckCircle2, ChevronLeft, ChevronRight, CirclePlus, MapPin, Navigation, QrCode, Search, ShieldCheck, Ticket } from 'lucide-react';
import { selectHomeMarshPasses } from '../domain/marshPass';
import { calculateHomeAvailableHeight } from './homeViewport';
import './homeReference.css';

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
  { origin: 'Львів', city: 'Київ' },
  { origin: 'Львів', city: 'Рівне' },
  { origin: 'Львів', city: 'Тернопіль' },
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
  onOpenTrips,
  onPublishTrip,
  onOpenMap,
  onSearchDestination,
  trips = [],
}: {
  onStartNavigation: () => void;
  onSearchTrip: () => void;
  onOpenTrips: () => void;
  onPublishTrip: () => void;
  onOpenMap: () => void;
  onSearchDestination: (city: string, origin: string) => void;
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
      if (!element) { setAvailableHeight(null); return; }
      const shell = element.closest('.production-app');
      // The phone fit reserves the fixed BOTTOM tab bar. Tablet and desktop navigate
      // from a fixed left rail whose top is 0, so the same measurement would reserve
      // the whole viewport and squeeze Home into its 300px floor. Only the phone
      // shell (data-formfactor="mobile", the default when the attribute is absent)
      // keeps the height-fitting behaviour.
      const formFactor = shell?.getAttribute('data-formfactor') ?? 'mobile';
      if (window.innerWidth >= 1024 || formFactor !== 'mobile') { setAvailableHeight(null); return; }
      const top = element.getBoundingClientRect().top + window.scrollY;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const tabbar = shell?.querySelector<HTMLElement>('.app-tabbar');
      const tabbarTop = tabbar && getComputedStyle(tabbar).position === 'fixed'
        ? tabbar.getBoundingClientRect().top
        : null;
      const shellPaddingBottom = shell ? parseFloat(getComputedStyle(shell).paddingBottom) || 0 : 0;
      setAvailableHeight(calculateHomeAvailableHeight(viewport, top, tabbarTop, shellPaddingBottom));
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

  return <section aria-label="Головна MARSHGO" ref={root} className="home-hero home-hero--canonical mx-auto flex w-full max-w-xl flex-col px-4 pb-1 pt-2" style={availableHeight ? { height: availableHeight, overflowY: 'auto', overscrollBehaviorY: 'contain' } : undefined}>
    <h1 className="sr-only">Головна MARSHGO</h1>
    {activePass ? <section className={`home-marshpass-slot mb-3 ${marshPasses.length > 1 ? 'home-marshpass-slot--multiple' : ''}`} aria-label="Активні MarshPass">
      <button type="button" onClick={activePass.onOpen} aria-label={`Відкрити MarshPass: ${activePass.origin.split(',')[0]} — ${activePass.destination.split(',')[0]}`} onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => {
        const endX = event.changedTouches[0]?.clientX;
        if (touchStartX.current === null || endX === undefined || marshPasses.length < 2) return;
        const delta = endX - touchStartX.current;
        if (Math.abs(delta) > 40) setPassIndex((index) => (index + (delta < 0 ? 1 : -1) + marshPasses.length) % marshPasses.length);
        touchStartX.current = null;
      }} className="home-marshpass-card home-marshpass-card--active flex h-full w-full flex-col justify-between overflow-hidden rounded-[var(--mg-radius-xl)] border border-[var(--mg-border-medium)] bg-[var(--mg-surface-primary)] p-4 text-left shadow-[var(--mg-card-shadow)] transition active:scale-[.99]">
        <span className="home-pass-preview__header"><span className="home-pass-preview__brand"><span className="home-pass-preview__brand-icon"><Ticket size={17}/></span><span>MARSH PASS</span></span><span className={`home-pass-preview__status ${activePass.status === 'boarding' ? 'home-pass-preview__status--boarding' : 'home-pass-preview__status--confirmed'}`}><CheckCircle2 size={13}/>{activePass.status === 'boarding' ? 'Посадка дозволена' : 'Підтверджено'}</span></span>
        <span className="home-pass-preview__route"><span className="home-pass-preview__city"><span className="home-pass-preview__city-name">{activePass.origin.split(',')[0]}</span><span className="home-pass-preview__meta">{formatDeparture(activePass.departureAt)}</span></span><span className="home-pass-preview__connector" aria-hidden="true"><i/><ArrowRight size={15}/><i/></span><span className="home-pass-preview__city home-pass-preview__city--destination"><span className="home-pass-preview__city-name">{activePass.destination.split(',')[0]}</span>{activePass.price && <span className="home-pass-preview__meta">{activePass.price}</span>}</span></span>
        <span className="home-pass-preview__footer"><span className="home-pass-preview__driver"><ShieldCheck size={14} aria-hidden="true"/><span>{activePass.driverName ?? 'Приватна поїздка'}{activePass.seatCount ? ` · ${activePass.seatCount} ${activePass.seatCount === 1 ? 'місце' : 'місця'}` : ''}</span></span><span className="home-pass-preview__open"><QrCode size={14} aria-hidden="true"/>Відкрити квиток</span></span>
      </button>
      {marshPasses.length > 1 && <div className="mt-1.5 flex items-center justify-center gap-3"><button type="button" aria-label="Попередній MarshPass" onClick={() => setPassIndex((index) => (index - 1 + marshPasses.length) % marshPasses.length)} className="mg-press-subtle grid h-11 w-11 place-items-center rounded-full border border-slate-700 bg-slate-800 text-slate-100"><ChevronLeft size={16}/></button><span aria-live="polite" className="text-xs font-bold text-slate-300">{passIndex + 1} / {marshPasses.length}</span><button type="button" aria-label="Наступний MarshPass" onClick={() => setPassIndex((index) => (index + 1) % marshPasses.length)} className="mg-press-subtle grid h-11 w-11 place-items-center rounded-full border border-slate-700 bg-slate-800 text-slate-100"><ChevronRight size={16}/></button></div>}
    </section> : <button type="button" onClick={onOpenTrips} aria-label="Відкрити майбутні поїздки та квитки MarshPass" className="home-canonical-banner home-banner home-marshpass-card home-marshpass-promo mg-press-subtle relative mb-3 flex w-full shrink-0 flex-col justify-between overflow-hidden rounded-[var(--mg-radius-xl)] border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] p-4 text-left shadow-[var(--mg-card-shadow)]">
      <span aria-hidden="true" className="home-marshpass-promo__reference-art"/>
      <span aria-hidden="true" className="home-marshpass-promo__route">
        <svg viewBox="0 0 220 96" fill="none" preserveAspectRatio="xMidYMid meet">
          <path className="home-marshpass-promo__contour" d="M87 8C117 17 141 8 165 17C184 24 198 19 218 11M91 17C119 26 143 17 164 26C185 35 199 29 218 22M103 27C125 35 145 28 163 37C180 45 196 42 212 34" />
          <path d="M12 77C43 77 49 31 80 31C110 31 111 55 136 55C156 55 168 31 181 20" />
          <circle cx="12" cy="77" r="5" />
          <circle cx="80" cy="31" r="3.5" />
          <circle cx="136" cy="55" r="3.5" />
        </svg>
      </span>
      <span className="home-marshpass-promo__destination" aria-hidden="true"><MapPin size={27} strokeWidth={2.5}/></span>
      <span className="home-marshpass-promo__eyebrow relative flex items-center gap-2 text-xs font-black tracking-[.16em] text-[var(--mg-ink-secondary)]"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--mg-blue-tint)] text-[var(--mg-blue-ink)]"><Ticket size={17}/></span>MARSH PASS</span>
      <span className="home-marshpass-promo__title relative block font-display text-[1.35rem] font-extrabold leading-tight text-[var(--mg-ink-primary)]">Твій шлях. Один квиток.</span>
      <span className="home-marshpass-promo__description relative block text-xs font-medium leading-snug text-[var(--mg-ink-secondary)]">Увесь міський і міжміський транспорт<br/>в одному рішенні.</span>
      <span className="home-marshpass-promo__footer relative flex items-center justify-between border-t border-dashed border-[var(--mg-border-subtle)] pt-2 text-xs font-bold tracking-[.28em] text-[var(--mg-ink-secondary)]"><span>MARSHGO</span><span className="home-marshpass-promo__barcode" aria-hidden="true"/></span>
    </button>}

    <div className="home-action-grid mg-stagger-list grid grid-cols-2 gap-2" aria-label="Швидкі дії">
      {actions.map(({ title, subtitle, tone, icon: Icon }, index) => <button key={tone} type="button" style={{ '--mg-stagger-i': index } as CSSProperties} onClick={() => runAction(tone)} className={`home-action-card home-action-card--${tone} mg-press relative flex min-h-[92px] flex-col items-start justify-center gap-2 overflow-hidden rounded-[var(--mg-radius-xl)] border p-3 text-left transition active:scale-[.98]`}>
        <span className="home-action-icon relative z-10 grid h-10 w-10 place-items-center rounded-2xl"><Icon size={20} strokeWidth={2.3}/></span>
        <span aria-hidden="true" className={`home-action-card__reference-art home-action-card__reference-art--${tone}`}/>
        <span className="relative z-10 w-full">
          <span className="min-w-0"><span className="home-action-card__title block text-[14px] font-black leading-tight tracking-tight">{title}</span><span className="home-action-card__subtitle mt-0.5 block text-xs font-semibold leading-snug">{subtitle}</span></span>
        </span>
        <ArrowRight size={15} className="home-action-card__hint z-10" aria-hidden="true"/>
      </button>)}
    </div>

    <section className="home-popular-routes mt-3 min-h-0" aria-labelledby="popular-routes-title">
      <div className="mb-2 flex items-center justify-between px-1"><h2 id="popular-routes-title" className="text-[15px] font-black text-[var(--mg-ink)]">Популярні напрямки</h2><button type="button" onClick={onSearchTrip} className="mg-press-subtle inline-flex min-h-11 items-center gap-1 text-[12px] font-bold text-blue-600">Показати всі <ChevronRight className="inline" size={13}/></button></div>
      <div className="home-popular-routes__row no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
        {popularRoutes.map(({ origin, city }) => <button key={city} type="button" aria-label={`Маршрут ${origin} — ${city}`} onClick={() => onSearchDestination(city, origin)} className="home-popular-route mg-press relative h-[68px] min-w-[108px] flex-1 overflow-hidden rounded-2xl border border-white/70 bg-slate-200 text-left shadow-sm">
          <span aria-hidden="true" className="home-popular-route__reference-photo"/>
          <span className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent"/>
          <span className="home-popular-route__label absolute inset-x-2 bottom-2 flex items-end justify-between gap-1 text-[12px] font-extrabold leading-tight text-white"><span>{origin} →<br/>{city}</span><ChevronRight size={14} className="shrink-0"/></span>
        </button>)}
      </div>
    </section>
  </section>;
}
