import type { StyleSpecification } from 'maplibre-gl';
import type { MapTheme } from './MapAdapter';
import { buildFallbackStyle } from './style/buildStyle';
import { parseMapAssetManifest } from './style/manifest';

const styleUrl = (import.meta.env.VITE_MAP_STYLE_URL as string | undefined)?.trim();
const tileUrl = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim();
const attribution = (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined)?.trim() || '© OpenStreetMap contributors';
const manifestUrl = (import.meta.env.VITE_MAP_STYLE_MANIFEST_URL as string | undefined)?.trim();

export const configuredMapStyleUrl = styleUrl || undefined;
export const mapAttribution = attribution;

/** Prefer the versioned MARSHGO style manifest. Raster URL remains a compatibility path for owned tile services. */
export function createFallbackMapStyle(): StyleSpecification {
  return buildFallbackStyle('MARSHGO_LIGHT', tileUrl, attribution);
}

export function mapTilesConfigured(): boolean { return Boolean(manifestUrl || styleUrl || tileUrl); }

export async function resolveMapAssets(theme: MapTheme) {
  if (manifestUrl) {
    const response = await fetch(manifestUrl, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('MAP_MANIFEST_UNAVAILABLE');
    const manifest = parseMapAssetManifest(await response.json());
    const style = manifest.styles[theme];
    if (!style) throw new Error('MAP_STYLE_MISSING');
    return { style, styles: manifest.styles, mapDataVersion: manifest.mapDataVersion, styleVersion: manifest.styleVersion };
  }
  return { style: styleUrl || createFallbackMapStyle(), styles: undefined, mapDataVersion: undefined, styleVersion: undefined };
}
