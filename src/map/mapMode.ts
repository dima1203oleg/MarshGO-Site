/** The two basemaps are independent from camera perspective and transport overlays. */
export type MapLayer = 'simple' | 'satellite';
export type MapPerspective = '2d' | '3d';
export const mapLayers: Record<MapLayer, { label: string }> = {
  simple: { label: 'Схема' },
  satellite: { label: 'Супутник' },
};
export const PERSPECTIVE_PITCH = 52;

// Imagery must come from the deployment's licensed provider. A build with no
// VITE_MAP_SATELLITE_TILE_URL keeps the toggle honestly disabled instead of quietly
// spending a third party's licensed imagery from inside the bundle. The workspace `.env`
// declares the provider; `scripts/with-map-env.mjs` and the worktree-aware `envDir` in
// vite.config.ts are what deliver it to the build.
export const satelliteTiles = (import.meta.env?.VITE_MAP_SATELLITE_TILE_URL as string | undefined)?.trim() || undefined;
export const satelliteAttribution = (import.meta.env?.VITE_MAP_SATELLITE_ATTRIBUTION as string | undefined)?.trim() || undefined;

/** Single source of truth for «this build can actually show satellite imagery».
 *  Every satellite control must read it: promising a basemap we cannot fetch is a
 *  false-success UI, and the passenger should get the plain reason, not a dead button. */
export const satelliteBasemapAvailable = Boolean(satelliteTiles && satelliteAttribution);
export const SATELLITE_UNAVAILABLE_NOTE = 'Супутникові знімки не підключені.';

const LAYER_KEY = 'mg_map_layer';
const PERSPECTIVE_KEY = 'mg_map_perspective';
const layerListeners = new Set<(layer: MapLayer) => void>();
const perspectiveListeners = new Set<(perspective: MapPerspective) => void>();

/** Satellite selections are dropped when the deployment has no imagery source,
 *  including values stored by an earlier session on a differently configured build. */
function honorLayerAvailability(layer: MapLayer): MapLayer {
  return layer === 'satellite' && !satelliteBasemapAvailable ? 'simple' : layer;
}

export function getMapLayer(): MapLayer {
  try {
    const saved = localStorage.getItem(LAYER_KEY);
    // A saved 'satellite' from an environment with no licensed imagery would paint an empty
    // background, so the stored preference is honoured only where the base map exists. The
    // refusal is written back once, so a later read cannot disagree with this one.
    const resolved = saved === 'simple' || saved === 'satellite'
      ? honorLayerAvailability(saved)
      : (saved === 'standard' || saved === 'threeD' || saved === 'navigation')
        ? 'simple'
        : saved === 'hybrid' ? honorLayerAvailability('satellite') : null;
    if (resolved !== null) {
      if (resolved !== saved) { try { localStorage.setItem(LAYER_KEY, resolved); } catch { /* read-only storage */ } }
      return resolved;
    }
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
  const next = honorLayerAvailability(layer);
  try { localStorage.setItem(LAYER_KEY, next); } catch { /* mode still applies in memory */ }
  layerListeners.forEach((listener) => listener(next));
}
export function setMapPerspective(perspective: MapPerspective) {
  try { localStorage.setItem(PERSPECTIVE_KEY, perspective); } catch { /* mode still applies in memory */ }
  perspectiveListeners.forEach((listener) => listener(perspective));
}
export function subscribeMapLayer(listener: (layer: MapLayer) => void) { layerListeners.add(listener); return () => { layerListeners.delete(listener); }; }
export function subscribeMapPerspective(listener: (perspective: MapPerspective) => void) { perspectiveListeners.add(listener); return () => { perspectiveListeners.delete(listener); }; }

export function isBasemapConfigured(layer: MapLayer, schemeConfigured: boolean, satelliteReady = satelliteBasemapAvailable): boolean {
  return layer === 'satellite' ? satelliteReady : schemeConfigured;
}

/** Satellite is a raster base; the active journey remains a normal vector overlay above it. */
export function styleForLayer(layer: MapLayer, configured: string | undefined, dark = false, darkConfigured?: string): string | import('maplibre-gl').StyleSpecification | null {
  void layer;
  if (dark && darkConfigured) return darkConfigured;
  return configured ?? null;
}
