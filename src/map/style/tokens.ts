import type { MapTheme } from '../MapAdapter';

export const mapStyleTokens: Record<MapTheme, { route: string; routeCasing: string; vehicle: string; pickup: string; dropoff: string; background: string }> = {
  MARSHGO_LIGHT: { route: '#0878F9', routeCasing: '#FFFFFF', vehicle: '#0878F9', pickup: '#10A66A', dropoff: '#E5484D', background: '#EEF3F8' },
  MARSHGO_DARK: { route: '#4B9CFF', routeCasing: '#111827', vehicle: '#4B9CFF', pickup: '#23C98A', dropoff: '#FF6671', background: '#111827' },
};
