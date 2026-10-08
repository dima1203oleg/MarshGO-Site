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
  const modes = [{ Icon: CarFront, label: 'Попутка', tone: 'bg-blue-100 text-blue-600' }, { Icon: Bus, label: 'Автобус', tone: 'bg-emerald-100 text-emerald-600' }, { Icon: TrainFront, label: 'Поїзд', tone: 'bg-violet-100 text-violet-600' }, { Icon: Bike, label: 'Самокат', tone: 'bg-amber-100 text-amber-600' }];
  return <div className="w-full max-w-[19rem] rounded-[1.6rem] bg-white p-4 shadow-[0_18px_40px_rgba(23,90,170,.16)]">
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-xl bg-[#F4F8FD] px-3 py-2.5"><MapPin size={17} className="text-emerald-600"/><span><small className="block text-[10px] text-slate-400">Звідки</small><b className="text-sm text-[#0E1F35]">Моя локація</b></span></div>
      <div className="flex items-center gap-3 rounded-xl bg-[#F4F8FD] px-3 py-2.5"><MapPin size={17} className="text-rose-500"/><span><small className="block text-[10px] text-slate-400">Куди</small><b className="text-sm text-[#0E1F35]">Львів</b></span></div>
      <div className="flex items-center gap-3 rounded-xl bg-[#F4F8FD] px-3 py-2.5"><CalendarClock size={17} className="text-[#1789F4]"/><span><small className="block text-[10px] text-slate-400">Коли</small><b className="text-sm text-[#0E1F35]">Завтра, 08:00–08:30</b></span></div>
    </div>
    <div className="mt-3 grid grid-cols-4 gap-2">{modes.map(({ Icon, label, tone }) => <div key={label} className="flex flex-col items-center gap-1"><span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={19}/></span><small className="text-[10px] font-semibold text-slate-600">{label}</small></div>)}</div>
  </div>;
}

/** Trust picture: what protects both sides of a trip. */
function TrustPicture() {
  const items = [{ Icon: Phone, title: 'Підтверджений номер', caption: 'Кожен акаунт' }, { Icon: ShieldCheck, title: 'Авто з номером і фото', caption: 'Перед першою поїздкою' }, { Icon: LocateFixed, title: 'Геолокація лише в поїздці', caption: 'Вимикається будь-коли' }];
  return <div className="w-full max-w-[19rem] space-y-2.5">{items.map(({ Icon, title, caption }) => <div key={title} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_10px_26px_rgba(23,90,170,.12)]">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1789F4]"><Icon size={19}/></span>
    <span><b className="block text-sm text-[#0E1F35]">{title}</b><small className="text-xs text-slate-500">{caption}</small></span>
  </div>)}</div>;
}

const slides = {
  1: { eyebrow: 'Головна ідея', title: 'Їдеш? MARSHGO знайде попутника по дорозі', text: 'Просто почни навігацію — ми шукатимемо людей уздовж твого маршруту. Не треба створювати оголошення для кожної поїздки.' },
  2: { eyebrow: 'Пасажирам і водіям', title: 'Шукай поїздку або плануй наперед', text: 'Звідки, куди й коли — і MARSHGO покаже попутки, автобуси, потяги та самокати там, де вони вже підключені.' },
  3: { eyebrow: 'Безпека й приватність', title: 'Дозвольте MARSHGO бути корисним', text: 'Геолокація потрібна лише під час навігації чи зустрічі з водієм. Можна дозволити зараз або пізніше.' },
} as const;

/** First-run slides: one screen each (no scrolling), swipe or buttons to move, skip at any time. */
export function OnboardingSlides({ step, permissionMessage, onNext, onBack, onSkip, onFinish, onRequestLocation }: Props) {
  const touchStart = useRef<number | null>(null);
  const slide = slides[step];
  return <section className="mx-auto flex min-h-0 w-full max-w-md flex-col pt-2 text-[#14243b]"
    onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
    onTouchEnd={(event) => {
      const start = touchStart.current; touchStart.current = null;
      const end = event.changedTouches[0]?.clientX;
      if (start === null || end === undefined || Math.abs(end - start) < 50) return;
      if (end < start) { if (step < 3) onNext(); } else onBack();
    }}>
    <header className="flex shrink-0 items-center justify-between">
      <button onClick={onBack} aria-label="Назад" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><ArrowLeft size={19}/></button>
      <BrandMark size="sm"/>
      <button onClick={onSkip} className="px-2 py-2 text-xs font-semibold text-slate-500">Пропустити</button>
    </header>

    <div className="relative mt-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_40%,#FFFFFF_0%,#EAF4FF_55%,#DCEBFF_100%)] p-4">
      {step === 1 ? <HeroIllustration className="h-full max-h-[300px] w-auto max-w-full"/> : step === 2 ? <SearchPicture/> : <TrustPicture/>}
    </div>

    <div className="shrink-0 pt-5">
      <div className="flex justify-center gap-1.5" aria-label={`Крок ${step} з 3`}>{([1, 2, 3] as const).map((item) => <span key={item} className={`h-1.5 rounded-full transition-all ${item === step ? 'w-6 bg-[#1789F4]' : 'w-1.5 bg-slate-300'}`}/>)}</div>
      <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[.18em] text-[#1789F4]">{slide.eyebrow}</p>
      <h1 className="mx-auto mt-1.5 max-w-sm text-balance text-center text-[1.6rem] font-extrabold leading-tight tracking-tight text-[#081b35]">{slide.title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-slate-600">{slide.text}</p>
      {step === 3 && permissionMessage && <p role="status" className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">{permissionMessage}</p>}
    </div>

    <div className="shrink-0 pb-1 pt-5">
      {step < 3
        ? <button onClick={onNext} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2B95FF,#1477E6)] py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/25">Далі <ArrowRight size={17}/></button>
        : <>
          <button onClick={onRequestLocation} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white py-3.5 text-sm font-bold text-[#1789F4]"><LocateFixed size={17}/>Дозволити геолокацію</button>
          <button onClick={onFinish} className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2B95FF,#1477E6)] py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/25">Продовжити <ArrowRight size={17}/></button>
          <button onClick={onSkip} className="w-full py-2.5 text-sm font-semibold text-slate-500">Не зараз</button>
        </>}
    </div>
  </section>;
}
