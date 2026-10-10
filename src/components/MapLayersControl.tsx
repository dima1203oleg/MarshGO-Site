import { useEffect, useState } from 'react';
import { Layers, X } from 'lucide-react';
import { MapLayerSwitch } from './MapLayerSwitch';
import { getTransportLayers, subscribeTransportLayers, toggleTransportLayer, transportLayerList, type TransportLayerId } from '../map/transportLayers';
import { productionApi } from '../services/productionApi';

/** Layers that can show data depend on which feeds are connected; the server tells us. Cached for the session. */
let availabilityCache: Record<string, boolean> | null = null;

/**
 * One compact button. The three basemaps are independent from the information overlays;
 * transport and micromobility layers remain available in 2D, 3D, and satellite modes.
 */
export function MapLayersControl({ overlays = false }: { overlays?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<TransportLayerId>>(getTransportLayers());
  const [available, setAvailable] = useState<Record<string, boolean> | null>(availabilityCache);
  useEffect(() => subscribeTransportLayers(setSelected), []);
  useEffect(() => {
    if (!open || !overlays || availabilityCache) return;
    void productionApi.transportLayerAvailability().then((items) => { availabilityCache = Object.fromEntries(items.map((item) => [item.id, item.available])); setAvailable(availabilityCache); }).catch(() => undefined);
  }, [open, overlays]);
  const showLayers = overlays;
  return <div className="relative">
    <button type="button" aria-label="Шари карти" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="relative grid h-14 w-14 place-items-center rounded-full bg-white text-[#1789F4] shadow-lg">{open ? <X size={22}/> : <Layers size={22}/>}{showLayers && selected.size > 0 && !open && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#1789F4] px-1 text-[10px] font-bold text-white">{selected.size}</span>}</button>
    {open && <div role="dialog" aria-label="Шари карти" className="absolute right-16 top-0 z-10 max-h-[70svh] w-[17.5rem] space-y-3 overflow-y-auto rounded-2xl bg-white p-3 shadow-xl">
      <div><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Карта</p><MapLayerSwitch/></div>
      {showLayers ? (['Транспорт', 'Мікромобільність', 'Спільні авто'] as const).map((group) => <div key={group}><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{group}</p>
        <div className="space-y-1">{transportLayerList.filter((item) => item.group === group).map((item) => { const ready = available === null || available[item.id] !== false; return <label key={item.id} className={`flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm ${ready ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed text-slate-400'}`}>
          <input type="checkbox" checked={selected.has(item.id)} disabled={!ready} onChange={() => toggleTransportLayer(item.id)} className="h-4 w-4 accent-[#1789F4]"/><span className="flex-1">{item.label}</span>{!ready && <small className="text-[10px]">немає даних</small>}</label>; })}</div></div>)
        : <p className="rounded-xl bg-slate-50 p-2.5 text-[11px] leading-4 text-slate-500">Під час навігації карта лишається чистою: без додаткових шарів.</p>}
    </div>}
  </div>;
}
