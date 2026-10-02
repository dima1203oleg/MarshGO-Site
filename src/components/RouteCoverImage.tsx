import React from 'react';
import {



  Sparkles,






  Navigation
} from 'lucide-react';

interface RouteCoverImageProps {
  origin: string;
  destination: string;
  category?: string;
  className?: string;
  departureTime?: string;
}

interface RouteTheme {
  name: string;
  gradient: string;
  roadGradient: [string, string];
  icon: 'waves' | 'mountain' | 'city' | 'forest' | 'steppe';
  roadNumber: string;
  skyColor: string;
  badgeBg: string;
}

// Generate algorithmic landscape themes based on Ukrainian routes
function getRouteTheme(origin: string, destination: string): RouteTheme {
  const text = `${origin} ${destination}`.toLowerCase();

  // Odesa / Southern Black Sea Route
  if (text.includes('одес') || text.includes('микола') || text.includes('херсон') || text.includes('чорноморськ')) {
    return {
      name: 'Причорноморська траса M-05',
      gradient: 'from-amber-600 via-orange-600 to-sky-900',
      roadGradient: ['#F59E0B', '#0EA5E9'],
      icon: 'waves',
      roadNumber: 'M-05',
      skyColor: '#FDBA74',
      badgeBg: 'bg-orange-500/20 text-orange-200 border-orange-400/30'
    };
  }

  // Western / Carpathian / Lviv / Stryi / Frankivsk Route
  if (text.includes('львів') || text.includes('стрий') || text.includes('франківськ') || text.includes('карпат') || text.includes('ужгород') || text.includes('яремче')) {
    return {
      name: 'Карпатський автошлях M-06',
      gradient: 'from-emerald-800 via-teal-900 to-slate-900',
      roadGradient: ['#34D399', '#38BDF8'],
      icon: 'mountain',
      roadNumber: 'M-06',
      skyColor: '#6EE7B7',
      badgeBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
    };
  }

  // Kyiv Metropolitan / Central Route
  if (text.includes('київ') || text.includes('біла церква') || text.includes('житомир') || text.includes('вінниц') || text.includes('умань')) {
    return {
      name: 'Центральна магістраль M-01 / M-05',
      gradient: 'from-blue-700 via-indigo-900 to-[#081B35]',
      roadGradient: ['#60A5FA', '#818CF8'],
      icon: 'city',
      roadNumber: 'M-05',
      skyColor: '#93C5FD',
      badgeBg: 'bg-blue-500/20 text-blue-200 border-blue-400/30'
    };
  }

  // Eastern / Steppes / Dnipro / Kharkiv
  if (text.includes('дніпро') || text.includes('харків') || text.includes('полтав') || text.includes('запоріж')) {
    return {
      name: 'Східний коридор M-03 / M-04',
      gradient: 'from-purple-800 via-indigo-950 to-slate-950',
      roadGradient: ['#A78BFA', '#F472B6'],
      icon: 'steppe',
      roadNumber: 'M-03',
      skyColor: '#DDD6FE',
      badgeBg: 'bg-purple-500/20 text-purple-200 border-purple-400/30'
    };
  }

  // Default Pan-Ukrainian Highway
  return {
    name: 'Автошлях України',
    gradient: 'from-blue-800 via-slate-900 to-indigo-950',
    roadGradient: ['#38BDF8', '#818CF8'],
    icon: 'forest',
    roadNumber: 'H-08',
    skyColor: '#BAE6FD',
    badgeBg: 'bg-blue-500/20 text-blue-200 border-blue-400/30'
  };
}

export const RouteCoverImage: React.FC<RouteCoverImageProps> = ({
  origin,
  destination,
  category: _category,
  className = 'w-full h-full',
  departureTime: _departureTime
}) => {
  const theme = getRouteTheme(origin, destination);

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${theme.gradient} select-none ${className}`}>
      {/* Decorative SVG Geometric Landscapes */}
      <svg
        className="absolute inset-0 w-full h-full opacity-60 mix-blend-overlay"
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={`grad-${theme.roadNumber}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.roadGradient[0]} />
            <stop offset="100%" stopColor={theme.roadGradient[1]} />
          </linearGradient>
        </defs>

        {/* Sun / Moon celestial disk */}
        <circle cx="280" cy="50" r="32" fill={theme.skyColor} opacity="0.35" />

        {/* Mountain or Hill contours */}
        {theme.icon === 'mountain' ? (
          <>
            <polygon points="20,180 90,80 160,180" fill="#064E3B" opacity="0.6" />
            <polygon points="120,190 220,60 320,190" fill="#047857" opacity="0.45" />
            <polygon points="260,190 340,100 420,190" fill="#064E3B" opacity="0.5" />
          </>
        ) : theme.icon === 'waves' ? (
          <>
            <path d="M 0 140 Q 100 110, 200 140 T 400 140 L 400 240 L 0 240 Z" fill="#0369A1" opacity="0.5" />
            <path d="M 0 170 Q 120 145, 240 170 T 400 170 L 400 240 L 0 240 Z" fill="#075985" opacity="0.6" />
          </>
        ) : (
          <>
            <path d="M 0 150 Q 150 110, 300 160 T 400 130 L 400 240 L 0 240 Z" fill="#1E293B" opacity="0.5" />
          </>
        )}

        {/* Highway Ribbon Path */}
        <path
          d="M 60 240 Q 180 180, 260 120 T 360 40"
          fill="none"
          stroke={`url(#grad-${theme.roadNumber})`}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 60 240 Q 180 180, 260 120 T 360 40"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.8"
        />
      </svg>

      {/* Atmospheric lighting effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30 pointer-events-none" />

      {/* Content Overlay */}
      <div className="absolute inset-0 p-3 flex flex-col justify-between text-white z-10">
        {/* Top Tag: Highway Badge */}
        <div className="flex items-center justify-between gap-1">
          <div className={`px-2 py-0.5 rounded-md text-[10px] font-black border backdrop-blur-md flex items-center gap-1 ${theme.badgeBg}`}>
            <Navigation className="w-2.5 h-2.5" />
            <span>{theme.roadNumber}</span>
          </div>

          <span className="text-[10px] text-white/80 font-bold bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-amber-300" />
            <span>Auto Art</span>
          </span>
        </div>

        {/* Bottom Title: Route text */}
        <div>
          <div className="text-[10px] font-bold text-sky-200 tracking-wide uppercase">
            {theme.name}
          </div>
          <div className="text-xs sm:text-sm font-black text-white leading-tight drop-shadow-md">
            {origin} ➔ {destination}
          </div>
        </div>
      </div>
    </div>
  );
};
