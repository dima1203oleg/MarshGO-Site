import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiRendezvous } from '../services/productionApi';
import type { MapAdapter, MapStatus } from '../map/MapAdapter';
import { MarshGoMap } from '../map/MarshGoMap';
import { rendezvousDistanceToPickup, rendezvousMapPoints } from '../domain/rendezvousMapPoints';

export function RendezvousLocationMap({ session, currentUserIsDriver }: { session: ApiRendezvous; currentUserIsDriver: boolean }) {
  const points = useMemo(() => rendezvousMapPoints(session, currentUserIsDriver), [session, currentUserIsDriver]);
  const coordinates = useMemo(() => points.map((point) => point.coordinate), [points]);
  const adapter = useRef<MapAdapter | null>(null);
  const fittedPointCount = useRef(0);
  const [status, setStatus] = useState<MapStatus>('loading');

  useEffect(() => {
    if (!adapter.current || coordinates.length <= fittedPointCount.current) return;
    adapter.current.focusCoordinates?.(coordinates, { top: 24, right: 24, bottom: 24, left: 24 }, 16);
    fittedPointCount.current = coordinates.length;
  }, [coordinates]);

  const ownLive = points.some((point) => point.kind === 'SELF_LOCATION');
  const otherLive = points.some((point) => point.kind === 'OTHER_LOCATION');
  const driverDistance = rendezvousDistanceToPickup(session, 'driver');
  const passengerDistance = rendezvousDistanceToPickup(session, 'passenger');
  const formatDistance = (distance: typeof driverDistance) => distance.state === 'LIVE'
    ? `≈ ${distance.straightLineMeters >= 1000
      ? `${(distance.straightLineMeters / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км`
      : `${Math.round(distance.straightLineMeters / 10) * 10} м`} по прямій`
    : distance.state === 'STALE' ? 'GPS застарів' : 'Немає свіжої GPS-точки';

  return <div data-testid="rendezvous-location-map" className="mt-3 overflow-hidden rounded-2xl border border-blue-100 bg-white">
    <div className="relative h-40" role="group" aria-label="Карта точки зустрічі">
      <MarshGoMap route={[]} routeWaypoints={points} onStatus={setStatus} onAdapter={(next) => { adapter.current = next; }} />
      {status !== 'available' && <div className="absolute inset-x-3 top-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-center text-[10px] font-semibold text-slate-600 shadow-sm" role="status">
        {status === 'loading' ? 'Завантажуємо карту зустрічі…' : status === 'degraded' ? 'Карта завантажилась не повністю.' : 'Карта тимчасово недоступна; статус точок доступний нижче.'}
      </div>}
    </div>
    <div className="grid grid-cols-3 gap-1 border-t border-slate-100 px-2 py-2 text-center text-[9px] font-semibold text-slate-600">
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600"/>Точка посадки</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-600"/>{ownLive ? 'Ви · наживо' : 'Ви · очікуємо GPS'}</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-violet-600"/>{otherLive ? 'Учасник · наживо' : 'Учасник · очікуємо GPS'}</span>
    </div>
    <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-3 py-2 text-[10px]">
      <p><b className="block text-slate-700">Водій до посадки</b><span className="text-slate-500">{formatDistance(driverDistance)}</span></p>
      <p><b className="block text-slate-700">Пасажир до посадки</b><span className="text-slate-500">{formatDistance(passengerDistance)}</span></p>
    </div>
    <p className="px-3 pb-2 text-[9px] leading-4 text-slate-500">Відстані приблизні, по прямій; маршрут і ETA до посадки не розраховані.</p>
  </div>;
}
