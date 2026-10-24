import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import type { ApiRendezvous } from '../services/productionApi';
import type { MapAdapter, MapStatus } from '../map/MapAdapter';
import { MarshGoMap } from '../map/MarshGoMap';
import { rendezvousDistanceToPickup, rendezvousMapPoints } from '../domain/rendezvousMapPoints';
import { productionApi, type ApiRendezvousApproaches } from '../services/productionApi';

function metersBetween(a: [number, number], b: [number, number]) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b[1] - a[1]); const dLon = radians(b[0] - a[0]);
  const lat1 = radians(a[1]); const lat2 = radians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function RendezvousLocationMap({
  session,
  currentUserIsDriver,
  busy = false,
  onArrived,
  onApproaching,
  onStopSharing,
  onBoarding,
}: {
  session: ApiRendezvous;
  currentUserIsDriver: boolean;
  busy?: boolean;
  onArrived?: () => void;
  onApproaching?: () => void;
  onStopSharing?: () => void;
  onBoarding?: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [approaches, setApproaches] = useState<ApiRendezvousApproaches | null>(null);
  const displaySession = useMemo(() => approaches ? ({
    ...session,
    locations: {
      driver: approaches.driver.location ?? session.locations.driver,
      passenger: approaches.passenger.location ?? session.locations.passenger,
    },
  }) : session, [session, approaches]);
  const points = useMemo(() => rendezvousMapPoints(displaySession, currentUserIsDriver), [displaySession, currentUserIsDriver]);
  const coordinates = useMemo(() => points.map((point) => point.coordinate), [points]);
  const adapter = useRef<MapAdapter | null>(null);
  const fitted = useRef(false);
  const lastFramedLocations = useRef<{ driver: [number, number] | null; passenger: [number, number] | null }>({ driver: null, passenger: null });
  const [status, setStatus] = useState<MapStatus>('loading');

  useEffect(() => {
    if (!session.locationSharingEnabled || !session.currentParticipantConsent || !session.otherParticipantConsent) {
      setApproaches(null);
      return;
    }
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending || !active) return;
      pending = true;
      try { const result = await productionApi.rendezvousApproaches(session.id); if (active) setApproaches(result); }
      catch { if (active) setApproaches(null); }
      finally { pending = false; }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [session.id, session.locationSharingEnabled, session.currentParticipantConsent, session.otherParticipantConsent]);

  const routeSegments = useMemo(() => {
    if (!approaches) return [];
    return [
      approaches.driver.approach.status === 'ROUTED' && approaches.driver.approach.geometry
        ? { id: 'driver-approach', coordinates: approaches.driver.approach.geometry, modeColor: '#2563eb' } : null,
      approaches.passenger.approach.status === 'ROUTED' && approaches.passenger.approach.geometry
        ? { id: 'passenger-approach', coordinates: approaches.passenger.approach.geometry, modeColor: '#7c3aed' } : null,
    ].filter((segment): segment is NonNullable<typeof segment> => Boolean(segment));
  }, [approaches]);
  const mapCoordinates = useMemo(() => {
    const routed = routeSegments.flatMap((segment) => segment.coordinates);
    return [...coordinates, ...routed];
  }, [coordinates, routeSegments]);

  useEffect(() => {
    if (!adapter.current || mapCoordinates.length === 0) return;
    const driverNow = displaySession.locations.driver?.freshness === 'LIVE' ? displaySession.locations.driver.coordinates : null;
    const passengerNow = displaySession.locations.passenger?.freshness === 'LIVE' ? displaySession.locations.passenger.coordinates : null;
    const movedEnough = (next: [number, number] | null, previous: [number, number] | null) => Boolean(next && (!previous || metersBetween(next, previous) >= 75));
    const shouldRefit = !fitted.current || movedEnough(driverNow, lastFramedLocations.current.driver) || movedEnough(passengerNow, lastFramedLocations.current.passenger);
    if (shouldRefit) {
      adapter.current.focusCoordinates?.(mapCoordinates, { top: 24, right: 24, bottom: 24, left: 24 }, 16);
      fitted.current = true;
      lastFramedLocations.current = { driver: driverNow, passenger: passengerNow };
    }
  }, [mapCoordinates, displaySession.locations.driver?.capturedAt, displaySession.locations.passenger?.capturedAt]);

  const ownLive = points.some((point) => point.kind === 'SELF_LOCATION');
  const otherLive = points.some((point) => point.kind === 'OTHER_LOCATION');
  const driverDistance = rendezvousDistanceToPickup(displaySession, 'driver');
  const passengerDistance = rendezvousDistanceToPickup(displaySession, 'passenger');
  const formatDistance = (distance: typeof driverDistance) => distance.state === 'LIVE'
    ? `≈ ${distance.straightLineMeters >= 1000
      ? `${(distance.straightLineMeters / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км`
      : `${Math.round(distance.straightLineMeters / 10) * 10} м`} по прямій`
    : distance.state === 'STALE' ? 'GPS застарів' : 'Немає свіжої GPS-точки';
  const formatApproach = (approach: ApiRendezvousApproaches['driver']['approach'] | undefined, fallback: typeof driverDistance) => {
    if (approach?.status === 'ROUTED' && approach.distanceMeters !== null && approach.durationSeconds !== null) {
      const distance = approach.distanceMeters >= 1000
        ? `${(approach.distanceMeters / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км`
        : `${Math.round(approach.distanceMeters / 10) * 10} м`;
      return `≈ ${distance} · ~${Math.max(1, Math.round(approach.durationSeconds / 60))} хв`;
    }
    if (approach?.status === 'ROUTING_UNAVAILABLE') return 'Маршрут/ETA недоступні';
    return formatDistance(fallback);
  };
  const driverApproach = approaches?.driver.approach;
  const passengerApproach = approaches?.passenger.approach;

  return <div data-testid="rendezvous-location-map" className={fullscreen
    ? 'fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#eff4fa] text-[#142642] dark:bg-[#07111d] dark:text-white'
    : 'relative mt-3 overflow-hidden rounded-2xl border border-blue-100 bg-white'}>
    {fullscreen && <header className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex min-h-12 items-center gap-2 rounded-2xl border border-white/70 bg-white/95 p-2 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
      <button type="button" aria-label="Згорнути карту зустрічі" onClick={() => setFullscreen(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-white"><ArrowLeft size={20}/></button>
      <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-extrabold">Зустріч · {session.pickup.label}</h2><p className="text-[11px] text-slate-500">{session.locationSharingEnabled ? 'Обмін місцем активний' : 'Очікуємо згоду учасників'}</p></div>
    </header>}
    <div className={fullscreen ? 'relative min-h-0 flex-1' : 'relative h-40'} role="group" aria-label="Карта точки зустрічі">
      <MarshGoMap key={fullscreen ? 'meeting-map-fullscreen' : 'meeting-map-inline'} route={[]} routeSegments={routeSegments} routeWaypoints={points} onStatus={setStatus} onAdapter={(next) => { adapter.current = next; }} />
      {!fullscreen && <button type="button" aria-label="Розгорнути карту зустрічі" onClick={() => setFullscreen(true)} className="absolute right-2 top-2 z-20 flex min-h-11 items-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-3 text-xs font-bold text-slate-800 shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-950/95 dark:text-white"><Maximize2 size={15}/>На весь екран</button>}
      {status !== 'available' && <div className="absolute inset-x-3 top-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-center text-[10px] font-semibold text-slate-600 shadow-sm" role="status">
        {status === 'loading' ? 'Завантажуємо карту зустрічі…' : status === 'degraded' ? 'Карта завантажилась не повністю.' : 'Карта тимчасово недоступна; статус точок доступний нижче.'}
      </div>}
    </div>
    <div className={fullscreen ? 'grid grid-cols-3 gap-1 border-t border-slate-200 bg-white px-2 py-3 text-center text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300' : 'grid grid-cols-3 gap-1 border-t border-slate-100 px-2 py-2 text-center text-[9px] font-semibold text-slate-600'}>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600"/>Точка посадки</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-600"/>{ownLive ? 'Ви · наживо' : 'Ви · очікуємо GPS'}</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-violet-600"/>{otherLive ? 'Учасник · наживо' : 'Учасник · очікуємо GPS'}</span>
    </div>
    <div className={fullscreen ? 'grid grid-cols-2 gap-2 border-t border-slate-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-xs dark:border-slate-800 dark:bg-slate-950' : 'grid grid-cols-2 gap-2 border-t border-slate-100 px-3 py-2 text-[10px]'}>
      <p><b className="block text-slate-700">Водій до посадки</b><span className="text-slate-500">{formatApproach(driverApproach, driverDistance)}</span></p>
      <p><b className="block text-slate-700">Пасажир до посадки</b><span className="text-slate-500">{formatApproach(passengerApproach, passengerDistance)}</span></p>
    </div>
    {fullscreen && session.locationSharingEnabled && <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-white px-4 pb-3 dark:border-slate-800 dark:bg-slate-950">
      <button type="button" disabled={busy} onClick={onApproaching} className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Прямую до точки</button>
      <button type="button" disabled={busy} onClick={onArrived} className="min-h-11 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Я на місці</button>
      {session.state === 'BOTH_NEARBY' && onBoarding && <button type="button" disabled={busy} onClick={onBoarding} className="col-span-2 min-h-11 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Підтвердити зустріч і посадку</button>}
      <button type="button" disabled={busy} onClick={onStopSharing} className="col-span-2 min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Припинити обмін GPS</button>
    </div>}
    {!fullscreen && <p className="px-3 pb-2 text-[9px] leading-4 text-slate-500">Сині та фіолетові лінії й ETA надходять від налаштованої маршрутизації. Якщо її немає, показуємо GPS-стан без вигаданого шляху.</p>}
  </div>;
}
