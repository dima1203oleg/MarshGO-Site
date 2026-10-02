import { useState } from 'react';
import { MapPin, Navigation, RefreshCw } from 'lucide-react';
import { MarshGoMap } from './MarshGoMap';
import type { MapAdapter, MapStatus } from './MapAdapter';

interface OfferRouteMapProps {
  origin: string;
  destination: string;
  geometry?: Array<[number, number]>;
}

const statusCopy: Record<MapStatus, string> = {
  unconfigured: 'Карта очікує на налаштування джерела картографічних даних.',
  loading: 'Завантажуємо карту маршруту…',
  available: 'Карта маршруту готова.',
  degraded: 'Карта завантажена частково. Маршрут залишається доступним.',
  failed: 'Не вдалося завантажити карту.',
};

/** Offer preview only renders route geometry supplied by the routing backend. */
export function OfferRouteMap({ origin, destination, geometry }: OfferRouteMapProps) {
  const [status, setStatus] = useState<MapStatus>('unconfigured');
  const [adapter, setAdapter] = useState<MapAdapter | null>(null);
  const route = geometry?.filter((point) => point.length === 2 && point.every(Number.isFinite)) ?? [];

  return (
    <section aria-label={`Огляд маршруту ${origin} — ${destination}`} className="overflow-hidden rounded-2xl border border-[#DFE7F1] bg-white">
      {route.length >= 2 ? (
        <div className="relative h-64 sm:h-80">
          <MarshGoMap route={route} onStatus={setStatus} onAdapter={setAdapter} />
          <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-5.5rem)] items-center gap-2 rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-xs font-semibold text-[#14243B] shadow-md backdrop-blur">
            <MapPin className="h-4 w-4 shrink-0 text-[#1769F4]" aria-hidden="true" />
            <span className="truncate">{origin} <span className="text-slate-400">→</span> {destination}</span>
          </div>
          <button
            type="button"
            aria-label="Показати весь маршрут"
            title="Показати весь маршрут"
            onClick={() => adapter?.fitRoute()}
            className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-xl border border-white/70 bg-white/95 text-[#1769F4] shadow-md"
          >
            <Navigation className="h-4 w-4" aria-hidden="true" />
          </button>
          {status !== 'available' && (
            <div role="status" className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-3 rounded-xl bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-md">
              <span>{statusCopy[status]}</span>
              {status === 'failed' && <button type="button" aria-label="Повторити завантаження карти" onClick={() => adapter?.retry()} className="shrink-0 rounded-lg p-1 text-blue-700"><RefreshCw className="h-4 w-4" /></button>}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-40 items-center gap-3 bg-slate-50 px-5 py-6 text-sm text-slate-600">
          <MapPin className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          <p>Для цієї пропозиції сервер не надав геометрію дороги. Карта з’явиться після отримання перевіреного маршруту.</p>
        </div>
      )}
      <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">Огляд маршруту · без поточного GPS водія</p>
    </section>
  );
}
