import { useState } from 'react';
import { Layers, X } from 'lucide-react';
import { MapLayerSwitch } from './MapLayerSwitch';
import { MapModeSwitch } from './MapModeSwitch';

/** One compact button; the layer and style pickers live in a popover so the map stays uncluttered. */
export function MapLayersControl() {
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <button type="button" aria-label="Шари карти" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#1789F4] shadow-lg">{open ? <X size={22}/> : <Layers size={22}/>}</button>
    {open && <div role="dialog" aria-label="Шари карти" className="absolute right-16 top-0 z-10 w-[17.5rem] space-y-3 rounded-2xl bg-white p-3 shadow-xl">
      <div><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Карта</p><MapLayerSwitch/></div>
      <div><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Стиль</p><MapModeSwitch/></div>
    </div>}
  </div>;
}
