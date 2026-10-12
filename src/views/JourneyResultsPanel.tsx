import { useEffect, useState } from 'react';
import { ArrowRight, Clock3, Footprints, Map as MapIcon, MapPin, ShieldCheck, Ticket, TrainFront } from 'lucide-react';
import type { ApiJourney, ApiJourneySearchResult, ApiJourneyStrategy } from '../services/productionApi';
import { journeyLegCaveat, journeyLegLabel } from './journeyLegLabel';
import { formatTransferCount, journeyModeColor } from '../map/journeyRouteModel';

const strategyLabels: Record<ApiJourneyStrategy, string> = {
  FASTEST: 'Найшвидші', CHEAPEST: 'Найдешевші', BALANCED: 'Оптимальні',
  PREMIUM: 'Premium', RELIABLE: 'Найнадійніше', CUSTOM: 'Ваш пріоритет',
};

const formatPrice = (minor: number, currency = 'UAH') => new Intl.NumberFormat('uk-UA', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(minor / 100);

const formatDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} год ${minutes % 60} хв` : `${minutes} хв`;
};

const formatTime = (value: string) => new Intl.DateTimeFormat('uk-UA', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
}).format(new Date(value));

function JourneyCard({ journey, onOpenOffer, onOpenMap }: {
  journey: ApiJourney;
  onOpenOffer: (offerId: string, journeyId: string, journeyLegId: string) => void;
  onOpenMap: (journey: ApiJourney) => void;
}) {
  const legs = journey.legs;
  const firstLeg = legs[0];
  const lastLeg = legs.at(-1);
  if (!firstLeg || !lastLeg) return null;

  const transitLegs = legs.filter(leg => leg.mode !== 'WALK');
  if (transitLegs.length === 0) return null;
  const hasEstimatedWalking = legs.some(leg => journeyLegCaveat(leg.mode, leg.source) !== null);
  const isMultimodal = transitLegs.length > 1 || (transitLegs.length === 1 && legs.length > 1);
  const hasTransitSchedule = transitLegs.some(leg => leg.source === 'gtfs-static');
  const communityLeg = transitLegs.find(leg => leg.mode === 'COMMUNITY' || Boolean(leg.offerId));
  const reservableLeg = legs.find(leg => Boolean(leg.offerId));
  const shownPrice = journey.confirmedPriceMinor ?? journey.totalPriceMinor;
  const routeStart = journey.requestedDepartureAt ?? firstLeg.departureAt;
  const chainLabel = transitLegs.map(leg => `${journeyLegLabel(leg.mode, leg.transportType)}${leg.routeName ? ` ${leg.routeName}` : ''}`).join(' + ');
  const priceLabel = journey.confirmedPriceMinor !== null ? 'Підтверджена ціна'
    : journey.estimatedPriceMinMinor !== null && journey.estimatedPriceMaxMinor !== null
      ? `Оцінка ${formatPrice(journey.estimatedPriceMinMinor)}–${formatPrice(journey.estimatedPriceMaxMinor)}`
      : 'Ціна уточнюється';

  return <article data-journey-id={journey.id} className="journey-result-card rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_6px_18px_rgba(24,58,105,.06)]">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-extrabold text-slate-800" aria-label={`Транспорт маршруту: ${chainLabel}`}>{chainLabel}</p>
        <p className="mt-1 truncate text-[10px] text-slate-500">{firstLeg.origin.name} <ArrowRight className="mx-0.5 inline" size={11}/> {lastLeg.destination.name}</p>
      </div>
    </div>

    <div className="mt-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <strong className="text-base font-extrabold tabular-nums">{formatTime(routeStart)}–{formatTime(lastLeg.arrivalAt)}</strong>
        <span className="truncate text-[10px] font-medium text-slate-500">{formatDuration(journey.totalDurationSeconds)}</span>
      </div>
      <div className="shrink-0 text-right"><small className="block text-[9px] leading-3 text-slate-500">{priceLabel}</small><strong className="text-base font-extrabold tabular-nums">{shownPrice === null ? '—' : formatPrice(shownPrice, journey.currency ?? 'UAH')}</strong></div>
    </div>

    <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${transitLegs.length}, minmax(0, 1fr))` }} role="list" aria-label={`Послідовність транспорту: ${chainLabel}`}>
      {transitLegs.map(leg => <div key={leg.id} role="listitem" className="min-w-0">
        <div className="flex items-center gap-1.5 overflow-hidden text-[9px] font-bold">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: journeyModeColor(leg.mode, leg.transportType) }}/>
          <span className="truncate">{journeyLegLabel(leg.mode, leg.transportType)}{leg.routeName ? ` ${leg.routeName}` : ''}</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full" style={{ backgroundColor: journeyModeColor(leg.mode, leg.transportType) }}/>
        <span className="mt-1 block truncate text-[9px] tabular-nums text-slate-500">{formatDuration(leg.durationSeconds)}</span>
        <span className="block truncate text-[9px] font-semibold text-slate-600" aria-label={leg.fareIncludedByPreviousSegment ? 'Вартість цього сегмента включена у попередній квиток' : leg.priceMinor === null ? 'Ціна сегмента уточнюється' : `Орієнтовна ціна сегмента ${formatPrice(leg.priceMinor, leg.currency ?? journey.currency ?? 'UAH')}`}>
          {leg.fareIncludedByPreviousSegment ? 'у квитку' : leg.priceMinor === null ? 'ціна уточнюється' : formatPrice(leg.priceMinor, leg.currency ?? journey.currency ?? 'UAH')}
        </span>
      </div>)}
    </div>

    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500">
      <span className="inline-flex items-center gap-1"><MapPin size={12}/>{formatTransferCount(journey.transfers)}</span>
      {journey.walkingMeters > 0 && <span className="inline-flex items-center gap-1"><Footprints size={12}/>{hasEstimatedWalking ? '≈ ' : ''}{journey.walkingMeters} м пішки</span>}
      {journey.waitingSeconds !== undefined && journey.waitingSeconds > 0 && <span className="inline-flex items-center gap-1"><Clock3 size={12}/>{formatDuration(journey.waitingSeconds)} очікування</span>}
      {communityLeg?.driver && <span className="inline-flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-600"/>{communityLeg.driver.name}{communityLeg.driver.reviewCount ? ` · ${communityLeg.driver.averageRating?.toFixed(1)}` : ''}</span>}
    </div>

    <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
      <button type="button" onClick={() => onOpenMap(journey)} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 text-[10px] font-bold text-blue-800 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><MapIcon size={14}/>На карті<ArrowRight size={13}/></button>
      {reservableLeg ? <button type="button" onClick={() => onOpenOffer(reservableLeg.offerId!, journey.id, reservableLeg.id)} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-[10px] font-bold text-white shadow-sm"><Ticket size={14}/>{isMultimodal ? 'Попутка' : 'Поїздка'}</button>
        : <span className="flex min-h-10 flex-1 items-center justify-center rounded-xl bg-slate-50 px-2 text-center text-[9px] font-semibold text-slate-500"><TrainFront size={13} className="mr-1 shrink-0"/>{hasTransitSchedule ? 'Розклад · без бронювання' : 'Бронювання недоступне'}</span>}
    </div>
  </article>;
}

