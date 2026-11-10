import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Accessibility, ArrowLeftRight, Bike, BusFront, CableCar, CarFront, Clock3, Eye, Layers, MapPin, MapPinned, ParkingCircle, Route, TrafficCone, TrainFront, TramFront, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { getTransportLayers, setTransportLayers, subscribeTransportLayers, type TransportLayerId, transportLayerList } from '../map/transportLayers';
import { getLayerAvailabilityState, loadLayerAvailability, retryLayerAvailability, subscribeLayerAvailability } from '../map/layerAvailability';
import { hasMapLayerRenderer, isLayerSelectable, layerUnavailableNote } from '../map/transportLayerConfig';
import { getMapDisplayPreferences, setMapDisplayPreference, subscribeMapDisplayPreferences, type MapDisplayPreferenceId } from '../map/mapLayerPreferences';

const canonicalLayerOrder: TransportLayerId[] = ['BUS', 'MINIBUS', 'TROLLEYBUS', 'TRAIN', 'TRAM', 'BICYCLE', 'METRO', 'SCOOTER', 'CARPOOL', 'CARSHARING', 'TAXI', 'TRANSFER'];

function LayerRow({
  label,
  icon: Icon,
  tone,
  ids,
  selected,
  available,
  unavailableNote,
  onToggle,
}: {
  label: string;
  icon: LucideIcon;
  tone: string;
  ids: TransportLayerId[];
  selected: ReadonlySet<TransportLayerId>;
  available: Record<string, boolean> | null;
  unavailableNote: string;
  onToggle: (ids: TransportLayerId[], enabled: boolean) => void;
}) {
  const readyIds = ids.filter((id) => isLayerSelectable(available, id));
  const ready = readyIds.length > 0;
  const checked = readyIds.some((id) => selected.has(id));
  return <label className={`flex min-h-11 min-w-0 items-center gap-1.5 rounded-xl px-1 py-0.5 text-xs ${ready ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5' : 'cursor-not-allowed text-slate-400 dark:text-slate-500'}`}>
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${tone}`}><Icon size={15} aria-hidden="true"/></span>
    <span className="min-w-0 flex-1 font-semibold leading-tight">{label}{!ready && <small className="mt-0.5 block text-xs font-normal">{available === null ? 'перевірка' : unavailableNote}</small>}</span>
    <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={!ready} onChange={() => onToggle(readyIds, !checked)} className="peer sr-only"/>
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[var(--mg-action)] peer-checked:after:translate-x-4 peer-disabled:bg-slate-200 dark:bg-slate-700 dark:peer-disabled:bg-slate-800"/>
  </label>;
}

function PreferenceRow({ label, id, checked, icon: Icon, onChange }: { label: string; id: MapDisplayPreferenceId; checked: boolean; icon: LucideIcon; onChange: (id: MapDisplayPreferenceId, enabled: boolean) => void }) {
  return <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-1.5 rounded-xl px-1 py-0.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5">
    <Icon size={18} className="shrink-0 text-blue-500" aria-hidden="true"/><span className="min-w-0 flex-1 font-semibold leading-tight">{label}</span>
    <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={() => onChange(id, !checked)} className="peer sr-only"/>
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[var(--mg-action)] peer-checked:after:translate-x-4 dark:bg-slate-700"/>
  </label>;
}

function UnavailableRow({ label, icon: Icon, status = 'Недоступно' }: { label: string; icon: LucideIcon; status?: string }) {
  return <div title={`${label}: ${status.toLocaleLowerCase('uk-UA')}`} className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-xl px-1 py-0.5 text-xs text-slate-400 dark:text-slate-500">
    <Icon size={18} className="shrink-0 text-slate-400" aria-hidden="true"/><span className="min-w-0 flex-1 font-semibold leading-tight">{label}</span>
    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{status}</span>
  </div>;
}

/** Mobile-first layers sheet with truthful provider availability and desktop popover fallback. */
export function MapLayersControl({ overlays = false, visible = true }: { overlays?: boolean; visible?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<TransportLayerId>>(getTransportLayers());
  const [layerState, setLayerState] = useState(getLayerAvailabilityState);
  const [displayPreferences, setDisplayPreferences] = useState(getMapDisplayPreferences());

  useEffect(() => subscribeTransportLayers(setSelected), []);
  useEffect(() => subscribeLayerAvailability(setLayerState), []);
  useEffect(() => subscribeMapDisplayPreferences(setDisplayPreferences), []);
  useEffect(() => { if (!visible) setOpen(false); }, [visible]);
  useEffect(() => { if (open && overlays) void loadLayerAvailability(); }, [open, overlays]);

  const available = layerState.availability;
  const unavailableNote = layerUnavailableNote(layerState.probeFailed);
  const showLayers = overlays;
  const toggleGroup = (ids: TransportLayerId[], enabled: boolean) => setTransportLayers(ids, enabled);
  const togglePreference = (id: MapDisplayPreferenceId, enabled: boolean) => setMapDisplayPreference(id, enabled);

  return <>
    <div className="relative">
      <button type="button" aria-label="Шари карти" aria-expanded={open} aria-controls="marshgo-map-layers" onClick={() => setOpen((value) => !value)} className="map-interaction-control mg-press-subtle relative grid h-12 w-12 place-items-center rounded-full shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)]">
        {open ? <X size={22}/> : <Layers size={22}/>}
        {showLayers && selected.size > 0 && !open && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--mg-action)] px-1 text-xs font-bold text-white">{selected.size}</span>}
      </button>
    </div>
    {open && visible && typeof document !== 'undefined' && createPortal(<div id="marshgo-map-layers" role="dialog" aria-label="Шари карти" style={{ bottom: 'var(--mg-global-nav-clearance)', maxHeight: 'min(60dvh, calc(100dvh - max(.75rem, env(safe-area-inset-top)) - var(--mg-global-nav-clearance) - .75rem))' }} className="fixed inset-x-0 z-[1000] max-h-[60svh] overflow-y-auto rounded-t-[1.75rem] border border-slate-200 bg-white px-4 pb-3 pt-1 text-slate-900 shadow-[0_-12px_40px_rgba(8,27,53,.2)] dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)] dark:text-[var(--mg-ink-primary)] dark:shadow-[0_-12px_40px_rgba(0,0,0,.45)] sm:fixed sm:inset-x-auto sm:bottom-auto sm:right-16 sm:top-1/2 sm:max-h-[70svh] sm:w-[20rem] sm:-translate-y-1/2 sm:rounded-2xl sm:p-3 sm:shadow-xl">
      <div className="mx-auto mb-0 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden" aria-hidden="true"/>
      <header className="mb-2 flex items-center justify-between gap-3">
        <div><h2 className="font-extrabold text-sm">Налаштування карти</h2></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Закрити шари карти" className="grid h-11 w-11 place-items-center rounded-full hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-white/10"><X size={18}/></button>
      </header>
      {showLayers ? <>
        {layerState.probeFailed && <p role="status" className="mb-2 rounded-xl bg-amber-50 p-2 text-xs leading-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Не вдалося перевірити джерела шарів.<button type="button" className="ml-1 font-bold underline" onClick={() => { void retryLayerAvailability(); }}>Повторити</button></p>}
        <section className="mb-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-[var(--mg-surface-secondary)]">
          <h3 className="mb-1 flex items-center gap-2 px-1 text-[12px] font-bold text-slate-600 dark:text-slate-300"><BusFront size={17} className="text-blue-500" aria-hidden="true"/>Транспорт<span className="ml-auto text-slate-400" aria-hidden="true">⌃</span></h3>
            <div className="grid grid-cols-2 gap-x-1">{canonicalLayerOrder.map((id) => transportLayerList.find(item => item.id === id)).filter((item): item is (typeof transportLayerList)[number] => Boolean(item)).map((item) => {
              const iconById: Record<TransportLayerId, LucideIcon> = { PUBLIC_TRANSPORT: BusFront, METRO: TrainFront, TRAM: TramFront, TROLLEYBUS: BusFront, BUS: BusFront, MINIBUS: BusFront, TRAIN: TrainFront, CARPOOL: CarFront, TAXI: CarFront, TRANSFER: CarFront, CITY_TRAIN: TrainFront, FUNICULAR: CableCar, STOPS: MapPin, BICYCLE: Bike, SCOOTER: Bike, CARSHARING: CarFront, RENTAL_POINTS: MapPinned };
              const toneById: Record<TransportLayerId, string> = { PUBLIC_TRANSPORT: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', METRO: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300', TRAM: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', TROLLEYBUS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', BUS: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', MINIBUS: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', TRAIN: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', CARPOOL: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300', TAXI: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', TRANSFER: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300', CITY_TRAIN: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', FUNICULAR: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300', STOPS: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300', BICYCLE: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', SCOOTER: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300', CARSHARING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', RENTAL_POINTS: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' };
              return hasMapLayerRenderer(item.id)
                ? <LayerRow key={item.id} label={item.label} icon={iconById[item.id]} tone={toneById[item.id]} ids={[item.id]} selected={selected} available={available} unavailableNote={unavailableNote} onToggle={toggleGroup}/>
                : <UnavailableRow key={item.id} label={item.label} icon={iconById[item.id]} status="У маршрутах"/>;
            })}</div>
        </section>
        <section className="mb-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-[var(--mg-surface-secondary)]">
          <h3 className="mb-1 flex items-center gap-2 px-1 text-[12px] font-bold text-slate-600 dark:text-slate-300"><Eye size={17} className="text-blue-500" aria-hidden="true"/>Відображення<span className="ml-auto text-slate-400" aria-hidden="true">⌃</span></h3>
          <div className="grid grid-cols-2 gap-x-1">
            <PreferenceRow label="Лінії маршрутів" id="routeLines" icon={Route} checked={displayPreferences.routeLines} onChange={togglePreference}/>
            <PreferenceRow label="Номери маршрутів" id="routeNumbers" icon={BusFront} checked={displayPreferences.routeNumbers} onChange={togglePreference}/>
            <LayerRow label="Зупинки" icon={MapPin} tone="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" ids={['STOPS']} selected={selected} available={available} unavailableNote={unavailableNote} onToggle={toggleGroup}/>
            <UnavailableRow label="Час прибуття (ETA)" icon={Clock3}/>
            <PreferenceRow label="Рух транспорту" id="liveVehicles" icon={BusFront} checked={displayPreferences.liveVehicles} onChange={togglePreference}/>
            <UnavailableRow label="Пересадки" icon={ArrowLeftRight}/>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-[var(--mg-surface-secondary)]">
          <h3 className="mb-1 flex items-center gap-2 px-1 text-[12px] font-bold text-slate-600 dark:text-slate-300"><Route size={17} className="text-slate-500" aria-hidden="true"/>Інфраструктура<span className="ml-auto text-slate-400" aria-hidden="true">⌃</span></h3>
          <div className="grid grid-cols-2 gap-x-1">
            <UnavailableRow label="Дорожній рух" icon={CarFront}/><UnavailableRow label="Велодоріжки" icon={Bike}/>
            <UnavailableRow label="Події на дорогах" icon={TriangleAlert}/><LayerRow label="Пункти прокату" icon={MapPinned} tone="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" ids={['RENTAL_POINTS']} selected={selected} available={available} unavailableNote={unavailableNote} onToggle={toggleGroup}/>
            <UnavailableRow label="Паркування" icon={ParkingCircle}/><UnavailableRow label="Доступність" icon={Accessibility}/>
            <UnavailableRow label="Зарядні станції" icon={TrafficCone}/><UnavailableRow label="Місця повернення" icon={MapPin}/>
          </div>
        </section>
      </> : <p className="rounded-xl bg-slate-50 p-3 text-xs leading-4 text-slate-500 dark:bg-[var(--mg-surface-secondary)] dark:text-slate-400">Додаткові транспортні шари доступні на транспортній карті.</p>}
    </div>, document.body)}
  </>;
}
