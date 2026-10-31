import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Accessibility, ArrowLeftRight, Bike, BusFront, CableCar, CarFront, Clock3, Eye, Layers, MapPin, MapPinned, ParkingCircle, Route, TrafficCone, TrainFront, TramFront, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { getTransportLayers, setTransportLayers, subscribeTransportLayers, type TransportLayerId, transportLayerList } from '../map/transportLayers';
import { productionApi } from '../services/productionApi';
import { getMapDisplayPreferences, setMapDisplayPreference, subscribeMapDisplayPreferences, type MapDisplayPreferenceId } from '../map/mapLayerPreferences';

/** Layers that can show data depend on connected feeds; the server is authoritative. */
let availabilityCache: Record<string, boolean> | null = null;
const canonicalLayerOrder: TransportLayerId[] = ['BUS', 'MINIBUS', 'TROLLEYBUS', 'TRAIN', 'TRAM', 'BICYCLE', 'METRO', 'SCOOTER', 'CARPOOL', 'CARSHARING', 'TAXI', 'TRANSFER'];

function LayerRow({
  label,
  icon: Icon,
  tone,
  ids,
  selected,
  available,
  onToggle,
}: {
  label: string;
  icon: LucideIcon;
  tone: string;
  ids: TransportLayerId[];
  selected: ReadonlySet<TransportLayerId>;
  available: Record<string, boolean> | null;
  onToggle: (ids: TransportLayerId[], enabled: boolean) => void;
}) {
  const readyIds = available === null ? [] : ids.filter((id) => available[id] === true);
  const ready = readyIds.length > 0;
  const checked = readyIds.some((id) => selected.has(id));
  return <label className={`flex min-h-11 min-w-0 items-center gap-1.5 rounded-xl px-1 py-0.5 text-[10px] ${ready ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5' : 'cursor-not-allowed text-slate-400 dark:text-slate-500'}`}>
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${tone}`}><Icon size={15} aria-hidden="true"/></span>
    <span className="min-w-0 flex-1 font-semibold leading-tight">{label}{!ready && <small className="mt-0.5 block text-[9px] font-normal">{available === null ? 'перевірка' : 'немає даних'}</small>}</span>
    <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={!ready} onChange={() => onToggle(readyIds, !checked)} className="peer sr-only"/>
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#0B63D6] peer-checked:after:translate-x-4 peer-disabled:bg-slate-200 dark:bg-slate-700 dark:peer-disabled:bg-slate-800"/>
  </label>;
}

function PreferenceRow({ label, id, checked, icon: Icon, onChange }: { label: string; id: MapDisplayPreferenceId; checked: boolean; icon: LucideIcon; onChange: (id: MapDisplayPreferenceId, enabled: boolean) => void }) {
  return <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-1.5 rounded-xl px-1 py-0.5 text-[10px] hover:bg-slate-50 dark:hover:bg-white/5">
    <Icon size={18} className="shrink-0 text-blue-500" aria-hidden="true"/><span className="min-w-0 flex-1 font-semibold leading-tight">{label}</span>
    <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={() => onChange(id, !checked)} className="peer sr-only"/>
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#0B63D6] peer-checked:after:translate-x-4 dark:bg-slate-700"/>
  </label>;
}

function UnavailableRow({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return <div aria-disabled="true" className="flex min-h-11 min-w-0 cursor-not-allowed items-center gap-1.5 rounded-xl px-1 py-0.5 text-[10px] text-slate-400 dark:text-slate-500">
    <Icon size={18} className="shrink-0 text-slate-400" aria-hidden="true"/><span className="min-w-0 flex-1 font-semibold leading-tight"><span className="block">{label}</span><small className="mt-0.5 block text-[9px] font-normal">дані недоступні</small></span>
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800"/>
  </div>;
}

/** Mobile-first layers sheet with truthful provider availability and desktop popover fallback. */
export function MapLayersControl({ overlays = false, variant = 'explore', visible = true }: { overlays?: boolean; variant?: 'explore' | 'navigation'; visible?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<TransportLayerId>>(getTransportLayers());
  const [displayPreferences, setDisplayPreferences] = useState(getMapDisplayPreferences());
  const [available, setAvailable] = useState<Record<string, boolean> | null>(availabilityCache);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => subscribeTransportLayers(setSelected), []);
  useEffect(() => subscribeMapDisplayPreferences(setDisplayPreferences), []);
  useEffect(() => { if (!visible) setOpen(false); }, [visible]);
  useEffect(() => {
    if (!open || !overlays || availabilityCache) return;
    let active = true;
    void productionApi.transportLayerAvailability()
      .then((items) => {
        if (!active) return;
        availabilityCache = Object.fromEntries(items.map((item) => [item.id, item.available]));
        setAvailable(availabilityCache);
        const knownIds: TransportLayerId[] = [...transportLayerList.map((item) => item.id), 'PUBLIC_TRANSPORT', 'CITY_TRAIN', 'FUNICULAR', 'STOPS', 'RENTAL_POINTS'];
        setTransportLayers(knownIds.filter((id) => availabilityCache?.[id] !== true), false);
        setAvailabilityError(false);
      })
      .catch(() => {
        if (!active) return;
        setAvailable(Object.fromEntries([...transportLayerList.map((item) => [item.id, false] as const), ['STOPS', false], ['RENTAL_POINTS', false]]));
        setTransportLayers([...transportLayerList.map((item) => item.id), 'PUBLIC_TRANSPORT', 'CITY_TRAIN', 'FUNICULAR', 'STOPS', 'RENTAL_POINTS'], false);
        setAvailabilityError(true);
      });
    return () => { active = false; };
  }, [open, overlays, retryKey]);

  const showLayers = overlays;
  const navigationMode = variant === 'navigation';
  const toggleGroup = (ids: TransportLayerId[], enabled: boolean) => setTransportLayers(ids, enabled);
  const togglePreference = (id: MapDisplayPreferenceId, enabled: boolean) => setMapDisplayPreference(id, enabled);

  return <>
    <div className="relative">
      <button type="button" aria-label="Шари карти" aria-expanded={open} aria-controls="marshgo-map-layers" onClick={() => setOpen((value) => !value)} className={`relative grid h-12 w-12 place-items-center rounded-full shadow-lg ${navigationMode ? 'border border-slate-200 bg-white/95 text-[#0B1730] backdrop-blur dark:border-white/15 dark:bg-[#0A1D2D]/90 dark:text-white' : 'bg-white text-[#0B63D6] dark:bg-[#0B1C2B] dark:text-[#66B2FF]'}`}>
        {open ? <X size={22}/> : <Layers size={22}/>}
        {showLayers && selected.size > 0 && !open && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#0B63D6] px-1 text-[10px] font-bold text-white">{selected.size}</span>}
      </button>
    </div>
    {open && visible && typeof document !== 'undefined' && createPortal(<div id="marshgo-map-layers" role="dialog" aria-label="Шари карти" style={{ bottom: 'calc(4.6rem + env(safe-area-inset-bottom))', maxHeight: 'min(60dvh, calc(100dvh - max(.75rem, env(safe-area-inset-top)) - 5.3rem - env(safe-area-inset-bottom)))' }} className="fixed inset-x-0 z-[1000] max-h-[60svh] overflow-y-auto rounded-t-[1.75rem] border border-slate-200 bg-white px-4 pb-3 pt-1 text-slate-900 shadow-[0_-12px_40px_rgba(8,27,53,.2)] dark:border-[#263648] dark:bg-[#0A1D2D] dark:text-slate-100 dark:shadow-[0_-12px_40px_rgba(0,0,0,.45)] sm:fixed sm:inset-x-auto sm:bottom-auto sm:right-16 sm:top-1/2 sm:max-h-[70svh] sm:w-[20rem] sm:-translate-y-1/2 sm:rounded-2xl sm:p-3 sm:shadow-xl">
      <div className="mx-auto mb-0 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden" aria-hidden="true"/>
      <header className="mb-1 flex items-center justify-between gap-3">
        <div><h2 className="font-extrabold">Шари</h2></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Закрити шари карти" className="grid h-11 w-11 place-items-center rounded-full hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-white/10"><X size={18}/></button>
      </header>
      {showLayers ? <>
        {availabilityError && <p role="status" className="mb-2 rounded-xl bg-amber-50 p-2 text-[11px] leading-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Не вдалося перевірити джерела шарів. Вони тимчасово вимкнені.<button type="button" className="ml-1 font-bold underline" onClick={() => { availabilityCache = null; setAvailable(null); setAvailabilityError(false); setRetryKey((key) => key + 1); }}>Повторити</button></p>}
        <section className="mb-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-[#0c2031]">
          <h3 className="mb-1 flex items-center gap-2 px-1 text-[12px] font-bold text-slate-600 dark:text-slate-300"><BusFront size={17} className="text-blue-500" aria-hidden="true"/>Транспорт<span className="ml-auto text-slate-400" aria-hidden="true">⌃</span></h3>
            <div className="grid grid-cols-2 gap-x-1">{canonicalLayerOrder.map((id) => transportLayerList.find(item => item.id === id)).filter((item): item is (typeof transportLayerList)[number] => Boolean(item)).map((item) => {
              const iconById: Record<TransportLayerId, LucideIcon> = { PUBLIC_TRANSPORT: BusFront, METRO: TrainFront, TRAM: TramFront, TROLLEYBUS: BusFront, BUS: BusFront, MINIBUS: BusFront, TRAIN: TrainFront, CARPOOL: CarFront, TAXI: CarFront, TRANSFER: CarFront, CITY_TRAIN: TrainFront, FUNICULAR: CableCar, STOPS: MapPin, BICYCLE: Bike, SCOOTER: Bike, CARSHARING: CarFront, RENTAL_POINTS: MapPinned };
              const toneById: Record<TransportLayerId, string> = { PUBLIC_TRANSPORT: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', METRO: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300', TRAM: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', TROLLEYBUS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', BUS: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', MINIBUS: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', TRAIN: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', CARPOOL: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300', TAXI: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', TRANSFER: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300', CITY_TRAIN: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', FUNICULAR: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300', STOPS: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300', BICYCLE: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', SCOOTER: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300', CARSHARING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', RENTAL_POINTS: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' };
              return <LayerRow key={item.id} label={item.label} icon={iconById[item.id]} tone={toneById[item.id]} ids={[item.id]} selected={selected} available={available} onToggle={toggleGroup}/>;
            })}</div>
        </section>
        <section className="mb-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-[#0c2031]">
          <h3 className="mb-1 flex items-center gap-2 px-1 text-[12px] font-bold text-slate-600 dark:text-slate-300"><Eye size={17} className="text-blue-500" aria-hidden="true"/>Відображення<span className="ml-auto text-slate-400" aria-hidden="true">⌃</span></h3>
          <div className="grid grid-cols-2 gap-x-1">
            <PreferenceRow label="Лінії маршрутів" id="routeLines" icon={Route} checked={displayPreferences.routeLines} onChange={togglePreference}/>
            <PreferenceRow label="Номери маршрутів" id="routeNumbers" icon={BusFront} checked={displayPreferences.routeNumbers} onChange={togglePreference}/>
            <LayerRow label="Зупинки" icon={MapPin} tone="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" ids={['STOPS']} selected={selected} available={available} onToggle={toggleGroup}/>
            <UnavailableRow label="Час прибуття (ETA)" icon={Clock3}/>
            <PreferenceRow label="Рух транспорту" id="liveVehicles" icon={BusFront} checked={displayPreferences.liveVehicles} onChange={togglePreference}/>
            <UnavailableRow label="Пересадки" icon={ArrowLeftRight}/>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-[#0c2031]">
          <h3 className="mb-1 flex items-center gap-2 px-1 text-[12px] font-bold text-slate-600 dark:text-slate-300"><Route size={17} className="text-slate-500" aria-hidden="true"/>Інфраструктура<span className="ml-auto text-slate-400" aria-hidden="true">⌃</span></h3>
          <div className="grid grid-cols-2 gap-x-1">
            <UnavailableRow label="Дорожній рух" icon={CarFront}/><UnavailableRow label="Велодоріжки" icon={Bike}/>
            <UnavailableRow label="Події на дорогах" icon={TriangleAlert}/><LayerRow label="Пункти прокату" icon={MapPinned} tone="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" ids={['RENTAL_POINTS']} selected={selected} available={available} onToggle={toggleGroup}/>
            <UnavailableRow label="Паркування" icon={ParkingCircle}/><UnavailableRow label="Доступність" icon={Accessibility}/>
            <UnavailableRow label="Зарядні станції" icon={TrafficCone}/><UnavailableRow label="Місця повернення" icon={MapPin}/>
          </div>
        </section>
      </> : <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-4 text-slate-500 dark:bg-[#10283B] dark:text-slate-400">Додаткові транспортні шари доступні на транспортній карті.</p>}
    </div>, document.body)}
  </>;
}
