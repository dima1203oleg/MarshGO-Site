import { useEffect, useState } from 'react';
import { Bike, Bus, CarFront, Footprints, KeyRound, Plane, Repeat, Ship, Ticket, TrainFront, TramFront, Users, Zap, type LucideIcon } from 'lucide-react';
import { formatDistance, transportGroups, transportModes, type TransportMode } from '../domain/transportCatalog';
import { productionApi, type ApiMobilityAvailability, type ApiNearby } from '../services/productionApi';

const icons: Record<string, LucideIcon> = {
  carpool: CarFront, taxi: CarFront, carsharing: KeyRound, car_rental: KeyRound, transfer: Repeat, bus: Bus, marshrutka: Users, trolleybus: Bus, tram: TramFront, metro: TrainFront,
  train: TrainFront, suburban_train: TrainFront, intercity_bus: Ticket, bike: Bike, scooter: Zap, moped: Bike, plane: Plane, ferry: Ship, walk: Footprints,
};
/** Vehicles parked at the same spot are shown as one row ("Велосипед ×5"). */
function groupAssets(assets: ApiNearby['assets']) {
  const groups = new Map<string, { key: string; type: string; providerName: string; distanceM: number; rangeMeters?: number; count: number }>();
  for (const asset of assets) {
    const key = `${asset.type}|${asset.providerName}|${asset.location[0].toFixed(4)},${asset.location[1].toFixed(4)}`;
    const found = groups.get(key);
    if (found) found.count += 1; else groups.set(key, { key, type: asset.type, providerName: asset.providerName, distanceM: asset.distanceM, ...(asset.rangeMeters ? { rangeMeters: asset.rangeMeters } : {}), count: 1 });
  }
  return [...groups.values()];
}
const typeLabel: Record<string, string> = { BIKE: 'Велосипед', EBIKE: 'E-bike', SCOOTER: 'Самокат', MOPED: 'Мопед', CARSHARING: 'Авто' };

