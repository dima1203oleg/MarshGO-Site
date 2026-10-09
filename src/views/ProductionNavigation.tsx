import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowUp, CornerUpLeft, CornerUpRight, Flag, MapPin, Navigation, LocateFixed, RotateCcw, RefreshCw, Search, ShieldCheck, Square, Volume2, VolumeX, type LucideIcon } from 'lucide-react';
import { dueAnnouncement, formatGuidanceDistance, instructionText, nextGuidance, prepareGuidance, voiceLine } from '../navigation/guidance';
import type { Maneuver } from '../../shared/navigation/contracts';
import { ApiNavigationMatch, ApiNavigationSession, ApiPlace, productionApi } from '../services/productionApi';
import type { LocationFix } from '../../shared/navigation/contracts';
import { MarshGoMap } from '../map/MarshGoMap';
import { MapLayersControl } from '../components/MapLayersControl';
import type { MapAdapter, MapStatus } from '../map/MapAdapter';
import { WebGeolocationProvider, validateLocationFix } from '../platform/LocationProvider';
import { NavigationStore } from '../navigation/NavigationStore';
import { OfflineNavigationStore } from '../navigation/OfflineNavigationStore';
import { BasicRouteMapMatchingProvider } from '../navigation/BasicRouteMapMatchingProvider';
import { boundsOf, encodePolyline6 } from '../../shared/navigation/geometry';
import { routeResultSchema } from '../../shared/navigation/contracts';
import { navigationError } from '../../shared/navigation/errors';
import { OffRouteGuard } from '../navigation/OffRouteGuard';
import { getMapLayer, setMapLayer, type MapLayer } from '../map/mapMode';

function navigationErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (error.message === 'Required role is missing') return 'Щоб користуватися навігацією, активуйте роль водія у профілі.';
  const locationMessages: Record<string, string> = {
    GPS_PERMISSION_DENIED: 'Дозвольте MARSHGO доступ до геолокації в налаштуваннях браузера або пристрою, потім спробуйте ще раз.',
    GPS_UNAVAILABLE: 'Не вдалося отримати точне місце. Перевірте дозвіл і сигнал GPS, потім спробуйте ще раз.',
    GPS_INVALID_FIX: 'Пристрій надав некоректну GPS-точку. Перевірте точність геолокації та спробуйте ще раз.',
    GPS_LOW_ACCURACY: 'Поточне місце визначено неточно. Увімкніть точну геолокацію та спробуйте ще раз.',
    GPS_STALE: 'GPS-точка застаріла. Зачекайте на свіже місце розташування та повторіть спробу.',
  };
  const locationMessage = locationMessages[error.message];
  if (locationMessage) return locationMessage;
  if (/^[A-Z][A-Z0-9_]+$/.test(error.message)) return fallback;
  return error.message;
}

const hasRoute = (session: ApiNavigationSession) => (session.route?.length ?? 0) >= 2 && session.route_distance_m !== null && session.route_duration_s !== null;

function canonicalRoute(session: ApiNavigationSession) {
  const points = session.route ?? [];
  return routeResultSchema.parse({
    id: session.id, provider: 'marshgo-routing', geometry: { encoding: 'polyline6', value: encodePolyline6(points) },
    bounds: boundsOf(points), distanceMeters: session.route_distance_m ?? 0, durationSeconds: session.route_duration_s ?? 0,
    durationWithoutTrafficSeconds: session.route_duration_s ?? 0, trafficAware: false,
    legs: [{ distanceMeters: session.route_distance_m ?? 0, durationSeconds: session.route_duration_s ?? 0 }], maneuvers: [],
    confidence: 'BASELINE', calculatedAt: session.started_at, routeVersion: session.route_version,
  });
}

const VOICE_KEY = 'marshgo.navigation.voice';
const voicePreferred = () => { try { return localStorage.getItem(VOICE_KEY) !== 'off'; } catch { return true; } };
/** Speaks Ukrainian guidance with the device voice; silently does nothing where speech synthesis is unavailable. */
function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'uk-UA';
  const voice = synth.getVoices().find((item) => item.lang.toLowerCase().startsWith('uk'));
  if (voice) utterance.voice = voice;
  utterance.rate = 1.02;
  synth.speak(utterance);
}
function maneuverIcon(maneuver: Maneuver): LucideIcon {
  if (maneuver.type === 'ARRIVE') return Flag;
  if (maneuver.type === 'ROUNDABOUT') return RefreshCw;
  if (maneuver.type === 'UTURN' || maneuver.modifier === 'UTURN') return RotateCcw;
  if (maneuver.modifier?.includes('LEFT')) return CornerUpLeft;
  if (maneuver.modifier?.includes('RIGHT')) return CornerUpRight;
  return ArrowUp;
}

