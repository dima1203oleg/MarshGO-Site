import { ArrowRight, Clock3, MapPin, ShieldCheck, Ticket, TrainFront } from 'lucide-react';
import type { ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy } from '../services/productionApi';

const strategyLabels: Record<ApiJourneyStrategy, string> = {
  FASTEST: 'Найшвидше', CHEAPEST: 'Найдешевше', BALANCED: 'Оптимально',
  PREMIUM: 'Premium', RELIABLE: 'Найнадійніше', CUSTOM: 'Ваш пріоритет',
};

const formatPrice = (minor: number) => new Intl.NumberFormat('uk-UA', {
  style: 'currency', currency: 'UAH', maximumFractionDigits: 0,
}).format(minor / 100);

const formatDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} год ${minutes % 60} хв` : `${minutes} хв`;
};

function JourneyCard({ journey, onOpenOffer }: { journey: ApiJourney; onOpenOffer: (offerId: string) => void }) {
  const leg = journey.legs[0];
  if (!leg) return null;
  const time = (value: string) => new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date(value));
  const priceStatus = leg.priceStatus === 'LOCKED' ? 'Ціну підтверджено' : leg.priceStatus === 'ESTIMATED' ? 'Орієнтовна ціна' : leg.priceStatus === 'DYNAMIC' ? 'Ціна може змінитися' : 'Ціна уточнюється';
  const transit = journey.source === 'gtfs-static';
  const priceLabel = journey.confirmedPriceMinor !== null ? 'Підтверджена ціна' : transit ? 'Вартість квитка' : 'Орієнтовна ціна';
  const shownPrice = journey.confirmedPriceMinor ?? journey.totalPriceMinor;
  const modeLabels: Record<string, string> = { BUS: 'Автобус', MINIBUS: 'Маршрутка', RAIL: 'Залізниця', TRAM: 'Трамвай', TROLLEYBUS: 'Тролейбус', METRO: 'Метро', FERRY: 'Пором' };

  return <article className="journey-result-card rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(24,58,105,.07)]">
    <div className="flex items-center justify-between gap-3">
      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700">{modeLabels[leg.mode] ?? strategyLabels[journey.strategy]}</span>
      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>{transit ? journey.providerName ?? 'Розклад перевізника' : 'MARSHGO Community'}</span>
    </div>
    <div className="journey-result-path mt-4 grid grid-cols-[auto_1fr] gap-x-3">
      <div className="flex flex-col items-center pt-1"><span className="h-2.5 w-2.5 rounded-full border-[3px] border-blue-600 bg-white"/><span className="my-1.5 w-px flex-1 border-l border-dashed border-blue-300"/><span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-100"/></div>
      <div className="min-w-0 pb-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><small className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Відправлення</small><b className="mt-0.5 block truncate text-sm">{leg.origin.name}</b></div><b className="shrink-0 text-sm tabular-nums">{time(leg.departureAt)}</b></div>
      <div className="my-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500"><span className="flex items-center gap-1"><Clock3 size={12}/>{formatDuration(journey.totalDurationSeconds)}</span><span className="flex items-center gap-1"><MapPin size={12}/>{journey.transfers ? `${journey.transfers} пересадок` : 'Без пересадок'}</span>{journey.walkingMeters > 0 && <span>{journey.walkingMeters} м пішки</span>}</div>
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><small className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Прибуття</small><b className="mt-0.5 block truncate text-sm">{leg.destination.name}</b></div><b className="shrink-0 text-sm tabular-nums">{time(leg.arrivalAt)}</b></div></div>
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
      {transit ? <div className="flex min-w-0 items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><TrainFront size={18}/></span><div className="min-w-0"><b className="block truncate text-xs">{leg.routeName ? `Маршрут ${leg.routeName}` : modeLabels[leg.mode]}</b><span className="block truncate text-[10px] text-slate-500">{leg.headsign || 'Прямий рейс'} · місця не підтверджені</span></div></div> : <div className="flex min-w-0 items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">{leg.driver?.name.slice(0, 1).toLocaleUpperCase('uk-UA')}</span><div className="min-w-0"><b className="block truncate text-xs">{leg.driver?.name}</b><span className="flex items-center gap-1 text-[10px] text-slate-500"><ShieldCheck size={12} className="text-emerald-600"/>{leg.driver?.reviewCount ? `${leg.driver.averageRating?.toFixed(1)} · ${leg.driver.reviewCount} відгуків` : 'Новий водій'}</span></div></div>}
      <div className="shrink-0 text-right"><small className="block text-[9px] text-slate-500">{priceLabel}</small><b className="text-lg tabular-nums">{shownPrice === null ? '—' : formatPrice(shownPrice)}</b><small className="block text-[9px] text-slate-500">{transit ? 'у джерелі не вказано' : priceStatus}</small></div>
    </div>
    <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[10px] leading-4 text-slate-600">{transit ? 'Це розклад, а не підтверджене бронювання: наявність місць, ціна та актуальні зміни рейсу можуть відрізнятися. Перевірте інформацію в перевізника.' : 'План не резервує місце. Остаточна наявність і вартість підтверджуються перед бронюванням.'}</p>
    {transit ? <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 py-3.5 text-xs font-bold text-blue-800"><TrainFront size={15}/>Розклад знайдено · квиток не бронюється</div> : journey.offerId && <button onClick={() => onOpenOffer(journey.offerId!)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-xs font-bold text-white shadow-md shadow-blue-600/15"><Ticket size={15}/>Переглянути поїздку<ArrowRight size={15}/></button>}
  </article>;
}

export function JourneyResultsPanel({ result, onOpenOffer }: { result: ApiJourneySearchResult; onOpenOffer: (offerId: string, journeyId: string, journeyLegId: string) => void }) {
  return <section aria-label="План маршруту" className="mt-4">
    <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600">Ваш маршрут</p><h2 className="mt-1 text-xl font-extrabold">Найкращі доступні варіанти</h2><p className="mt-1 text-xs text-slate-500">Порівняйте час, пересадки та ціну.</p></div>
    {result.partial && <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Показані джерела: розклади громадського транспорту та попутки MARSHGO, де вони доступні. Для решти сервісів потрібні окремі API доступи; ціни, місця й бронювання поза MARSHGO можуть бути недоступні.</p>}
    {result.providerErrors.length > 0 && <p className="mb-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-800">Деякі розклади тимчасово недоступні: {result.providerErrors.join('; ')}.</p>}
    {result.journeys.length ? <div className="space-y-3">{result.journeys.map(journey => <JourneyCard key={journey.id} journey={journey} onOpenOffer={offerId => onOpenOffer(offerId, journey.id, journey.legs[0]?.id ?? '')}/>)}</div> : <div className="rounded-2xl bg-white p-6 text-center"><MapPin className="mx-auto text-slate-300"/><p className="mt-2 font-bold">Актуальних маршрутів поки немає</p><p className="mt-1 text-sm text-slate-500">{result.partial ? 'Для обраних видів транспорту маршрути ще не будуються. Додайте «Попутка» або оберіть «Усі».' : 'Спробуйте інший час або перевірте сповіщення пізніше.'}</p></div>}
  </section>;
}
