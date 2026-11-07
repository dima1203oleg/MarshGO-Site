import type { MapTheme } from '../MapAdapter';

export const mapStyleTokens: Record<MapTheme, { route: string; routeCasing: string; vehicle: string; pickup: string; dropoff: string; background: string }> = {
  MARSHGO_LIGHT: { route: '#155E95', routeCasing: '#F2F7FB', vehicle: '#155E95', pickup: '#16845C', dropoff: '#BE3440', background: '#F2F7FB' },
  MARSHGO_DARK: { route: '#71C7F2', routeCasing: '#071521', vehicle: '#71C7F2', pickup: '#2CD67D', dropoff: '#FF7A89', background: '#071521' },
};
