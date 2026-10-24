import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BusFront, ChevronDown, Eye, Layers, Route, X } from 'lucide-react';
import { getTransportLayers, mapLayerDisplayOrder, setTransportLayers, subscribeTransportLayers, type TransportLayerId, transportLayerList } from '../map/transportLayers';
import { productionApi } from '../services/productionApi';
import { getMapDisplayPreferences, setMapDisplayPreference, subscribeMapDisplayPreferences, type MapDisplayPreferenceId } from '../map/mapLayerPreferences';
import { getTransportModeVisual } from '../design-system/transport/transportModeRegistry';
import { TransportIcon } from '../design-system/transport/TransportIcon';

/** Layers that can show data depend on connected feeds; the server is authoritative. */
let availabilityCache: Record<string, boolean> | null = null;

function LayerRow({
  label,
  ids,
  selected,
  available,
  onToggle,
}: {
  label: string;
  ids: TransportLayerId[];
  selected: ReadonlySet<TransportLayerId>;
  available: Record<string, boolean> | null;
  onToggle: (ids: TransportLayerId[], enabled: boolean) => void;
}) {
  const modeId: Partial<Record<TransportLayerId, string>> = {
    BUS: 'BUS', MINIBUS: 'MINIBUS', TROLLEYBUS: 'TROLLEYBUS', TRAIN: 'TRAIN', TRAM: 'TRAM',
    BICYCLE: 'BIKE', METRO: 'METRO', SCOOTER: 'SCOOTER', CARPOOL: 'CARPOOL', CARSHARING: 'CARSHARING',
    TAXI: 'TAXI', TRANSFER: 'TRANSFER',
  };
  const mode = modeId[ids[0]];
  const visual = mode ? getTransportModeVisual(mode) : null;
  const readyIds = available === null ? [] : ids.filter((id) => available[id] === true);
  const ready = readyIds.length > 0;
  const checked = readyIds.some((id) => selected.has(id));
  const unavailableReason = ready ? null : available === null ? 'Перевіряємо доступність' : 'Немає доступних даних';
  return <label className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-[11px] ${ready ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5' : 'cursor-not-allowed text-slate-400 dark:text-slate-500'}`}>
    {visual && <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white" style={{ backgroundColor: visual.color }}><TransportIcon mode={mode!} size={16} strokeWidth={2.4}/></span>}
    <span className="flex min-w-0 flex-1 flex-col justify-center font-semibold leading-tight"><span className="truncate">{label}</span>{unavailableReason && <small className="mt-0.5 truncate text-[8px] font-medium leading-none text-slate-400 dark:text-slate-500">{unavailableReason}</small>}</span>
    <input type="checkbox" role="switch" aria-label={unavailableReason ? `${label} — ${unavailableReason}` : label} checked={checked} disabled={!ready} onChange={() => onToggle(readyIds, !checked)} className="peer sr-only"/>
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#1789F4] peer-checked:after:translate-x-4 peer-disabled:bg-slate-200 dark:bg-slate-700 dark:peer-disabled:bg-slate-800"/>
  </label>;
}

function PreferenceRow({ label, id, checked, onChange }: { label: string; id: MapDisplayPreferenceId; checked: boolean; onChange: (id: MapDisplayPreferenceId, enabled: boolean) => void }) {
  return <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-[11px] hover:bg-slate-50 dark:hover:bg-white/5">
    <span className="min-w-0 flex-1 font-semibold leading-tight">{label}</span>
    <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={() => onChange(id, !checked)} className="peer sr-only"/>
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#1789F4] peer-checked:after:translate-x-4 dark:bg-slate-700"/>
  </label>;
}

function UnavailableRow({ label }: { label: string }) {
  return <div aria-disabled="true" className="flex min-h-11 min-w-0 cursor-not-allowed items-center gap-2 rounded-xl px-2 py-1.5 text-[11px] text-slate-400 dark:text-slate-500">
    <span className="flex min-w-0 flex-1 flex-col justify-center font-semibold leading-tight"><span className="truncate">{label}</span><small className="mt-0.5 truncate text-[8px] font-medium leading-none">Немає доступних даних</small></span>
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800"/>
  </div>;
}

function SectionHeading({ title, icon: Icon, expanded, onToggle }: { title: string; icon: typeof BusFront; expanded: boolean; onToggle: () => void }) {
  return <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-white/5">
    <Icon size={17} className="text-blue-600 dark:text-blue-400" aria-hidden="true"/><span className="flex-1">{title}</span><ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true"/>
  </button>;
}

/** Mobile-first layers sheet with truthful provider availability and desktop popover fallback. */
export function MapLayersControl({ overlays = false, variant = 'explore', visible = true }: { overlays?: boolean; variant?: 'explore' | 'navigation'; visible?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<TransportLayerId>>(getTransportLayers());
  const [displayPreferences, setDisplayPreferences] = useState(getMapDisplayPreferences());
  const [available, setAvailable] = useState<Record<string, boolean> | null>(availabilityCache);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [expandedSections, setExpandedSections] = useState({ transport: true, display: true, infrastructure: true });

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
      <button type="button" aria-label="Шари карти" aria-expanded={open} aria-controls="marshgo-map-layers" onClick={() => setOpen((value) => !value)} className={`relative grid h-12 w-12 place-items-center rounded-full shadow-lg ${navigationMode ? 'border border-slate-200 bg-white/95 text-[#0B1730] backdrop-blur dark:border-white/15 dark:bg-[#0A1D2D]/90 dark:text-white' : 'bg-white text-[#1789F4] dark:bg-[#0B1C2B] dark:text-[#66B2FF]'}`}>
        {open ? <X size={22}/> : <Layers size={22}/>}
        {showLayers && selected.size > 0 && !open && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#1789F4] px-1 text-[10px] font-bold text-white">{selected.size}</span>}
      </button>
    </div>
    {open && visible && typeof document !== 'undefined' && createPortal(<div id="marshgo-map-layers" role="dialog" aria-label="Шари карти" aria-describedby="marshgo-map-layers-description" style={{ bottom: 'calc(4.6rem + env(safe-area-inset-bottom))', maxHeight: 'calc(100dvh - max(.75rem, env(safe-area-inset-top)) - 5.3rem - env(safe-area-inset-bottom))' }} className="fixed inset-x-0 z-[1000] max-h-[74svh] overflow-y-auto rounded-t-[1.75rem] border border-slate-200 bg-white px-4 pb-2 pt-1.5 text-slate-900 shadow-[0_-12px_40px_rgba(8,27,53,.2)] dark:border-[#263648] dark:bg-[#0A1D2D] dark:text-slate-100 dark:shadow-[0_-12px_40px_rgba(0,0,0,.45)] sm:fixed sm:inset-x-auto sm:bottom-auto sm:right-16 sm:top-1/2 sm:max-h-[70svh] sm:w-[20rem] sm:-translate-y-1/2 sm:rounded-2xl sm:p-3 sm:shadow-xl">
      <p id="marshgo-map-layers-description" className="sr-only">Шари залежать від підключених джерел. Недоступні шари вимкнені.</p>
      <div className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden" aria-hidden="true"/>
      <header className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-extrabold">Шари</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Закрити шари карти" className="grid h-11 w-11 place-items-center rounded-full hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-white/10"><X size={18}/></button>
      </header>
      {showLayers ? <>
        {availabilityError && <p role="status" className="mb-2 rounded-xl bg-amber-50 p-2 text-[11px] leading-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Не вдалося перевірити джерела шарів. Вони тимчасово вимкнені.<button type="button" className="ml-1 font-bold underline" onClick={() => { availabilityCache = null; setAvailable(null); setAvailabilityError(false); setRetryKey((key) => key + 1); }}>Повторити</button></p>}
        <section className="mb-1 rounded-2xl border border-slate-200 bg-slate-50/70 p-0.5 dark:border-slate-700 dark:bg-[#0E2435]">
          <SectionHeading title="Транспорт" icon={BusFront} expanded={expandedSections.transport} onToggle={() => setExpandedSections(value => ({ ...value, transport: !value.transport }))}/>
          {expandedSections.transport && <div className="grid grid-cols-2 gap-x-1 px-1 pb-1">{mapLayerDisplayOrder.map((id) => {
            const item = transportLayerList.find((layer) => layer.id === id);
            return item ? <LayerRow key={item.id} label={item.label} ids={[item.id]} selected={selected} available={available} onToggle={toggleGroup}/> : null;
          })}</div>}
        </section>
        <section className="mb-1 rounded-2xl border border-slate-200 bg-slate-50/70 p-0.5 dark:border-slate-700 dark:bg-[#0E2435]">
          <SectionHeading title="Відображення" icon={Eye} expanded={expandedSections.display} onToggle={() => setExpandedSections(value => ({ ...value, display: !value.display }))}/>
          {expandedSections.display && <div className="grid grid-cols-2 gap-x-1 px-1 pb-1">
            <PreferenceRow label="Лінії маршрутів" id="routeLines" checked={displayPreferences.routeLines} onChange={togglePreference}/>
            <PreferenceRow label="Номери маршрутів" id="routeNumbers" checked={displayPreferences.routeNumbers} onChange={togglePreference}/>
            <LayerRow label="Зупинки" ids={['STOPS']} selected={selected} available={available} onToggle={toggleGroup}/>
            <UnavailableRow label="Час прибуття (ETA)"/>
            <PreferenceRow label="Рух транспорту (онлайн)" id="liveVehicles" checked={displayPreferences.liveVehicles} onChange={togglePreference}/>
            <UnavailableRow label="Пересадки"/>
          </div>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-0.5 dark:border-slate-700 dark:bg-[#0E2435]">
          <SectionHeading title="Інфраструктура" icon={Route} expanded={expandedSections.infrastructure} onToggle={() => setExpandedSections(value => ({ ...value, infrastructure: !value.infrastructure }))}/>
          {expandedSections.infrastructure && <div className="grid grid-cols-2 gap-x-1 px-1 pb-1">
            <UnavailableRow label="Дорожній рух"/><UnavailableRow label="Велодоріжки"/>
            <UnavailableRow label="Події на дорогах"/><LayerRow label="Пункти оренди" ids={['RENTAL_POINTS']} selected={selected} available={available} onToggle={toggleGroup}/>
            <UnavailableRow label="Паркування"/><UnavailableRow label="Об’єкти доступності"/>
            <UnavailableRow label="Зарядні станції"/><UnavailableRow label="Місця повернення"/>
          </div>}
        </section>
      </> : <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-4 text-slate-500 dark:bg-[#10283B] dark:text-slate-400">Додаткові транспортні шари доступні на транспортній карті.</p>}
    </div>, document.body)}
  </>;
}
