import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Navigation,
  ArrowRightLeft,
  Search,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  Maximize2,
  X,
  Compass,
  ArrowRight
} from 'lucide-react';

export interface CityMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  popular?: boolean;
  region: string;
}

export const UKRAINE_CITIES: CityMarker[] = [
  { id: 'kyiv', name: 'Київ', lat: 50.4501, lng: 30.5234, popular: true, region: 'Центр' },
  { id: 'odesa', name: 'Одеса', lat: 46.4825, lng: 30.7233, popular: true, region: 'Південь' },
  { id: 'lviv', name: 'Львів', lat: 49.8397, lng: 24.0297, popular: true, region: 'Захід' },
  { id: 'dnipro', name: 'Дніпро', lat: 48.4647, lng: 35.0462, popular: true, region: 'Схід' },
  { id: 'kharkiv', name: 'Харків', lat: 49.9935, lng: 36.2304, popular: true, region: 'Схід' },
  { id: 'vinnytsia', name: 'Вінниця', lat: 49.2331, lng: 28.4682, popular: true, region: 'Центр' },
  { id: 'uman', name: 'Умань', lat: 48.7484, lng: 30.2218, popular: true, region: 'Центр' },
  { id: 'stryi', name: 'Стрий', lat: 49.2562, lng: 23.8548, popular: true, region: 'Захід' },
  { id: 'poltava', name: 'Полтава', lat: 49.5883, lng: 34.5514, popular: true, region: 'Схід' },
  { id: 'zaporizhzhia', name: 'Запоріжжя', lat: 47.8388, lng: 35.1396, popular: true, region: 'Схід' },
  { id: 'zhytomyr', name: 'Житомир', lat: 50.2547, lng: 28.6587, popular: true, region: 'Північ' },
  { id: 'ivano_frankivsk', name: 'Івано-Франківськ', lat: 48.9226, lng: 24.7111, popular: true, region: 'Захід' },
  { id: 'chernivtsi', name: 'Чернівці', lat: 48.2921, lng: 25.9358, popular: true, region: 'Захід' },
  { id: 'rivne', name: 'Рівне', lat: 50.6199, lng: 26.2516, popular: true, region: 'Захід' },
  { id: 'ternopil', name: 'Тернопіль', lat: 49.5535, lng: 25.5948, popular: true, region: 'Захід' },
  { id: 'khmelnytskyi', name: 'Хмельницький', lat: 49.4230, lng: 26.9871, popular: true, region: 'Захід' },
  { id: 'cherkasy', name: 'Черкаси', lat: 49.4444, lng: 32.0598, popular: true, region: 'Центр' },
  { id: 'mykolaiv', name: 'Миколаїв', lat: 46.9750, lng: 31.9946, popular: true, region: 'Південь' },
  { id: 'kropyvnytskyi', name: 'Кропивницький', lat: 48.5079, lng: 32.2623, region: 'Центр' },
  { id: 'kremenchuk', name: 'Кременчук', lat: 49.0630, lng: 33.4040, region: 'Центр' },
  { id: 'bila_tserkva', name: 'Біла Церква', lat: 49.7989, lng: 30.1153, popular: true, region: 'Центр' },
  { id: 'lutsk', name: 'Луцьк', lat: 50.7472, lng: 25.3254, region: 'Захід' },
  { id: 'uzhhorod', name: 'Ужгород', lat: 48.6208, lng: 22.2879, region: 'Захід' }
];

// Project GPS to SVG ViewBox (800 x 480)
function project(lat: number, lng: number): { x: number; y: number } {
  const minLng = 21.8;
  const maxLng = 40.5;
  const minLat = 44.4;
  const maxLat = 52.4;

  const width = 800;
  const height = 480;
  const padX = 55;
  const padY = 40;

  const x = padX + ((lng - minLng) / (maxLng - minLng)) * (width - 2 * padX);
  const y = height - padY - ((lat - minLat) / (maxLat - minLat)) * (height - 2 * padY);

  return { x: Math.round(x), y: Math.round(y) };
}

