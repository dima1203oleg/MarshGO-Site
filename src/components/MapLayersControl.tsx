import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layers, X } from 'lucide-react';
import { MapLayerSwitch } from './MapLayerSwitch';
import { getTransportLayers, setTransportLayers, subscribeTransportLayers, type TransportLayerId, transportLayerList } from '../map/transportLayers';
import { productionApi } from '../services/productionApi';

/** Layers that can show data depend on connected feeds; the server is authoritative. */
let availabilityCache: Record<string, boolean> | null = null;

const navigationGroups: Array<{ label: string; ids: TransportLayerId[] }> = [
  { label: 'Автобуси та маршрутки', ids: ['BUS'] },
  { label: 'Трамваї та тролейбуси', ids: ['TRAM', 'TROLLEYBUS'] },
  { label: 'Метро та поїзди', ids: ['METRO', 'CITY_TRAIN'] },
];

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
  const readyIds = ids.filter((id) => available === null || available[id] !== false);
  const ready = readyIds.length > 0;
  const checked = readyIds.some((id) => selected.has(id));
  return <label className={`flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 text-sm ${ready ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5' : 'cursor-not-allowed text-slate-400 dark:text-slate-500'}`}>
    <input type="checkbox" checked={checked} disabled={!ready} onChange={() => onToggle(readyIds, !checked)} className="h-5 w-5 accent-[#1789F4]"/>
    <span className="min-w-0 flex-1 font-semibold">{label}</span>
    {!ready && <small className="text-[10px]">немає даних</small>}
  </label>;
}

/** Mobile-first layers sheet with truthful provider availability and desktop popover fallback. */
export function MapLayersControl({ overlays = false, variant = 'explore' }: { overlays?: boolean; variant?: 'explore' | 'navigation' }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<TransportLayerId>>(getTransportLayers());
  const [available, setAvailable] = useState<Record<string, boolean> | null>(availabilityCache);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => subscribeTransportLayers(setSelected), []);
  useEffect(() => {
    if (!open || !overlays || availabilityCache) return;
    let active = true;
    void productionApi.transportLayerAvailability()
      .then((items) => {
        if (!active) return;
        availabilityCache = Object.fromEntries(items.map((item) => [item.id, item.available]));
        setAvailable(availabilityCache);
        setAvailabilityError(false);
      })
      .catch(() => {
        if (!active) return;
        setAvailable(Object.fromEntries(transportLayerList.map((item) => [item.id, false])));
        setAvailabilityError(true);
      });
    return () => { active = false; };
  }, [open, overlays, retryKey]);

  const showLayers = overlays;
  const navigationMode = variant === 'navigation';
  const toggleGroup = (ids: TransportLayerId[], enabled: boolean) => setTransportLayers(ids, enabled);

  return <>
    <div className="relative">
      <button type="button" aria-label="Шари карти" aria-expanded={open} aria-controls="marshgo-map-layers" onClick={() => setOpen((value) => !value)} className={`relative grid h-12 w-12 place-items-center rounded-full shadow-lg ${navigationMode ? 'border border-white/15 bg-[#0A1D2D]/90 text-white backdrop-blur' : 'bg-white text-[#1789F4] dark:bg-[#0B1C2B] dark:text-[#66B2FF]'}`}>
        {open ? <X size={22}/> : <Layers size={22}/>}
        {showLayers && selected.size > 0 && !open && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#1789F4] px-1 text-[10px] font-bold text-white">{selected.size}</span>}
      </button>
    </div>
    {open && typeof document !== 'undefined' && createPortal(<div id="marshgo-map-layers" role="dialog" aria-label="Шари карти" className={`fixed inset-x-0 bottom-0 z-[1000] max-h-[74svh] overflow-y-auto rounded-t-[1.75rem] border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_rgba(8,27,53,.2)] sm:fixed sm:inset-x-auto sm:bottom-auto sm:right-16 sm:top-1/2 sm:max-h-[70svh] sm:w-[20rem] sm:-translate-y-1/2 sm:rounded-2xl sm:p-3 sm:shadow-xl ${navigationMode ? 'dark border-[#263648] bg-[#0A1D2D] text-slate-100 dark:shadow-[0_-12px_40px_rgba(0,0,0,.45)]' : 'border-slate-200 bg-white text-slate-900 dark:border-[#263648] dark:bg-[#0A1D2D] dark:text-slate-100 dark:shadow-[0_-12px_40px_rgba(0,0,0,.45)]'}`}>
      <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden" aria-hidden="true"/>
      <header className="mb-2 flex items-center justify-between gap-3">
        <div><h2 className="font-extrabold">Шари карти</h2><p className="text-[10px] text-slate-500 dark:text-slate-400">Дані від доступних провайдерів</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Закрити шари карти" className="grid h-11 w-11 place-items-center rounded-full hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-white/10"><X size={18}/></button>
      </header>
      {!navigationMode && <section className="mb-3 rounded-2xl bg-slate-50 p-3 dark:bg-[#10283B]">
        <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Базова карта</h3>
        <MapLayerSwitch/>
      </section>}
      {showLayers ? <>
        {availabilityError && <p role="status" className="mb-2 rounded-xl bg-amber-50 p-2 text-[11px] leading-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Не вдалося перевірити джерела шарів. Вони тимчасово вимкнені.<button type="button" className="ml-1 font-bold underline" onClick={() => { availabilityCache = null; setAvailable(null); setAvailabilityError(false); setRetryKey((key) => key + 1); }}>Повторити</button></p>}
        {navigationMode ? <>
          <section aria-label="Громадський транспорт" className="mb-3">
            <h3 className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Транспорт</h3>
            {navigationGroups.map((group) => <LayerRow key={group.label} label={group.label} ids={group.ids} selected={selected} available={available} onToggle={toggleGroup}/>)}
          </section>
          <section>
            <h3 className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Дорога та заряджання</h3>
            <div className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-slate-400 dark:text-slate-500"><span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded border border-slate-300 dark:border-slate-600"/><span className="min-w-0 flex-1 font-semibold">Затори</span><small className="text-[10px]">провайдер недоступний</small></div>
            <div className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-slate-400 dark:text-slate-500"><span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded border border-slate-300 dark:border-slate-600"/><span className="min-w-0 flex-1 font-semibold">Зарядні станції</span><small className="text-[10px]">дані недоступні</small></div>
          </section>
        </> : <>
          {(['Транспорт', 'Мікромобільність', 'Спільні авто'] as const).map((group) => <section key={group} className="mb-3">
            <h3 className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{group}</h3>
            {transportLayerList.filter((item) => item.group === group).map((item) => <LayerRow key={item.id} label={item.label} ids={[item.id]} selected={selected} available={available} onToggle={toggleGroup}/>)}
          </section>)}
          <section aria-label="Додаткові шари">
            <h3 className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Додатково</h3>
            <div className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-slate-400 dark:text-slate-500"><span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded border border-slate-300 dark:border-slate-600"/><span className="min-w-0 flex-1 font-semibold">Затори</span><small className="text-[10px]">провайдер недоступний</small></div>
            <div className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-slate-400 dark:text-slate-500"><span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded border border-slate-300 dark:border-slate-600"/><span className="min-w-0 flex-1 font-semibold">Зарядні станції</span><small className="text-[10px]">дані недоступні</small></div>
          </section>
        </>}
      </> : <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-4 text-slate-500 dark:bg-[#10283B] dark:text-slate-400">Додаткові транспортні шари доступні на транспортній карті.</p>}
    </div>, document.body)}
  </>;
}
