/** Three navigation map looks. Style swaps only apply to the OpenFreeMap vector styles; other providers keep their own style. */
export type MapMode = 'google' | 'apple' | 'waze';
export const mapModes: Record<MapMode, { label: string; styleName: string; route: string; casing: string; pitch: number; width: number }> = {
  google: { label: 'Google', styleName: 'bright', route: '#4285F4', casing: '#FFFFFF', pitch: 0, width: 1 },
  apple: { label: 'Apple', styleName: 'liberty', route: '#0A84FF', casing: '#FFFFFF', pitch: 55, width: 1.25 },
  waze: { label: 'Waze', styleName: 'positron', route: '#7B61FF', casing: '#1B1340', pitch: 0, width: 1.15 },
};

const KEY = 'mg_map_mode';
const OPENFREEMAP = 'https://tiles.openfreemap.org/styles/';
const listeners = new Set<(mode: MapMode) => void>();

export function getMapMode(): MapMode {
  try { const saved = localStorage.getItem(KEY); if (saved === 'google' || saved === 'apple' || saved === 'waze') return saved; } catch { /* storage unavailable */ }
  return 'google';
}
export function setMapMode(mode: MapMode) {
  try { localStorage.setItem(KEY, mode); } catch { /* mode still applies in memory */ }
  listeners.forEach((listener) => listener(mode));
}
export function subscribeMapMode(listener: (mode: MapMode) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
/** Style URL for the mode, or null when the configured style is not an OpenFreeMap one. */
export function styleUrlForMode(mode: MapMode, configured: string | undefined): string | null {
  return configured?.startsWith(OPENFREEMAP) ? `${OPENFREEMAP}${mapModes[mode].styleName}` : null;
}

/** Four map layers: schematic map, 3D navigation, satellite hybrid and a rail/tram/metro overlay. */
export type MapLayer = 'standard' | 'navigation' | 'hybrid' | 'transit';
export const mapLayers: Record<MapLayer, { label: string; pitch: number }> = {
  standard: { label: 'Карта', pitch: 0 },
  navigation: { label: 'Навігація', pitch: 60 },
  hybrid: { label: 'Супутник', pitch: 0 },
  transit: { label: 'Транзит', pitch: 0 },
};
export const satelliteTiles = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const satelliteAttribution = 'Imagery © Esri, Maxar, Earthstar Geographics';
/** Rail/tram/metro raster tiles from a source you are licensed to use (self-hosted OpenRailwayMap, a transit provider, ...). Unset = layer unavailable. */
const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const transitTemplate = viteEnv.VITE_TRANSIT_TILE_URL?.trim();
export const transitTiles: string[] = transitTemplate ? [transitTemplate] : [];
export const transitAttribution = viteEnv.VITE_TRANSIT_TILE_ATTRIBUTION?.trim() || 'Transit data © OpenStreetMap contributors';
export const transitConfigured = transitTiles.length > 0;

const LAYER_KEY = 'mg_map_layer';
const layerListeners = new Set<(layer: MapLayer) => void>();
export function getMapLayer(): MapLayer {
  try { const saved = localStorage.getItem(LAYER_KEY); if (saved === 'standard' || saved === 'navigation' || saved === 'hybrid' || saved === 'transit') return saved; } catch { /* storage unavailable */ }
  return 'standard';
}
export function setMapLayer(layer: MapLayer) {
  try { localStorage.setItem(LAYER_KEY, layer); } catch { /* layer still applies in memory */ }
  layerListeners.forEach((listener) => listener(layer));
}
export function subscribeMapLayer(listener: (layer: MapLayer) => void) { layerListeners.add(listener); return () => { layerListeners.delete(listener); }; }
/** Style for a layer: 3D navigation always uses the building-extruding vector style; hybrid is a raster satellite style. */
export function styleForLayer(layer: MapLayer, mode: MapMode, configured: string | undefined): string | import('maplibre-gl').StyleSpecification | null {
  if (layer === 'hybrid') return { version: 8, sources: { satellite: { type: 'raster', tiles: [satelliteTiles], tileSize: 256, maxzoom: 19, attribution: satelliteAttribution } }, layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }] };
  if (layer === 'navigation' && configured?.startsWith(OPENFREEMAP)) return `${OPENFREEMAP}liberty`;
  return styleUrlForMode(mode, configured);
}
