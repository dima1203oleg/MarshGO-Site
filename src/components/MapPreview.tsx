import React from 'react';
import { MapPin } from 'lucide-react';
import { MarshGoMap } from '../map/MarshGoMap';
import type { Coordinate } from '../../shared/navigation/contracts';

interface MapPreviewProps {
  origin: string;
  destination: string;
  routeGeometry?: Coordinate[];
  vehicleLocation?: Coordinate | null;
  intermediateStops?: string[];
  activeDetour?: { minutes: number; km: number; pickupName: string; dropoffName: string };
  interactive?: boolean;
  className?: string;
}

/** Displays only a real route supplied by the server; it never invents roads or vehicle positions. */
export const MapPreview: React.FC<MapPreviewProps> = ({
  origin,
  destination,
  routeGeometry,
  vehicleLocation,
  className = 'h-64 sm:h-80',
}) => {
  const route = routeGeometry?.filter((point) => point.length === 2 && point.every(Number.isFinite)) ?? [];
  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${className}`}>
      {route.length >= 2 ? (
        <MarshGoMap route={route} vehicle={vehicleLocation} onStatus={() => undefined} onAdapter={() => undefined} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="max-w-sm">
            <MapPin className="mx-auto mb-3 h-8 w-8 text-blue-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-800">{origin} <span className="text-slate-400">→</span> {destination}</p>
            <p className="mt-2 text-xs text-slate-500">Карта маршруту з’явиться, коли сервер надасть дорожню геометрію.</p>
          </div>
        </div>
      )}
    </div>
  );
};
