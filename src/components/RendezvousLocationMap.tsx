import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { ApiRendezvous } from '../services/productionApi';
import type { MapAdapter, MapStatus } from '../map/MapAdapter';
import { MarshGoMap } from '../map/MarshGoMap';
import { interpolateRendezvousMapPoints, rendezvousDistanceToPickup, rendezvousMapPoints } from '../domain/rendezvousMapPoints';
import { productionApi, type ApiRendezvousApproaches } from '../services/productionApi';

function metersBetween(a: [number, number], b: [number, number]) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b[1] - a[1]); const dLon = radians(b[0] - a[0]);
  const lat1 = radians(a[1]); const lat2 = radians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function RendezvousLocationMap({ session, currentUserIsDriver, onArrived }: { session: ApiRendezvous; currentUserIsDriver: boolean; onArrived: () => void }) {
  const [approaches, setApproaches] = useState<ApiRendezvousApproaches | null>(null);
  const displaySession = useMemo(() => approaches ? ({
    ...session,
    locations: {
      driver: approaches.driver.location ?? session.locations.driver,
      passenger: approaches.passenger.location ?? session.locations.passenger,
    },
  }) : session, [session, approaches]);
  const points = useMemo(() => rendezvousMapPoints(displaySession, currentUserIsDriver), [displaySession, currentUserIsDriver]);
  const [animatedPoints, setAnimatedPoints] = useState(points);
  const animatedPointsRef = useRef(points);
  const coordinates = useMemo(() => points.map((point) => point.coordinate), [points]);
  const adapter = useRef<MapAdapter | null>(null);
  const fitted = useRef(false);
  const lastFramedLocations = useRef<{ driver: [number, number] | null; passenger: [number, number] | null }>({ driver: null, passenger: null });
  const [status, setStatus] = useState<MapStatus>('loading');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const from = animatedPointsRef.current;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const hasPositionChange = points.some((point) => {
      if (point.kind !== 'SELF_LOCATION' && point.kind !== 'OTHER_LOCATION') return false;
      const previous = from.find((candidate) => candidate.kind === point.kind);
      return previous && (previous.coordinate[0] !== point.coordinate[0] || previous.coordinate[1] !== point.coordinate[1]);
    });
    if (reduceMotion || !hasPositionChange) {
      animatedPointsRef.current = points;
      setAnimatedPoints(points);
      return;
    }
    const startedAt = performance.now();
    const durationMs = 700;
    let frame = 0;
    const animate = (now: number) => {
      const linear = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - (1 - linear) ** 3;
      const next = interpolateRendezvousMapPoints(from, points, eased);
      animatedPointsRef.current = next;
      setAnimatedPoints(next);
      if (linear < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [points]);

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

  return <div data-testid="rendezvous-location-map" className={expanded
    ? 'fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-y-auto bg-white dark:bg-[#0A1D2D]'
    : 'mt-3 overflow-hidden rounded-2xl border border-blue-100 bg-white dark:bg-[#0A1D2D]'}>
    {expanded && <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 pt-[max(.75rem,env(safe-area-inset-top))] dark:border-slate-800">
      <div><h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Точка зустрічі</h2><p className="text-xs text-slate-500 dark:text-slate-400">Спільне наближення до посадки</p></div>
      <button type="button" aria-label="Згорнути карту зустрічі" onClick={() => setExpanded(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><Minimize2 size={18}/></button>
    </header>}
    <div className={`relative ${expanded ? 'h-[48dvh] min-h-64 shrink-0' : 'h-40'}`} role="group" aria-label="Карта точки зустрічі">
      <MarshGoMap route={[]} routeSegments={routeSegments} routeWaypoints={animatedPoints} onStatus={setStatus} onAdapter={(next) => { adapter.current = next; }} />
      {!expanded && <button type="button" aria-label="Розгорнути карту зустрічі" onClick={() => setExpanded(true)} className="absolute right-2 top-2 z-20 grid h-11 w-11 place-items-center rounded-xl border border-white/80 bg-white/95 text-slate-800 shadow-md"><Maximize2 size={17}/></button>}
      {status !== 'available' && <div className="absolute inset-x-3 top-3 z-10 rounded-xl bg-white/95 px-3 py-2 text-center text-[10px] font-semibold text-slate-600 shadow-sm" role="status">
        {status === 'loading' ? 'Завантажуємо карту зустрічі…' : status === 'degraded' ? 'Карта завантажилась не повністю.' : 'Карта тимчасово недоступна; статус точок доступний нижче.'}
      </div>}
    </div>
    <div className="grid shrink-0 grid-cols-3 gap-1 border-t border-slate-100 px-2 py-2 text-center text-[9px] font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600"/>Точка посадки</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-600"/>{ownLive ? `Ви (${currentUserIsDriver ? 'водій' : 'пасажир'}) · наживо` : 'Ви · очікуємо GPS'}</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-violet-600"/>{otherLive ? `${currentUserIsDriver ? 'Пасажир' : 'Водій'} · наживо` : 'Учасник · очікуємо GPS'}</span>
    </div>
    <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 px-3 py-2 text-[10px] dark:border-slate-800">
      <p data-testid="meeting-driver-card"><b className="block text-slate-700">Водій до посадки</b><span className="text-slate-500">{formatApproach(driverApproach, driverDistance)}</span></p>
      <p data-testid="meeting-passenger-card"><b className="block text-slate-700">Пасажир до посадки</b><span className="text-slate-500">{formatApproach(passengerApproach, passengerDistance)}</span></p>
    </div>
    <p className="px-3 pb-2 text-[9px] leading-4 text-slate-500 dark:text-slate-400">Сині та фіолетові лінії й ETA надходять від налаштованої маршрутизації. Якщо її немає, показуємо GPS-стан без вигаданого шляху.</p>
    {expanded && <div className="sticky bottom-0 mt-auto shrink-0 border-t border-slate-100 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-[#0A1D2D]">
      <button type="button" onClick={onArrived} className="min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">Я на місці</button>
    </div>}
  </div>;
}
