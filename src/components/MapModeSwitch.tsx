import { useEffect, useState } from 'react';
import { getMapMode, mapModes, setMapMode, subscribeMapMode, type MapMode } from '../map/mapMode';

export function MapModeSwitch({ className = '' }: { className?: string }) {
  const [mode, setMode] = useState<MapMode>(getMapMode());
  useEffect(() => subscribeMapMode(setMode), []);
  return <div role="radiogroup" aria-label="Режим карти" className={`inline-flex rounded-xl border border-slate-200 bg-[#F5F8FD] p-1 text-xs ${className}`}>
    {(Object.keys(mapModes) as MapMode[]).map((key) => <button key={key} type="button" role="radio" aria-checked={mode === key} onClick={() => setMapMode(key)} className={`rounded-lg px-3 py-1.5 font-bold transition ${mode === key ? 'bg-[#1789F4] text-white shadow' : 'text-slate-500'}`}>{mapModes[key].label}</button>)}
  </div>;
}
