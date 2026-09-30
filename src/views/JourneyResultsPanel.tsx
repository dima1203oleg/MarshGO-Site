import { ArrowRight, Clock3, MapPin, ShieldCheck, Ticket } from 'lucide-react';
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

  return <article className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-[0_4px_16px_rgba(30,64,100,.05)]">
    <div className="flex items-center justify-between gap-3">
      <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700">{strategyLabels[journey.strategy]}</span>
      <span className="text-[10px] font-semibold text-emerald-700">Community · актуальна пропозиція</span>
    </div>
    <div className="mt-4 flex items-center gap-2 text-sm font-extrabold">
      <span className="truncate">{leg.origin.name}</span><ArrowRight size={15} className="shrink-0 text-blue-600"/><span className="truncate">{leg.destination.name}</span>
    </div>
    <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
      <div className="space-y-1 text-xs text-slate-500">
        <p className="flex items-center gap-1.5"><Clock3 size={14}/>{formatDuration(journey.totalDurationSeconds)} · {new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date(leg.departureAt))}</p>
        <p className="flex items-center gap-1.5"><MapPin size={14}/>{journey.transfers} пересадок · {journey.walkingMeters} м пішки</p>
        <p className="flex items-center gap-1.5"><ShieldCheck size={14}/>{leg.driver.reviewCount ? `${leg.driver.averageRating?.toFixed(1)} · ${leg.driver.reviewCount} відгуків` : 'Новий водій'}</p>
      </div>
      <div className="text-right"><b className="text-lg">{formatPrice(journey.totalPriceMinor)}</b><small className="block text-[10px] text-slate-500">оцінка, не бронювання</small></div>
    </div>
    <p className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] leading-4 text-slate-600">План не резервує місце. Остаточна наявність і ціна підтверджуються під час бронювання.</p>
    <button onClick={() => onOpenOffer(journey.offerId)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white"><Ticket size={15}/>Переглянути пропозицію й бронювання<ArrowRight size={15}/></button>
  </article>;
}

export function JourneyResultsPanel({ result, onOpenOffer }: { result: ApiJourneySearchResult; onOpenOffer: (offerId: string, journeyId: string, journeyLegId: string) => void }) {
  return <section aria-label="План маршруту" className="mt-4">
    <div className="mb-3"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Journey Planner</p><h2 className="mt-1 text-xl font-extrabold">Варіанти маршруту</h2></div>
    {result.partial && <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Зараз доступні лише підтверджені пропозиції MARSHGO Community. Автобуси, таксі й громадський транспорт не підключені як реальні джерела.</p>}
    {result.journeys.length ? <div className="space-y-3">{result.journeys.map(journey => <JourneyCard key={journey.id} journey={journey} onOpenOffer={offerId => onOpenOffer(offerId, journey.id, journey.legs[0]?.id ?? '')}/>)}</div> : <div className="rounded-2xl bg-white p-6 text-center"><MapPin className="mx-auto text-slate-300"/><p className="mt-2 font-bold">Актуальних маршрутів поки немає</p><p className="mt-1 text-sm text-slate-500">Спробуйте інший час або перевірте сповіщення пізніше.</p></div>}
  </section>;
}
