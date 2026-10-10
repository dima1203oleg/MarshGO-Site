/** Base map modes. Transit and micromobility are independent information layers, never a fourth map mode. */
export type MapLayer = 'simple' | 'threeD' | 'satellite';
export const mapLayers: Record<MapLayer, { label: string; pitch: number }> = {
  simple: { label: 'Простий 2D', pitch: 0 },
  threeD: { label: '3D', pitch: 52 },
  satellite: { label: 'Супутник', pitch: 0 },
};

const LAYER_KEY = 'mg_map_layer';
const layerListeners = new Set<(layer: MapLayer) => void>();
export function getMapLayer(): MapLayer {
  try {
    const saved = localStorage.getItem(LAYER_KEY);
    if (saved === 'simple' || saved === 'threeD' || saved === 'satellite') return saved;
    // Keep existing users' selected base layer through this taxonomy cleanup.
    if (saved === 'standard') return 'simple';
    if (saved === 'navigation') return 'threeD';
    if (saved === 'hybrid') return 'satellite';
  } catch { /* browser storage is optional */ }
  return 'simple';
}
export function setMapLayer(layer: MapLayer) {
  try { localStorage.setItem(LAYER_KEY, layer); } catch { /* mode still applies in memory */ }
  layerListeners.forEach((listener) => listener(layer));
}
export function subscribeMapLayer(listener: (layer: MapLayer) => void) { layerListeners.add(listener); return () => { layerListeners.delete(listener); }; }

// Imagery must come from the deployment's licensed provider. Never silently
// depend on a public vendor endpoint in a production bundle.
export const satelliteTiles = (import.meta.env?.VITE_MAP_SATELLITE_TILE_URL as string | undefined)?.trim() || undefined;
export const satelliteAttribution = (import.meta.env?.VITE_MAP_SATELLITE_ATTRIBUTION as string | undefined)?.trim() || undefined;

/** Satellite is a raster base; the active journey remains a normal vector overlay above it. */
export function styleForLayer(layer: MapLayer, configured: string | undefined, dark = false): string | import('maplibre-gl').StyleSpecification | null {
  void dark; // Satellite tint is applied on its raster layer while retaining vector roads and labels.
  return configured ?? null;
}
