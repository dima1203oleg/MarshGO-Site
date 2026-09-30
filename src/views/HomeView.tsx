import React, { useState } from 'react';
import {
  ArrowRight, ArrowRightLeft, Bus, CalendarDays, Car, CheckCircle2,
  ChevronRight, Clock3, Compass, Crosshair, Map, MapPin, Search,
  ShieldCheck, Sparkles, TrainFront, Users, Wind, Zap
} from 'lucide-react';
import { TransportCategory } from '../types';
import { detectCurrentLocation } from '../services/geolocation';
import { InteractiveMapPicker } from '../components/InteractiveMapPicker';
import { FuelCostCalculatorModal } from '../components/FuelCostCalculatorModal';
import { SafetyTripModal } from '../components/SafetyTripModal';

interface HomeViewProps {
  onSearch: (params: { origin: string; destination: string; date: string; passengers: number }) => void;
  onNavigate: (view: string) => void;
  onCategoryClick: (cat: TransportCategory) => void;
}

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const routeExamples = [
  { from: 'Київ', to: 'Львів', price: 'від 550 ₴', duration: '≈ 6 год 30 хв', tint: 'from-sky-500 to-blue-800', icon: '🌄' },
  { from: 'Одеса', to: 'Київ', price: 'від 450 ₴', duration: '≈ 6 год', tint: 'from-amber-500 to-rose-800', icon: '🌅' },
  { from: 'Львів', to: 'Івано-Франківськ', price: 'від 280 ₴', duration: '≈ 2 год 30 хв', tint: 'from-emerald-500 to-teal-900', icon: '⛰️' },
];

const transportTypes: { id: TransportCategory; label: string; detail: string; icon: React.ReactNode; tone: string }[] = [
  { id: 'community', label: 'Попутка', detail: '0% комісії', icon: <Car />, tone: 'bg-emerald-50 text-emerald-700' },
  { id: 'taxi_pro', label: 'Таксі', detail: 'Швидко та зручно', icon: <Car />, tone: 'bg-amber-50 text-amber-700' },
  { id: 'bus', label: 'Автобуси', detail: 'По всій Україні', icon: <Bus />, tone: 'bg-blue-50 text-blue-700' },
  { id: 'minibus', label: 'Маршрутки', detail: 'Більше напрямків', icon: <Bus />, tone: 'bg-violet-50 text-violet-700' },
  { id: 'carsharing', label: 'Каршеринг', detail: 'Свобода руху', icon: <Car />, tone: 'bg-teal-50 text-teal-700' },
  { id: 'rail', label: 'Потяг', detail: 'Комфорт і швидкість', icon: <TrainFront />, tone: 'bg-indigo-50 text-indigo-700' },
  { id: 'transit', label: 'Транспорт', detail: 'Міські маршрути', icon: <Compass />, tone: 'bg-slate-100 text-slate-700' },
];

