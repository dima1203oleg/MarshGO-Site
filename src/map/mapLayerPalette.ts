import type { TransportLayerId } from './transportLayers';

/**
 * Small, high-contrast pictogram palette used by the map layer sheet.
 * Keep this independent from route-line colors: the layer sheet is a category
 * legend and follows the approved map-layer mockup, while journey colors retain
 * their own semantic palette.
 */
const layerBadgeColors: Partial<Record<TransportLayerId, string>> = {
  BUS: '#1687FF',
  MINIBUS: '#F5B51B',
  TROLLEYBUS: '#16A34A',
  TRAIN: '#F43F5E',
  TRAM: '#F97316',
  BICYCLE: '#06A6D8',
  METRO: '#8B20F8',
  SCOOTER: '#16A34A',
  CARPOOL: '#4B5563',
  CARSHARING: '#F97316',
  TAXI: '#7C3AED',
  TRANSFER: '#172434',
};

export function mapLayerBadgeColor(id: TransportLayerId, fallback: string): string {
  return layerBadgeColors[id] ?? fallback;
}
