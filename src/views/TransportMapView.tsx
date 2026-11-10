import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bike, BusFront, CarFront, MapPin, TrainFront, TramFront, type LucideIcon } from 'lucide-react';
import { productionApi, type ApiTransportCity } from '../services/productionApi';
import { MarshGoMap } from '../map/MarshGoMap';
import { MapLayersControl } from '../components/MapLayersControl';
import { MapBasemapControl, MapControlRail, MapPerspectiveControl, MapVoiceControl, MapZoomControls } from '../components/MapInteractionControls';
import type { MapAdapter, MapStatus } from '../map/MapAdapter';
import { cityTransportLayerIds, getTransportLayers, hasStoredLayerChoice, minZoom, setTransportLayers, subscribeTransportLayers, toggleTransportLayer, type TransportLayerId } from '../map/transportLayers';
import { getLayerAvailabilityState, loadLayerAvailability, subscribeLayerAvailability } from '../map/layerAvailability';
import { isLayerSelectable, layerUnavailableNote } from '../map/transportLayerConfig';
import { mapStatusDetail } from '../map/mapStatusCopy';
import { getVehicleQuality, subscribeVehicleQuality, type VehicleQuality } from '../map/transportQuality';
import { StatusBadge } from '../design-system/ui/StatusBadge';
import { diagnosticsRequested } from './resultsDiagnostics';

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

