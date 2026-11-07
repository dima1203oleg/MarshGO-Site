import { useRef } from 'react';
import { ArrowLeft, ArrowRight, Bike, Bus, CalendarClock, CarFront, LocateFixed, MapPin, Phone, ShieldCheck, TrainFront } from 'lucide-react';
import { HeroIllustration } from './HeroIllustration';
import { BrandMark } from './BrandMark';

type Props = {
  step: 1 | 2 | 3;
  permissionMessage: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onRequestLocation: () => void;
};

/** Search card mock: the passenger and planning scenario in one picture. */
function SearchPicture() {
  const modes = [{ Icon: CarFront, label: 'Попутка' }, { Icon: Bus, label: 'Автобус' }, { Icon: TrainFront, label: 'Поїзд' }, { Icon: Bike, label: 'Самокат' }];
  return <div className="w-full max-w-[19rem] rounded-[1.6rem] bg-white p-4 shadow-[0_18px_40px_rgba(23,90,170,.16)] dark:shadow-[0_18px_40px_rgba(0,0,0,.45)]">
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-xl bg-[#F4F8FD] px-3 py-2.5 dark:bg-[var(--mg-surface-secondary)]"><MapPin size={17} className="text-emerald-600 dark:text-[#74E0A1]"/><span><small className="block text-xs text-slate-400">Звідки</small><b className="text-sm text-[#0E1F35]">Моя локація</b></span></div>
      <div className="flex items-center gap-3 rounded-xl bg-[#F4F8FD] px-3 py-2.5 dark:bg-[var(--mg-surface-secondary)]"><MapPin size={17} className="text-rose-500"/><span><small className="block text-xs text-slate-400">Куди</small><b className="text-sm text-[#0E1F35]">Львів</b></span></div>
      <div className="flex items-center gap-3 rounded-xl bg-[#F4F8FD] px-3 py-2.5 dark:bg-[var(--mg-surface-secondary)]"><CalendarClock size={17} className="text-[var(--mg-blue)]"/><span><small className="block text-xs text-slate-400">Коли</small><b className="text-sm text-[#0E1F35]">Завтра, 08:00–08:30</b></span></div>
    </div>
    <div className="mt-3 grid grid-cols-4 gap-2">{modes.map(({ Icon, label }) => <div key={label} className="flex flex-col items-center gap-1"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--mg-blue-tint)] text-[var(--mg-blue-ink)] dark:bg-[var(--mg-surface-elevated)] dark:text-[var(--mg-blue)]"><Icon size={19}/></span><small className="text-xs font-semibold text-slate-600">{label}</small></div>)}</div>
  </div>;
}

/** Trust picture: what protects both sides of a trip. */
function TrustPicture() {
  const items = [{ Icon: Phone, title: 'Підтверджений номер', caption: 'Кожен акаунт' }, { Icon: ShieldCheck, title: 'Авто з номером і фото', caption: 'Перед першою поїздкою' }, { Icon: LocateFixed, title: 'Геолокація лише в поїздці', caption: 'Вимикається будь-коли' }];
  return <div className="w-full max-w-[19rem] space-y-2.5">{items.map(({ Icon, title, caption }) => <div key={title} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_10px_26px_rgba(23,90,170,.12)] dark:shadow-[0_10px_26px_rgba(0,0,0,.4)]">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[var(--mg-blue)]"><Icon size={19}/></span>
    <span><b className="block text-sm text-[#0E1F35]">{title}</b><small className="text-xs text-slate-500">{caption}</small></span>
  </div>)}</div>;
}

const slides = {
  1: { eyebrow: 'Головна ідея', title: 'Їдеш? MARSHGO допоможе знайти попутника', text: 'Почни навігацію, а якщо захочеш підбирати пасажирів — окремо увімкни пошук уздовж маршруту.' },
  2: { eyebrow: 'Пасажирам і водіям', title: 'Шукай поїздку або плануй наперед', text: 'Звідки, куди й коли — і MARSHGO покаже попутки, автобуси, потяги та самокати там, де вони вже підключені.' },
  3: { eyebrow: 'Безпека й приватність', title: 'Дозвольте MARSHGO бути корисним', text: 'Геолокація потрібна лише під час навігації чи зустрічі з водієм. Можна дозволити зараз або пізніше.' },
} as const;