/** Full transport catalogue. A mode is "available" when it is native (carpool) or backed by an enabled, healthy provider in the Mobility Control Center. */
export function TransportCatalog({ origin, onUnavailable }: { origin: { latitude: number; longitude: number } | null; onUnavailable: (message: string) => void }) {
  const [availability, setAvailability] = useState<ApiMobilityAvailability | null>(null);
  const [active, setActive] = useState<TransportMode | null>(null);
  const [nearby, setNearby] = useState<ApiNearby | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [note, setNote] = useState('');

  useEffect(() => { productionApi.mobilityAvailability().then(setAvailability).catch(() => undefined); }, []);

  const transitType = (mode: TransportMode) => ({ bus: 'bus', trolleybus: 'trolleybus', tram: 'tram', metro: 'metro', train: 'train', suburban_train: 'train', intercity_bus: 'bus' } as Record<string, string>)[mode.id];
  const rentalInfo = (mode: TransportMode) => availability?.modes.find((item) => item.mode === mode.rental);
  const isAvailable = (mode: TransportMode) => mode.native === true || (mode.rental ? rentalInfo(mode)?.available === true : transitType(mode) ? availability?.transit[transitType(mode)]?.available === true : false);

  const open = async (mode: TransportMode) => {
    setActive(mode); setNearby(null); setNote('');
    const transitCities = transitType(mode) ? availability?.transit[transitType(mode)]?.cities ?? [] : [];
    if (transitCities.length > 0) { onUnavailable(`${mode.label}: розклад підключено для міст — ${transitCities.join(', ')}. Побудова маршрутів громадським транспортом ще в розробці.`); return; }
    if (!isAvailable(mode)) { onUnavailable(`${mode.label}: поки немає підключеного провайдера. Адміністратор може підключити його в Центрі керування мобільністю.`); return; }
    if (!mode.rental) return;
    const point = origin ?? await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), () => resolve(null), { timeout: 8000 });
    });
    if (!point) { setNote('Оберіть місце «Звідки» або дозвольте геолокацію, щоб показати транспорт поруч.'); return; }
    setState('loading');
    try { setNearby(await productionApi.nearbyRentals(mode.rental, point.latitude, point.longitude, 1500)); setState('idle'); }
    catch (error) { setState('error'); setNote(error instanceof Error ? error.message : 'Не вдалося завантажити транспорт поруч.'); }
  };

  return <section aria-label="Види транспорту" className="mt-5">
    <h2 className="mb-0.5 text-sm font-extrabold text-[#0E1F35]">Види транспорту</h2>
    <p className="mb-3 text-xs text-slate-500">{transportModes.length} видів в одному застосунку</p>
    {transportGroups.map((group) => <div key={group} className="mb-3"><h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{group}</h3>
      <div className="grid grid-cols-3 gap-2.5">{transportModes.filter((mode) => mode.group === group).map((mode) => { const Icon = icons[mode.id] ?? CarFront; const available = isAvailable(mode); return <button key={mode.id} type="button" aria-pressed={active?.id === mode.id} aria-label={`${mode.label}${available ? ', доступно' : ', скоро'}`} onClick={() => void open(mode)}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 text-center text-[11px] font-semibold leading-tight transition-colors ${active?.id === mode.id ? 'border-[#1789F4] bg-[#EAF3FF] text-[#1789F4]' : available ? 'border-[#BBD7FB] bg-white text-[#0E1F35] shadow-sm' : 'border-[#E5EDF7] bg-white text-[#475569] shadow-sm'}`}>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${available ? 'bg-[#1789F4] text-white' : 'bg-[#F1F5F9] text-[#1789F4]'}`}><Icon size={18}/></span>{mode.label}
        <span className={`text-[9px] font-medium ${available ? 'text-[#1789F4]' : 'text-slate-400'}`}>{available ? 'доступно' : 'скоро'}</span></button>; })}</div></div>)}
    {active?.rental && isAvailable(active) && <div role="region" aria-label={`${active.label} поруч`} className="mt-1 rounded-2xl bg-white p-4 shadow-sm">
      <b className="text-sm text-[#0E1F35]">{active.label} поруч</b>
      {state === 'loading' && <p className="mt-2 text-xs text-slate-500">Шукаємо транспорт поруч…</p>}
      {note && <p role="status" className="mt-2 text-xs text-slate-600">{note}</p>}
      {nearby && <>
        <p className="mt-1 text-xs text-slate-500">{nearby.totalAssets > 0 ? `${nearby.totalAssets} вільних у радіусі ${formatDistance(nearby.radiusM)}` : `Поблизу немає вільного транспорту у радіусі ${formatDistance(nearby.radiusM)}.`}{nearby.failedProviders > 0 ? ' Деякі провайдери тимчасово недоступні.' : ''}</p>
        <ul className="mt-2 divide-y divide-slate-100">{groupAssets(nearby.assets).slice(0, 5).map((group) => <li key={group.key} className="flex items-center justify-between py-2 text-xs"><span><b className="text-[#0E1F35]">{typeLabel[group.type] ?? group.type}{group.count > 1 ? ` ×${group.count}` : ''}</b> · {group.providerName}{group.rangeMeters ? ` · запас ${Math.round(group.rangeMeters / 1000)} км` : ''}</span><span className="font-bold text-[#1789F4]">{formatDistance(group.distanceM)}</span></li>)}</ul>
        {nearby.stations.length > 0 && <><p className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Станції</p><ul className="divide-y divide-slate-100">{nearby.stations.slice(0, 3).map((station) => <li key={station.id} className="flex items-center justify-between py-2 text-xs"><span><b className="text-[#0E1F35]">{station.name}</b> · {station.availableAssets} вільних</span><span className="font-bold text-[#1789F4]">{formatDistance(station.distanceM)}</span></li>)}</ul></>}
        <p className="mt-2 text-[10px] text-slate-400">Бронювання й оплата оренди поки не підключені: це перегляд наявності.</p>
      </>}
    </div>}
  </section>;
}
