import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ArrowLeft, MapPin, Navigation, LocateFixed, ShieldCheck, Square, Volume2 } from 'lucide-react';
import { ApiNavigationMatch, ApiNavigationSession, ApiPlace, productionApi } from '../services/productionApi';
import { initialMapTileHealth, leafletTileKey, MapTileHealth, reduceMapTileHealth } from '../services/mapTileStatus';

type Props = { onBack: () => void; onOpenDemand?: (demandId: string) => void };
const tileUrl = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim();
const tileAttribution = (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined)?.trim() || '';

export function ProductionNavigation({ onBack, onOpenDemand }: Props) {
  const [destinationText, setDestinationText] = useState('');
  const [suggestions, setSuggestions] = useState<ApiPlace[]>([]);
  const [destination, setDestination] = useState<ApiPlace | null>(null);
  const [session, setSession] = useState<ApiNavigationSession | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [matchingBusy, setMatchingBusy] = useState(false);
  const [matchingEnabled, setMatchingEnabled] = useState(false);
  const [matches, setMatches] = useState<ApiNavigationMatch[]>([]);
  const [gpsMessage, setGpsMessage] = useState('');
  const [visible, setVisible] = useState(document.visibilityState === 'visible');
  const [clock, setClock] = useState(Date.now());
  const [onRoute, setOnRoute] = useState<boolean | null>(null);
  const [mapTileHealth, setMapTileHealth] = useState<MapTileHealth>(() => initialMapTileHealth(Boolean(tileUrl)));
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const positionRef = useRef<L.CircleMarker | null>(null);
  const lastSentRef = useRef<{ lat: number; lon: number; at: number } | null>(null);

  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    productionApi.activeNavigation().then((active) => {
      if (active) {
        setSession(active); setMatchingEnabled(active.opt_in); setOnRoute(null);
        if (active.opt_in) void productionApi.navigationMatches(active.id).then(setMatches).catch(() => undefined);
      }
    }).catch((error: unknown) => {
      setGpsMessage(error instanceof Error ? error.message : 'Не вдалося відновити навігаційну сесію.');
    }).finally(() => setRestoring(false));
  }, []);

  useEffect(() => {
    if (!session || !visible) return;
    return productionApi.subscribeRealtime((event) => {
      if (event.type !== 'navigation.match.passenger-confirmed') return;
      void productionApi.navigationMatches(session.id).then((current) => {
        setMatches(current);
        if (current.some((match) => match.id === event.data.candidate_id)) {
          setGpsMessage('Пасажир підтвердив взаємний інтерес. Зупиніться безпечно, щоб погодити ціну. Бронювання ще немає.');
        }
      }).catch((error: unknown) => setGpsMessage(error instanceof Error ? error.message : 'Не вдалося оновити стан попутника.'));
    }, () => undefined);
  }, [session?.id, visible]);

  useEffect(() => {
    if (!session || session.state !== 'active' || !matchingEnabled || !session.current_location_at || !visible) return;
    let current = true;
    const refresh = () => productionApi.refreshNavigationMatches(session.id)
      .then((next) => { if (current) setMatches(next); })
      .catch((error: unknown) => { if (current) setGpsMessage(error instanceof Error ? error.message : 'Підбір попутників недоступний.'); });
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => { current = false; window.clearInterval(timer); };
  }, [session?.id, session?.state, matchingEnabled, Boolean(session?.current_location_at), visible]);

  useEffect(() => {
    if (!session || !mapElement.current || mapRef.current) return;
    const map = L.map(mapElement.current, { zoomControl: false, attributionControl: Boolean(tileUrl) });
    mapRef.current = map;
    if (tileUrl) {
      const tiles = L.tileLayer(tileUrl, { attribution: tileAttribution, maxZoom: 19, crossOrigin: true });
      tileLayerRef.current = tiles;
      tiles.on('tileload', (event) => setMapTileHealth((health) => reduceMapTileHealth(health, 'tileload', leafletTileKey(event.coords))));
      tiles.on('tileerror', (event) => setMapTileHealth((health) => reduceMapTileHealth(health, 'tileerror', leafletTileKey(event.coords))));
      tiles.on('tileunload', (event) => setMapTileHealth((health) => reduceMapTileHealth(health, 'tileunload', leafletTileKey(event.coords))));
      tiles.addTo(map);
    }
    routeRef.current = L.polyline(session.route.map(([lon, lat]) => [lat, lon]), {
      color: '#1769F4', weight: 7, opacity: 0.95, lineCap: 'round', lineJoin: 'round',
    }).addTo(map);
    const [originLon, originLat] = session.current_location ?? session.route[0];
    positionRef.current = L.circleMarker([originLat, originLon], {
      radius: 9, color: '#fff', weight: 4, fillColor: '#1769F4', fillOpacity: 1,
    }).addTo(map);
    map.fitBounds(routeRef.current.getBounds(), { padding: [35, 35] });
    return () => {
      map.remove(); mapRef.current = null; tileLayerRef.current = null; routeRef.current = null; positionRef.current = null;
    };
  }, [session?.id]);

  useEffect(() => {
    if (!session || !mapRef.current || !positionRef.current) return;
    const point = session.current_location;
    if (!point) return;
    positionRef.current.setLatLng([point[1], point[0]]);
    mapRef.current.panTo([point[1], point[0]], { animate: true, duration: 0.6 });
  }, [session?.current_location?.[0], session?.current_location?.[1]]);

  useEffect(() => {
    if (!session || session.state !== 'active' || !navigator.geolocation) return;
    let busySending = false;
    const watchId = navigator.geolocation.watchPosition((position) => {
      if (document.visibilityState !== 'visible' || busySending) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || accuracy > 100) {
        setGpsMessage('Точність GPS недостатня. Перевірте дозвіл на геолокацію та відкрийте екран надворі.');
        return;
      }
      const now = Date.now();
      const last = lastSentRef.current;
      const displacement = last ? L.latLng(last.lat, last.lon).distanceTo([latitude, longitude]) : Infinity;
      if (last && now - last.at < 10_000 && displacement < 25) return;
      busySending = true;
      productionApi.sendNavigationLocation(session.id, {
        coordinates: [longitude, latitude], accuracyMeters: accuracy, capturedAt: new Date(position.timestamp).toISOString(),
      }).then((result) => {
        lastSentRef.current = { lat: latitude, lon: longitude, at: now };
        setOnRoute(result.onRoute);
        setGpsMessage(result.onRoute ? '' : 'Ви поза коридором маршруту. Перевірте напрямок або завершіть навігацію.');
        setSession((current) => current?.id === session.id ? {
          ...current, current_location: [longitude, latitude], current_location_accuracy_m: accuracy,
          current_location_at: result.capturedAt,
        } : current);
      }).catch((error: unknown) => {
        setGpsMessage(error instanceof Error ? error.message : 'Не вдалося синхронізувати GPS.');
      }).finally(() => { busySending = false; });
    }, (error) => {
      setGpsMessage(error.code === error.PERMISSION_DENIED ? 'Дозвіл на геолокацію вимкнений.' : 'GPS тимчасово недоступний. Навігація не рухатиме маркер без свіжого сигналу.');
    }, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [session?.id, session?.state]);

  const searchDestination = async () => {
    setBusy(true); setSuggestions([]); setDestination(null);
    try {
      const found = await productionApi.suggestPlaces(destinationText.trim());
      setSuggestions(found);
      if (!found.length) setGpsMessage('Місце не знайдено. Уточніть назву й оберіть результат геокодера.');
    } catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Пошук місця недоступний.'); }
    finally { setBusy(false); }
  };

  const start = async () => {
    if (!destination || !navigator.geolocation) {
      setGpsMessage(destination ? 'Цей пристрій не надає доступ до GPS.' : 'Спершу знайдіть і виберіть точку призначення.');
      return;
    }
    setBusy(true); setGpsMessage('Очікуємо точне місце розташування…');
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        if (position.coords.accuracy > 100) throw new Error('Точність GPS має бути не гіршою за 100 метрів.');
        const created = await productionApi.startNavigation({
          origin: [position.coords.longitude, position.coords.latitude],
          destination: [destination.longitude, destination.latitude], destinationName: destination.label,
        });
        setSession(created); setMatchingEnabled(false); setMatches([]); setOnRoute(null); lastSentRef.current = null; setGpsMessage('');
      } catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Не вдалося побудувати дорожній маршрут.'); }
      finally { setBusy(false); }
    }, (error) => {
      setGpsMessage(error.code === error.PERMISSION_DENIED ? 'Надайте дозвіл на геолокацію в налаштуваннях iPhone.' : 'Не вдалося отримати точку GPS. Перевірте сигнал і спробуйте ще раз.');
      setBusy(false);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 });
  };

  const end = async () => {
    if (!session) return;
    setBusy(true);
    try { await productionApi.endNavigation(session.id); setSession(null); setMatchingEnabled(false); setMatches([]); setOnRoute(null); lastSentRef.current = null; setGpsMessage('Навігацію завершено. Точну геолокацію видалено із сервера.'); }
    catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Не вдалося завершити навігацію.'); }
    finally { setBusy(false); }
  };

  const toggleMatching = async () => {
    if (!session) return;
    const next = !matchingEnabled;
    setMatchingBusy(true);
    try {
      await productionApi.setNavigationMatching(session.id, next);
      setMatchingEnabled(next); setSession({ ...session, opt_in: next });
      if (!next) setMatches([]);
      setGpsMessage(next ? 'Пошук уздовж маршруту увімкнено за вашою згодою.' : 'Автоматичний пошук вимкнено.');
    } catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Не вдалося змінити налаштування підбору.'); }
    finally { setMatchingBusy(false); }
  };

  const pauseForResponse = async () => {
    if (!session) return;
    setBusy(true);
    try { await productionApi.pauseNavigation(session.id); setSession({ ...session, state: 'paused' }); setGpsMessage('Навігацію призупинено. Підтверджуйте інтерес лише коли авто безпечно зупинене.'); }
    catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Не вдалося призупинити навігацію.'); }
    finally { setBusy(false); }
  };

  const resumeNavigation = async () => {
    if (!session) return;
    setBusy(true);
    try { await productionApi.resumeNavigation(session.id); setSession({ ...session, state: 'active' }); setGpsMessage('Навігацію відновлено. Чекаємо свіжу GPS-точку.'); }
    catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Не вдалося відновити навігацію.'); }
    finally { setBusy(false); }
  };

  const expressInterest = async (candidateId: string) => {
    if (!session) return;
    setMatchingBusy(true);
    try {
      await productionApi.expressNavigationInterest(session.id, candidateId);
      setMatches((current) => current.map((match) => match.id === candidateId ? { ...match, status: 'driver_interested' } : match));
      setGpsMessage('Водійський інтерес надіслано. Бронювання не створено — потрібне підтвердження пасажира та погодження ціни.');
    } catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Не вдалося підтвердити інтерес.'); }
    finally { setMatchingBusy(false); }
  };

  const matchingPanel = session ? <section className="mt-4 rounded-2xl bg-blue-50 p-3">
    <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold">Підбирати попутників дорогою</p><p className="text-[11px] leading-4 text-slate-500">Пошук лише після вашої згоди · потрібно перевірене активне авто</p></div><button type="button" role="switch" aria-checked={matchingEnabled} aria-label="Пошук попутників уздовж маршруту" disabled={matchingBusy || !session.matching_vehicle_available} onClick={() => void toggleMatching()} className={`relative h-7 w-12 shrink-0 rounded-full transition ${matchingEnabled ? 'bg-emerald-500' : 'bg-slate-300'} disabled:opacity-45`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${matchingEnabled ? 'left-6' : 'left-1'}`}/></button></div>
    {!session.matching_vehicle_available && <p className="mt-2 text-[10px] text-amber-800">Додайте та активуйте перевірений автомобіль із достатньою кількістю місць.</p>}
    {matchingEnabled && <div className="mt-3 max-h-[23svh] space-y-2 overflow-y-auto pr-1">
      <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-blue-800">{matches.length ? `Сумісні заявки · ${matches.length}` : 'Шукаємо вздовж дороги'}</p>{session.state === 'active' && <span className="text-[10px] text-slate-500">оновлення щохвилини</span>}</div>
      {matches.map((match) => <article key={match.id} className="rounded-xl bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-xs">{match.origin_name.split(',')[0]} → {match.destination_name.split(',')[0]}</b><p className="mt-1 text-[10px] text-slate-500">{match.passenger_count} пас. · забрати орієнтовно {new Intl.DateTimeFormat('uk-UA',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Kyiv'}).format(new Date(match.pickup_eta))}</p></div><span className="shrink-0 text-right text-[10px] font-bold text-blue-700">+{(match.detour_distance_m/1000).toFixed(1)} км<br/>+{Math.round(match.detour_duration_s/60)} хв</span></div>
        <p className="mt-1 text-[10px] text-slate-500">{match.budget_minor === null ? 'Бюджет не вказаний' : `${new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:0}).format(match.budget_minor/100)} ${match.budget_type === 'per_seat' ? 'за місце' : 'за всіх'}`}{match.vehicle_make ? ` · ${match.vehicle_make} ${match.vehicle_model ?? ''}` : ''}</p>
        {match.status === 'suggested' && session.state === 'active' && <button disabled={busy} onClick={() => void pauseForResponse()} className="mt-2 w-full rounded-lg bg-amber-100 py-2 text-[10px] font-bold text-amber-900">Зупиніться та призупиніть навігацію, щоб відповісти</button>}
        {match.status === 'suggested' && session.state === 'paused' && <button disabled={matchingBusy} onClick={() => void expressInterest(match.id)} className="mt-2 w-full rounded-lg bg-emerald-600 py-2 text-[10px] font-bold text-white">Підтвердити інтерес водія</button>}
        {match.status === 'driver_interested' && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] font-semibold text-amber-900">Ваш інтерес надіслано. Чекаємо підтвердження пасажира; бронювання ще немає.</p>}
        {match.status === 'passenger_confirmed' && <><p className="mt-2 rounded-lg bg-emerald-50 p-2 text-[10px] font-semibold text-emerald-800">Пасажир підтвердив взаємний інтерес. Бронювання ще немає.</p>{session.state === 'paused' && <button disabled={!onOpenDemand} onClick={() => onOpenDemand?.(match.demand_id)} className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-[10px] font-bold text-white disabled:opacity-50">Відкрити заявку та запропонувати ціну</button>}</>}
      </article>)}
      {!matches.length && <p className="rounded-xl bg-white p-3 text-[10px] leading-4 text-slate-500">Поки не знайдено заявки, що проходять географічну, часову та маршрутну перевірку.</p>}
    </div>}
  </section> : null;

  if (!session) return <main className="min-h-[100svh] bg-[#f5f8fd] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-safe text-[#17243a]">
    <div className="mx-auto max-w-xl">
      <button onClick={onBack} className="mt-3 grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm" aria-label="Назад"><ArrowLeft size={19}/></button>
      <div className="mt-7"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white"><Navigation size={24}/></span><p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-blue-600">MARSHGO Navigation</p><h1 className="mt-1 text-2xl font-extrabold">Куди прямуєте?</h1><p className="mt-2 text-sm leading-5 text-slate-500">Побудуємо реальний автомобільний маршрут від вашої GPS-позиції. Геолокація передаватиметься лише під час відкритого екрана.</p></div>
      <div className="mt-6 rounded-[1.5rem] bg-white p-4 shadow-sm">
        <label className="block text-xs font-bold text-slate-500">Пункт призначення</label>
        <div className="mt-2 flex gap-2"><input value={destinationText} onChange={(event) => { setDestinationText(event.target.value); setDestination(null); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchDestination(); } }} placeholder="Наприклад, Львів" className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-3 text-sm outline-none"/><button type="button" onClick={() => void searchDestination()} disabled={busy || destinationText.trim().length < 3} className="rounded-xl bg-blue-50 px-3 text-xs font-bold text-blue-700 disabled:opacity-50">Знайти</button></div>
        {suggestions.length > 0 && <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">{suggestions.map((place) => <button key={place.providerId} type="button" onClick={() => { setDestination(place); setDestinationText(place.label); setSuggestions([]); setGpsMessage(''); }} className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm hover:bg-blue-50"><MapPin size={16} className="text-blue-600"/>{place.label}</button>)}</div>}
        {destination && <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-semibold text-emerald-800"><ShieldCheck size={16}/>Точку призначення підтверджено геокодером</div>}
      </div>
      <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-900"><b>Приватність і безпека.</b> GPS доступний тільки вам. Підбір пасажирів вимкнений, доки ви явно його не ввімкнете під час навігації. У фоні передавання координат припиняється; гарантована фонова навігація iOS потребує окремого нативного застосунку.</div>
      {gpsMessage && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{gpsMessage}</p>}
      <button onClick={() => void start()} disabled={busy || restoring || !destination} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"><LocateFixed size={18}/>{restoring ? 'Перевіряємо сесію…' : busy ? 'Готуємо маршрут…' : 'Почати навігацію'}</button>
    </div>
  </main>;

  const duration = `${Math.floor(session.route_duration_s / 3600)} год ${Math.round((session.route_duration_s % 3600) / 60)} хв`;
  const distance = `${(session.route_distance_m / 1000).toFixed(1).replace('.', ',')} км`;
  const fixAge = session.current_location_at ? Math.max(0, Math.floor((clock - new Date(session.current_location_at).getTime()) / 1000)) : null;
  return <main className="relative h-[100svh] overflow-hidden bg-[#dbeafe] text-[#17243a]">
    <div ref={mapElement} className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_40%_40%,#dceeff,#eff6ff_45%,#d6e5f3)]" aria-label="Карта фактичного автомобільного маршруту" />
    <div className="pointer-events-none absolute left-4 right-4 top-[max(.8rem,env(safe-area-inset-top))] z-[500] rounded-[1.3rem] bg-[#0b2345]/95 p-4 text-white shadow-xl backdrop-blur">
      <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10"><Navigation size={21}/></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold uppercase tracking-wide text-blue-200">До пункту призначення</p><h1 className="truncate text-lg font-extrabold">{session.destination_name}</h1><p className="mt-1 text-xs text-blue-100">{distance} · {duration} за дорожнім маршрутом на старті</p></div></div>
    </div>
    {mapTileHealth.status !== 'available' && <div role={mapTileHealth.status === 'failed' || mapTileHealth.status === 'degraded' ? 'alert' : 'status'} className="pointer-events-auto absolute left-4 right-4 top-[8.8rem] z-[500] rounded-xl bg-amber-50/95 px-3 py-2 text-[11px] font-semibold text-amber-900 shadow">
      {mapTileHealth.status === 'unconfigured' && 'Підкладка карти не налаштована. Показано справжню геометрію маршруту без вулиць.'}
      {mapTileHealth.status === 'loading' && 'Завантажуємо підкладку карти. Геометрія маршруту вже показана.'}
      {mapTileHealth.status === 'degraded' && 'Не всі фрагменти карти завантажилися. Перевірте з’єднання; геометрія маршруту залишається видимою.'}
      {mapTileHealth.status === 'failed' && 'Не вдалося завантажити підкладку карти. Перевірте з’єднання або постачальника карт; геометрія маршруту залишається видимою.'}
      {(mapTileHealth.status === 'degraded' || mapTileHealth.status === 'failed') && <button type="button" className="ml-2 underline" onClick={() => tileLayerRef.current?.redraw()}>Повторити завантаження карти</button>}
    </div>}
    <div className="absolute right-4 top-1/2 z-[500] -translate-y-1/2 space-y-2"><button aria-label="Звук" onClick={() => setGpsMessage('Голосові інструкції поки не підключені.')} className="grid h-12 w-12 place-items-center rounded-full bg-white text-slate-700 shadow-lg"><Volume2 size={20}/></button><button aria-label="Центрувати маршрут" onClick={() => { const point = session.current_location; if (point) mapRef.current?.panTo([point[1], point[0]], { animate: true }); }} className="grid h-12 w-12 place-items-center rounded-full bg-white text-blue-700 shadow-lg"><LocateFixed size={20}/></button></div>
    <section className="absolute inset-x-0 bottom-0 z-[500] rounded-t-[1.8rem] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_35px_rgba(14,37,70,.18)]">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200"/><div className="flex items-center justify-between"><div><p className="text-lg font-extrabold">{session.state === 'paused' ? 'Навігацію призупинено' : fixAge === null ? 'Очікуємо GPS' : fixAge > 30 || !visible ? 'GPS застарів' : 'Навігація активна'}</p><p className="mt-1 text-xs text-slate-500">{session.current_location_accuracy_m ? `Точність ±${Math.round(session.current_location_accuracy_m)} м` : 'Очікуємо першу GPS-точку'}{fixAge !== null ? ` · ${fixAge} с тому` : ''}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${session.state === 'paused' || !visible || fixAge !== null && fixAge > 30 ? 'bg-amber-100 text-amber-800' : onRoute === false ? 'bg-rose-100 text-rose-700' : onRoute === true ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{session.state === 'paused' ? 'Безпечно зупинено' : !visible || fixAge !== null && fixAge > 30 ? 'GPS пауза' : onRoute === false ? 'Поза маршрутом' : onRoute === true ? 'На маршруті' : 'Перевірка GPS'}</span></div>
      {gpsMessage && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{gpsMessage}</p>}
      {session.state === 'paused' && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">Навігацію призупинено. Перевірте, що автомобіль безпечно зупинений.</div>}
      {matchingPanel}
      {session.state === 'paused' && <button onClick={() => void resumeNavigation()} disabled={busy} className="mt-3 w-full rounded-2xl bg-blue-100 py-3 text-sm font-bold text-blue-800 disabled:opacity-50">{busy ? 'Відновлюємо…' : 'Відновити навігацію'}</button>}
      <button onClick={() => void end()} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3.5 font-bold text-white disabled:opacity-50"><Square size={16} fill="currentColor"/>{busy ? 'Завершуємо…' : 'Завершити навігацію'}</button>
    </section>
  </main>;
}
