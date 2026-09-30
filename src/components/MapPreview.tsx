import React from 'react';
import { Navigation, MapPin, Compass, ShieldCheck } from 'lucide-react';

interface Waypoint {
  name: string;
  type: 'origin' | 'destination' | 'pickup' | 'dropoff';
  lat?: number;
  lng?: number;
}

interface MapPreviewProps {
  origin: string;
  destination: string;
  intermediateStops?: string[];
  waypoints?: Waypoint[];
  driverLocation?: { lat: number; lng: number };
  activeDetour?: {
    minutes: number;
    km: number;
    pickupName: string;
    dropoffName: string;
  };
  interactive?: boolean;
  className?: string;
}

export const MapPreview: React.FC<MapPreviewProps> = ({
  origin,
  destination,
  intermediateStops = [],
  waypoints,
  activeDetour,
  className = 'h-64 sm:h-80'
}) => {
  // SVG based high performance vector road visualizer representing Ukrainian highway geometry
  // E.g. M05 (Kyiv-Odesa) or M06 (Kyiv-Lviv-Stryi)
  return (
    <div className={`relative w-full rounded-2xl overflow-hidden bg-[#0A192F] border border-[#1E293B] shadow-inner select-none ${className}`}>
      {/* Top Map HUD Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-[#081B35]/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1E3A8A]/50 text-xs text-white">
          <Navigation className="w-3.5 h-3.5 text-[#1769F4] animate-pulse" />
          <span className="font-medium">{origin}</span>
          <span className="text-slate-400">→</span>
          <span className="font-medium text-[#38BDF8]">{destination}</span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#081B35]/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-[#1E3A8A]/50 text-[11px] text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>MARSHGO Map v2.6</span>
        </div>
      </div>

      {/* SVG Canvas representing dynamic road geometry */}
      <svg className="w-full h-full" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="roadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1E3A8A" />
            <stop offset="50%" stop-color="#1769F4" />
            <stop offset="100%" stop-color="#38BDF8" />
          </linearGradient>

          <linearGradient id="detourGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F59E0B" />
            <stop offset="100%" stop-color="#10B981" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" strokeWidth="0.8" opacity="0.4" />
          </pattern>
        </defs>

        {/* Map Grid & Topographic lines */}
        <rect width="600" height="340" fill="#071527" />
        <rect width="600" height="340" fill="url(#grid)" />

        {/* Stylized terrain water bodies / regions */}
        <path d="M 0 280 Q 150 250, 300 290 T 600 260 L 600 340 L 0 340 Z" fill="#0C213D" opacity="0.5" />
        <path d="M 450 0 Q 420 120, 500 200 T 600 340 L 600 0 Z" fill="#0C213D" opacity="0.3" />

        {/* Main Highway Route (S-curve corridor) */}
        <path
          d="M 90 250 C 180 230, 240 180, 310 160 S 440 120, 510 80"
          fill="none"
          stroke="#1E3A8A"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M 90 250 C 180 230, 240 180, 310 160 S 440 120, 510 80"
          fill="none"
          stroke="url(#roadGrad)"
          strokeWidth="5"
          strokeLinecap="round"
          filter="url(#glow)"
        />

        {/* Dash highway animation */}
        <path
          d="M 90 250 C 180 230, 240 180, 310 160 S 440 120, 510 80"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeDasharray="8 8"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* Detour path if passenger match is active */}
        {activeDetour && (
          <>
            <path
              d="M 210 200 Q 240 240, 270 230 T 320 160"
              fill="none"
              stroke="url(#detourGrad)"
              strokeWidth="4"
              strokeDasharray="6 4"
              filter="url(#glow)"
            />
            {/* Pickup Waypoint Point */}
            <circle cx="240" cy="236" r="6" fill="#F59E0B" />
            <circle cx="240" cy="236" r="14" fill="#F59E0B" opacity="0.3" className="animate-ping" />
            <text x="252" y="240" fill="#FDE68A" fontSize="11" fontWeight="600">
              +{activeDetour.minutes} хв ({activeDetour.pickupName})
            </text>
          </>
        )}

        {/* Origin Pin */}
        <g transform="translate(90, 250)">
          <circle r="16" fill="#1769F4" opacity="0.2" className="animate-pulse" />
          <circle r="8" fill="#1769F4" stroke="#FFFFFF" strokeWidth="2.5" />
          <text y="24" textAnchor="middle" fill="#E2E8F0" fontSize="12" fontWeight="bold">
            {origin}
          </text>
        </g>

        {/* Intermediate Stop dots */}
        {intermediateStops.map((stop, i) => {
          const x = 200 + i * 110;
          const y = 200 - i * 40;
          return (
            <g key={stop} transform={`translate(${x}, ${y})`}>
              <circle r="4" fill="#94A3B8" stroke="#1E293B" strokeWidth="1.5" />
              <text y="-10" textAnchor="middle" fill="#94A3B8" fontSize="10">
                {stop}
              </text>
            </g>
          );
        })}

        {/* Active Car Marker along corridor */}
        <g transform="translate(195, 205)">
          <circle r="12" fill="#10B981" opacity="0.3" className="animate-ping" />
          <circle r="7" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
        </g>

        {/* Destination Pin */}
        <g transform="translate(510, 80)">
          <circle r="18" fill="#10B981" opacity="0.2" className="animate-pulse" />
          <circle r="9" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
          <text y="24" textAnchor="middle" fill="#E2E8F0" fontSize="12" fontWeight="bold">
            {destination}
          </text>
        </g>
      </svg>

      {/* Floating Compass / Controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10 pointer-events-auto">
        <button
          type="button"
          aria-label="Орієнтація карти на північ"
          className="p-2 rounded-lg bg-[#081B35]/85 border border-[#1E3A8A]/50 text-slate-300 hover:text-white transition-colors"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Distance & ETA Badge */}
      <div className="absolute bottom-3 left-3 bg-[#081B35]/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1E3A8A]/50 text-xs text-slate-200">
        <span className="font-semibold text-white">Road Routing OSRM</span>
        <span className="mx-1.5 text-slate-500">·</span>
        <span>Коридор M-05 / M-06</span>
      </div>
    </div>
  );
};
