import { useEffect, useState } from 'react';
import { ArrowRight, Clock3, Footprints, MapPin, ShieldCheck, Ticket, TrainFront } from 'lucide-react';
import type { ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy } from '../services/productionApi';

const strategyLabels: Record<ApiJourneyStrategy, string> = {
  FASTEST: 'Найшвидше', CHEAPEST: 'Найдешевше', BALANCED: 'Оптимально',
  PREMIUM: 'Premium', RELIABLE: 'Найнадійніше', CUSTOM: 'Ваш пріоритет',
};

const modeLabels: Record<string, string> = {
  WALK: 'Пішки', COMMUNITY: 'Попутка MARSHGO', BUS: 'Автобус', MINIBUS: 'Маршрутка',
  RAIL: 'Залізниця', FUNICULAR: 'Фунікулер', city_train: 'Міська електричка', funicular: 'Фунікулер',
  TRAM: 'Трамвай', TROLLEYBUS: 'Тролейбус', METRO: 'Метро', FERRY: 'Пором',
};

const formatPrice = (minor: number) => new Intl.NumberFormat('uk-UA', {
  style: 'currency', currency: 'UAH', maximumFractionDigits: 0,
}).format(minor / 100);

const formatDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} год ${minutes % 60} хв` : `${minutes} хв`;
};

const formatTime = (value: string) => new Intl.DateTimeFormat('uk-UA', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
}).format(new Date(value));

function JourneyCard({ journey, onOpenOffer }: {
  journey: ApiJourney;
  onOpenOffer: (offerId: string, journeyId: string, journeyLegId: string) => void;
}) {
  const legs = journey.legs;
  const firstLeg = legs[0];
  const lastLeg = legs.at(-1);
  if (!firstLeg || !lastLeg) return null;

  const transitLegs = legs.filter(leg => leg.mode !== 'WALK');
  const isMultimodal = transitLegs.length > 1 || (transitLegs.length === 1 && legs.length > 1);
  const hasTransitSchedule = transitLegs.some(leg => leg.source === 'gtfs-static');
  const communityLeg = transitLegs.find(leg => leg.mode === 'COMMUNITY' || Boolean(leg.offerId));
  const reservableLeg = legs.find(leg => Boolean(leg.offerId));
  const shownPrice = journey.confirmedPriceMinor ?? journey.totalPriceMinor;
  const priceLabel = journey.confirmedPriceMinor !== null ? 'Підтверджена ціна'
    : journey.estimatedPriceMinMinor !== null && journey.estimatedPriceMaxMinor !== null
      ? `Оцінка ${formatPrice(journey.estimatedPriceMinMinor)}–${formatPrice(journey.estimatedPriceMaxMinor)}`
      : 'Ціна уточнюється';

  return <article className="journey-result-card rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(24,58,105,.07)]">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700">
        {isMultimodal ? 'Комбінований маршрут' : modeLabels[firstLeg.mode] ?? 'Маршрут'}
      </span>
      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700">{strategyLabels[journey.strategy]}</span>
    </div>

    <div className="journey-result-path mt-4 grid grid-cols-[auto_1fr] gap-x-3">
      <div className="flex flex-col items-center pt-1"><span className="h-2.5 w-2.5 rounded-full border-[3px] border-blue-600 bg-white"/><span className="my-1.5 w-px flex-1 border-l border-dashed border-blue-300"/><span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-100"/></div>
      <div className="min-w-0 pb-3">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><small className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Відправлення</small><b className="mt-0.5 block truncate text-sm">{firstLeg.origin.name}</b></div><b className="shrink-0 text-sm tabular-nums">{formatTime(firstLeg.departureAt)}</b></div>
        <div className="my-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500"><span className="flex items-center gap-1"><Clock3 size={12}/>{formatDuration(journey.totalDurationSeconds)}</span><span className="flex items-center gap-1"><MapPin size={12}/>{journey.transfers ? `${journey.transfers} пересадок` : 'Без пересадок'}</span>{journey.walkingMeters > 0 && <span className="flex items-center gap-1"><Footprints size={12}/>{journey.walkingMeters} м пішки</span>}</div>
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><small className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Прибуття</small><b className="mt-0.5 block truncate text-sm">{lastLeg.destination.name}</b></div><b className="shrink-0 text-sm tabular-nums">{formatTime(lastLeg.arrivalAt)}</b></div>
      </div>
    </div>

    <ol className="space-y-2 border-t border-slate-100 pt-3" aria-label="Відрізки маршруту">
      {legs.map((leg, index) => {
        const isWalk = leg.mode === 'WALK';
        const previous = legs[index - 1];
        const waitSeconds = previous ? Math.max(0, (Date.parse(leg.departureAt) - Date.parse(previous.arrivalAt)) / 1000) : 0;
        const title = modeLabels[leg.mode] ?? leg.mode;
        return <li key={leg.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
          {previous && waitSeconds > 0 && <p className="mb-2 border-l-2 border-amber-300 pl-2 text-[10px] text-slate-500">Пересадка · очікування {formatDuration(waitSeconds)}</p>}
          <div className="flex items-start gap-2.5">
            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${isWalk ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>{isWalk ? <Footprints size={14}/> : <TrainFront size={14}/>}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5"><b className="text-xs">{title}{leg.routeName ? ` · ${leg.routeName}` : ''}</b><span className="text-[10px] tabular-nums text-slate-500">{formatTime(leg.departureAt)}–{formatTime(leg.arrivalAt)}</span></div>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">{leg.origin.name} → {leg.destination.name}</p>
              {!isWalk && (leg.providerName || leg.headsign) && <p className="mt-0.5 truncate text-[10px] text-slate-500">{[leg.providerName, leg.headsign].filter(Boolean).join(' · ')}</p>}
            </div>
          </div>
        </li>;
      })}
    </ol>

    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
      {communityLeg?.driver ? <div className="flex min-w-0 items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">{communityLeg.driver.name.slice(0, 1).toLocaleUpperCase('uk-UA')}</span><div className="min-w-0"><b className="block truncate text-xs">{communityLeg.driver.name}</b><span className="flex items-center gap-1 text-[10px] text-slate-500"><ShieldCheck size={12} className="text-emerald-600"/>{communityLeg.driver.reviewCount ? `${communityLeg.driver.averageRating?.toFixed(1)} · ${communityLeg.driver.reviewCount} відгуків` : 'Новий водій'}</span></div></div>
        : <div className="flex min-w-0 items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><TrainFront size={18}/></span><div className="min-w-0"><b className="block truncate text-xs">{journey.providerName ?? transitLegs[0]?.providerName ?? 'Перевізники маршруту'}</b><span className="block truncate text-[10px] text-slate-500">{hasTransitSchedule ? 'Розклад без підтвердженого бронювання' : `${transitLegs.length} відрізки маршруту`}</span></div></div>}
      <div className="shrink-0 text-right"><small className="block text-[9px] text-slate-500">{priceLabel}</small><b className="text-lg tabular-nums">{shownPrice === null ? '—' : formatPrice(shownPrice)}</b><small className="block text-[9px] text-slate-500">{journey.confirmedPriceMinor !== null ? 'зафіксовано' : 'може змінитися'}</small></div>
    </div>
    {hasTransitSchedule && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] leading-4 text-amber-900">Розклад громадського транспорту може змінитися. Наявність місць і вартість квитків не підтверджуються цим пошуком.</p>}
    {reservableLeg ? <button onClick={() => onOpenOffer(reservableLeg.offerId!, journey.id, reservableLeg.id)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-xs font-bold text-white shadow-md shadow-blue-600/15"><Ticket size={15}/>{isMultimodal ? 'Переглянути пропозицію попутки' : 'Переглянути поїздку'}<ArrowRight size={15}/></button> : <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 py-3.5 text-xs font-bold text-blue-800"><TrainFront size={15}/>Розклад знайдено · квиток не бронюється</div>}
  </article>;
}

export function JourneyResultsPanel({ result, onOpenOffer }: { result: ApiJourneySearchResult; onOpenOffer: (offerId: string, journeyId: string, journeyLegId: string) => void }) {
  const [activeFilter, setActiveFilter] = useState('all');
  useEffect(() => setActiveFilter('all'), [result.journeys]);
  const filterGroups = [
    { id: 'community', label: 'Попутки', modes: ['COMMUNITY'] },
    { id: 'bus', label: 'Автобуси', modes: ['BUS', 'MINIBUS'] },
    { id: 'rail', label: 'Потяги', modes: ['RAIL'] },
    ...['TRAM', 'TROLLEYBUS', 'METRO', 'FERRY', 'FUNICULAR'].map(mode => ({ id: mode, label: modeLabels[mode], modes: [mode] })),
  ].filter(group => result.journeys.some(journey => journey.legs.some(leg => group.modes.includes(leg.mode))));
  const visibleJourneys = activeFilter === 'all' ? result.journeys : result.journeys.filter(journey => {
    const group = filterGroups.find(item => item.id === activeFilter);
    return group && journey.legs.some(leg => group.modes.includes(leg.mode));
  });
  const preferenceMessages: Record<string, string> = {
    preferredVehicleClass: 'клас автомобіля не застосовується до розкладів громадського транспорту',
    'maxPriceMinor:public-transit-fare-unavailable': 'обмеження ціни не застосовується до рейсів без тарифів у джерелі',
    'CHEAPEST:public-transit-fares-unavailable': 'найдешевший варіант серед розкладів без оприлюднених тарифів визначити неможливо',
    'maxTransfers:limited-to-2': 'планувальник будує максимум дві пересадки',
    'transportType:taxi:not-in-route-engine': 'маршрути таксі ще не входять до планувальника',
    'transportType:carsharing:not-in-route-engine': 'маршрути каршерінгу ще не входять до планувальника',
    'transportType:car_rental:not-in-route-engine': 'оренда авто доступна окремо, але не додається до маршрутного ланцюжка',
    'transportType:transfer:not-in-route-engine': 'зовнішні трансфери ще не входять до планувальника',
    'transportType:bike:not-in-route-engine': 'велосипедні прокати ще не додаються до маршрутного ланцюжка',
    'transportType:scooter:not-in-route-engine': 'самокати ще не додаються до маршрутного ланцюжка',
    'transportType:moped:not-in-route-engine': 'прокат мопедів ще не додається до маршрутного ланцюжка',
    'transportType:plane:not-in-route-engine': 'авіарейси ще не входять до планувальника',
    'transportType:walk:not-in-route-engine': 'пішки доступно лише як короткий підхід до зупинки, окремий маршрут не будується',
  };
  return <section aria-label="План маршруту" className="mt-4">
    <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600">Ваш маршрут</p><h2 className="mt-1 text-xl font-extrabold">Найкращі доступні варіанти</h2><p className="mt-1 text-xs text-slate-500">Порівняйте час, пересадки та ціну.</p></div>
    {result.journeys.length > 0 && <div role="group" aria-label="Фільтр маршрутів за транспортом" className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1"><button type="button" aria-pressed={activeFilter === 'all'} onClick={() => setActiveFilter('all')} className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold ${activeFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>Усі · {result.journeys.length}</button>{filterGroups.map(group => { const count = result.journeys.filter(journey => journey.legs.some(leg => group.modes.includes(leg.mode))).length; return <button key={group.id} type="button" aria-pressed={activeFilter === group.id} onClick={() => setActiveFilter(group.id)} className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold ${activeFilter === group.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>{group.label} · {count}</button>; })}</div>}
    {result.partial && <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Це частковий результат: враховані джерела, що відповіли для цієї території та часу. Розклад, наявність місць і тариф стороннього перевізника потрібно підтвердити у нього.</p>}
    {result.unsupportedPreferences.length > 0 && <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Не всі умови можна врахувати: {result.unsupportedPreferences.map(value => preferenceMessages[value] ?? value).join('; ')}.</p>}
    {result.providerErrors.length > 0 && <p className="mb-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-800">Деякі розклади тимчасово недоступні: {result.providerErrors.join('; ')}.</p>}
    {result.journeys.length ? visibleJourneys.length ? <div className="space-y-3">{visibleJourneys.map(journey => <JourneyCard key={journey.id} journey={journey} onOpenOffer={onOpenOffer}/>)}</div> : <div className="rounded-2xl bg-white p-6 text-center"><p className="font-bold">Немає маршрутів у цій категорії</p><button type="button" onClick={() => setActiveFilter('all')} className="mt-2 text-sm font-bold text-blue-700">Показати всі</button></div> : <div className="rounded-2xl bg-white p-6 text-center"><MapPin className="mx-auto text-slate-300"/><p className="mt-2 font-bold">Актуальних маршрутів поки немає</p><p className="mt-1 text-sm text-slate-500">Спробуйте змінити вид транспорту, час або перевізників.</p></div>}
  </section>;
}