/** First-run slides: one screen each (no scrolling), swipe or buttons to move, skip at any time. */
export function OnboardingSlides({ step, permissionMessage, onNext, onBack, onSkip, onFinish, onRequestLocation }: Props) {
  const touchStart = useRef<number | null>(null);
  const slide = slides[step];
  return <section className="mx-auto flex min-h-0 w-full max-w-md flex-col pt-2 text-[#14243b] dark:text-[var(--mg-ink-primary)]"
    onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
    onTouchEnd={(event) => {
      const start = touchStart.current; touchStart.current = null;
      const end = event.changedTouches[0]?.clientX;
      if (start === null || end === undefined || Math.abs(end - start) < 50) return;
      if (end < start) { if (step < 3) onNext(); } else onBack();
    }}>
    <header className="flex shrink-0 items-center justify-between">
      <button onClick={onBack} aria-label="Назад" className="mg-press grid h-11 w-11 place-items-center rounded-full border border-transparent bg-white shadow-sm dark:border-white/15"><ArrowLeft size={19}/></button>
      <BrandMark size="sm"/>
      <button onClick={onSkip} className="mg-press min-h-11 rounded-xl px-3 text-xs font-semibold text-slate-500">Пропустити</button>
    </header>

    <div className="relative mt-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_40%,#FFFFFF_0%,#EAF4FF_55%,#DCEBFF_100%)] p-4 dark:bg-[radial-gradient(circle_at_50%_40%,#183251_0%,#112540_55%,#0C1C31_100%)]">
      {step === 1 ? <HeroIllustration className="h-full max-h-[300px] w-auto max-w-full"/> : step === 2 ? <SearchPicture/> : <TrustPicture/>}
    </div>

    <div className="shrink-0 pt-5">
      <div className="flex justify-center gap-1.5" aria-label={`Крок ${step} з 3`}>{([1, 2, 3] as const).map((item) => <span key={item} className={`h-1.5 rounded-full transition-all ${item === step ? 'w-6 bg-[var(--mg-action)]' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`}/>)}</div>
      <p className="mt-4 text-center text-xs font-bold uppercase tracking-[.18em] text-[var(--mg-blue-ink)]">{slide.eyebrow}</p>
      <h1 className="mx-auto mt-1.5 max-w-sm text-balance text-center text-[1.6rem] font-extrabold leading-tight tracking-tight text-[#081b35]">{slide.title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-slate-600">{slide.text}</p>
      {step === 3 && permissionMessage && <p role="status" className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900 dark:bg-[rgba(22,135,255,.14)] dark:text-[var(--mg-blue)]">{permissionMessage}</p>}
    </div>

    <div className="shrink-0 pb-1 pt-5">
      {step < 3
        ? <button onClick={onNext} className="mg-press flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--mg-action)] py-4 text-sm font-bold text-white shadow-lg shadow-blue-900/25 hover:bg-[var(--mg-action-hover)]">Далі <ArrowRight size={17}/></button>
        : <>
          <button onClick={onRequestLocation} className="mg-press flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white py-3.5 text-sm font-bold text-[var(--mg-blue-ink)] dark:border-slate-700"><LocateFixed size={17}/>Дозволити геолокацію</button>
          <button onClick={onFinish} className="mg-press mt-2.5 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--mg-action)] py-4 text-sm font-bold text-white shadow-lg shadow-blue-900/25 hover:bg-[var(--mg-action-hover)]">Продовжити <ArrowRight size={17}/></button>
          <button onClick={onSkip} className="mg-press min-h-11 w-full rounded-xl text-sm font-semibold text-slate-500">Не зараз</button>
        </>}
    </div>
  </section>;
}