/** Arrival zoom: above the vehicle gate, so a city chosen from the dropdown shows live movement at once. */
const arrivalZoom = minZoom.vehicles + 0.2;
const normalizedCity = (name: string) => name.trim().toLocaleLowerCase('uk-UA').replace(/[’'`]/g, '');

/** 2D map for planning: city transport is on until the user chooses otherwise, and that choice survives leaving the screen. */
export function TransportMapView({ onBack, cityName, onCitySelected }: { onBack: () => void; cityName: string; onCitySelected: (name: string) => void }) {
  const showDiagnostics = typeof window !== 'undefined' && diagnosticsRequested(
    window.location.search,
    (() => { try { return window.localStorage.getItem('marshgo.results.diagnostics'); } catch { return null; } })(),
  );
  const [status, setStatus] = useState<MapStatus>('loading');
  const [hint, setHint] = useState<string | null>(null);
  const [cityRegistryHint, setCityRegistryHint] = useState<string | null>(null);
  const [cities, setCities] = useState<ApiTransportCity[]>([]);
  const [cityId, setCityId] = useState('');
  const [selected, setSelected] = useState(getTransportLayers());
  const [layerState, setLayerState] = useState(getLayerAvailabilityState);
  const [quality, setQuality] = useState<VehicleQuality | null>(getVehicleQuality());
  const [mapAdapter, setMapAdapter] = useState<MapAdapter | null>(null);
  const selectedCity = useMemo(() => cities.find((city) => city.id === cityId) ?? null, [cities, cityId]);
  useEffect(() => subscribeTransportLayers(setSelected), []);
  useEffect(() => subscribeLayerAvailability(setLayerState), []);
  useEffect(() => { void loadLayerAvailability(); }, []);
  /**
   * A first visit has never chosen anything, and an empty canvas that still says "realtime джерело
   * підключене" reads as a broken map. Once the server registry answers, switch on exactly the public
   * transport this city can serve. An explicit choice — including switching everything off — is stored
   * and never overwritten.
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || hasStoredLayerChoice()) return;
    const ids = cityTransportLayerIds(layerState.availability);
    if (!ids.length) return;
    seeded.current = true;
    setTransportLayers(ids, true);
  }, [layerState.availability]);
  useEffect(() => subscribeVehicleQuality(setQuality), []);
  useEffect(() => {
    const controller = new AbortController();
    void productionApi.transportCities(controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      setCities(response);
    }).catch(() => { if (!controller.signal.aborted) setHint('Не вдалося завантажити список міст.'); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!cities.length) return;
    const match = cities.find((city) => normalizedCity(city.name) === normalizedCity(cityName));
    setCityId(match?.id ?? '');
    setCityRegistryHint(cityName && !match ? `Для міста «${cityName}» у реєстрі немає перевіреного каталогу міського транспорту.` : null);
  }, [cityName, cities]);
  useEffect(() => {
    if (!selectedCity?.bbox || !mapAdapter) return;
    mapAdapter.focus([(selectedCity.bbox[0] + selectedCity.bbox[2]) / 2, (selectedCity.bbox[1] + selectedCity.bbox[3]) / 2], arrivalZoom);
  }, [selectedCity, mapAdapter]);
  // Leaving the screen already destroys the map adapter (polling, sources, layers) in MarshGoMap;
  // clearing the selection here would silently store "no layers" and blank the map on the next visit.
  const onAdapter = (next: MapAdapter | null) => {
    setMapAdapter(next);
  };
  const chooseCity = (nextId: string) => {
    setCityId(nextId);
    const city = cities.find((entry) => entry.id === nextId);
    if (city) onCitySelected(city.name);
  };
  return <section aria-label="Карта транспорту" className="relative h-[100svh] overflow-hidden bg-[#dbeafe] text-[#17243a] dark:bg-[var(--mg-canvas)] dark:text-[var(--mg-ink-primary)]">
    <MarshGoMap route={[]} overlays onStatus={setStatus} onTransportHint={setHint} onAdapter={onAdapter}/>
    <div className="pointer-events-none absolute inset-x-4 top-[max(.8rem,env(safe-area-inset-top))] z-[500] flex flex-col gap-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white p-2 shadow-xl dark:bg-[var(--mg-surface-primary)]">
        <button type="button" onClick={onBack} aria-label="Назад" className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-700 dark:bg-[var(--mg-surface-secondary)] dark:text-[var(--mg-ink-primary)]"><ArrowLeft size={18}/></button>
        <h1 className="flex-1 truncate px-1 text-base font-extrabold">Карта транспорту</h1>
        {cities.length > 0 && <label className="sr-only" htmlFor="transport-city">Місто</label>}
        {cities.length > 0 && <select id="transport-city" aria-label="Місто на транспортній карті" value={cityId} onChange={(event) => chooseCity(event.target.value)} className="max-w-28 rounded-full border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-secondary)] dark:text-[var(--mg-ink-primary)]">
          <option value="">Оберіть місто</option>
          {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>}
      </div>
      <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Швидкі шари">
        {chips.map(({ label, id, Icon }) => {
          const selectable = isLayerSelectable(layerState.availability, id);
          return <button key={id} type="button" disabled={!selectable} aria-pressed={selected.has(id)} aria-label={selectable ? label : `${label}: зараз недоступно`} onClick={() => toggleTransportLayer(id)} className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold shadow ${selected.has(id) ? 'bg-[var(--mg-action)] text-white' : 'bg-white text-slate-700 dark:bg-[var(--mg-surface-secondary)] dark:text-[var(--mg-ink-primary)]'} ${selectable ? '' : 'cursor-not-allowed bg-slate-50 text-slate-400 dark:bg-[var(--mg-surface-elevated)] dark:text-[var(--mg-ink-muted)]'}`}>
            <Icon size={15}/>{label}
            {showDiagnostics && !selectable && <span className="text-xs font-semibold">· {layerUnavailableNote(layerState.probeFailed)}</span>}
          </button>;
        })}
      </div>
      {showDiagnostics && hint && <p role="status" className="pointer-events-auto max-w-[22rem] self-start rounded-xl bg-[var(--mg-surface-primary)]/95 px-3 py-2 text-xs font-semibold leading-snug text-[var(--mg-ink-secondary)] shadow">{hint}</p>}
      {cityRegistryHint && <p role="status" className="pointer-events-auto max-w-[22rem] self-start rounded-xl border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)]/95 px-3 py-2 text-xs font-semibold leading-snug text-[var(--mg-ink-secondary)] shadow">Транспортна карта для цього міста поки недоступна.</p>}
      {showDiagnostics && quality && <p role="status" aria-label="Якість даних живого транспорту" className="pointer-events-auto self-start shadow"><StatusBadge status={quality.status} label={quality.label} size="sm"/></p>}
      {showDiagnostics && selectedCity && <p className="pointer-events-auto self-start rounded-xl bg-[var(--mg-surface-primary)]/95 px-3 py-2 text-xs font-semibold text-[var(--mg-ink-secondary)] shadow">
        {selectedCity.routeCount} маршрутів · {selectedCity.stopCount} зупинок · статичний розклад{selectedCity.realtimeAvailable ? ' · realtime джерело підключене' : ''}
      </p>}
      {showDiagnostics && status !== 'available' && <p role="status" className="pointer-events-auto self-start rounded-xl bg-[var(--mg-surface-primary)] px-3 py-2 text-xs font-semibold text-[var(--mg-ink-secondary)] shadow">{mapStatusDetail(status, 'transport')}</p>}
      {!showDiagnostics && (status === 'failed' || status === 'unconfigured') && <p role="status" className="pointer-events-auto self-start rounded-xl border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] px-3 py-2 text-xs font-semibold text-[var(--mg-ink-secondary)] shadow">Карта недоступна</p>}
      {!showDiagnostics && status === 'degraded' && <p role="status" className="pointer-events-auto self-start rounded-xl border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] px-3 py-2 text-xs font-semibold text-[var(--mg-ink-secondary)] shadow">Карта завантажена частково</p>}
    </div>
    <MapControlRail className="absolute right-4 top-1/2 z-[500] -translate-y-1/2" label="Керування транспортною картою">
      <MapZoomControls map={mapAdapter}/>
      <MapVoiceControl />
      <MapPerspectiveControl />
      <MapBasemapControl />
      <MapLayersControl overlays />
    </MapControlRail>
  </section>;
}
