import type { MapTheme } from '../MapAdapter';

const LIGHT: MapTheme = 'MARSHGO_LIGHT';
const DARK: MapTheme = 'MARSHGO_DARK';

/**
 * One style URL cannot serve both themes: the dark UI would sit on a light
 * basemap, which is what a single `VITE_MAP_STYLE_URL` produced. A deployment
 * declares the dark palette of the same provider separately.
 */
export function themeStyleUrls(styleUrl?: string, darkStyleUrl?: string): Partial<Record<MapTheme, string>> | undefined {
  if (!styleUrl && !darkStyleUrl) return undefined;
  return { [LIGHT]: styleUrl ?? darkStyleUrl, [DARK]: darkStyleUrl ?? styleUrl };
}