type Props = { onBack: () => void; onOpenDemand?: (demandId: string, candidateId: string) => void; autoStart?: boolean; onAddVehicle?: () => void };
const AUTO_MATCHING_KEY = 'marshgo.navigation.autoMatching';
const autoMatchingPreferred = () => { try { return localStorage.getItem(AUTO_MATCHING_KEY) !== 'off'; } catch { return true; } };
export function ProductionNavigation({ onBack, onOpenDemand, autoStart = false, onAddVehicle }: Props) {
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
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  // Raw GPS position: the marker for a session without a route ("just drive"), where there is no route to match it to.
  const [liveFix, setLiveFix] = useState<[number, number] | null>(null);
  const autoStartTried = useRef(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const dragStart = useRef<number | null>(null);
  const centeredOnce = useRef<string | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || typeof ResizeObserver === 'undefined') { setSheetHeight(0); return; }
    const observer = new ResizeObserver(() => setSheetHeight(sheet.getBoundingClientRect().height));
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [sheetOpen, Boolean(session)]);
  const [liveHeading, setLiveHeading] = useState<number | null>(null);
  const [liveSpeed, setLiveSpeed] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [voiceOn, setVoiceOn] = useState(voicePreferred);
  const spokenRef = useRef<Set<string>>(new Set());
  const [topQuery, setTopQuery] = useState('');
  const [topSuggestions, setTopSuggestions] = useState<ApiPlace[]>([]);
  const offlineStoreRef = useRef<OfflineNavigationStore | null>(null);
  if (!offlineStoreRef.current) offlineStoreRef.current = new OfflineNavigationStore();
  const [navigationStore] = useState(() => new NavigationStore((effect, state) => {
    if (effect.type === 'CLEAR_OFFLINE_STATE') offlineStoreRef.current?.clear(state.sessionId);
    if (effect.type === 'REQUEST_REROUTE' && state.sessionId) {
      navigationStore.dispatch({ type: 'REROUTE_STARTED' });
      void productionApi.rerouteNavigation(state.sessionId).then((updated) => {
        navigationStore.dispatch({ type: 'REROUTE_SUCCEEDED', route: canonicalRoute(updated) });
        setSession(updated);
        setMatchingEnabled(false); setMatches([]);
        setOnRoute(true);
        setGpsMessage('Маршрут оновлено від останньої підтвердженої GPS-позиції. Пошук попутників призупинено до повторної згоди.');
      }).catch((error: unknown) => {
        navigationStore.dispatch({ type: 'REROUTE_FAILED', error: navigationError('REROUTE_FAILED', 'osrm') });
        setGpsMessage(error instanceof Error ? error.message : 'Не вдалося оновити маршрут.');
      });
    }
    if (effect.type === 'EMIT_TELEMETRY') window.dispatchEvent(new CustomEvent('marshgo:telemetry', { detail: { name: effect.name, sessionId: state.sessionId } }));
  }));
  const navigationState = useSyncExternalStore(navigationStore.subscribe, navigationStore.getSnapshot, navigationStore.getSnapshot);
  const mapRef = useRef<MapAdapter | null>(null);
  const locationProvider = useRef(new WebGeolocationProvider());
  const mapMatchingProvider = useRef(new BasicRouteMapMatchingProvider());
  const lastSentRef = useRef<{ lat: number; lon: number; at: number } | null>(null);
  const lastValidatedFixRef = useRef<LocationFix | null>(null);
  const offRouteGuardRef = useRef(new OffRouteGuard());

  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const syncConnectivity = () => {
      if (!navigator.onLine) { navigationStore.dispatch({ type: 'CONNECTIVITY_LOST' }); return; }
      if (!session) { navigationStore.dispatch({ type: 'CONNECTIVITY_RESTORED' }); return; }
      void productionApi.activeNavigation().then((authoritative) => {
        if (!authoritative || authoritative.id !== session.id) {
          offlineStoreRef.current?.clear(session.id);
          navigationStore.dispatch({ type: 'NAVIGATION_ENDED' });
          setSession(null);
          return;
        }
        setSession(authoritative);
        navigationStore.dispatch({ type: 'CONNECTIVITY_RESTORED' });
      }).catch(() => navigationStore.dispatch({ type: 'CONNECTIVITY_LOST' }));
    };
    window.addEventListener('online', syncConnectivity);
    window.addEventListener('offline', syncConnectivity);
    syncConnectivity();
    return () => { window.removeEventListener('online', syncConnectivity); window.removeEventListener('offline', syncConnectivity); };
  }, [navigationStore, session?.id]);

  useEffect(() => {
    if (!session || !hasRoute(session)) return;
    try { navigationStore.dispatch({ type: 'NAVIGATION_SESSION_RECONCILED', sessionId: session.id, route: canonicalRoute(session), paused: session.state === 'paused' }); }
    catch { setGpsMessage('Сервер повернув маршрут у несумісному форматі. Поточний маршрут не змінено.'); }
  }, [navigationStore, session?.id, session?.route_version, session?.state, session?.route]);

  // The map would otherwise open zoomed out; centre on the driver once, after that the "my location" button brings the follow camera back.
  useEffect(() => {
    if (!session || !liveFix || centeredOnce.current === session.id) return;
    // Like Apple Maps: navigation opens on the driver, close and tilted, following the direction of travel.
    if (mapRef.current) { mapRef.current.recenter(liveFix); centeredOnce.current = session.id; }
  }, [session?.id, liveFix?.[0], liveFix?.[1], mapStatus]);

  // Active navigation is always the clean 3D map; the user's previous map mode comes back afterwards.
  const hasSession = Boolean(session);
  useEffect(() => {
    if (!hasSession) return;
    const previous: MapLayer = getMapLayer();
    if (previous !== 'navigation') setMapLayer('navigation');
    return () => { if (previous !== 'navigation') setMapLayer(previous); };
  }, [hasSession]);

  useEffect(() => {
    lastValidatedFixRef.current = null;
    offRouteGuardRef.current.reset();
  }, [session?.id]);

  useEffect(() => {
    if (navigationState.connectivity === 'OFFLINE' && session) if (hasRoute(session)) offlineStoreRef.current?.save(navigationState, { ...session, destination_name: session.destination_name ?? '', route: session.route ?? [], route_distance_m: session.route_distance_m ?? 0, route_duration_s: session.route_duration_s ?? 0 });
  }, [navigationState.connectivity, navigationState.routeVersion, navigationState.sessionId, session?.id, session?.route_version, session?.state]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    productionApi.activeNavigation().then((active) => {
      if (active) {
        setSession(active); setMatchingEnabled(active.opt_in); setOnRoute(null);
        if (active.opt_in) void productionApi.navigationMatches(active.id).then(setMatches).catch(() => undefined);
      } else offlineStoreRef.current?.clear();
    }).catch((error: unknown) => {
      const cached = offlineStoreRef.current?.readLatest();
      if (cached) {
        setSession({ ...cached.session, current_location: null, current_location_accuracy_m: null, current_location_at: null });
        setMatchingEnabled(false);
        navigationStore.dispatch({ type: 'NAVIGATION_SESSION_RECONCILED', sessionId: cached.sessionId, route: cached.route, paused: cached.session.state === 'paused' });
        navigationStore.dispatch({ type: 'CONNECTIVITY_LOST' });
        setGpsMessage('Офлайн-режим: показуємо кешований маршрут. Підбір попутників, оновлення маршруту й актуальна ETA недоступні.');
      } else setGpsMessage(navigationErrorMessage(error, 'Не вдалося відновити навігаційну сесію.'));
    }).finally(() => setRestoring(false));
  }, [navigationStore]);

  useEffect(() => {
    if (!session || !visible) return;
    return productionApi.subscribeRealtime((event) => {
      if (event.type === 'navigation.route-updated' && event.data.navigation_session_id === session.id) {
        void productionApi.activeNavigation().then((active) => {
          if (!active || active.id !== session.id) return;
          setSession(active); setMatchingEnabled(false); setMatches([]);
          setGpsMessage('Пасажира підтверджено. Дорожній маршрут оновлено через точки посадки й висадки.');
        }).catch((error: unknown) => setGpsMessage(error instanceof Error ? error.message : 'Не вдалося оновити дорожній маршрут.'));
        return;
      }
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
    if (!session || session.state !== 'active' || !matchingEnabled || !hasRoute(session) || navigationState.connectivity === 'OFFLINE' || !session.current_location_at || !visible) return;
    let current = true;
    const refresh = () => productionApi.refreshNavigationMatches(session.id)
      .then((next) => { if (current) setMatches(next); })
      .catch((error: unknown) => { if (current) setGpsMessage(error instanceof Error ? error.message : 'Підбір попутників недоступний.'); });
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => { current = false; window.clearInterval(timer); };
  }, [session?.id, session?.state, matchingEnabled, Boolean(session && hasRoute(session)), Boolean(session?.current_location_at), visible, navigationState.connectivity]);

  useEffect(() => {
    if (!session || session.state !== 'active' || !('geolocation' in navigator)) return;
    let busySending = false;
    const unsubscribe = locationProvider.current.subscribe((fix) => {
      if (document.visibilityState !== 'visible' || busySending) return;
      const checked = validateLocationFix(fix, Date.now(), lastValidatedFixRef.current ?? undefined);
      if (!checked.accepted) {
        setGpsMessage(checked.code === 'GPS_TELEPORT_DETECTED'
          ? 'GPS подав неможливий стрибок позиції. Чекаємо наступну узгоджену точку.'
          : checked.code === 'GPS_STALE'
            ? 'Отримана GPS-точка застаріла або прийшла не в порядку. Чекаємо свіжі дані.'
            : 'Точність GPS недостатня. Перевірте дозвіл на геолокацію та відкрийте екран надворі.');
        return;
      }
      lastValidatedFixRef.current = checked.fix;
      const { latitude, longitude, accuracyMeters: accuracy } = checked.fix;
      setLiveFix([longitude, latitude]);
      const speed = checked.fix.speedMps;
      setLiveSpeed(typeof speed === 'number' && Number.isFinite(speed) ? speed : null);
      // A compass heading is only meaningful while moving; standing still keeps the last direction.
      if (typeof checked.fix.headingDegrees === 'number' && (speed ?? 0) > 1) setLiveHeading(checked.fix.headingDegrees);
      if (hasRoute(session)) {
        navigationStore.dispatch({ type: 'GPS_FIX_RECEIVED', fix: checked.fix });
        void mapMatchingProvider.current.match([checked.fix], { route: canonicalRoute(session) }).then((matched) => {
          navigationStore.dispatch({ type: 'LOCATION_MATCHED', location: matched.location });
        }).catch(() => setGpsMessage('Не вдалося прив’язати GPS до дорожнього маршруту.'));
      }
      const now = Date.now();
      const last = lastSentRef.current;
      const displacement = last ? (() => {
        const radians = Math.PI / 180; const dLat = (latitude - last.lat) * radians; const dLon = (longitude - last.lon) * radians;
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(last.lat * radians) * Math.cos(latitude * radians) * Math.sin(dLon / 2) ** 2;
        return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
      })() : Infinity;
      // A heartbeat at least every 15 s even when standing still, so a parked driver is not shown as "GPS stale".
      if (last && now - last.at < 15_000 && displacement < 25) return;
      lastSentRef.current = { lat: latitude, lon: longitude, at: now };
      busySending = true;
      productionApi.sendNavigationLocation(session.id, {
        coordinates: [longitude, latitude], accuracyMeters: accuracy, capturedAt: fix.capturedAtClient,
      }).then((result) => {
        lastSentRef.current = { lat: latitude, lon: longitude, at: now };
        const deviation = offRouteGuardRef.current.observe(result.onRoute, now);
        setOnRoute(deviation.confirmedOffRoute ? false : result.onRoute ? true : null);
        if (deviation.requestReroute) navigationStore.dispatch({ type: 'ROUTE_DEVIATION_DETECTED' });
        setGpsMessage(result.onRoute ? '' : deviation.confirmedOffRoute
          ? 'Кілька GPS-точок підтвердили відхилення від маршруту. Перераховуємо безпечний шлях.'
          : 'Перевіряємо відхилення GPS, щоб не перебудовувати маршрут через одиничний неточний сигнал.');
        void productionApi.activeNavigation().then((authoritative) => {
          if (authoritative?.id === session.id) setSession(authoritative);
        }).catch(() => undefined);
      }).catch((error: unknown) => {
        if (!navigator.onLine) navigationStore.dispatch({ type: 'CONNECTIVITY_LOST' });
        setGpsMessage(error instanceof Error ? error.message : 'Не вдалося синхронізувати GPS.');
      }).finally(() => { busySending = false; });
    });
    void locationProvider.current.start({ enableHighAccuracy: true, maximumAgeMs: 5_000, timeoutMs: 20_000 }).catch((error: unknown) => {
      setGpsMessage(error instanceof Error && error.message === 'GPS_PERMISSION_DENIED' ? 'Дозвіл на геолокацію вимкнений.' : 'GPS тимчасово недоступний. Навігація не рухатиме маркер без свіжого сигналу.');
    });
    return () => { unsubscribe(); void locationProvider.current.stop(); };
  }, [navigationStore, session?.id, session?.state, Boolean(session && hasRoute(session))]);

  const searchDestination = async () => {
    setBusy(true); setSuggestions([]); setDestination(null);
    try {
      const found = await productionApi.suggestPlaces(destinationText.trim());
      setSuggestions(found);
      if (!found.length) setGpsMessage('Місце не знайдено. Уточніть назву й оберіть результат геокодера.');
    } catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Пошук місця недоступний.'); }
    finally { setBusy(false); }
  };

  // ---- Turn-by-turn guidance and voice ----
  const guidancePrepared = useMemo(() => session && hasRoute(session) && session.maneuvers?.length ? prepareGuidance(session.route!, session.maneuvers) : null,
    [session?.id, session?.route_version, session?.maneuvers?.length, session?.route?.length]);
  const guidancePosition: [number, number] | null = navigationState.currentLocation ? [navigationState.currentLocation.longitude, navigationState.currentLocation.latitude] : liveFix;
  const guidance = useMemo(() => guidancePrepared && guidancePosition ? nextGuidance(guidancePrepared, guidancePosition) : null,
    [guidancePrepared, guidancePosition?.[0], guidancePosition?.[1]]);
  const lastRouteVersion = useRef<number | null>(null);
  useEffect(() => {
    if (!session) return;
    const previous = lastRouteVersion.current;
    lastRouteVersion.current = session.route_version;
    if (previous !== null && previous !== session.route_version) {
      spokenRef.current = new Set();
      if (voiceOn) speak('Маршрут перебудовано');
    }
  }, [session?.id, session?.route_version]);
  useEffect(() => {
    if (!voiceOn || !guidance?.next || session?.state !== 'active') return;
    const ids = dueAnnouncement(guidance.distanceMeters, spokenRef.current, `${session.route_version}:${guidance.next.id}`);
    if (!ids) return;
    ids.forEach((id) => spokenRef.current.add(id));
    speak(voiceLine(guidance.next, guidance.distanceMeters));
  }, [voiceOn, guidance?.next?.id, Math.round((guidance?.distanceMeters ?? 0) / 10), session?.state]);
  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    try { localStorage.setItem(VOICE_KEY, next ? 'on' : 'off'); } catch { /* preference is optional */ }
    if (next) speak(guidance?.next ? voiceLine(guidance.next, guidance.distanceMeters) : 'Голосові підказки увімкнено');
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const start = async (withDestination: ApiPlace | null = destination) => {
    if (!('geolocation' in navigator)) { setGpsMessage('Цей пристрій не надає доступ до GPS.'); return; }
    setBusy(true); setGpsMessage('Очікуємо точне місце розташування…');
    try {
      const fix = await locationProvider.current.getCurrentFix({ enableHighAccuracy: true, maximumAgeMs: 0, timeoutMs: 25_000 });
      const checked = validateLocationFix(fix, Date.now());
      if (!checked.accepted) throw new Error(checked.code);
      const created = await productionApi.startNavigation({
        origin: [fix.longitude, fix.latitude],
        ...(withDestination ? { destination: [withDestination.longitude, withDestination.latitude] as [number, number], destinationName: withDestination.label } : {}),
      });
      if (hasRoute(created)) navigationStore.dispatch({ type: 'NAVIGATION_SESSION_RECONCILED', sessionId: created.id, route: canonicalRoute(created), paused: false });
      setSession(created); setMatchingEnabled(false); setMatches([]); setOnRoute(null); lastSentRef.current = null; setGpsMessage('');
      setLiveFix([fix.longitude, fix.latitude]);
      // Passenger search along the route is on by default for drivers with a verified vehicle (one switch in the panel turns it off for good).
      if (created.matching_vehicle_available && autoMatchingPreferred()) {
        void productionApi.setNavigationMatching(created.id, true).then(() => { setMatchingEnabled(true); setSession((current) => current ? { ...current, opt_in: true } : current); }).catch(() => undefined);
      }
    } catch (error) { setGpsMessage(navigationErrorMessage(error, 'Не вдалося розпочати навігацію. Перевірте геолокацію та спробуйте ще раз.')); }
    finally { setBusy(false); }
  };

  // Pressing "Почати навігацію" on the home screen goes straight to the map: GPS starts now, the destination can be chosen on top at any time.
  useEffect(() => {
    if (!autoStart || restoring || session || autoStartTried.current) return;
    autoStartTried.current = true;
    void start(null);
  }, [autoStart, restoring, session]);

  const searchTopDestination = async () => {
    setBusy(true); setTopSuggestions([]);
    try {
      const found = await productionApi.suggestPlaces(topQuery.trim());
      setTopSuggestions(found);
      if (!found.length) setGpsMessage('Місце не знайдено. Уточніть назву й оберіть результат геокодера.');
    } catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Пошук місця недоступний.'); }
    finally { setBusy(false); }
  };

  const chooseTopDestination = async (place: ApiPlace) => {
    if (!session) return;
    setBusy(true); setTopSuggestions([]); setGpsMessage('Будуємо маршрут…');
    try {
      const updated = await productionApi.setNavigationDestination(session.id, { destination: [place.longitude, place.latitude], destinationName: place.label });
      navigationStore.dispatch({ type: 'NAVIGATION_SESSION_RECONCILED', sessionId: updated.id, route: canonicalRoute(updated), paused: updated.state === 'paused' });
      setSession(updated); setMatches([]); setTopQuery(''); setGpsMessage('');
    } catch (error) { setGpsMessage(navigationErrorMessage(error, 'Не вдалося побудувати маршрут. Дочекайтеся GPS і спробуйте ще раз.')); }
    finally { setBusy(false); }
  };

  const end = async () => {
    if (!session) return;
    setBusy(true);
    try { await productionApi.endNavigation(session.id); navigationStore.dispatch({ type: 'NAVIGATION_ENDED' }); setSession(null); setMatchingEnabled(false); setMatches([]); setOnRoute(null); lastSentRef.current = null; setGpsMessage('Навігацію завершено. Точну геолокацію видалено із сервера.'); }
    catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Не вдалося завершити навігацію.'); }
    finally { setBusy(false); }
  };

  const toggleMatching = async () => {
    if (!session) return;
    const next = !matchingEnabled;
    setMatchingBusy(true);
    try {
      await productionApi.setNavigationMatching(session.id, next);
      try { localStorage.setItem(AUTO_MATCHING_KEY, next ? 'on' : 'off'); } catch { /* preference is optional */ }
      setMatchingEnabled(next); setSession({ ...session, opt_in: next });
      if (!next) setMatches([]);
      setGpsMessage(next ? 'Пошук уздовж маршруту увімкнено за вашою згодою.' : 'Автоматичний пошук вимкнено.');
    } catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Не вдалося змінити налаштування підбору.'); }
    finally { setMatchingBusy(false); }
  };

  const pauseForResponse = async () => {
    if (!session) return;
    setBusy(true);
    try { await productionApi.pauseNavigation(session.id); navigationStore.dispatch({ type: 'NAVIGATION_PAUSED' }); setSession({ ...session, state: 'paused' }); setGpsMessage('Навігацію призупинено. Підтверджуйте інтерес лише коли авто безпечно зупинене.'); }
    catch (error) { setGpsMessage(error instanceof Error ? error.message : 'Не вдалося призупинити навігацію.'); }
    finally { setBusy(false); }
  };

  const resumeNavigation = async () => {
    if (!session) return;
    setBusy(true);
    try { await productionApi.resumeNavigation(session.id); navigationStore.dispatch({ type: 'NAVIGATION_RESUMED' }); setSession({ ...session, state: 'active' }); setGpsMessage('Навігацію відновлено. Чекаємо свіжу GPS-точку.'); }
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

  const matchingPanel = session ? <section className="mt-3 rounded-2xl bg-blue-50 px-3 py-2.5">
    <div className="flex items-center justify-between gap-3"><p className="min-w-0 text-sm font-bold">Підбирати пасажирів</p><button type="button" role="switch" aria-checked={matchingEnabled} aria-label="Пошук попутників уздовж маршруту" disabled={matchingBusy || !session.matching_vehicle_available} onClick={() => void toggleMatching()} className={`relative h-7 w-12 shrink-0 rounded-full transition ${matchingEnabled ? 'bg-emerald-500' : 'bg-slate-300'} disabled:opacity-45`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${matchingEnabled ? 'left-6' : 'left-1'}`}/></button></div>
    {!session.matching_vehicle_available && <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] leading-4 text-amber-900"><span>Щоб шукати пасажирів під час руху, додайте авто.</span>{onAddVehicle && <button type="button" onClick={onAddVehicle} className="shrink-0 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-bold">Додати авто</button>}</div>}
    {session.matching_vehicle_available && matchingEnabled && !hasRoute(session) && <p className="mt-2 rounded-xl bg-white p-2.5 text-[11px] leading-4 text-slate-600">Оберіть, куди їдете, — і ми почнемо шукати попутників уздовж маршруту.</p>}
    {matchingEnabled && <div className="mt-2 max-h-[20svh] space-y-2 overflow-y-auto pr-1">
      <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-blue-800">{matches.length ? `Сумісні заявки · ${matches.length}` : 'Шукаємо вздовж дороги'}</p>{session.state === 'active' && <span className="text-[10px] text-slate-500">оновлення щохвилини</span>}</div>
      {matches.map((match) => <article key={match.id} className="rounded-xl bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-xs">{match.origin_name.split(',')[0]} → {match.destination_name.split(',')[0]}</b><p className="mt-1 text-[10px] text-slate-500">{match.passenger_count} пас. · забрати орієнтовно {new Intl.DateTimeFormat('uk-UA',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Kyiv'}).format(new Date(match.pickup_eta))}</p></div><span className="shrink-0 text-right text-[10px] font-bold text-blue-700">+{(match.detour_distance_m/1000).toFixed(1)} км<br/>+{Math.round(match.detour_duration_s/60)} хв</span></div>
        <p className="mt-1 text-[10px] text-slate-500">{match.budget_minor === null ? 'Бюджет не вказаний' : `${new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:0}).format(match.budget_minor/100)} ${match.budget_type === 'per_seat' ? 'за місце' : 'за всіх'}`}{match.vehicle_make ? ` · ${match.vehicle_make} ${match.vehicle_model ?? ''}` : ''}</p>
        {match.status === 'suggested' && session.state === 'active' && <button disabled={busy} onClick={() => void pauseForResponse()} className="mt-2 w-full rounded-lg bg-amber-100 py-2 text-[10px] font-bold text-amber-900">Зупиніться та призупиніть навігацію, щоб відповісти</button>}
        {match.status === 'suggested' && session.state === 'paused' && <button disabled={matchingBusy} onClick={() => void expressInterest(match.id)} className="mt-2 w-full rounded-lg bg-emerald-600 py-2 text-[10px] font-bold text-white">Підтвердити інтерес водія</button>}
        {match.status === 'driver_interested' && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] font-semibold text-amber-900">Ваш інтерес надіслано. Чекаємо підтвердження пасажира; бронювання ще немає.</p>}
        {match.status === 'passenger_confirmed' && <><p className="mt-2 rounded-lg bg-emerald-50 p-2 text-[10px] font-semibold text-emerald-800">Пасажир підтвердив взаємний інтерес. Бронювання ще немає.</p>{session.state === 'paused' && <button disabled={!onOpenDemand} onClick={() => onOpenDemand?.(match.demand_id, match.id)} className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-[10px] font-bold text-white disabled:opacity-50">Відкрити заявку та запропонувати ціну</button>}</>}
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
      <button onClick={() => void start(null)} disabled={busy || restoring} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white py-3.5 text-sm font-bold text-blue-700 disabled:opacity-50">Почати без пункту призначення</button>
      <button onClick={() => void start()} disabled={busy || restoring || !destination} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"><LocateFixed size={18}/>{restoring ? 'Перевіряємо сесію…' : busy ? 'Готуємо маршрут…' : 'Почати навігацію'}</button>
    </div>
  </main>;

  const liveDistance = navigationState.remainingDistanceMeters;
  const liveDuration = navigationState.remainingDurationSeconds;
  const routed = hasRoute(session);
  const durationSeconds = liveDuration ?? session.route_duration_s ?? 0;
  const duration = `${Math.floor(durationSeconds / 3600)} год ${Math.round((durationSeconds % 3600) / 60)} хв`;
  const distanceMeters = liveDistance ?? session.route_distance_m ?? 0;
  const distance = `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} км`;
  const eta = navigationState.eta?.arrivalAt
    ? new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date(navigationState.eta.arrivalAt))
    : null;
  const fixAge = session.current_location_at ? Math.max(0, Math.floor((clock - new Date(session.current_location_at).getTime()) / 1000)) : null;
  return <main className="fixed inset-0 overflow-hidden bg-[#dbeafe] text-[#17243a]">
    <MarshGoMap route={session.route ?? []} vehicle={navigationState.currentLocation ? [navigationState.currentLocation.longitude, navigationState.currentLocation.latitude] : liveFix ?? session.current_location} heading={liveHeading} onStatus={setMapStatus} onAdapter={(adapter) => { mapRef.current = adapter; if (adapter) adapter.onCameraModeChange = (mode) => setFollowing(mode === 'FOLLOW' || mode === 'FOLLOW_HEADING'); }} />
    {!routed && <>
    <div className="absolute left-4 right-4 top-[max(.8rem,env(safe-area-inset-top))] z-[500] rounded-[1.3rem] bg-white p-3 shadow-xl">
      <form onSubmit={(event) => { event.preventDefault(); if (topQuery.trim().length >= 3) void searchTopDestination(); }} className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Назад" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700"><ArrowLeft size={18}/></button>
        <input value={topQuery} onChange={(event) => setTopQuery(event.target.value)} placeholder="Куди їдемо?" aria-label="Куди їдемо?" className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-sm outline-none"/>
        <button type="submit" disabled={busy || topQuery.trim().length < 3} aria-label="Знайти місце" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 text-white disabled:opacity-50"><Search size={17}/></button>
      </form>
      {topSuggestions.length > 0 && <div className="mt-2 max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">{topSuggestions.map((place) => <button key={place.providerId} type="button" onClick={() => void chooseTopDestination(place)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-blue-50"><MapPin size={15} className="shrink-0 text-blue-600"/>{place.label}</button>)}</div>}
      {!topSuggestions.length && <p className="mt-2 px-1 text-[11px] text-slate-500">Навігація працює. Оберіть пункт призначення, щоб побудувати маршрут і шукати попутників.</p>}
    </div>
    </>}
    {routed && <>
    {guidance?.next && navigationState.lifecycle !== 'ARRIVED' ? (() => { const Icon = maneuverIcon(guidance.next); return <div data-testid="navigation-guidance" className="pointer-events-none absolute left-4 right-4 top-[max(.8rem,env(safe-area-inset-top))] z-[500] overflow-hidden rounded-[1.4rem] bg-[#0b2345]/95 text-white shadow-xl backdrop-blur">
      <div className="flex items-center gap-3 p-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#1789F4]"><Icon size={32} strokeWidth={2.6}/></span>
        <div className="min-w-0 flex-1"><p className="text-[1.9rem] font-extrabold leading-none tracking-tight">{formatGuidanceDistance(guidance.distanceMeters)}</p><p className="mt-1 line-clamp-2 text-[15px] font-bold leading-snug">{instructionText(guidance.next)}</p></div></div>
      <p data-testid="navigation-live-progress" className="border-t border-white/10 bg-white/5 px-4 py-2 text-xs text-blue-100">{guidance.currentStreet ? `${guidance.currentStreet} · ` : ''}{session.destination_name}: {distance} · {duration}{eta ? ` · прибуття ${eta}` : ''}</p>
    </div>; })() : <>
      <div className="pointer-events-none absolute left-4 right-4 top-[max(.8rem,env(safe-area-inset-top))] z-[500] rounded-[1.3rem] bg-[#0b2345]/95 p-4 text-white shadow-xl backdrop-blur">
      <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10"><Navigation size={21}/></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold uppercase tracking-wide text-blue-200">{navigationState.lifecycle === 'ARRIVED' ? 'Ви досягли пункту призначення' : 'До пункту призначення'}</p><h1 className="truncate text-lg font-extrabold">{session.destination_name}</h1><p data-testid="navigation-live-progress" className="mt-1 text-xs text-blue-100">{distance} · {duration}{eta ? ` · прибуття ${eta}` : navigationState.connectivity === 'OFFLINE' ? ' · офлайн ETA' : ''}</p></div></div>
    </div>
    </>}
    </>}
    {mapStatus !== 'available' && <div role={mapStatus === 'failed' || mapStatus === 'degraded' ? 'alert' : 'status'} className="pointer-events-none absolute left-4 right-4 top-[8.8rem] z-[500] flex items-start gap-2 rounded-xl bg-amber-50/95 px-3 py-2 text-[11px] font-semibold text-amber-900 shadow">
      <span className="min-w-0 flex-1">
        {mapStatus === 'unconfigured' && 'Стиль і підкладка MARSHGO не налаштовані. Геометрія реального маршруту залишається доступною.'}
        {mapStatus === 'loading' && 'Завантажуємо карту MARSHGO. Геометрія маршруту вже показана.'}
        {mapStatus === 'degraded' && 'Карта завантажилася частково. Геометрія маршруту залишається видимою.'}
        {mapStatus === 'failed' && 'Не вдалося завантажити стиль карти. Перевірте мережу або manifest провайдера.'}
      </span>
      {(mapStatus === 'degraded' || mapStatus === 'failed') && <button type="button" className="pointer-events-auto shrink-0 rounded-lg px-1 py-0.5 underline underline-offset-2" onClick={() => mapRef.current?.retry()}>Повторити завантаження карти</button>}
    </div>}
    <div className="absolute right-4 top-1/2 z-[500] -translate-y-1/2 space-y-2"><MapLayersControl/><button aria-label={voiceOn ? 'Вимкнути голос' : 'Увімкнути голос'} aria-pressed={voiceOn} onClick={toggleVoice} className={`grid h-12 w-12 place-items-center rounded-full shadow-lg ${voiceOn ? 'bg-white text-[#1789F4]' : 'bg-white text-slate-400'}`}>{voiceOn ? <Volume2 size={20}/> : <VolumeX size={20}/>}</button>{!sheetOpen && <button aria-label="Завершити навігацію" onClick={() => void end()} disabled={busy} className="grid h-12 w-12 place-items-center rounded-full bg-rose-600 text-white shadow-lg disabled:opacity-50"><Square size={16} fill="currentColor"/></button>}<button aria-label="Показати моє місце" aria-pressed={following} onClick={() => { const point = navigationState.currentLocation ? [navigationState.currentLocation.longitude, navigationState.currentLocation.latitude] as [number, number] : liveFix ?? session.current_location ?? undefined; mapRef.current?.recenter(point ?? undefined); }} className={`grid h-12 w-12 place-items-center rounded-full shadow-lg ${following ? 'bg-[#1789F4] text-white' : 'bg-white text-[#1789F4]'}`}><Navigation size={20} fill={following ? 'currentColor' : 'none'}/></button></div>
    <div aria-label="Швидкість" style={sheetOpen && sheetHeight ? { bottom: sheetHeight + 14 } : undefined} className={`absolute left-4 z-[500] grid h-[4.4rem] w-[4.4rem] place-items-center rounded-full border-4 border-white bg-white/95 text-center shadow-lg transition-[bottom] duration-300 ${sheetOpen ? (sheetHeight ? '' : 'bottom-[16rem]') : 'bottom-[max(2.2rem,calc(env(safe-area-inset-bottom)+1.6rem))]'}`}>
      <span><b data-testid="navigation-speed" className="block text-2xl font-extrabold leading-none text-[#0E1F35]">{liveSpeed === null ? '—' : Math.round(liveSpeed * 3.6)}</b><small className="text-[10px] font-bold text-slate-500">км/год</small></span>
    </div>
    {!sheetOpen && <>
      {gpsMessage && <p role="status" className="absolute inset-x-4 bottom-[max(3.2rem,calc(env(safe-area-inset-bottom)+2.6rem))] z-[500] ml-24 rounded-xl bg-amber-50/95 p-2.5 text-xs leading-5 text-amber-900 shadow">{gpsMessage}</p>}
      <button type="button" aria-label="Розгорнути панель" aria-expanded={false} onClick={() => setSheetOpen(true)}
        onPointerDown={(event) => { dragStart.current = event.clientY; }}
        onPointerUp={(event) => { const start = dragStart.current; dragStart.current = null; if (start !== null && event.clientY - start < -16) setSheetOpen(true); }}
        className="absolute bottom-[max(.35rem,env(safe-area-inset-bottom))] left-1/2 z-[500] flex h-8 w-28 -translate-x-1/2 touch-none items-center justify-center"><span className="h-1.5 w-12 rounded-full bg-[#0E1F35]/45 shadow-[0_0_0_2px_rgba(255,255,255,.7)]"/></button>
    </>}
    {sheetOpen && <section ref={sheetRef} aria-label="Панель навігації" className="absolute inset-x-0 bottom-0 z-[500] rounded-t-[1.8rem] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_35px_rgba(14,37,70,.18)] transition-[padding] duration-200">
      <button type="button" aria-label={sheetOpen ? 'Згорнути панель' : 'Розгорнути панель'} aria-expanded={sheetOpen} onClick={() => setSheetOpen((open) => !open)}
        onPointerDown={(event) => { dragStart.current = event.clientY; }}
        onPointerUp={(event) => { const start = dragStart.current; dragStart.current = null; if (start === null) return; const delta = event.clientY - start; if (delta > 24) { setSheetOpen(false); event.preventDefault(); } else if (delta < -24) { setSheetOpen(true); event.preventDefault(); } }}
        className="mx-auto mb-1 flex h-7 w-24 touch-none items-center justify-center"><span className="h-1.5 w-11 rounded-full bg-slate-300"/></button>{sheetOpen && <div className="flex items-center justify-between"><div><p className="text-lg font-extrabold">{session.state === 'paused' ? 'Навігацію призупинено' : fixAge === null ? 'Очікуємо GPS' : fixAge > 45 || !visible ? 'GPS застарів' : 'Навігація активна'}</p><p className="mt-1 text-xs text-slate-500">{session.current_location_accuracy_m ? `Точність ±${Math.round(session.current_location_accuracy_m)} м` : 'Очікуємо першу GPS-точку'}{fixAge !== null ? ` · ${fixAge} с тому` : ''}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${session.state === 'paused' || !visible || fixAge !== null && fixAge > 45 ? 'bg-amber-100 text-amber-800' : onRoute === false ? 'bg-rose-100 text-rose-700' : routed && onRoute === true ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{session.state === 'paused' ? 'Безпечно зупинено' : !visible || fixAge !== null && fixAge > 45 ? 'GPS пауза' : onRoute === false ? 'Поза маршрутом' : !routed && fixAge !== null ? 'Без маршруту' : onRoute === true ? 'На маршруті' : 'Перевірка GPS'}</span></div>}
      {gpsMessage && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{gpsMessage}</p>}
      {sheetOpen && session.state === 'paused' && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">Навігацію призупинено. Перевірте, що автомобіль безпечно зупинений.</div>}
      {sheetOpen && matchingPanel}
      {session.state === 'paused' && <button onClick={() => void resumeNavigation()} disabled={busy} className="mt-3 w-full rounded-2xl bg-blue-100 py-3 text-sm font-bold text-blue-800 disabled:opacity-50">{busy ? 'Відновлюємо…' : 'Відновити навігацію'}</button>}
      {sheetOpen && <button onClick={() => void end()} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3 font-bold text-white disabled:opacity-50"><Square size={16} fill="currentColor"/>{busy ? 'Завершуємо…' : 'Завершити навігацію'}</button>}
    </section>}
  </main>;
}
