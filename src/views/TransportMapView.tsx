import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bike, Bus, TrainFront } from 'lucide-react';
import { productionApi, type ApiTransportCity } from '../services/productionApi';
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
  const [cities, setCities] = useState<ApiTransportCity[]>([]);
  const [cityId, setCityId] = useState('kyiv');
  const [selected, setSelected] = useState(getTransportLayers());
  const adapter = useRef<MapAdapter | null>(null);
  const selectedCity = useMemo(() => cities.find((city) => city.id === cityId) ?? null, [cities, cityId]);
  useEffect(() => subscribeTransportLayers(setSelected), []);
  useEffect(() => {
    const controller = new AbortController();
    void productionApi.transportCities(controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      setCities(response);
      if (!response.some((city) => city.id === cityId) && response[0]) setCityId(response[0].id);
    }).catch(() => { if (!controller.signal.aborted) setHint('Не вдалося завантажити список міст.'); });
    return () => controller.abort();
  }, []);
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
  const chooseCity = (nextId: string) => {
    setCityId(nextId);
    const city = cities.find((entry) => entry.id === nextId);
    if (city?.bbox) adapter.current?.focus([(city.bbox[0] + city.bbox[2]) / 2, (city.bbox[1] + city.bbox[3]) / 2], 10.5);
  };
  return <main className="relative h-[100svh] overflow-hidden bg-[#dbeafe] text-[#17243a]">
    <MarshGoMap route={[]} overlays theme="MARSHGO_LIGHT" onStatus={setStatus} onTransportHint={setHint} onAdapter={onAdapter}/>
    <div className="pointer-events-none absolute inset-x-4 top-[max(.8rem,env(safe-area-inset-top))] z-[500] flex flex-col gap-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white p-2 shadow-xl">
        <button type="button" onClick={onBack} aria-label="Назад" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><ArrowLeft size={18}/></button>
        <h1 className="flex-1 truncate px-1 text-base font-extrabold">Карта транспорту</h1>
        {cities.length > 0 && <label className="sr-only" htmlFor="transport-city">Місто</label>}
        {cities.length > 0 && <select id="transport-city" aria-label="Місто на транспортній карті" value={cityId} onChange={(event) => chooseCity(event.target.value)} className="max-w-28 rounded-full border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700">
          {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>}
      </div>
      <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Швидкі шари">
        {chips.map(({ label, id, Icon }) => <button key={id} type="button" aria-pressed={selected.has(id)} onClick={() => toggleTransportLayer(id)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow ${selected.has(id) ? 'bg-[#1789F4] text-white' : 'bg-white text-slate-700'}`}><Icon size={15}/>{label}</button>)}
      </div>
      {hint && <p role="status" className="pointer-events-auto self-start rounded-xl bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-600 shadow">{hint}</p>}
      {selectedCity && <p className="pointer-events-auto self-start rounded-xl bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-700 shadow">
        {selectedCity.routeCount} маршрутів · {selectedCity.stopCount} зупинок · статичний розклад{selectedCity.realtimeAvailable ? ' · realtime джерело підключене' : ''}
        {selectedCity.sourceUrl && <><span aria-hidden="true"> · </span><a className="text-blue-700 underline" href={selectedCity.sourceUrl} target="_blank" rel="noreferrer">Джерело даних</a></>}
        <span> · {selectedCity.licenses.length ? selectedCity.licenses.join(', ') : 'умови використання уточнюються'}</span>
      </p>}
      {status === 'failed' && <p role="alert" className="pointer-events-auto self-start rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900 shadow">Не вдалося завантажити карту. Перевірте мережу.</p>}
    </div>
    <div className="absolute right-4 top-1/2 z-[500] -translate-y-1/2"><MapLayersControl overlays/></div>
  </main>;
}
