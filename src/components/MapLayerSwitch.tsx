import { useEffect, useState } from 'react';
import { Box, Layers, Map as MapIcon } from 'lucide-react';
import { getMapLayer, mapLayers, setMapLayer, subscribeMapLayer, type MapLayer } from '../map/mapMode';

const icons = { simple: MapIcon, threeD: Box, satellite: Layers } as const;

/** The three map modes: 2D, 3D navigation, satellite. */
export function MapLayerSwitch({ className = '' }: { className?: string }) {
  const [layer, setLayer] = useState<MapLayer>(getMapLayer());
  useEffect(() => subscribeMapLayer(setLayer), []);
  return <div role="radiogroup" aria-label="Режим карти" className={`inline-flex gap-1 rounded-2xl border border-slate-200 bg-[#F5F8FD] p-1 ${className}`}>
    {(Object.keys(mapLayers) as MapLayer[]).map((key) => { const Icon = icons[key]; return <button key={key} type="button" role="radio" aria-checked={layer === key} onClick={() => setMapLayer(key)} className={`flex min-w-[4.2rem] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-bold ${layer === key ? 'bg-[#1789F4] text-white' : 'text-slate-600'}`}><Icon size={17}/>{mapLayers[key].label}</button>; })}
  </div>;
}
