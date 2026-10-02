import type { StyleSpecification } from 'maplibre-gl';
import type { MapTheme } from '../MapAdapter';
import { mapStyleTokens } from './tokens';

export function buildFallbackStyle(theme: MapTheme, tileUrl?: string, attribution = '© OpenStreetMap contributors'): StyleSpecification {
  const tokens = mapStyleTokens[theme];
  return {
    version: 8,
    name: theme.replaceAll('_', ' '),
    sources: tileUrl ? { 'marshgo-basemap': { type: 'raster', tiles: [tileUrl], tileSize: 256, attribution } } : {},
    layers: [
      { id: 'marshgo-background', type: 'background', paint: { 'background-color': tokens.background } },
      ...(tileUrl ? [{ id: 'marshgo-basemap', type: 'raster' as const, source: 'marshgo-basemap' }] : []),
    ],
  };
}
