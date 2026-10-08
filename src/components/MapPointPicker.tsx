import { useEffect, useRef, useState } from 'react';
import { Check, LocateFixed, X } from 'lucide-react';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { resolveMapAssets } from '../map/mapConfig';
import { productionApi, type ApiPlace } from '../services/productionApi';

type Props = { title: string; initial: { latitude: number; longitude: number } | null; onConfirm: (place: ApiPlace) => void; onClose: () => void };
const UKRAINE_CENTER: [number, number] = [31.1656, 48.3794];

/** Full-screen map: the user moves the map under a fixed pin, the address is resolved by the server geocoder. */
export function MapPointPicker({ title, initial, onConfirm, onClose }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const [place, setPlace] = useState<ApiPlace | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'resolving' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const lookup = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleResolve = (latitude: number, longitude: number) => {
    lookup.current += 1; setPlace(null); setState('resolving'); setMessage('');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void resolve(latitude, longitude), 450);
  };

  const resolve = async (latitude: number, longitude: number) => {
    const ticket = ++lookup.current;
    setState('resolving'); setMessage('');
    try {
      const found = await productionApi.reverseGeocode(latitude, longitude);
      if (ticket !== lookup.current) return;
      setPlace({ ...found, latitude, longitude });
      setState('ready');
    } catch (error) {
      if (ticket !== lookup.current) return;
      setPlace(null); setState('error');
      setMessage(error instanceof Error ? error.message : 'Не вдалося визначити адресу. Посуньте мапу ще раз.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    let map: import('maplibre-gl').Map | null = null;
    void Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css'), resolveMapAssets('MARSHGO_NAVIGATION_LIGHT')]).then(([maplibre, , assets]) => {
      if (cancelled || !container.current) return;
      const center: [number, number] = initial ? [initial.longitude, initial.latitude] : UKRAINE_CENTER;
      maplibre.setWorkerUrl(mapLibreWorkerUrl);
      map = new maplibre.Map({ container: container.current, style: assets.style, center, zoom: initial ? 14 : 5.5, attributionControl: { compact: true } });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
      map.on('moveend', () => { const c = map!.getCenter(); scheduleResolve(c.lat, c.lng); });
      map.once('load', () => { const c = map!.getCenter(); if (initial) void resolve(c.lat, c.lng); else setState('ready'); });
    }).catch(() => { setState('error'); setMessage('Не вдалося завантажити мапу.'); });
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); map?.remove(); mapRef.current = null; };
  }, []);

  const locate = () => {
    if (!navigator.geolocation) { setMessage('Геолокація недоступна в цьому браузері.'); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => mapRef.current?.easeTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 16, duration: 600 }),
      () => setMessage('Немає доступу до геолокації. Дозвольте його в налаштуваннях браузера.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[80] flex flex-col bg-white">
    <div ref={container} className="relative min-h-0 flex-1" data-testid="point-picker-map">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full"><svg width="38" height="48" viewBox="0 0 38 48"><path d="M19 0C8.5 0 0 8.3 0 18.6 0 32 19 48 19 48s19-16 19-29.4C38 8.3 29.5 0 19 0z" fill="#1789F4" stroke="#fff" strokeWidth="2.5"/><circle cx="19" cy="18" r="6.5" fill="#fff"/></svg></div>
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[9] h-2 w-5 -translate-x-1/2 rounded-full bg-black/20 blur-[2px]"/>
      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 bg-gradient-to-b from-white/95 to-white/0 px-4 pb-6 pt-[max(.8rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Закрити мапу" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-md"><X size={18}/></button>
        <h2 className="text-base font-extrabold text-[#0E1F35]">{title}</h2>
      </header>
      <button type="button" onClick={locate} aria-label="Моє місцезнаходження" className="absolute bottom-4 right-14 z-20 grid h-10 w-10 place-items-center rounded-full bg-white text-[#1789F4] shadow-md"><LocateFixed size={18}/></button>
    </div>
    <div className="border-t border-slate-100 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Обрана точка</p>
      <p role="status" className="mt-1 min-h-[2.5rem] text-sm font-bold text-[#0E1F35]">{state === 'resolving' ? 'Визначаємо адресу…' : place ? place.label : state === 'error' ? message : 'Посуньте мапу, щоб поставити позначку'}</p>
      {message && state !== 'error' && <p className="text-xs text-rose-600">{message}</p>}
      <button type="button" disabled={!place || state === 'resolving'} onClick={() => place && onConfirm(place)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1789F4] py-3.5 text-sm font-bold text-white disabled:opacity-50"><Check size={17}/>Підтвердити точку</button>
    </div>
  </div>;
}
