import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Maximize2,
  Compass,
  Play,
  Pause,
  Car
} from 'lucide-react';
import { TransportOffer } from '../types';

interface LiveRouteMapProps {
  offer: TransportOffer;
}

// Coordinate database for major Ukrainian cities & waypoints
const CITY_COORDS: Record<string, [number, number]> = {
  'odesa': [46.4825, 30.7233],
  'одеса': [46.4825, 30.7233],
  'kyiv': [50.4501, 30.5234],
  'київ': [50.4501, 30.5234],
  'lviv': [49.8397, 24.0297],
  'львів': [49.8397, 24.0297],
  'dnipro': [48.4647, 35.0462],
  'дніпро': [48.4647, 35.0462],
  'kharkiv': [49.9935, 36.2304],
  'харків': [49.9935, 36.2304],
  'uman': [48.7484, 30.2218],
  'умань': [48.7484, 30.2218],
  'bila tserkva': [49.7989, 30.1153],
  'біла церква': [49.7989, 30.1153],
  'zhytomyr': [50.2547, 28.6587],
  'житомир': [50.2547, 28.6587],
  'rivne': [50.6199, 26.2516],
  'рівне': [50.6199, 26.2516],
  'vinnytsia': [49.2331, 28.4682],
  'вінниця': [49.2331, 28.4682],
  'stryi': [49.2558, 23.8576],
  'стрий': [49.2558, 23.8576]
};

