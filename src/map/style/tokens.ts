import type { MapTheme } from '../MapAdapter';

export const mapStyleTokens: Record<MapTheme, { route: string; routeCasing: string; vehicle: string; pickup: string; dropoff: string; background: string }> = {
  MARSHGO_LIGHT: { route: '#0878F9', routeCasing: '#FFFFFF', vehicle: '#0878F9', pickup: '#10A66A', dropoff: '#E5484D', background: '#EEF3F8' },
  MARSHGO_DARK: { route: '#4B9CFF', routeCasing: '#111827', vehicle: '#4B9CFF', pickup: '#23C98A', dropoff: '#FF6671', background: '#111827' },
  MARSHGO_NAVIGATION_LIGHT: { route: '#0878F9', routeCasing: '#FFFFFF', vehicle: '#0563DB', pickup: '#10A66A', dropoff: '#E5484D', background: '#E7EEF6' },
  MARSHGO_NAVIGATION_DARK: { route: '#57A5FF', routeCasing: '#0B1420', vehicle: '#76B4FF', pickup: '#35D69A', dropoff: '#FF6A75', background: '#0B1420' },
};