export function JourneyResultsPanel({ result, onOpenOffer, onOpenMap }: { result: ApiJourneySearchResult; onOpenOffer: (offerId: string, journeyId: string, journeyLegId: string) => void; onOpenMap: (journey: ApiJourney) => void }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const strategyOptions = result.availableStrategies?.length
    ? result.availableStrategies
    : [...new Set(result.journeys.flatMap(journey => journey.recommendedStrategies ?? [journey.strategy]))];
  const defaultStrategy = result.requestedStrategy && strategyOptions.includes(result.requestedStrategy)
    ? result.requestedStrategy
    : strategyOptions.includes('BALANCED') ? 'BALANCED' : strategyOptions[0] ?? 'BALANCED';
  const [activeStrategy, setActiveStrategy] = useState<ApiJourneyStrategy>(defaultStrategy);
  useEffect(() => {
    setActiveFilter('all');
    setActiveStrategy(defaultStrategy);
  }, [result, defaultStrategy]);
  const filterGroups = [
    { id: 'community', label: 'Попутки', modes: ['COMMUNITY', 'COMMUNITY_DEMAND'] },
    { id: 'bus', label: 'Автобуси', modes: ['BUS', 'URBAN_BUS', 'MINIBUS'] },
    { id: 'rail', label: 'Потяги', modes: ['RAIL'] },
    ...[
      ['TRAM', 'Трамваї'], ['TROLLEYBUS', 'Тролейбуси'], ['METRO', 'Метро'],
      ['FERRY', 'Пороми'], ['FUNICULAR', 'Фунікулери'],
    ].map(([mode, label]) => ({ id: mode, label, modes: [mode] })),
  ].filter(group => result.journeys.some(journey => journey.legs.some(leg => group.modes.includes(leg.mode))));
  const strategyJourneys = result.journeys
    .filter(journey => journey.strategyRanks
      ? typeof journey.strategyRanks[activeStrategy] === 'number'
      : (journey.recommendedStrategies ?? [journey.strategy]).includes(activeStrategy))
    .sort((a, b) => (a.strategyRanks?.[activeStrategy] ?? Number.MAX_SAFE_INTEGER)
      - (b.strategyRanks?.[activeStrategy] ?? Number.MAX_SAFE_INTEGER)
      || a.totalDurationSeconds - b.totalDurationSeconds);
  const visibleJourneys = activeFilter === 'all' ? strategyJourneys : strategyJourneys.filter(journey => {
    const group = filterGroups.find(item => item.id === activeFilter);
    return group && journey.legs.some(leg => group.modes.includes(leg.mode));
  });
  const preferenceMessages: Record<string, string> = {
    preferredVehicleClass: 'клас автомобіля не застосовується до розкладів громадського транспорту',
    'maxPriceMinor:public-transit-fare-unavailable': 'обмеження ціни не застосовується до рейсів без тарифів у джерелі',
    'CHEAPEST:public-transit-fares-unavailable': 'найдешевший варіант серед розкладів без оприлюднених тарифів визначити неможливо',
    'maxTransfers:limited-to-4': 'планувальник будує максимум чотири пересадки',
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
    <div role="group" aria-label="Ранжування маршрутів" className="mb-3 grid grid-cols-3 gap-2">{(['BALANCED', 'FASTEST', 'CHEAPEST'] as const).map(strategy => { const count = result.journeys.filter(journey => journey.strategyRanks ? typeof journey.strategyRanks[strategy] === 'number' : (journey.recommendedStrategies ?? [journey.strategy]).includes(strategy)).length; const available = count > 0; return <button key={strategy} type="button" disabled={!available} aria-pressed={activeStrategy === strategy} aria-label={`${strategyLabels[strategy]}${available ? `, ${count} маршрутів` : ', недоступно для цього запиту'}`} title={available ? undefined : 'Немає маршрутів із достатніми даними для цього режиму'} onClick={() => { setActiveStrategy(strategy); setActiveFilter('all'); }} className={`flex min-h-10 min-w-0 items-center justify-center rounded-full border px-1 text-[9px] font-bold disabled:cursor-not-allowed ${activeStrategy === strategy ? 'border-blue-600 bg-blue-600 text-white' : available ? 'border-slate-100 bg-white text-slate-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}><span className="whitespace-nowrap text-center">{strategyLabels[strategy]}</span></button>; })}</div>
    {result.journeys.length > 0 && <div role="group" aria-label="Фільтр маршрутів за транспортом" className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1"><button type="button" aria-pressed={activeFilter === 'all'} onClick={() => setActiveFilter('all')} className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold ${activeFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>Усі · {strategyJourneys.length}</button>{filterGroups.map(group => { const count = strategyJourneys.filter(journey => journey.legs.some(leg => group.modes.includes(leg.mode))).length; return <button key={group.id} type="button" aria-pressed={activeFilter === group.id} onClick={() => setActiveFilter(group.id)} className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold ${activeFilter === group.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>{group.label} · {count}</button>; })}</div>}
    {result.partial && <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Це частковий результат: враховані джерела, що відповіли для цієї території та часу. Розклад, наявність місць і тариф стороннього перевізника потрібно підтвердити у нього.</p>}
    {result.unsupportedPreferences.length > 0 && <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Не всі умови можна врахувати: {result.unsupportedPreferences.map(value => preferenceMessages[value] ?? value).join('; ')}.</p>}
    {result.providerErrors.length > 0 && <p className="mb-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-800">Деякі розклади тимчасово недоступні: {result.providerErrors.join('; ')}.</p>}
    {result.resultsTruncated && <p className="mb-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">Показано до {result.alternativeLimitPerStrategy ?? 12} різних варіантів на режим із {result.paretoCount ?? result.candidateCount ?? 'знайдених'} Pareto-варіантів. Результати обмежені, щоб пошук залишався швидким.</p>}
    {result.candidateGenerationTruncated && <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Пошук досяг ліміту обробки джерел; частина маршрутів могла не потрапити до результатів. Уточніть час або види транспорту й повторіть пошук.</p>}
    {result.journeys.length ? visibleJourneys.length ? <div className="space-y-3">{visibleJourneys.map(journey => <JourneyCard key={journey.id} journey={journey} onOpenOffer={onOpenOffer} onOpenMap={onOpenMap}/>)}</div> : <div className="rounded-2xl bg-white p-6 text-center"><p className="font-bold">Немає маршрутів у цій категорії</p><button type="button" onClick={() => setActiveFilter('all')} className="mt-2 text-sm font-bold text-blue-700">Показати всі</button></div> : <div className="rounded-2xl bg-white p-6 text-center"><MapPin className="mx-auto text-slate-300"/><p className="mt-2 font-bold">Актуальних маршрутів поки немає</p><p className="mt-1 text-sm text-slate-500">Спробуйте змінити вид транспорту, час або перевізників.</p></div>}
  </section>;
}