export const HomeView: React.FC<HomeViewProps> = ({ onSearch, onNavigate, onCategoryClick }) => {
  const [origin, setOrigin] = useState('Київ');
  const [destination, setDestination] = useState('Львів');
  const [date, setDate] = useState(localDate);
  const [passengers, setPassengers] = useState(1);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [notice, setNotice] = useState('');
  const [isFuelCalcOpen, setIsFuelCalcOpen] = useState(false);
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!origin.trim() || !destination.trim() || origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
      setNotice('Вкажіть різні міста відправлення та прибуття.');
      return;
    }
    setNotice('');
    onSearch({ origin: origin.trim(), destination: destination.trim(), date, passengers });
  };

  const detectLocation = async () => {
    setIsLocating(true);
    const result = await detectCurrentLocation();
    setIsLocating(false);
    setNotice(result.success && result.location ? `Ваше місто: ${result.location.city}` : result.error || 'Не вдалося визначити місце.');
    if (result.success && result.location) setOrigin(result.location.city);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const swapCities = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  return (
    <div className="min-h-screen bg-[#F5F8FD] pb-24 md:pb-12">
      <section className="relative overflow-hidden bg-[#07182E] text-white">
        <div className="pointer-events-none absolute -right-24 -top-48 h-[35rem] w-[35rem] rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-9 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[1.15fr_.85fr] lg:gap-12 lg:pb-20">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-[11px] font-bold tracking-[.16em] text-cyan-200 uppercase">
              <MapPin className="h-3.5 w-3.5" /> Україна ближче
            </div>
            <h1 className="font-display text-[2.7rem] font-extrabold leading-[.99] tracking-tight sm:text-6xl lg:text-[4.4rem]">
              Більше можливостей у кожній поїздці<span className="text-[#32A8FF]">.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Попутки, таксі, автобуси та громадський транспорт — знайдіть свій маршрут в одному пошуку.
            </p>

            <form onSubmit={submitSearch} className="mt-8 rounded-[1.7rem] border border-white/20 bg-white p-3 text-[#14243B] shadow-[0_25px_80px_rgba(0,0,0,.32)] sm:p-4">
              {showMapPicker && <div className="mb-3 overflow-hidden rounded-2xl"><InteractiveMapPicker origin={origin} destination={destination} onSelectOrigin={setOrigin} onSelectDestination={setDestination} onSwap={swapCities} onConfirm={() => { setShowMapPicker(false); onSearch({ origin, destination, date, passengers }); }} /></div>}
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <label className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 transition focus-within:border-blue-500 focus-within:bg-white">
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"><MapPin className="h-3.5 w-3.5 text-blue-600" /> Звідки</span>
                  <input aria-label="Місто відправлення" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Місто відправлення" className="mt-1 w-full bg-transparent text-sm font-bold outline-none placeholder:font-normal" />
                </label>
                <button type="button" onClick={swapCities} aria-label="Поміняти міста місцями" className="mx-auto -my-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-sm transition hover:rotate-180 sm:my-0"><ArrowRightLeft className="h-4 w-4" /></button>
                <label className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 transition focus-within:border-blue-500 focus-within:bg-white">
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"><MapPin className="h-3.5 w-3.5 text-emerald-600" /> Куди</span>
                  <input aria-label="Місто прибуття" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Місто прибуття" className="mt-1 w-full bg-transparent text-sm font-bold outline-none placeholder:font-normal" />
                </label>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 focus-within:border-blue-500 focus-within:bg-white">
                  <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" /><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Коли?</span><input aria-label="Дата поїздки" type="date" min={localDate()} value={date} onChange={(e) => setDate(e.target.value)} className="mt-0.5 w-full bg-transparent text-xs font-bold outline-none" /></span>
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 focus-within:border-blue-500 focus-within:bg-white">
                  <Users className="h-4 w-4 shrink-0 text-blue-600" /><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Пасажири</span><select aria-label="Кількість пасажирів" value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="mt-0.5 w-full bg-transparent text-xs font-bold outline-none"><option value={1}>1 пасажир</option><option value={2}>2 пасажири</option><option value={3}>3 пасажири</option><option value={4}>4 пасажири</option></select></span>
                </label>
                <button type="submit" className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 active:scale-[.98] sm:min-w-48"><Search className="h-4 w-4" /> Знайти маршрути <ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px]">
                <div className="flex items-center gap-2 text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Перевірені водії · прозорі ціни</div>
                <div className="flex gap-3">
                  <button type="button" onClick={detectLocation} disabled={isLocating} className="inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900"><Crosshair className={`h-3.5 w-3.5 ${isLocating ? 'animate-spin' : ''}`} /> Моє місце</button>
                  <button type="button" onClick={() => setShowMapPicker((show) => !show)} className="inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900"><Map className="h-3.5 w-3.5" /> {showMapPicker ? 'Сховати карту' : 'Обрати на карті'}</button>
                </div>
              </div>
              {notice && <p aria-live="polite" className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-700"><CheckCircle2 className="h-4 w-4" />{notice}</p>}
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Безпечно</span>
              <span className="inline-flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-300" /> Зручно</span>
              <span className="inline-flex items-center gap-1.5"><Wind className="h-4 w-4 text-cyan-300" /> Доступно</span>
              <button type="button" onClick={() => setIsSafetyOpen(true)} className="font-semibold text-cyan-200 underline-offset-4 hover:underline">Центр безпеки</button>
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-[28rem] lg:block">
            <div className="absolute -inset-8 rounded-full bg-blue-500/15 blur-3xl" />
            <div className="relative rounded-[2.6rem] border border-white/30 bg-gradient-to-br from-white/30 to-white/5 p-3 shadow-2xl backdrop-blur-xl rotate-2">
              <div className="overflow-hidden rounded-[2rem] bg-[#F7FAFF] p-4 text-[#14243B] shadow-inner">
                <div className="flex items-center justify-between px-1 pb-4"><div><div className="font-display text-2xl font-extrabold tracking-tight">MARSH<span className="text-blue-600">GO</span></div><div className="text-[10px] text-slate-500">Більше, ніж поїздка</div></div><div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm"><Compass className="h-4 w-4" /></div></div>
                <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 pb-2"><MapPin className="h-4 w-4 text-blue-600"/><div><div className="text-[10px] text-slate-500">Звідки</div><div className="text-xs font-extrabold">Київ</div></div></div><div className="flex items-center gap-3 pt-2"><MapPin className="h-4 w-4 text-emerald-600"/><div><div className="text-[10px] text-slate-500">Куди</div><div className="text-xs font-extrabold">Львів</div></div></div></div>
                <div className="my-3 flex gap-2 overflow-hidden">{transportTypes.slice(0, 5).map((item) => <div key={item.id} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 ${item.tone}`}><span className="[&>svg]:h-4 [&>svg]:w-4">{item.icon}</span><span className="truncate text-[9px] font-bold">{item.label}</span></div>)}</div>
                <div className="mb-2 flex items-center justify-between"><div><div className="text-xs font-extrabold">Найкращі варіанти</div><div className="text-[10px] text-slate-500">Київ → Львів · сьогодні</div></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">Демо</span></div>
                {[['Попутка', '5 год 30 хв', '750 ₴', 'from-amber-300 to-emerald-700'], ['Автобус', '6 год 10 хв', '520 ₴', 'from-sky-400 to-blue-900'], ['Таксі', '5 год 20 хв', '1 200 ₴', 'from-slate-300 to-slate-700']].map(([name, time, price, tint]) => <div key={name} className="mb-2 flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm"><div className={`flex h-12 w-14 items-center justify-center rounded-lg bg-gradient-to-br ${tint} text-xl`}>{name === 'Автобус' ? '🚌' : '🚘'}</div><div className="min-w-0 flex-1"><div className="text-xs font-extrabold">{name}</div><div className="flex items-center gap-1 text-[10px] text-slate-500"><Clock3 className="h-3 w-3" />{time}</div></div><div className="text-right text-xs font-extrabold">{price}<div className="text-[9px] font-medium text-slate-500">за місце</div></div></div>)}
                <div className="mt-3 rounded-xl bg-[#0A2344] p-3 text-white"><div className="flex items-center gap-2 text-[10px] font-bold text-blue-200"><Sparkles className="h-3.5 w-3.5"/> НЕ ЗНАЙШЛИ РЕЙС?</div><div className="mt-1 text-xs font-bold">Запропонуйте свій бюджет</div></div>
              </div>
            </div>
            <div className="absolute -left-10 top-20 rounded-2xl border border-white/40 bg-white/90 px-4 py-3 shadow-xl backdrop-blur"><div className="text-[10px] font-bold text-slate-500">Популярний маршрут</div><div className="mt-1 text-xs font-extrabold text-[#14243B]">Київ <ArrowRight className="mx-1 inline h-3 w-3 text-blue-600"/> Львів</div></div>
            <div className="absolute -right-4 bottom-12 rounded-2xl border border-white/30 bg-[#0D2C51]/90 px-4 py-3 text-white shadow-xl backdrop-blur"><div className="text-[10px] text-slate-300">Поїздок щодня</div><div className="text-lg font-extrabold">100+ <span className="text-xs font-medium text-cyan-300">маршрутів</span></div></div>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl space-y-12 px-4 py-9 sm:px-6 sm:py-12">
        <section aria-labelledby="transport-title">
          <div className="mb-5 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Знайдіть свій спосіб</p><h2 id="transport-title" className="mt-1 text-xl font-extrabold tracking-tight text-[#14243B] sm:text-2xl">Усі види транспорту</h2></div><button onClick={() => onCategoryClick('all')} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900">Усі варіанти <ArrowRight className="h-3.5 w-3.5" /></button></div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-7">
            {transportTypes.map((item) => <button key={item.id} onClick={() => onCategoryClick(item.id)} className="group min-w-[8.6rem] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg sm:min-w-0"><span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5 ${item.tone}`}>{item.icon}</span><span className="block text-xs font-extrabold text-[#14243B]">{item.label}</span><span className="mt-1 block text-[10px] text-slate-500">{item.detail}</span></button>)}
          </div>
        </section>

        <section aria-labelledby="routes-title">
          <div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Натхнення для подорожі</p><h2 id="routes-title" className="mt-1 text-xl font-extrabold tracking-tight text-[#14243B] sm:text-2xl">Популярні напрямки</h2></div><button onClick={() => onNavigate('search')} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">Більше напрямків <ArrowRight className="h-3.5 w-3.5"/></button></div>
          <div className="grid gap-4 sm:grid-cols-3">{routeExamples.map((route) => <button key={`${route.from}-${route.to}`} onClick={() => onSearch({ origin: route.from, destination: route.to, date, passengers })} className={`group relative min-h-48 overflow-hidden rounded-3xl bg-gradient-to-br ${route.tint} p-5 text-left text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl`}><span className="absolute -right-3 -top-8 text-8xl opacity-30 transition group-hover:scale-110">{route.icon}</span><div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-white/10"/><div className="relative flex h-full min-h-40 flex-col justify-between"><div className="flex items-center gap-2 text-sm font-extrabold">{route.from}<ArrowRight className="h-4 w-4"/>{route.to}</div><div><div className="text-2xl font-extrabold">{route.price}</div><div className="mt-1 flex items-center justify-between text-xs text-white/80"><span>{route.duration}</span><span className="inline-flex items-center gap-1 font-bold text-white">Шукати <ArrowRight className="h-3.5 w-3.5"/></span></div></div></div></button>)}</div>
        </section>

        <section className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
          <div><div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-blue-700"><Sparkles className="h-3.5 w-3.5"/> Зворотний пошук</div><h2 className="mt-3 text-xl font-extrabold tracking-tight text-[#14243B]">Не знайшли потрібний рейс?</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Вкажіть маршрут і бюджет — водії зможуть надіслати вам свою пропозицію.</p></div><button onClick={() => onNavigate('demand-new')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0C2444] px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-900">Створити запит <ArrowRight className="h-4 w-4"/></button>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5"><div className="flex flex-wrap gap-5 text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600"/> Верифіковані профілі</span><span className="inline-flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500"/> Зручний пошук</span><span className="inline-flex items-center gap-2"><Wind className="h-4 w-4 text-blue-600"/> Більше варіантів</span></div><div className="flex gap-2"><button onClick={() => setIsFuelCalcOpen(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm hover:border-blue-300">Калькулятор витрат</button><button onClick={() => setIsSafetyOpen(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm hover:border-emerald-300">Безпека</button></div></section>
      </main>

      <FuelCostCalculatorModal isOpen={isFuelCalcOpen} onClose={() => setIsFuelCalcOpen(false)} defaultOrigin={origin} defaultDestination={destination} defaultDistanceKm={475} />
      <SafetyTripModal isOpen={isSafetyOpen} onClose={() => setIsSafetyOpen(false)} tripDetails={{ origin, destination }} />
    </div>
  );
};
