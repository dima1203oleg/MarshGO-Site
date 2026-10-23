import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Accessibility, ArrowLeftRight, BatteryCharging, Bike, BusFront, CarFront, ChevronDown, Clock3, Eye, Layers, MapPin, Navigation, ParkingCircle, Route, TrainFront, TramFront, TriangleAlert, X } from 'lucide-react';
import { cityTransportLayerIds, getTransportLayers, setTransportLayers, subscribeTransportLayers, type TransportLayerId, transportLayerList } from '../map/transportLayers';
import { productionApi } from '../services/productionApi';
import { getMapDisplayPreferences, setMapDisplayPreference, subscribeMapDisplayPreferences, type MapDisplayPreferenceId } from '../map/mapLayerPreferences';

/** Layers that can show data depend on connected feeds; the server is authoritative. */
let availabilityCache: Record<string, boolean> | null = null;

function LayerRow({
  label,
  ids,
  icon: Icon,
  tone,
  selected,
  available,
  onToggle,
}: {
  label: string;
  ids: TransportLayerId[];
  icon: typeof BusFront;
  tone: string;
  selected: ReadonlySet<TransportLayerId>;
  available: Record<string, boolean> | null;
  onToggle: (ids: TransportLayerId[], enabled: boolean) => void;
}) {
  const readyIds = available === null ? [] : ids.filter((id) => available[id] === true);
  const ready = readyIds.length > 0;
  const checked = readyIds.some((id) => selected.has(id));
  return <label className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-1.5 py-1.5 text-[11px] ${ready ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5' : 'cursor-not-allowed text-slate-400 dark:text-slate-500'}`}>
    <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone}`}><Icon size={16} strokeWidth={2.3}/></span>
    <span className="min-w-0 flex-1 font-semibold leading-tight">{label}</span>
    {!ready && <span className="sr-only">{available === null ? 'Перевіряємо доступність джерела.' : 'Немає підключеного джерела даних.'}</span>}
    <input type="checkbox" role="switch" aria-label={label} title={!ready ? 'Немає підключеного джерела даних' : undefined} checked={checked} disabled={!ready} onChange={() => onToggle(readyIds, !checked)} className="peer sr-only"/>
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#1789F4] peer-checked:after:translate-x-4 peer-disabled:bg-slate-200 dark:bg-slate-700 dark:peer-disabled:bg-slate-800"/>
  </label>;
}

function PreferenceRow({ label, id, icon: Icon, checked, onChange }: { label: string; id: MapDisplayPreferenceId; icon: typeof Route; checked: boolean; onChange: (id: MapDisplayPreferenceId, enabled: boolean) => void }) {
  return <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl px-1.5 py-1.5 text-[11px] hover:bg-slate-50 dark:hover:bg-white/5">
    <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"><Icon size={16} strokeWidth={2.3}/></span>
    <span className="min-w-0 flex-1 font-semibold leading-tight">{label}</span>
    <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={() => onChange(id, !checked)} className="peer sr-only"/>
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#1789F4] peer-checked:after:translate-x-4 dark:bg-slate-700"/>
  </label>;
}

function UnavailableRow({ label, icon: Icon }: { label: string; icon: typeof Route }) {
  return <div role="switch" aria-label={`${label}: дані недоступні`} aria-checked="false" aria-disabled="true" title="Цей шар поки не підключений" className="flex min-h-11 min-w-0 cursor-not-allowed items-center gap-2 rounded-xl px-1.5 py-1.5 text-[11px] text-slate-400 dark:text-slate-500">
    <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"><Icon size={16} strokeWidth={2.3}/></span>
    <span className="min-w-0 flex-1 font-semibold leading-tight">{label}</span>
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800"/>
  </div>;
}

const transportVisuals: Record<TransportLayerId, { icon: typeof BusFront; tone: string }> = {
  BUS: { icon: BusFront, tone: 'bg-blue-600 text-white' }, MINIBUS: { icon: BusFront, tone: 'bg-amber-500 text-white' },
  TROLLEYBUS: { icon: BusFront, tone: 'bg-emerald-600 text-white' }, TRAIN: { icon: TrainFront, tone: 'bg-rose-600 text-white' },
  TRAM: { icon: TramFront, tone: 'bg-orange-500 text-white' }, BICYCLE: { icon: Bike, tone: 'bg-cyan-600 text-white' },
  METRO: { icon: TrainFront, tone: 'bg-violet-600 text-white' }, SCOOTER: { icon: Navigation, tone: 'bg-green-600 text-white' },
  CARPOOL: { icon: CarFront, tone: 'bg-slate-600 text-white' }, CARSHARING: { icon: CarFront, tone: 'bg-orange-600 text-white' },
  TAXI: { icon: CarFront, tone: 'bg-purple-700 text-white' }, TRANSFER: { icon: Navigation, tone: 'bg-slate-700 text-white' },
  PUBLIC_TRANSPORT: { icon: BusFront, tone: 'bg-blue-600 text-white' }, CITY_TRAIN: { icon: TrainFront, tone: 'bg-rose-600 text-white' },
  FUNICULAR: { icon: TramFront, tone: 'bg-orange-500 text-white' }, STOPS: { icon: MapPin, tone: 'bg-blue-600 text-white' },
  RENTAL_POINTS: { icon: Bike, tone: 'bg-green-600 text-white' },
};

function SectionHeading({ title, open, onClick }: { title: string; open: boolean; onClick: () => void }) {
  return <button type="button" aria-expanded={open} onClick={onClick} className="flex min-h-10 w-full items-center justify-between gap-2 px-2 text-left text-xs font-bold text-slate-600 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:text-white">
    <span>{title}</span><ChevronDown size={16} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}/>
  </button>;
}

/** Mobile-first layers sheet with truthful provider availability and desktop popover fallback. */
export function MapLayersControl({ overlays = false, variant = 'explore', visible = true }: { overlays?: boolean; variant?: 'explore' | 'navigation'; visible?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<TransportLayerId>>(getTransportLayers());
  const [displayPreferences, setDisplayPreferences] = useState(getMapDisplayPreferences());
  const [available, setAvailable] = useState<Record<string, boolean> | null>(availabilityCache);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [expandedSections, setExpandedSections] = useState<ReadonlySet<string>>(() => new Set(['Транспорт', 'Відображення', 'Інфраструктура']));

  useEffect(() => subscribeTransportLayers(setSelected), []);
  useEffect(() => subscribeMapDisplayPreferences(setDisplayPreferences), []);
  useEffect(() => { if (!visible) setOpen(false); }, [visible]);
  useEffect(() => {
    if (!open || !overlays || availabilityCache) return;
    let active = true;
    void productionApi.transportLayerAvailability()
      .then((items) => {
        if (!active) return;
        availabilityCache = Object.fromEntries(items.map((item) => [item.id, item.available]));
        setAvailable(availabilityCache);
        const knownIds: TransportLayerId[] = [...transportLayerList.map((item) => item.id), 'PUBLIC_TRANSPORT', 'CITY_TRAIN', 'FUNICULAR', 'STOPS', 'RENTAL_POINTS'];
        setTransportLayers(knownIds.filter((id) => availabilityCache?.[id] !== true), false);
        setAvailabilityError(false);
      })
      .catch(() => {
        if (!active) return;
        setAvailable(Object.fromEntries([...transportLayerList.map((item) => [item.id, false] as const), ['STOPS', false], ['RENTAL_POINTS', false]]));
        setTransportLayers([...transportLayerList.map((item) => item.id), 'PUBLIC_TRANSPORT', 'CITY_TRAIN', 'FUNICULAR', 'STOPS', 'RENTAL_POINTS'], false);
        setAvailabilityError(true);
      });
    return () => { active = false; };
  }, [open, overlays, retryKey]);

  const showLayers = overlays;
  const navigationMode = variant === 'navigation';
  const toggleGroup = (ids: TransportLayerId[], enabled: boolean) => setTransportLayers(ids, enabled);
  const togglePreference = (id: MapDisplayPreferenceId, enabled: boolean) => setMapDisplayPreference(id, enabled);
  const toggleSection = (section: string) => setExpandedSections((current) => {
    const next = new Set(current);
    if (next.has(section)) next.delete(section); else next.add(section);
    return next;
  });
  const sectionHeading = (title: string) => <SectionHeading title={title} open={expandedSections.has(title)} onClick={() => toggleSection(title)}/>;
  const allLayerIds: TransportLayerId[] = [...transportLayerList.map((item) => item.id), 'PUBLIC_TRANSPORT', 'CITY_TRAIN', 'FUNICULAR', 'STOPS', 'RENTAL_POINTS'];
  const applyPreset = (preset: 'clean' | 'city' | 'route') => {
    if (preset === 'city') {
      setTransportLayers(allLayerIds, false);
      setTransportLayers(cityTransportLayerIds(available), true);
      setMapDisplayPreference('routeLines', true);
      setMapDisplayPreference('liveVehicles', true);
      setMapDisplayPreference('routeNumbers', true);
      return;
    }
    setTransportLayers(allLayerIds, false);
    setMapDisplayPreference('routeLines', preset === 'route');
    setMapDisplayPreference('liveVehicles', false);
    setMapDisplayPreference('routeNumbers', false);
  };

  return <>
    <div className="relative">
      <button type="button" aria-label="Шари карти" aria-expanded={open} aria-controls="marshgo-map-layers" onClick={() => setOpen((value) => !value)} className={`relative grid h-12 w-12 place-items-center rounded-full shadow-lg ${navigationMode ? 'border border-slate-200 bg-white/95 text-[#0B1730] backdrop-blur dark:border-white/15 dark:bg-[#0A1D2D]/90 dark:text-white' : 'bg-white text-[#1789F4] dark:bg-[#0B1C2B] dark:text-[#66B2FF]'}`}>
        {open ? <X size={22}/> : <Layers size={22}/>}
        {showLayers && selected.size > 0 && !open && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#1789F4] px-1 text-[10px] font-bold text-white">{selected.size}</span>}
      </button>
    </div>
    {open && visible && typeof document !== 'undefined' && createPortal(<div id="marshgo-map-layers" role="dialog" aria-label="Шари карти" style={{ bottom: 'calc(4.6rem + env(safe-area-inset-bottom))', maxHeight: 'min(66svh, calc(100dvh - max(.75rem, env(safe-area-inset-top)) - 5.3rem - env(safe-area-inset-bottom)))' }} className="fixed inset-x-0 z-[1000] max-h-[66svh] overflow-y-auto rounded-t-[1.75rem] border border-slate-200 bg-white px-4 pb-3 pt-2 text-slate-900 shadow-[0_-12px_40px_rgba(8,27,53,.2)] dark:border-[#263648] dark:bg-[#0A1D2D] dark:text-slate-100 dark:shadow-[0_-12px_40px_rgba(0,0,0,.45)] sm:fixed sm:inset-x-auto sm:bottom-auto sm:right-16 sm:top-1/2 sm:max-h-[70svh] sm:w-[20rem] sm:-translate-y-1/2 sm:rounded-2xl sm:p-3 sm:shadow-xl">
      <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden" aria-hidden="true"/>
      <header className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-extrabold">Шари карти</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Закрити шари карти" className="grid h-11 w-11 place-items-center rounded-full hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-white/10"><X size={18}/></button>
      </header>
      {showLayers ? <>
        {availabilityError && <p role="status" className="mb-2 rounded-xl bg-amber-50 p-2 text-[11px] leading-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Не вдалося перевірити джерела шарів. Вони тимчасово вимкнені.<button type="button" className="ml-1 font-bold underline" onClick={() => { availabilityCache = null; setAvailable(null); setAvailabilityError(false); setRetryKey((key) => key + 1); }}>Повторити</button></p>}
        <section className="mb-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-1 dark:border-slate-700 dark:bg-[#0D2233]">
          {sectionHeading('Транспорт')}
          {expandedSections.has('Транспорт') && <div className="grid grid-cols-2 gap-x-1 border-t border-slate-200/70 px-1 pt-1 dark:border-slate-700/70">{[
            ...(['BUS', 'MINIBUS', 'TROLLEYBUS', 'TRAIN', 'TRAM', 'BICYCLE', 'METRO', 'SCOOTER', 'CARPOOL', 'CARSHARING', 'TAXI', 'TRANSFER'] as TransportLayerId[]).map((id) => {
              const item = transportLayerList.find((candidate) => candidate.id === id)!;
              return <LayerRow key={id} label={item.label} ids={[id]} {...transportVisuals[id]} selected={selected} available={available} onToggle={toggleGroup}/>;
            }),
          ]}</div>}
        </section>
        <section className="mb-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-1 dark:border-slate-700 dark:bg-[#0D2233]">
          {sectionHeading('Відображення')}
          {expandedSections.has('Відображення') && <div className="grid grid-cols-2 gap-x-1 border-t border-slate-200/70 px-1 pt-1 dark:border-slate-700/70">
            <PreferenceRow label="Лінії маршрутів" id="routeLines" icon={Route} checked={displayPreferences.routeLines} onChange={togglePreference}/>
            <PreferenceRow label="Номери маршрутів" id="routeNumbers" icon={Eye} checked={displayPreferences.routeNumbers} onChange={togglePreference}/>
            <LayerRow label="Зупинки" ids={['STOPS']} {...transportVisuals.STOPS} selected={selected} available={available} onToggle={toggleGroup}/>
            <UnavailableRow label="Час прибуття (ETA)" icon={Clock3}/>
            <PreferenceRow label="Рух транспорту" id="liveVehicles" icon={Navigation} checked={displayPreferences.liveVehicles} onChange={togglePreference}/>
            <UnavailableRow label="Пересадки" icon={ArrowLeftRight}/>
          </div>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-1 dark:border-slate-700 dark:bg-[#0D2233]">
          {sectionHeading('Інфраструктура')}
          {expandedSections.has('Інфраструктура') && <div className="grid grid-cols-2 gap-x-1 border-t border-slate-200/70 px-1 pt-1 dark:border-slate-700/70">
            <UnavailableRow label="Дорожній рух" icon={CarFront}/><UnavailableRow label="Велодоріжки" icon={Bike}/>
            <UnavailableRow label="Події на дорогах" icon={TriangleAlert}/><LayerRow label="Пункти прокату" ids={['RENTAL_POINTS']} {...transportVisuals.RENTAL_POINTS} selected={selected} available={available} onToggle={toggleGroup}/>
            <UnavailableRow label="Паркування" icon={ParkingCircle}/><UnavailableRow label="Об’єкти доступності" icon={Accessibility}/>
            <UnavailableRow label="Зарядні станції" icon={BatteryCharging}/>
          </div>}
        </section>
        <details className="mt-2 px-1 text-[11px] text-slate-500 dark:text-slate-400">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">Швидкі налаштування карти</summary>
          <div className="grid grid-cols-3 gap-1 pb-2">
            <button type="button" onClick={() => applyPreset('clean')} className="min-h-10 rounded-lg bg-slate-100 px-2 font-semibold text-slate-700 hover:bg-slate-200 dark:bg-[#10283B] dark:text-slate-200 dark:hover:bg-white/10">Чиста карта</button>
            <button type="button" onClick={() => applyPreset('city')} disabled={available === null} className="min-h-10 rounded-lg bg-slate-100 px-2 font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-45 dark:bg-[#10283B] dark:text-slate-200 dark:hover:bg-white/10">Міський транспорт</button>
            <button type="button" onClick={() => applyPreset('route')} className="min-h-10 rounded-lg bg-slate-100 px-2 font-semibold text-slate-700 hover:bg-slate-200 dark:bg-[#10283B] dark:text-slate-200 dark:hover:bg-white/10">Мій маршрут</button>
          </div>
        </details>
      </> : <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-4 text-slate-500 dark:bg-[#10283B] dark:text-slate-400">Додаткові транспортні шари доступні на транспортній карті.</p>}
    </div>, document.body)}
  </>;
}