// Major Ukrainian Highway Corridors for background lines
const HIGHWAY_CORRIDORS = [
  ['kyiv', 'bila_tserkva', 'uman', 'odesa'], // M-05
  ['kyiv', 'zhytomyr', 'rivne', 'lviv', 'stryi', 'uzhhorod'], // M-06
  ['kyiv', 'poltava', 'kharkiv'], // M-03
  ['lviv', 'ternopil', 'khmelnytskyi', 'vinnytsia', 'uman'], // M-12 / E50
  ['kyiv', 'cherkasy', 'kremenchuk', 'dnipro', 'zaporizhzhia'], // Dnipro corridor
  ['odesa', 'mykolaiv'],
  ['lviv', 'stryi', 'ivano_frankivsk', 'chernivtsi']
];

interface InteractiveMapPickerProps {
  origin: string;
  destination: string;
  onSelectOrigin: (cityName: string) => void;
  onSelectDestination: (cityName: string) => void;
  onSwap: () => void;
  onConfirm?: () => void;
  className?: string;
}

export const InteractiveMapPicker: React.FC<InteractiveMapPickerProps> = ({
  origin,
  destination,
  onSelectOrigin,
  onSelectDestination,
  onSwap,
  onConfirm,
  className = ''
}) => {
  // Current active assignment mode: 'origin' or 'destination'
  const [activeSlot, setActiveSlot] = useState<'origin' | 'destination'>(
    !origin ? 'origin' : !destination ? 'destination' : 'origin'
  );
  const [hoveredCity, setHoveredCity] = useState<CityMarker | null>(null);
  const [selectedPopupCity, setSelectedPopupCity] = useState<CityMarker | null>(null);

  // Pre-calculated city positions
  const citiesWithCoords = useMemo(() => {
    return UKRAINE_CITIES.map((c) => ({
      ...c,
      ...project(c.lat, c.lng)
    }));
  }, []);

  const originCity = useMemo(() => {
    return (
      citiesWithCoords.find(
        (c) =>
          c.name.toLowerCase() === (origin || '').toLowerCase() ||
          (origin && origin.toLowerCase().includes(c.name.toLowerCase()))
      ) || null
    );
  }, [citiesWithCoords, origin]);

  const destinationCity = useMemo(() => {
    return (
      citiesWithCoords.find(
        (c) =>
          c.name.toLowerCase() === (destination || '').toLowerCase() ||
          (destination && destination.toLowerCase().includes(c.name.toLowerCase()))
      ) || null
    );
  }, [citiesWithCoords, destination]);

  // Handle click on a city marker
  const handleMarkerClick = (city: CityMarker) => {
    if (activeSlot === 'origin') {
      onSelectOrigin(city.name);
      // Automatically advance to choosing destination if not chosen or same
      if (!destination || destination === city.name) {
        setActiveSlot('destination');
      }
    } else {
      onSelectDestination(city.name);
      // If origin is not chosen, switch back to origin
      if (!origin || origin === city.name) {
        setActiveSlot('origin');
      }
    }
    setSelectedPopupCity(city);
  };

  // Direct selection via popup actions
  const handleSetAsOrigin = (cityName: string) => {
    onSelectOrigin(cityName);
    if (!destination || destination === cityName) {
      setActiveSlot('destination');
    }
    setSelectedPopupCity(null);
  };

  const handleSetAsDestination = (cityName: string) => {
    onSelectDestination(cityName);
    setSelectedPopupCity(null);
  };

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden bg-[#0A192F] border border-[#1E293B] shadow-xl text-white select-none ${className}`}>
      {/* Top Interactive Mode HUD */}
      <div className="p-3 sm:p-4 bg-[#081B35]/95 backdrop-blur-md border-b border-[#1E3A8A]/50 flex flex-col sm:flex-row items-center justify-between gap-3 z-20 relative">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="p-2 rounded-xl bg-blue-500/20 text-[#38BDF8] border border-blue-500/30">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="text-xs font-extrabold flex items-center gap-2">
              <span>Інтерактивна карта доріг України</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Клікніть на місто
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              {activeSlot === 'origin' ? (
                <span className="text-sky-300 font-semibold">
                  1. Оберіть точку відправлення (Звідки) на карті
                </span>
              ) : (
                <span className="text-emerald-300 font-semibold">
                  2. Оберіть пункт прибуття (Куди) на карті
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Slot selector toggles */}
        <div className="flex items-center gap-1.5 bg-[#0D2140] p-1 rounded-xl border border-[#1E3A8A] w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={() => setActiveSlot('origin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSlot === 'origin'
                ? 'bg-[#1769F4] text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span className="truncate max-w-[90px] sm:max-w-none">
              {origin ? `З: ${origin}` : 'Звідки'}
            </span>
          </button>

          <button
            type="button"
            onClick={onSwap}
            title="Поміняти місцями"
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white active:rotate-180 transition"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveSlot('destination')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSlot === 'destination'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="truncate max-w-[90px] sm:max-w-none">
              {destination ? `До: ${destination}` : 'Куди'}
            </span>
          </button>
        </div>
      </div>

      {/* Main SVG Vector Canvas */}
      <div className="relative w-full h-80 sm:h-96 overflow-hidden">
        <svg
          className="w-full h-full"
          viewBox="0 0 800 480"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="selectedRouteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1769F4" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>

            <filter id="mapGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <pattern id="mapPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" strokeWidth="0.8" opacity="0.3" />
            </pattern>
          </defs>

          {/* Background Grid */}
          <rect width="800" height="480" fill="#071527" />
          <rect width="800" height="480" fill="url(#mapPattern)" />

          {/* Ukraine Stylized Border Contour / Regions */}
          <path
            d="M 100 130 C 180 90, 320 80, 420 90 S 620 70, 720 120 S 760 250, 700 320 S 580 340, 520 380 S 430 420, 360 410 S 320 360, 240 380 S 140 370, 80 270 S 60 160, 100 130 Z"
            fill="#0B1E36"
            stroke="#1E3A8A"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            opacity="0.7"
          />

          {/* Background Major Ukrainian Highway Corridors */}
          {HIGHWAY_CORRIDORS.map((corridor, idx) => {
            const points = corridor
              .map((cId) => citiesWithCoords.find((c) => c.id === cId))
              .filter(Boolean) as (CityMarker & { x: number; y: number })[];

            if (points.length < 2) return null;
            const pathData = points.reduce((acc, pt, i) => {
              return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
            }, '');

            return (
              <g key={`corridor_${idx}`}>
                <path
                  d={pathData}
                  fill="none"
                  stroke="#1E3A8A"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.45"
                />
                <path
                  d={pathData}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  opacity="0.6"
                />
              </g>
            );
          })}

          {/* Active Direct Route Connection between selected Origin and Destination */}
          {originCity && destinationCity && originCity.id !== destinationCity.id && (
            <g>
              {/* Glow backline */}
              <line
                x1={originCity.x}
                y1={originCity.y}
                x2={destinationCity.x}
                y2={destinationCity.y}
                stroke="#1769F4"
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.3"
                filter="url(#mapGlow)"
              />
              {/* Gradient highway line */}
              <line
                x1={originCity.x}
                y1={originCity.y}
                x2={destinationCity.x}
                y2={destinationCity.y}
                stroke="url(#selectedRouteGrad)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {/* Moving dash line */}
              <line
                x1={originCity.x}
                y1={originCity.y}
                x2={destinationCity.x}
                y2={destinationCity.y}
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeDasharray="6 6"
                strokeLinecap="round"
                opacity="0.8"
              />

              {/* Animated Midpoint Badge */}
              <g
                transform={`translate(${(originCity.x + destinationCity.x) / 2}, ${(originCity.y + destinationCity.y) / 2})`}
              >
                <circle r="12" fill="#081B35" stroke="#38BDF8" strokeWidth="2" />
                <path d="M -4 -4 L 4 0 L -4 4 Z" fill="#38BDF8" />
              </g>
            </g>
          )}

          {/* City Markers */}
          {citiesWithCoords.map((city) => {
            const isOrigin = originCity?.id === city.id;
            const isDestination = destinationCity?.id === city.id;
            const isHovered = hoveredCity?.id === city.id;
            const isSelected = isOrigin || isDestination;

            return (
              <g
                key={city.id}
                transform={`translate(${city.x}, ${city.y})`}
                onClick={() => handleMarkerClick(city)}
                onMouseEnter={() => setHoveredCity(city)}
                onMouseLeave={() => setHoveredCity(null)}
                className="cursor-pointer group"
              >
                {/* Hit area */}
                <circle r="22" fill="transparent" />

                {/* Pulse ring on selected or hovered */}
                {(isSelected || isHovered) && (
                  <circle
                    r="18"
                    fill={isOrigin ? '#1769F4' : isDestination ? '#10B981' : '#38BDF8'}
                    opacity="0.25"
                    className="animate-ping"
                  />
                )}

                {/* Marker Outer Circle */}
                <circle
                  r={isSelected ? 10 : city.popular ? 7 : 5}
                  fill={
                    isOrigin
                      ? '#1769F4'
                      : isDestination
                      ? '#10B981'
                      : isHovered
                      ? '#38BDF8'
                      : city.popular
                      ? '#0284C7'
                      : '#475569'
                  }
                  stroke="#FFFFFF"
                  strokeWidth={isSelected ? 3 : 1.5}
                  className="transition-all duration-200"
                />

                {/* Center Core */}
                {isSelected && <circle r="4" fill="#FFFFFF" />}

                {/* Marker City Name Label */}
                <text
                  y={isSelected ? 22 : 18}
                  textAnchor="middle"
                  fill={isSelected ? '#FFFFFF' : isHovered ? '#38BDF8' : '#CBD5E1'}
                  fontSize={isSelected ? '12' : city.popular ? '11' : '10'}
                  fontWeight={isSelected || isHovered ? 'bold' : 'normal'}
                  className="pointer-events-none select-none drop-shadow"
                >
                  {city.name}
                </text>

                {/* Origin / Destination Tag Indicator above */}
                {isOrigin && (
                  <g transform="translate(0, -20)">
                    <rect x="-24" y="-12" width="48" height="16" rx="4" fill="#1769F4" />
                    <text y="0" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="bold">
                      ЗВІДКИ
                    </text>
                  </g>
                )}

                {isDestination && (
                  <g transform="translate(0, -20)">
                    <rect x="-22" y="-12" width="44" height="16" rx="4" fill="#10B981" />
                    <text y="0" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="bold">
                      КУДИ
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Quick Action Popup when a city is selected */}
        {selectedPopupCity && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#081B35]/95 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-2xl z-30 flex items-center gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#1769F4]" />
              <span className="font-extrabold text-sm text-white">{selectedPopupCity.name}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSetAsOrigin(selectedPopupCity.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  origin === selectedPopupCity.name
                    ? 'bg-[#1769F4] text-white'
                    : 'bg-white/10 hover:bg-[#1769F4] text-slate-200'
                }`}
              >
                Вибрати як «Звідки»
              </button>

              <button
                type="button"
                onClick={() => handleSetAsDestination(selectedPopupCity.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  destination === selectedPopupCity.name
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/10 hover:bg-emerald-600 text-slate-200'
                }`}
              >
                Вибрати як «Куди»
              </button>

              <button
                type="button"
                onClick={() => setSelectedPopupCity(null)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Route Summary & Popular Presets */}
      <div className="p-3 sm:p-4 bg-[#081B35]/95 backdrop-blur-md border-t border-[#1E3A8A]/50 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Route status */}
        <div className="flex items-center gap-3 text-xs w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[#0D2140] px-3 py-1.5 rounded-xl border border-[#1E3A8A]">
            <span className="font-semibold text-slate-300">Обрано:</span>
            <strong className="text-sky-400 font-extrabold">{origin || 'Оберіть місто'}</strong>
            <span className="text-slate-500">→</span>
            <strong className="text-emerald-400 font-extrabold">{destination || 'Оберіть місто'}</strong>
          </div>

          {origin && destination && origin !== destination && (
            <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
              Маршрут прокладено
            </span>
          )}
        </div>

        {/* Popular Quick Route Chips */}
        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Популярні:</span>
          {[
            { from: 'Одеса', to: 'Київ' },
            { from: 'Київ', to: 'Львів' },
            { from: 'Стрий', to: 'Львів' },
            { from: 'Дніпро', to: 'Київ' }
          ].map((pair, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelectOrigin(pair.from);
                onSelectDestination(pair.to);
                setSelectedPopupCity(null);
              }}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-200 transition active:scale-95"
            >
              {pair.from} → {pair.to}
            </button>
          ))}
        </div>

        {/* Confirm action if provided */}
        {onConfirm && (
          <button
            type="button"
            onClick={onConfirm}
            disabled={!origin || !destination}
            className="w-full md:w-auto px-5 py-2 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white text-xs font-bold shadow-md shadow-[#1769F4]/20 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Знайти поїздки</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
