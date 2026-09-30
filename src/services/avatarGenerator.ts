/**
 * Procedural SVG Avatar Generator
 * Generates unique stylized profile avatars for users without custom photos.
 */

export interface AvatarOptions {
  palette?: string; // 'blue' | 'emerald' | 'amber' | 'purple' | 'sunset' | 'ukraine';
  accessory?: 'none' | 'glasses' | 'headphones' | 'cap' | 'sunglasses';
  expression?: 'smile' | 'cool' | 'wink' | 'friendly';
  seed?: string;
}

const PALETTES: Record<string, { bg1: string; bg2: string; skin: string; hair: string; accent: string }> = {
  blue: {
    bg1: '#1E3A8A',
    bg2: '#3B82F6',
    skin: '#FED7AA',
    hair: '#1E293B',
    accent: '#60A5FA'
  },
  emerald: {
    bg1: '#064E3B',
    bg2: '#10B981',
    skin: '#FFEDD5',
    hair: '#78350F',
    accent: '#34D399'
  },
  amber: {
    bg1: '#78350F',
    bg2: '#F59E0B',
    skin: '#FDE68A',
    hair: '#451A03',
    accent: '#FBBF24'
  },
  purple: {
    bg1: '#4C1D95',
    bg2: '#8B5CF6',
    skin: '#FED7AA',
    hair: '#312E81',
    accent: '#A78BFA'
  },
  sunset: {
    bg1: '#991B1B',
    bg2: '#F97316',
    skin: '#FFEDD5',
    hair: '#1F2937',
    accent: '#FB923C'
  },
  ukraine: {
    bg1: '#0A4074',
    bg2: '#E5A912',
    skin: '#FED7AA',
    hair: '#0F172A',
    accent: '#FFD700'
  }
};

const PALETTE_KEYS = Object.keys(PALETTES);
const ACCESSORIES: AvatarOptions['accessory'][] = ['none', 'glasses', 'headphones', 'sunglasses', 'cap'];
const EXPRESSIONS: AvatarOptions['expression'][] = ['smile', 'cool', 'wink', 'friendly'];

/** Simple string hash to deterministic number */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generate a complete SVG data-URI avatar
 */
export function generateAvatarSvg(seed: string = 'marshgo_user', customOpts?: AvatarOptions): string {
  const h = hashString(seed);

  const paletteKey = customOpts?.palette || PALETTE_KEYS[h % PALETTE_KEYS.length];
  const accessory = customOpts?.accessory || ACCESSORIES[(h >> 2) % ACCESSORIES.length];
  const expression = customOpts?.expression || EXPRESSIONS[(h >> 4) % EXPRESSIONS.length];

  const p = PALETTES[paletteKey] || PALETTES.blue;
  const initials = seed
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'MG';

  // Hair style: 0 = short/neat, 1 = modern crop, 2 = wavy, 3 = cap
  const hairStyle = (h >> 3) % 4;

  const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.bg1}" />
      <stop offset="100%" stop-color="${p.bg2}" />
    </linearGradient>
    <linearGradient id="jacketGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${p.accent}" />
      <stop offset="100%" stop-color="${p.bg1}" />
    </linearGradient>
  </defs>

  <!-- Background Circle -->
  <circle cx="60" cy="60" r="60" fill="url(#bgGrad)" />

  <!-- Background decorative ring -->
  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" />

  <!-- Body / Shoulders -->
  <path d="M 22 120 Q 22 96 38 90 L 60 96 L 82 90 Q 98 96 98 120 Z" fill="url(#jacketGrad)" />
  <path d="M 45 92 L 60 108 L 75 92 Z" fill="#FFFFFF" opacity="0.9" />

  <!-- Neck -->
  <rect x="52" y="74" width="16" height="20" rx="4" fill="${p.skin}" />

  <!-- Head Base -->
  <ellipse cx="60" cy="58" rx="24" ry="28" fill="${p.skin}" />

  <!-- Ears -->
  <circle cx="36" cy="59" r="6" fill="${p.skin}" />
  <circle cx="84" cy="59" r="6" fill="${p.skin}" />

  <!-- Hair Styles -->
  ${
    hairStyle === 0
      ? `<path d="M 36 50 Q 36 30 60 28 Q 84 30 84 50 Q 75 36 60 38 Q 45 36 36 50 Z" fill="${p.hair}" />`
      : hairStyle === 1
      ? `<path d="M 34 52 C 34 26 86 26 86 52 C 78 32 68 34 60 34 C 48 34 40 38 34 52 Z" fill="${p.hair}" />`
      : hairStyle === 2
      ? `<path d="M 34 54 Q 32 26 60 24 Q 88 26 86 54 Q 78 30 60 32 Q 42 30 34 54 Z" fill="${p.hair}" />`
      : `<path d="M 32 46 Q 36 28 60 26 Q 84 28 88 46 L 94 48 L 26 48 Z" fill="${p.accent}" />`
  }

  <!-- Eyes -->
  ${
    expression === 'wink'
      ? `
      <circle cx="50" cy="58" r="3" fill="#0F172A" />
      <path d="M 67 58 Q 72 54 75 58" fill="none" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" />
    `
      : accessory === 'sunglasses'
      ? ''
      : `
      <circle cx="50" cy="58" r="3" fill="#0F172A" />
      <circle cx="70" cy="58" r="3" fill="#0F172A" />
      <circle cx="51" cy="57" r="1" fill="#FFFFFF" />
      <circle cx="71" cy="57" r="1" fill="#FFFFFF" />
    `
  }

  <!-- Eyebrows -->
  <path d="M 44 51 Q 50 49 55 52" fill="none" stroke="${p.hair}" stroke-width="2" stroke-linecap="round" />
  <path d="M 65 52 Q 70 49 76 51" fill="none" stroke="${p.hair}" stroke-width="2" stroke-linecap="round" />

  <!-- Nose -->
  <path d="M 60 59 L 58 65 L 62 65" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

  <!-- Mouth -->
  ${
    expression === 'smile' || expression === 'friendly'
      ? `<path d="M 52 70 Q 60 78 68 70" fill="none" stroke="#991B1B" stroke-width="2.5" stroke-linecap="round" />`
      : expression === 'cool'
      ? `<path d="M 53 71 Q 60 74 67 69" fill="none" stroke="#991B1B" stroke-width="2.5" stroke-linecap="round" />`
      : `<path d="M 54 70 Q 60 76 66 70" fill="none" stroke="#991B1B" stroke-width="2.5" stroke-linecap="round" />`
  }

  <!-- Accessories -->
  ${
    accessory === 'glasses'
      ? `
      <circle cx="49" cy="58" r="9" fill="none" stroke="#0F172A" stroke-width="2.5" />
      <circle cx="71" cy="58" r="9" fill="none" stroke="#0F172A" stroke-width="2.5" />
      <line x1="58" y1="58" x2="62" y2="58" stroke="#0F172A" stroke-width="2.5" />
    `
      : accessory === 'sunglasses'
      ? `
      <path d="M 40 54 L 58 54 L 56 65 Q 48 67 42 62 Z" fill="#0F172A" />
      <path d="M 62 54 L 80 54 L 78 62 Q 72 67 64 65 Z" fill="#0F172A" />
      <line x1="57" y1="55" x2="63" y2="55" stroke="#0F172A" stroke-width="3" />
      <line x1="41" y1="55" x2="35" y2="58" stroke="#0F172A" stroke-width="2" />
      <line x1="79" y1="55" x2="85" y2="58" stroke="#0F172A" stroke-width="2" />
    `
      : accessory === 'headphones'
      ? `
      <path d="M 32 58 C 32 32 88 32 88 58" fill="none" stroke="${p.accent}" stroke-width="4" stroke-linecap="round" />
      <rect x="30" y="52" width="8" height="16" rx="4" fill="#0F172A" />
      <rect x="82" y="52" width="8" height="16" rx="4" fill="#0F172A" />
    `
      : ''
  }

  <!-- Travel / Marshgo Badge on corner -->
  <g transform="translate(86, 86)">
    <circle cx="12" cy="12" r="12" fill="#1769F4" stroke="#FFFFFF" stroke-width="2" />
    <path d="M 8 12 L 11 15 L 17 9" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </g>
