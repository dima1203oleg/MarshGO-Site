/** The two basemaps are independent from camera perspective and transport overlays. */
export type MapLayer = 'simple' | 'satellite';
export type MapPerspective = '2d' | '3d';
export const mapLayers: Record<MapLayer, { label: string }> = {
  simple: { label: 'Схема' },
  satellite: { label: 'Супутник' },
};
export const PERSPECTIVE_PITCH = 52;

const LAYER_KEY = 'mg_map_layer';
const PERSPECTIVE_KEY = 'mg_map_perspective';
const layerListeners = new Set<(layer: MapLayer) => void>();
const perspectiveListeners = new Set<(perspective: MapPerspective) => void>();
export function getMapLayer(): MapLayer {
  try {
    const saved = localStorage.getItem(LAYER_KEY);
    if (saved === 'simple' || saved === 'satellite') return saved;
    // Keep existing users' selected base layer through this taxonomy cleanup.
    if (saved === 'standard' || saved === 'threeD' || saved === 'navigation') return 'simple';
    if (saved === 'hybrid') return 'satellite';
  } catch { /* browser storage is optional */ }
  return 'simple';
}
export function getMapPerspective(): MapPerspective {
  try {
    const saved = localStorage.getItem(PERSPECTIVE_KEY);
    if (saved === '2d' || saved === '3d') return saved;
    // Migrate the old combined "3D map" selection into the independent camera state.
    const legacyLayer = localStorage.getItem(LAYER_KEY);
    if (legacyLayer === 'threeD' || legacyLayer === 'navigation') return '3d';
  } catch { /* browser storage is optional */ }
  return '2d';
}
export function setMapLayer(layer: MapLayer) {
  try { localStorage.setItem(LAYER_KEY, layer); } catch { /* mode still applies in memory */ }
  layerListeners.forEach((listener) => listener(layer));
}
export function setMapPerspective(perspective: MapPerspective) {
  try { localStorage.setItem(PERSPECTIVE_KEY, perspective); } catch { /* mode still applies in memory */ }
  perspectiveListeners.forEach((listener) => listener(perspective));
}
export function subscribeMapLayer(listener: (layer: MapLayer) => void) { layerListeners.add(listener); return () => { layerListeners.delete(listener); }; }
export function subscribeMapPerspective(listener: (perspective: MapPerspective) => void) { perspectiveListeners.add(listener); return () => { perspectiveListeners.delete(listener); }; }

// Imagery must come from the deployment's licensed provider. Never silently
// depend on a public vendor endpoint in a production bundle.
export const satelliteTiles = (import.meta.env?.VITE_MAP_SATELLITE_TILE_URL as string | undefined)?.trim() || undefined;
export const satelliteAttribution = (import.meta.env?.VITE_MAP_SATELLITE_ATTRIBUTION as string | undefined)?.trim() || undefined;

export function isBasemapConfigured(layer: MapLayer, schemeConfigured: boolean, satelliteConfigured = Boolean(satelliteTiles && satelliteAttribution)): boolean {
  return layer === 'satellite' ? satelliteConfigured : schemeConfigured;
}

/** Satellite is a raster base; the active journey remains a normal vector overlay above it. */
export function styleForLayer(layer: MapLayer, configured: string | undefined, dark = false): string | import('maplibre-gl').StyleSpecification | null {
  void dark; // Satellite tint is applied on its raster layer while retaining vector roads and labels.
  return configured ?? null;
}
