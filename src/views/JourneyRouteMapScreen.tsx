import { useState } from 'react';
import { ArrowLeft, Clock3, Footprints, MapPin, Route as RouteIcon } from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import { buildJourneyRouteMapModel } from '../map/journeyRouteModel';
import type { MapStatus } from '../map/MapAdapter';
import type { ApiJourney } from '../services/productionApi';
import { journeyLegLabel } from './journeyLegLabel';

const formatTime = (value: string) => new Intl.DateTimeFormat('uk-UA', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
}).format(new Date(value));

const formatDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} год ${minutes % 60} хв` : `${minutes} хв`;
};

export function JourneyRouteMapScreen({ journey, onBack }: { journey: ApiJourney; onBack: () => void }) {
  const model = buildJourneyRouteMapModel(journey.legs);
  const firstLeg = journey.legs[0];
  const lastLeg = journey.legs.at(-1);
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');

  return <main className="fixed inset-0 z-[80] overflow-hidden bg-slate-100 text-slate-900 dark:bg-[#0B0F14] dark:text-[#F5F9FF]" aria-label="Карта маршруту">
    {model.legs.length > 0 && <div className="absolute inset-0">
      <MarshGoMap route={[]} routeSegments={model.routeSegments} routeWaypoints={model.routeWaypoints} routeFitPadding={{ bottom: 440 }} onStatus={setMapStatus} onAdapter={() => undefined}/>
    </div>}
    <header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-xl items-center gap-3 px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))]">
      <button type="button" aria-label="Назад до результатів" onClick={onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-slate-800 shadow-md dark:bg-[#111820] dark:text-white">
        <ArrowLeft size={20}/>
      </button>
      <div className="min-w-0 flex-1 rounded-2xl bg-white/95 px-4 py-2.5 shadow-md backdrop-blur dark:bg-[#111820]/95">
        <p className="text-[10px] font-semibold text-slate-500 dark:text-[#B6C2D0]">Карта маршруту</p>
        <h1 className="truncate text-sm font-extrabold">{firstLeg?.origin.name ?? 'Початок'} → {lastLeg?.destination.name ?? 'Кінець'}</h1>
      </div>
    </header>

    {model.legs.length > 0 ? <section className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 mx-auto max-h-[47svh] max-w-xl overflow-y-auto rounded-[1.4rem] border border-slate-100 bg-white/95 p-4 shadow-[0_12px_34px_rgba(12,35,66,.2)] backdrop-blur dark:border-[#263648] dark:bg-[#111820]/95" aria-label="Сегменти маршруту">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold">{firstLeg?.origin.name} → {lastLeg?.destination.name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-[#B6C2D0]">
            <span className="inline-flex items-center gap-1"><Clock3 size={12}/>{formatDuration(journey.totalDurationSeconds)}</span>
            <span className="inline-flex items-center gap-1"><RouteIcon size={12}/>{journey.transfers} пересадок</span>
            {journey.walkingMeters > 0 && <span className="inline-flex items-center gap-1"><Footprints size={12}/>{journey.walkingMeters} м пішки</span>}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${mapStatus === 'failed' ? 'bg-amber-100 text-amber-900' : 'bg-blue-50 text-blue-700 dark:bg-[#16202B] dark:text-[#8CC4FF]'}`}>
          {mapStatus === 'failed' ? 'Карта частково недоступна' : 'Сегменти маршруту'}
        </span>
      </div>
      <ol className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-[#263648]">
        {journey.legs.map((leg) => {
          const shaped = model.legs.find(item => item.id === leg.id);
          return <li key={leg.id} className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-[#16202B]">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: shaped?.color ?? '#94A3B8' }}/>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><b className="truncate text-xs">{journeyLegLabel(leg.mode, leg.transportType)}{leg.routeName ? ` · ${leg.routeName}` : ''}</b><span className="shrink-0 text-[10px] tabular-nums text-slate-500 dark:text-[#B6C2D0]">{formatTime(leg.departureAt)}–{formatTime(leg.arrivalAt)}</span></div>
              <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-[#B6C2D0]">{leg.origin.name} → {leg.destination.name}</p>
              {!shaped && leg.mode !== 'WALK' && <p className="mt-1 text-[9px] text-amber-700 dark:text-amber-300">Геометрія відрізка відсутня в даних перевізника</p>}
            </div>
          </li>;
        })}
      </ol>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1" aria-label="Легенда транспорту">
        {model.legs.map(leg => <span key={leg.id} className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-600 dark:text-[#B6C2D0]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: leg.color }}/>{leg.label}</span>)}
      </div>
      <p className="mt-2 inline-flex items-center gap-1 text-[9px] leading-4 text-slate-500 dark:text-[#8FA0B3]"><MapPin size={11}/>Лінії показують лише геометрію, надану транспортним джерелом.</p>
    </section> : <section className="absolute inset-x-4 top-1/2 z-10 mx-auto max-w-md -translate-y-1/2 rounded-3xl bg-white p-6 text-center shadow-xl dark:bg-[#111820]">
      <MapPin size={28} className="mx-auto text-blue-600"/><h2 className="mt-3 text-lg font-extrabold">Геометрія маршруту недоступна</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-[#B6C2D0]">Транспортне джерело надало розклад зупинок, але не надало форму руху. Не з’єднуємо зупинки прямою лінією, щоб не показати хибний шлях.</p>
    </section>}
  </main>;
}