</svg>
`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
}

/** Pre-designed curated avatar collection for instant selection */
export interface CuratedAvatar {
  id: string;
  title: string;
  category: string;
  palette: AvatarOptions['palette'];
  accessory: AvatarOptions['accessory'];
  expression: AvatarOptions['expression'];
  svgDataUri: string;
}

export const PRESET_AVATARS: CuratedAvatar[] = [
  {
    id: 'av_explorer',
    title: 'Мандрівник',
    category: 'Traveler',
    palette: 'blue',
    accessory: 'sunglasses',
    expression: 'cool',
    svgDataUri: generateAvatarSvg('explorer_ua', { palette: 'blue', accessory: 'sunglasses', expression: 'cool' })
  },
  {
    id: 'av_music',
    title: 'Меломан',
    category: 'Urban',
    palette: 'emerald',
    accessory: 'headphones',
    expression: 'smile',
    svgDataUri: generateAvatarSvg('music_trip', { palette: 'emerald', accessory: 'headphones', expression: 'smile' })
  },
  {
    id: 'av_pro',
    title: 'PRO Водій',
    category: 'Driver',
    palette: 'ukraine',
    accessory: 'sunglasses',
    expression: 'friendly',
    svgDataUri: generateAvatarSvg('pro_driver', { palette: 'ukraine', accessory: 'sunglasses', expression: 'friendly' })
  },
  {
    id: 'av_smart',
    title: 'Інтелектуал',
    category: 'Student',
    palette: 'purple',
    accessory: 'glasses',
    expression: 'smile',
    svgDataUri: generateAvatarSvg('smart_commute', { palette: 'purple', accessory: 'glasses', expression: 'smile' })
  },
  {
    id: 'av_active',
    title: 'Попутниця',
    category: 'Explorer',
    palette: 'sunset',
    accessory: 'none',
    expression: 'wink',
    svgDataUri: generateAvatarSvg('sunny_road', { palette: 'sunset', accessory: 'none', expression: 'wink' })
  },
  {
    id: 'av_fast',
    title: 'Драйвер',
    category: 'Speed',
    palette: 'amber',
    accessory: 'cap',
    expression: 'friendly',
    svgDataUri: generateAvatarSvg('speed_driver', { palette: 'amber', accessory: 'cap', expression: 'friendly' })
  }
];
