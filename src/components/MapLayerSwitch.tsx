import { useEffect, useState } from 'react';
import { Box, Layers, Map as MapIcon, TrainFront } from 'lucide-react';
import { getMapLayer, mapLayers, transitConfigured, setMapLayer, subscribeMapLayer, type MapLayer } from '../map/mapMode';

const icons = { standard: MapIcon, navigation: Box, hybrid: Layers, transit: TrainFront } as const;

export function MapLayerSwitch({ className = '' }: { className?: string }) {
  const [layer, setLayer] = useState<MapLayer>(getMapLayer());
  useEffect(() => subscribeMapLayer(setLayer), []);
  return <div className={`flex flex-col gap-1 ${className}`}><div role="radiogroup" aria-label="Шар карти" className={`inline-flex gap-1 rounded-2xl border border-white/20 bg-[#0E1F35]/90 p-1 backdrop-blur`}>
    {(Object.keys(mapLayers) as MapLayer[]).map((key) => { const Icon = icons[key]; return <button key={key} type="button" role="radio" aria-checked={layer === key} onClick={() => setMapLayer(key)} className={`flex min-w-[3.6rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-bold transition ${layer === key ? 'bg-[#1789F4] text-white' : 'text-slate-300'}`}><Icon size={16} />{mapLayers[key].label}</button>; })}
  </div>{layer === 'transit' && !transitConfigured && <p role="status" className="max-w-[15rem] rounded-xl bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-600 shadow">Дані ліній метро, трамваю й залізниці ще не підключено.</p>}</div>;
}
