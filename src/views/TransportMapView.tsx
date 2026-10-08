import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bike, Bus, TrainFront } from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import { MapLayersControl } from '../components/MapLayersControl';
import type { MapAdapter, MapStatus } from '../map/MapAdapter';
import { getMapLayer, setMapLayer } from '../map/mapMode';
import { clearTransportLayers, getTransportLayers, subscribeTransportLayers, toggleTransportLayer, type TransportLayerId } from '../map/transportLayers';

const chips: Array<{ label: string; id: TransportLayerId; Icon: typeof Bus }> = [
  { label: 'Метро', id: 'METRO', Icon: TrainFront }, { label: 'Транспорт', id: 'PUBLIC_TRANSPORT', Icon: Bus }, { label: 'Велосипеди', id: 'BICYCLE', Icon: Bike },
];

/** 2D map for planning: the user switches on only the layers they need; everything is off by default. */
export function TransportMapView({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<MapStatus>('loading');
  const [hint, setHint] = useState<string | null>(null);
  const [selected, setSelected] = useState(getTransportLayers());
  const adapter = useRef<MapAdapter | null>(null);
  useEffect(() => subscribeTransportLayers(setSelected), []);
  useEffect(() => {
    // Planning happens on the 2D map; a 3D/satellite choice left over from navigation would hide the layers.
    if (getMapLayer() === 'navigation') setMapLayer('standard');
    return () => clearTransportLayers();
  }, []);
  const located = useRef(false);
  const onAdapter = (next: MapAdapter | null) => {
    adapter.current = next;
    if (!next || located.current || !('geolocation' in navigator)) return;
    located.current = true;
    navigator.geolocation.getCurrentPosition((position) => next.focus([position.coords.longitude, position.coords.latitude], 13), () => next.focus([30.5234, 50.4501], 10), { timeout: 8000, maximumAge: 300_000 });
  };
  return <main className="relative h-[100svh] overflow-hidden bg-[#dbeafe] text-[#17243a]">
    <MarshGoMap route={[]} overlays theme="MARSHGO_LIGHT" onStatus={setStatus} onTransportHint={setHint} onAdapter={onAdapter}/>
    <div className="pointer-events-none absolute inset-x-4 top-[max(.8rem,env(safe-area-inset-top))] z-[500] flex flex-col gap-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white p-2 shadow-xl">
        <button type="button" onClick={onBack} aria-label="Назад" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><ArrowLeft size={18}/></button>
        <h1 className="flex-1 truncate px-1 text-base font-extrabold">Карта транспорту</h1>
      </div>
      <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Швидкі шари">
        {chips.map(({ label, id, Icon }) => <button key={id} type="button" aria-pressed={selected.has(id)} onClick={() => toggleTransportLayer(id)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow ${selected.has(id) ? 'bg-[#1789F4] text-white' : 'bg-white text-slate-700'}`}><Icon size={15}/>{label}</button>)}
      </div>
      {hint && <p role="status" className="pointer-events-auto self-start rounded-xl bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-600 shadow">{hint}</p>}
      {status === 'failed' && <p role="alert" className="pointer-events-auto self-start rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900 shadow">Не вдалося завантажити карту. Перевірте мережу.</p>}
    </div>
    <div className="absolute right-4 top-1/2 z-[500] -translate-y-1/2"><MapLayersControl overlays/></div>
  </main>;
}
