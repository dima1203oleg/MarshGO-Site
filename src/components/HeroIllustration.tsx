/**
 * Static, resolution-independent MARSHGO illustration: a car on the road, a glowing route and the fellow traveller waiting at the pickup.
 * Pure SVG (sharp on every screen density), sized by its container.
 */
export function HeroIllustration({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 420 320" role="img" aria-label="Автомобіль їде світним маршрутом до попутника, який чекає на посадку" className={className} preserveAspectRatio="xMidYMid meet">
    <defs>
      <radialGradient id="hi-sky" cx="50%" cy="38%" r="65%"><stop offset="0" stopColor="#E9F4FF"/><stop offset="1" stopColor="#E9F4FF" stopOpacity="0"/></radialGradient>
      <linearGradient id="hi-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#DCE7F5"/><stop offset="1" stopColor="#C9D8EC"/></linearGradient>
      <linearGradient id="hi-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5AB2FF"/><stop offset=".55" stopColor="#1E7BEA"/><stop offset="1" stopColor="#0F57C2"/></linearGradient>
      <linearGradient id="hi-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1467D6"/><stop offset="1" stopColor="#0B4AA8"/></linearGradient>
      <linearGradient id="hi-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F2F9FF"/><stop offset=".55" stopColor="#A9D3FA"/><stop offset="1" stopColor="#6FA9E6"/></linearGradient>
      <linearGradient id="hi-route" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#22D3EE"/><stop offset="1" stopColor="#3B82F6"/></linearGradient>
      <radialGradient id="hi-rim" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#F1F5F9"/><stop offset="1" stopColor="#94A3B8"/></radialGradient>
      <filter id="hi-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="hi-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>

    <ellipse cx="210" cy="150" rx="210" ry="150" fill="url(#hi-sky)"/>
    {/* faint city skyline */}
    <g fill="#D6E4F5" opacity=".8"><rect x="36" y="118" width="22" height="64" rx="3"/><rect x="62" y="98" width="18" height="84" rx="3"/><rect x="84" y="128" width="26" height="54" rx="3"/><rect x="330" y="108" width="20" height="74" rx="3"/><rect x="354" y="126" width="28" height="56" rx="3"/></g>
    <g fill="#C3D8EF"><circle cx="122" cy="168" r="14"/><rect x="120" y="170" width="4" height="16" rx="2"/><circle cx="318" cy="166" r="12"/><rect x="316" y="168" width="4" height="16" rx="2"/></g>

    {/* road */}
    <path d="M-10 318 L176 196 Q210 178 244 196 L430 318 Z" fill="url(#hi-road)"/>
    <path d="M-10 318 L176 196 Q210 178 244 196 L430 318" fill="none" stroke="#FFFFFF" strokeWidth="3" opacity=".9"/>
    <path d="M210 196 L210 318" stroke="#FFFFFF" strokeWidth="5" strokeDasharray="16 16" opacity=".85"/>

    {/* glowing route from the car to the pickup */}
    <path d="M250 246 C300 244 318 222 300 202 C286 186 322 178 338 160 C350 146 330 128 304 122" fill="none" stroke="#38BDF8" strokeOpacity=".35" strokeWidth="18" strokeLinecap="round" filter="url(#hi-blur)"/>
    <path d="M250 246 C300 244 318 222 300 202 C286 186 322 178 338 160 C350 146 330 128 304 122" fill="none" stroke="url(#hi-route)" strokeWidth="7" strokeLinecap="round" filter="url(#hi-glow)"/>
    <path d="M250 246 C300 244 318 222 300 202 C286 186 322 178 338 160 C350 146 330 128 304 122" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 10" opacity=".95"/>

    {/* destination pin */}
    <g transform="translate(148 74)"><ellipse cx="0" cy="40" rx="10" ry="3" fill="#0E1F35" opacity=".15"/><path d="M0 -24 C-12 -24 -20 -15 -20 -5 C-20 9 0 30 0 30 S20 9 20 -5 C20 -15 12 -24 0 -24Z" fill="#22C1EE"/><circle cx="0" cy="-6" r="7" fill="#FFFFFF"/></g>

    {/* "fellow traveller found" avatar bubble */}
    <g transform="translate(262 52)">
      <rect x="-30" y="-30" width="60" height="60" rx="18" fill="#2F8CF5"/><rect x="-30" y="-30" width="60" height="30" rx="18" fill="#FFFFFF" opacity=".12"/>
      <circle cx="0" cy="-6" r="11" fill="#FFFFFF"/><path d="M-17 22 C-14 7 14 7 17 22Z" fill="#FFFFFF"/><path d="M-11 -9 C-9 -21 9 -21 11 -9 C6 -14 -6 -14 -11 -9Z" fill="#23324A"/>
      <path d="M-7 30 L0 40 L7 30Z" fill="#2F8CF5"/>
      <g transform="translate(24 -24)"><circle r="10" fill="#22C55E" stroke="#FFFFFF" strokeWidth="3"/><path d="M-4 0 L-1 3 L5 -3" stroke="#FFFFFF" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></g>
    </g>

    {/* fellow traveller */}
    <g transform="translate(336 188)">
      <ellipse cx="2" cy="66" rx="30" ry="7" fill="#0E1F35" opacity=".14"/>
      <rect x="-13" y="18" width="11" height="46" rx="5" fill="#2B4E86"/><rect x="2" y="18" width="11" height="46" rx="5" fill="#23457A"/>
      <path d="M-13 62 h12 v4 h-14z M2 62 h12 v4 h-12z" fill="#0E1F35"/>
      <path d="M-17 -20 Q0 -28 17 -20 L19 22 Q0 28 -19 22 Z" fill="#8EC5FA"/><path d="M0 -24 L0 24" stroke="#6FAAE6" strokeWidth="2"/>
      <path d="M17 -12 Q32 -10 42 -2" stroke="#8EC5FA" strokeWidth="9" strokeLinecap="round" fill="none"/><circle cx="44" cy="-1" r="5" fill="#F2C9A5"/>
      <rect x="-27" y="-14" width="13" height="30" rx="4" fill="#2C4C8C"/>
      <circle cx="0" cy="-36" r="12.5" fill="#F2C9A5"/><path d="M-12.5 -38 C-11 -53 11 -53 12.5 -38 C7 -45 -7 -45 -12.5 -38Z" fill="#2A211C"/>
      <rect x="22" y="40" width="17" height="24" rx="4" fill="#C49A62"/><rect x="25.5" y="34" width="10" height="8" rx="3" fill="none" stroke="#8A6A3E" strokeWidth="2"/>
    </g>

    {/* car */}
    <g transform="translate(150 246)">
      <ellipse cx="6" cy="40" rx="118" ry="16" fill="#0E1F35" opacity=".18" filter="url(#hi-blur)"/>
      <path d="M-100 22 L-78 -10 L-36 -50 Q-20 -62 4 -60 L58 -50 Q92 -38 108 -6 L116 20 Q120 38 98 42 L-74 48 Q-106 44 -100 22Z" fill="url(#hi-body)"/>
      <path d="M-100 22 L-78 -10 L-58 -8 L-66 26Z" fill="url(#hi-side)"/>
      <path d="M-56 -8 L-24 -44 Q-12 -52 6 -51 L52 -42 Q74 -34 86 -10Z" fill="url(#hi-glass)"/>
      <path d="M-10 -50 L10 -9" stroke="#1563D0" strokeWidth="5"/>
      <path d="M-40 -34 L-8 -46" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity=".7"/>
      <path d="M-66 24 L100 42" stroke="#0B4AA8" strokeWidth="2" opacity=".5"/>
      <path d="M-90 4 Q10 -2 110 6" stroke="#FFFFFF" strokeWidth="2" opacity=".25" fill="none"/>
      <ellipse cx="108" cy="22" rx="8" ry="5.5" fill="#FFF7C2"/><ellipse cx="108" cy="22" rx="16" ry="10" fill="#FFF3A3" opacity=".25" filter="url(#hi-blur)"/>
      <rect x="18" y="-2" width="14" height="4" rx="2" fill="#0B4AA8" opacity=".6"/>
      <g><ellipse cx="-46" cy="44" rx="19" ry="21" fill="#0E1F35" transform="rotate(-12 -46 44)"/><ellipse cx="-46" cy="44" rx="10" ry="11" fill="url(#hi-rim)" transform="rotate(-12 -46 44)"/><circle cx="-46" cy="44" r="3" fill="#475569"/></g>
      <g><ellipse cx="70" cy="54" rx="19" ry="22" fill="#0E1F35" transform="rotate(-12 70 54)"/><ellipse cx="70" cy="54" rx="10" ry="11.5" fill="url(#hi-rim)" transform="rotate(-12 70 54)"/><circle cx="70" cy="54" r="3" fill="#475569"/></g>
    </g>
  </svg>;
}
