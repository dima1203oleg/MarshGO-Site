import { useEffect, useRef, useState } from 'react';
import type { Coordinate } from '../../shared/navigation/contracts';
import { mapTilesConfigured, resolveMapAssets } from './mapConfig';
import type { MapAdapter, MapStatus, MapTheme } from './MapAdapter';
import { getMapLayer, styleForLayer, subscribeMapLayer, type MapLayer } from './mapMode';
import { getTransportLayers, subscribeTransportLayers } from './transportLayers';
import { configuredMapStyleUrl } from './mapConfig';
import { themeService } from '../services/theme';

type Props = { route: Coordinate[]; vehicle?: Coordinate | null; heading?: number | null; theme?: MapTheme; /** Information layers are independent from the three base map modes. */ overlays?: boolean; onTransportHint?: (message: string | null) => void; onStatus: (status: MapStatus) => void; onAdapter: (adapter: MapAdapter | null) => void };
function themeForMapLayer(layer: MapLayer, dark: boolean): MapTheme {
  if (layer === 'simple') return dark ? 'MARSHGO_DARK' : 'MARSHGO_LIGHT';
  return dark ? 'MARSHGO_3D_DARK' : 'MARSHGO_3D_LIGHT';
}
export function MarshGoMap({ route, vehicle, heading = null, theme, overlays = false, onTransportHint, onStatus, onAdapter }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const adapter = useRef<MapAdapter | null>(null);
  const syncOverlays = useRef<() => void>(() => undefined);
  const [layer, setLayer] = useState<MapLayer>(getMapLayer());
  const [dark, setDark] = useState(themeService.isDark());
  const activeTheme = theme ?? themeForMapLayer(layer, dark);
  useEffect(() => subscribeMapLayer(setLayer), []);
  useEffect(() => themeService.subscribe((_mode, isDark) => setDark(isDark)), []);
  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    const initialLayer = getMapLayer();
    const initialTheme = theme ?? themeForMapLayer(initialLayer, themeService.isDark());
    void Promise.all([import('./MapLibreAdapter'), import('maplibre-gl/dist/maplibre-gl.css'), resolveMapAssets(initialTheme)]).then(([{ MapLibreAdapter }, _css, assets]) => {
      if (cancelled || !container.current) return;
      const initialStyle = initialLayer === 'satellite'
        ? styleForLayer(initialLayer, configuredMapStyleUrl, initialTheme.endsWith('_DARK')) ?? assets.style
        : assets.styles?.[initialTheme] ?? styleForLayer(initialLayer, configuredMapStyleUrl, initialTheme.endsWith('_DARK')) ?? assets.style;
      const instance = new MapLibreAdapter(container.current, initialStyle, onStatus, mapTilesConfigured(), assets.styles, initialTheme);
      instance.setLayer(initialLayer);
      adapter.current = instance; onAdapter(instance);
      instance.onTransportHint = (message) => onTransportHint?.(message);
      syncOverlays.current();
      instance.setRoute(route); if (vehicle) instance.setVehicle(vehicle); instance.fitRoute();
    }).catch(() => onStatus('failed'));
    return () => { cancelled = true; adapter.current?.destroy(); adapter.current = null; onAdapter(null); };
  }, []);
  useEffect(() => { adapter.current?.setRoute(route); }, [route]);
  useEffect(() => { if (vehicle) adapter.current?.setVehicle(vehicle, heading); }, [vehicle?.[0], vehicle?.[1], heading]);
  useEffect(() => { adapter.current?.setTheme(activeTheme); }, [activeTheme]);
  useEffect(() => subscribeMapLayer((layer) => adapter.current?.setLayer(layer)), []);
  // Information layers remain independent from the selected 2D/3D/satellite basemap.
  syncOverlays.current = () => adapter.current?.setTransportLayers(overlays ? getTransportLayers() : new Set());
  useEffect(() => { syncOverlays.current(); }, [overlays]);
  useEffect(() => subscribeMapLayer(() => syncOverlays.current()), []);
  useEffect(() => subscribeTransportLayers(() => syncOverlays.current()), []);
  return <div ref={container} className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_40%_40%,#dceeff,#eff6ff_45%,#d6e5f3)]" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-label="Карта маршруту MARSHGO" role="img" />;
}