// Generates smooth realistic highway waypoints between two coordinates
function generateHighwayWaypoints(
  start: [number, number],
  end: [number, number],
  intermediate: [number, number][] = []
): [number, number][] {
  const allPoints: [number, number][] = [start, ...intermediate, end];
  const detailedPath: [number, number][] = [];

  for (let i = 0; i < allPoints.length - 1; i++) {
    const p1 = allPoints[i];
    const p2 = allPoints[i + 1];
    const steps = 25;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // Linear interpolation with natural highway curves
      const lat = p1[0] + (p2[0] - p1[0]) * t + Math.sin(t * Math.PI) * 0.04 * (i % 2 === 0 ? 1 : -1);
      const lng = p1[1] + (p2[1] - p1[1]) * t + Math.sin(t * Math.PI * 2) * 0.02;
      detailedPath.push([lat, lng]);
    }
  }

  return detailedPath;
}

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({ offer }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite' | 'voyager'>('voyager');
  const [isPlaying, setIsPlaying] = useState(true);
  const [followDriver, setFollowDriver] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0.42); // 42% along the route
  const [speedKmh, setSpeedKmh] = useState(94);

  // Derive origin, destination and stops
  const originKey = offer.origin.toLowerCase().trim();
  const destKey = offer.destination.toLowerCase().trim();

  const startCoord: [number, number] = CITY_COORDS[originKey] || [46.4825, 30.7233]; // default Odesa
  const endCoord: [number, number] = CITY_COORDS[destKey] || [50.4501, 30.5234]; // default Kyiv

  const intermediateCoords: [number, number][] = (offer.intermediateStops || [])
    .map((s) => CITY_COORDS[s.toLowerCase().trim()])
    .filter(Boolean) as [number, number][];

  const routePath = React.useMemo(() => {
    return generateHighwayWaypoints(startCoord, endCoord, intermediateCoords);
  }, [startCoord, endCoord, intermediateCoords]);

  // Calculate current driver coordinate
  const currentIndex = Math.min(
    routePath.length - 1,
    Math.floor(currentProgress * (routePath.length - 1))
  );
  const driverPos = routePath[currentIndex] || startCoord;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Map
    const map = L.map(mapContainerRef.current, {
      center: driverPos,
      zoom: 7,
      zoomControl: false,
      attributionControl: false
    });
    mapInstanceRef.current = map;

    // Tile URLs
    const tileUrls = {
      streets: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    };

    const tileLayer = L.tileLayer(tileUrls[mapLayer], {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Add Route Polyline
    const polyline = L.polyline(routePath, {
      color: '#1769F4',
      weight: 5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    routePolylineRef.current = polyline;

    // Origin Marker (A)
    const originIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div style="background-color: #1769F4; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
          A
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    L.marker(startCoord, { icon: originIcon })
      .addTo(map)
      .bindPopup(
        `<div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
          <strong style="color: #1769F4; font-size: 13px;">Точка відправлення: ${offer.origin}</strong>
          <div style="color: #64748B; margin-top: 4px;">${offer.originAddress || 'Головна локація'}</div>
          <div style="margin-top: 4px; font-weight: bold; color: #0F172A;">Виїзд: ${new Date(offer.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>`
      );

    // Destination Marker (B)
    const destIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div style="background-color: #16845C; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
          B
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    L.marker(endCoord, { icon: destIcon })
      .addTo(map)
      .bindPopup(
        `<div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
          <strong style="color: #16845C; font-size: 13px;">Пункт призначення: ${offer.destination}</strong>
          <div style="color: #64748B; margin-top: 4px;">${offer.destinationAddress || 'Кінцева адреса'}</div>
          <div style="margin-top: 4px; font-weight: bold; color: #0F172A;">Прибуття: ${new Date(offer.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>`
      );

    // Intermediate Stop Markers
    intermediateCoords.forEach((coord, idx) => {
      const stopName = offer.intermediateStops?.[idx] || 'Зупинка';
      const stopIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div style="background-color: #F59E0B; color: #0F172A; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 10px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
            ${idx + 1}
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      L.marker(coord, { icon: stopIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family: sans-serif; font-size: 12px;">
            <strong style="color: #D97706;">Проміжна зупинка: ${stopName}</strong>
            <div style="color: #64748B; margin-top: 2px;">Посадка/висадка пасажирів на трасі</div>
          </div>`
        );
    });

    // Real-Time Animated Driver Marker
    const driverIcon = L.divIcon({
      className: 'driver-live-marker',
      html: `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; inset: 0; background-color: rgba(23, 105, 244, 0.25); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="background-color: #081B35; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #38BDF8; box-shadow: 0 4px 12px rgba(0,0,0,0.45); z-index: 10;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 11.1 2 11.5V16c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const driverMarker = L.marker(driverPos, { icon: driverIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(
        `<div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
          <div style="display: flex; items-center; gap: 4px; font-weight: bold; color: #1769F4;">
            <span>🚗 Водій ${offer.driver.name}</span>
          </div>
          <div style="color: #64748B; margin-top: 2px;">${offer.vehicle?.make || 'Toyota'} ${offer.vehicle?.model || 'Camry'}</div>
          <div style="margin-top: 4px; font-weight: 700; color: #16845C;">Швидкість: ${speedKmh} км/год (GPS наживо)</div>
        </div>`
      );
    driverMarkerRef.current = driverMarker;

    // Fit bounds to whole route
    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [offer.id, startCoord, endCoord]);

  // Update Tile Layer when layer switch button is pressed
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const tileUrls = {
      streets: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    };

    tileLayerRef.current.setUrl(tileUrls[mapLayer]);
  }, [mapLayer]);

  // Real-Time GPS simulation ticker
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentProgress((prev) => {
        const next = prev + 0.003;
        const bounded = next > 1 ? 0 : next;

        // Fluctuating speed for realism (88 - 98 km/h)
        setSpeedKmh(Math.round(90 + Math.sin(Date.now() / 1500) * 8));

        return bounded;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Update Driver Marker Position on map
  useEffect(() => {
    if (!driverMarkerRef.current || !mapInstanceRef.current) return;
    const idx = Math.min(
      routePath.length - 1,
      Math.floor(currentProgress * (routePath.length - 1))
    );
    const newPos = routePath[idx];
    if (newPos) {
      driverMarkerRef.current.setLatLng(newPos);
      if (followDriver) {
        mapInstanceRef.current.panTo(newPos, { animate: true, duration: 0.4 });
      }
    }
  }, [currentProgress, routePath, followDriver]);

  const handleFitRoute = () => {
    if (!mapInstanceRef.current || !routePolylineRef.current) return;
    mapInstanceRef.current.fitBounds(routePolylineRef.current.getBounds(), { padding: [40, 40] });
    setFollowDriver(false);
  };

  const handleCenterDriver = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(driverPos, 11, { animate: true });
    setFollowDriver(true);
  };

  const kmCompleted = Math.round((offer.distanceKm || 475) * currentProgress);
  const kmRemaining = Math.max(0, (offer.distanceKm || 475) - kmCompleted);
  const minutesRemaining = Math.round(((offer.distanceKm || 475) - kmCompleted) / (speedKmh / 60));

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm bg-white dark:bg-[#0D1E36] space-y-0">
      {/* Top Map Control Bar */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-extrabold text-[#14243B] dark:text-white flex items-center gap-1.5">
            <span>GPS-трекінг рейсу:</span>
            <span className="text-[#1769F4] dark:text-sky-400 font-black">
              {offer.origin} ➔ {offer.destination}
            </span>
          </span>
        </div>

        {/* Layer switchers & actions */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center p-0.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setMapLayer('voyager')}
              className={`px-2 py-1 rounded-md font-bold transition text-[11px] ${
                mapLayer === 'voyager'
                  ? 'bg-[#1769F4] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Схема
            </button>
            <button
              type="button"
              onClick={() => setMapLayer('satellite')}
              className={`px-2 py-1 rounded-md font-bold transition text-[11px] ${
                mapLayer === 'satellite'
                  ? 'bg-[#081B35] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Супутник
            </button>
            <button
              type="button"
              onClick={() => setMapLayer('streets')}
              className={`px-2 py-1 rounded-md font-bold transition text-[11px] ${
                mapLayer === 'streets'
                  ? 'bg-[#1769F4] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              OSM
            </button>
          </div>

          <button
            type="button"
            onClick={handleCenterDriver}
            className={`p-1.5 rounded-lg border font-bold transition flex items-center gap-1 ${
              followDriver
                ? 'bg-[#1769F4] text-white border-[#1769F4]'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
            title="Центрувати на водієві"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Водій</span>
          </button>

          <button
            type="button"
            onClick={handleFitRoute}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition"
            title="Показати весь маршрут"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Real-time Interactive Leaflet Map Container */}
      <div className="relative w-full h-80 sm:h-96 z-0">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Live Telemetry Overlay */}
        <div className="absolute bottom-3 left-3 right-3 z-[400] bg-white/95 dark:bg-[#081B35]/95 backdrop-blur-md rounded-xl p-3 border border-slate-200/80 dark:border-slate-700 shadow-xl flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-[#1769F4] dark:text-sky-400 flex items-center justify-center font-black text-sm">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs text-[#14243B] dark:text-white">
                  {offer.driver.name} ({offer.vehicle?.make || 'Toyota'} {offer.vehicle?.model || 'Camry'})
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  {speedKmh} км/год
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Пройдено {kmCompleted} км · Залишилось {kmRemaining} км (~{Math.floor(minutesRemaining / 60)}г {minutesRemaining % 60}хв)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1 transition"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{isPlaying ? 'Пауза' : 'Пуск'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
