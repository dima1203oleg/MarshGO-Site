import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CarFront, Flag, UserRound } from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import type { MapAdapter } from '../map/MapAdapter';
import { getMapLayer, setMapLayer } from '../map/mapMode';
import { productionApi, type ApiBooking, type ApiRendezvous } from '../services/productionApi';
import { meetingSnapshot, formatEta, formatMeters, stageText } from '../navigation/meeting';
import { distanceBetween } from '../navigation/guidance';

type Point = [number, number];
const SEND_EVERY_MS = 5_000;
const POLL_EVERY_MS = 5_000;

/**
 * Live meeting: the pickup point (start of the route), the driver and the passenger on one map, moving in real time,
 * with distance and time-to-arrive for each side. Both phones share their position for the length of the meeting
 * (the server keeps it for 5 minutes only and pushes every update to the other person).
 */
export function MeetingMapView({ booking, initial, onClose }: { booking: ApiBooking; initial: ApiRendezvous; onClose: () => void }) {
  const [rendezvous, setRendezvous] = useState(initial);
  const [mine, setMine] = useState<Point | null>(null);
  const [other, setOther] = useState<Point | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const adapter = useRef<MapAdapter | null>(null);
  const lastSent = useRef(0);
  const driverTrail = useRef<{ point: Point; at: number } | null>(null);
  const [driverSpeed, setDriverSpeed] = useState<number | null>(null);
  const iAmDriver = booking.current_user_is_driver;
  const mutualConsent = rendezvous.currentParticipantConsent === true && rendezvous.otherParticipantConsent === true;
  const sharing = rendezvous.locationSharingEnabled && mutualConsent;
  const pickup = rendezvous.pickup.coordinates as Point;

  useEffect(() => {
    const previous = getMapLayer();
    if (previous !== 'simple') setMapLayer('simple');
    return () => { if (previous !== 'simple') setMapLayer(previous); };
  }, []);

  // The other person's position: from the canonical REST state every few seconds, and instantly from realtime pushes.
  useEffect(() => {
    let alive = true;
    const apply = (session: ApiRendezvous) => {
      setRendezvous(session);
      const location = session.locations[iAmDriver ? 'passenger' : 'driver'];
      setOther(session.currentParticipantConsent === true && session.otherParticipantConsent === true
        && location && location.freshness === 'LIVE' ? location.coordinates as Point : null);
    };
    apply(initial);
    const poll = () => { void productionApi.bookingRendezvous(booking.id).then((session) => { if (alive) apply(session); }).catch(() => undefined); };
    poll();
    const timer = window.setInterval(poll, POLL_EVERY_MS);
    const unsubscribe = productionApi.subscribeRealtime((event) => {
      if (!event.type.startsWith('rendezvous.')) return;
      const data = (event as { data: { rendezvous_id?: string; participant?: 'driver' | 'passenger'; coordinates?: [number, number] } }).data;
      if (data.rendezvous_id !== initial.id) return;
      if (event.type === 'rendezvous.location.updated' && data.coordinates && data.participant === (iAmDriver ? 'passenger' : 'driver')) setOther(data.coordinates as Point);
      else poll();
    }, () => undefined);
    return () => { alive = false; window.clearInterval(timer); unsubscribe(); };
  }, [booking.id, initial.id, iAmDriver]);

  // My own position: shown at once from the device, and shared with the other person while sharing is on.
  useEffect(() => {
    if (!('geolocation' in navigator)) { setMessage('Цей пристрій не надає геолокацію.'); return; }
    const watch = navigator.geolocation.watchPosition((position) => {
      const point: Point = [position.coords.longitude, position.coords.latitude];
      setMine(point);
      const now = Date.now();
      if (iAmDriver) {
        const previous = driverTrail.current;
        if (previous && now - previous.at > 1500) setDriverSpeed(distanceBetween(previous.point, point) / ((now - previous.at) / 1000));
        if (!previous || now - previous.at > 1500) driverTrail.current = { point, at: now };
      }
      if (sharing && now - lastSent.current >= SEND_EVERY_MS) {
        lastSent.current = now;
        void productionApi.sendRendezvousLocation(rendezvous.id, { longitude: point[0], latitude: point[1], accuracyMeters: Math.min(1000, position.coords.accuracy || 50), capturedAt: new Date(position.timestamp).toISOString() }).catch(() => undefined);
      }
    }, (error) => setMessage(error.code === 1 ? 'Дозвольте геолокацію, щоб друга людина бачила вас на карті.' : 'Не вдалося визначити ваше місце.'), { enableHighAccuracy: true, maximumAge: 2000, timeout: 20_000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [sharing, rendezvous.id, iAmDriver]);

  const driverPoint = sharing ? (iAmDriver ? mine : other) : null;
  const passengerPoint = sharing ? (iAmDriver ? other : mine) : null;
  const meetingPoints = { pickup, driver: driverPoint, passenger: passengerPoint };
  const latestMeetingPoints = useRef(meetingPoints);
  latestMeetingPoints.current = meetingPoints;
  useEffect(() => { adapter.current?.setMeetingPoints?.(meetingPoints); }, [pickup[0], pickup[1], driverPoint?.[0], driverPoint?.[1], passengerPoint?.[0], passengerPoint?.[1]]);
  const snapshot = useMemo(() => meetingSnapshot({ pickup, driver: driverPoint, passenger: passengerPoint, driverSpeedMps: iAmDriver ? driverSpeed : null }),
    [pickup[0], pickup[1], driverPoint?.[0], driverPoint?.[1], passengerPoint?.[0], passengerPoint?.[1], driverSpeed, iAmDriver]);

  const act = async (action: 'arrived' | 'will_arrive') => {
    setBusy(true); setMessage('');
    try {
      await productionApi.rendezvousStatus(rendezvous.id, action, action === 'will_arrive' ? 2 : undefined);
      setRendezvous(await productionApi.bookingRendezvous(booking.id));
      setMessage(action === 'arrived' ? 'Повідомили, що ви на місці.' : 'Повідомили, що будете через 2 хв.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не вдалося надіслати статус.'); }
    finally { setBusy(false); }
  };
  const activate = async () => {
    setBusy(true); setMessage('');
    try { setRendezvous(await productionApi.activateRendezvous(booking.id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не вдалося увімкнути обмін місцем.'); }
    finally { setBusy(false); }
  };
  const notYet = Date.now() < Date.parse(rendezvous.activationAt);
  const who = iAmDriver ? booking.passenger_name : booking.driver_name;

  return <main className="fixed inset-0 z-[80] overflow-hidden bg-[#dbeafe] text-[#17243a]" aria-label="Карта зустрічі">
    <MarshGoMap route={[]} theme="MARSHGO_LIGHT" onStatus={() => undefined} onAdapter={(next) => { adapter.current = next; next?.setMeetingPoints?.(latestMeetingPoints.current); }}/>
    <div className="pointer-events-none absolute inset-x-4 top-[max(3.5rem,calc(env(safe-area-inset-top)+0.85rem))] z-[500] space-y-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white p-2 shadow-xl">
        <button type="button" onClick={onClose} aria-label="Назад" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><ArrowLeft size={18}/></button>
        <div className="min-w-0 flex-1 px-1"><h1 className="truncate text-sm font-extrabold">Зустріч із {who}</h1><p className="truncate text-[11px] text-slate-500">Початок маршруту · {rendezvous.pickup.label}</p></div>
      </div>
    </div>
    <section aria-label="Стан зустрічі" className="absolute inset-x-0 bottom-0 z-[500] rounded-t-[1.8rem] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_35px_rgba(14,37,70,.18)]">
      <p data-testid="meeting-stage" className="text-center text-sm font-extrabold">{snapshot.stage ? stageText[snapshot.stage] : sharing ? `Чекаємо, поки ${iAmDriver ? 'пасажир' : 'водій'} поділиться місцем…` : mutualConsent ? 'Обмін місцем ще не увімкнено' : 'Очікуємо взаємне підтвердження обміну місцем'}</p>
      {snapshot.betweenM !== null && <p data-testid="meeting-between" className="mt-0.5 text-center text-xs text-slate-500">Між вами {formatMeters(snapshot.betweenM)}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[#EAF3FF] p-3" data-testid="meeting-driver-card"><p className="flex items-center gap-1.5 text-[11px] font-bold text-[#1789F4]"><CarFront size={14}/>{iAmDriver ? 'Ви (водій)' : 'Водій'}</p>
          <p className="mt-1 text-xl font-extrabold">{formatEta(snapshot.driverEtaMin)}</p><p className="text-[11px] text-slate-500">{driverPoint ? `прямо до точки ${formatMeters(snapshot.driverToPickupM)}` : 'немає свіжої позиції'}</p></div>
        <div className="rounded-2xl bg-emerald-50 p-3" data-testid="meeting-passenger-card"><p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700"><UserRound size={14}/>{iAmDriver ? 'Пасажир' : 'Ви (пасажир)'}</p>
          <p className="mt-1 text-xl font-extrabold">{formatEta(snapshot.passengerEtaMin)}</p><p className="text-[11px] text-slate-500">{passengerPoint ? `прямо до точки ${formatMeters(snapshot.passengerToPickupM)}` : 'немає свіжої позиції'}</p></div>
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500"><Flag size={12} className="shrink-0 text-rose-600"/>Місце зустрічі — початок маршруту поїздки. Відстань і ETA орієнтовні, за прямою відстанню.</p>
      {sharing && <p className="mt-1 text-center text-[10px] text-slate-500">Позиції оновлюються кожні 5 с; показуємо лише свіжі координати до 90 с.</p>}
      {message && <p role="status" className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">{message}</p>}
      {!rendezvous.locationSharingEnabled ? <button type="button" disabled={busy || notYet} onClick={() => void activate()} className="mt-3 w-full rounded-2xl bg-[#1789F4] py-3.5 text-sm font-bold text-white disabled:opacity-50">{notYet ? `Обмін місцем стане доступним о ${new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date(rendezvous.activationAt))}` : 'Увімкнути обмін місцем'}</button>
        : !mutualConsent ? <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-center text-xs text-amber-900">Карта почне показувати обидві позиції після підтвердження згоди обома учасниками.</p>
        : <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => void act('arrived')} className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white disabled:opacity-50">Я на місці</button><button type="button" disabled={busy} onClick={() => void act('will_arrive')} className="rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 disabled:opacity-50">Буду через 2 хв</button></div>}
    </section>
  </main>;
}
