import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bike, BusFront, CarFront, Globe, MapPin, TrainFront, TramFront, type LucideIcon } from 'lucide-react';
import { productionApi, type ApiTransportCity } from '../services/productionApi';
import { MarshGoMap } from '../map/MarshGoMap';
import { MapLayersControl } from '../components/MapLayersControl';
import type { MapAdapter, MapStatus } from '../map/MapAdapter';
import { clearTransportLayers, getTransportLayers, subscribeTransportLayers, toggleTransportLayer, type TransportLayerId } from '../map/transportLayers';
import { getLayerAvailabilityState, loadLayerAvailability, subscribeLayerAvailability } from '../map/layerAvailability';
import { isLayerSelectable, layerUnavailableNote } from '../map/transportLayerConfig';
import { getVehicleQuality, subscribeVehicleQuality, type VehicleQuality } from '../map/transportQuality';
import { StatusBadge } from '../design-system/ui/StatusBadge';
import { getMapLayer, getMapPerspective, satelliteBasemapAvailable, setMapLayer, setMapPerspective, subscribeMapLayer, subscribeMapPerspective, type MapLayer, type MapPerspective } from '../map/mapMode';

const chips: Array<{ label: string; id: TransportLayerId; Icon: LucideIcon }> = [
  { label: 'Увесь транспорт', id: 'PUBLIC_TRANSPORT', Icon: BusFront },
  { label: 'Автобуси', id: 'BUS', Icon: BusFront },
  { label: 'Тролейбуси', id: 'TROLLEYBUS', Icon: BusFront },
  { label: 'Трамваї', id: 'TRAM', Icon: TramFront },
  { label: 'Маршрутки', id: 'MINIBUS', Icon: BusFront },
  { label: 'Зупинки', id: 'STOPS', Icon: MapPin },
  { label: 'Метро', id: 'METRO', Icon: TrainFront },
  { label: 'Поїзди', id: 'TRAIN', Icon: TrainFront },
  { label: 'Попутки', id: 'CARPOOL', Icon: CarFront },
  { label: 'Велосипеди', id: 'BICYCLE', Icon: Bike },
  { label: 'Самокати', id: 'SCOOTER', Icon: Bike },
  { label: 'Каршерінг', id: 'CARSHARING', Icon: CarFront },
];

/** 2D map for planning: the user switches on only the layers they need; everything is off by default. */
export function TransportMapView({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<MapStatus>('loading');
  const [hint, setHint] = useState<string | null>(null);
  const [cities, setCities] = useState<ApiTransportCity[]>([]);
  const [cityId, setCityId] = useState('kyiv');
  const [selected, setSelected] = useState(getTransportLayers());
  const [layerState, setLayerState] = useState(getLayerAvailabilityState);
  const [quality, setQuality] = useState<VehicleQuality | null>(getVehicleQuality());
  const [mapLayer, setLocalMapLayer] = useState<MapLayer>(getMapLayer);
  const [mapPerspective, setLocalPerspective] = useState<MapPerspective>(getMapPerspective);
  const adapter = useRef<MapAdapter | null>(null);
  const selectedCity = useMemo(() => cities.find((city) => city.id === cityId) ?? null, [cities, cityId]);
  useEffect(() => subscribeTransportLayers(setSelected), []);
  useEffect(() => subscribeLayerAvailability(setLayerState), []);
  useEffect(() => { void loadLayerAvailability(); }, []);
  useEffect(() => subscribeVehicleQuality(setQuality), []);
  useEffect(() => subscribeMapLayer(setLocalMapLayer), []);
  useEffect(() => subscribeMapPerspective(setLocalPerspective), []);
  useEffect(() => {
    const controller = new AbortController();
    void productionApi.transportCities(controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      setCities(response);
      if (!response.some((city) => city.id === cityId) && response[0]) setCityId(response[0].id);
    }).catch(() => { if (!controller.signal.aborted) setHint('Не вдалося завантажити список міст.'); });
    return () => controller.abort();
  }, []);
  useEffect(() => () => clearTransportLayers(), []);
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
  return <main className="relative h-[100svh] overflow-hidden bg-[#dbeafe] text-[#17243a] dark:bg-[#0B141C] dark:text-[#E7F0FA]">
    <MarshGoMap route={[]} overlays onStatus={setStatus} onTransportHint={setHint} onAdapter={onAdapter}/>
    <div className="pointer-events-none absolute inset-x-4 top-[max(.8rem,env(safe-area-inset-top))] z-[500] flex flex-col gap-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white p-2 shadow-xl dark:bg-[#111820]">
        <button type="button" onClick={onBack} aria-label="Назад" className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-700 dark:bg-[#16202B] dark:text-slate-200"><ArrowLeft size={18}/></button>
        <h1 className="flex-1 truncate px-1 text-base font-extrabold">Карта транспорту</h1>
        {cities.length > 0 && <label className="sr-only" htmlFor="transport-city">Місто</label>}
        {cities.length > 0 && <select id="transport-city" aria-label="Місто на транспортній карті" value={cityId} onChange={(event) => chooseCity(event.target.value)} className="max-w-28 rounded-full border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-[#16202B] dark:text-slate-200">
          {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>}
      </div>
      <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Швидкі шари">
        {chips.map(({ label, id, Icon }) => {
          const selectable = isLayerSelectable(layerState.availability, id);
          return <button key={id} type="button" disabled={!selectable} aria-pressed={selected.has(id)} aria-label={selectable ? label : `${label}: ${layerUnavailableNote(layerState.probeFailed)}`} onClick={() => toggleTransportLayer(id)} className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold shadow ${selected.has(id) ? 'bg-[var(--mg-action)] text-white' : 'bg-white text-slate-700 dark:bg-[#16202B] dark:text-slate-200'} ${selectable ? '' : 'cursor-not-allowed bg-slate-50 text-slate-400 dark:bg-[#141C25] dark:text-slate-500'}`}>
            <Icon size={15}/>{label}
            {!selectable && <span className="text-xs font-semibold">· {layerUnavailableNote(layerState.probeFailed)}</span>}
          </button>;
        })}
      </div>
      {hint && <p role="status" className="pointer-events-auto max-w-[22rem] self-start rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold leading-snug text-slate-600 shadow dark:bg-[#111820]/95 dark:text-slate-300">{hint}</p>}
      {quality && <p role="status" aria-label="Якість даних живого транспорту" className="pointer-events-auto self-start shadow"><StatusBadge status={quality.status} label={quality.label} size="sm"/></p>}
      {selectedCity && <p className="pointer-events-auto self-start rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow">
        {selectedCity.routeCount} маршрутів · {selectedCity.stopCount} зупинок · статичний розклад{selectedCity.realtimeAvailable ? ' · realtime джерело підключене' : ''}
      </p>}
      {status === 'failed' && <p role="alert" className="pointer-events-auto self-start rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow">Не вдалося завантажити карту. Перевірте мережу.</p>}
      {status === 'unconfigured' && <p role="alert" className="pointer-events-auto self-start rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow">Не налаштовано базову карту — фон мапи порожній.</p>}
    </div>
    <div className="absolute right-4 top-1/2 z-[500] flex -translate-y-1/2 flex-col gap-2">
      <button
        type="button"
        aria-label={mapPerspective === '3d' ? 'Повернути плоский 2D-вигляд' : "Увімкнути об'ємну 3D-перспективу"}
        title={mapPerspective === '3d' ? '2D' : '3D'}
        aria-pressed={mapPerspective === '3d'}
        onClick={() => {
          const next: MapPerspective = mapPerspective === '3d' ? '2d' : '3d';
          setMapPerspective(next);
          setLocalPerspective(next);
        }}
        className={`grid h-12 w-12 place-items-center rounded-full text-xs font-black shadow-lg transition-all ${
          mapPerspective === '3d'
            ? 'bg-[var(--mg-action)] text-white shadow-blue-500/30 ring-2 ring-blue-400/50'
            : 'border border-slate-200/80 bg-white/95 text-slate-700 shadow-md backdrop-blur hover:bg-slate-50 dark:border-white/10 dark:bg-[#111C28]/95 dark:text-slate-200 dark:hover:bg-[#182635]'
        }`}
      >
        {mapPerspective === '3d' ? '2D' : '3D'}
      </button>
      <button
        type="button"
        aria-label={satelliteBasemapAvailable ? (mapLayer === 'satellite' ? 'Повернути схематичну карту' : 'Увімкнути супутникову карту') : 'Супутникові знімки недоступні'}
        title={satelliteBasemapAvailable ? (mapLayer === 'satellite' ? 'Схема' : 'Супутник') : 'Супутникові знімки не підключені'}
        aria-pressed={satelliteBasemapAvailable && mapLayer === 'satellite'}
        aria-disabled={!satelliteBasemapAvailable}
        disabled={!satelliteBasemapAvailable}
        onClick={() => {
          if (!satelliteBasemapAvailable) return;
          const next: MapLayer = mapLayer === 'simple' ? 'satellite' : 'simple';
          setMapLayer(next);
          setLocalMapLayer(next);
        }}
        className={`grid h-12 w-12 place-items-center rounded-full shadow-lg transition-all ${
          mapLayer === 'satellite' && satelliteBasemapAvailable
            ? 'bg-[var(--mg-action)] text-white shadow-blue-500/30 ring-2 ring-blue-400/50'
            : 'border border-slate-200/80 bg-white/95 text-slate-700 shadow-md backdrop-blur hover:bg-slate-50 dark:border-white/10 dark:bg-[#111C28]/95 dark:text-slate-200 dark:hover:bg-[#182635]'
        }${satelliteBasemapAvailable ? '' : ' opacity-45'}`}
      >
        <Globe size={20} />
      </button>
      <MapLayersControl overlays />
    </div>
  </main>;
}
