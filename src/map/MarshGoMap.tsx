import { useEffect, useRef } from 'react';
import type { Coordinate } from '../../shared/navigation/contracts';
import { mapTilesConfigured, resolveMapAssets } from './mapConfig';
import type { MapAdapter, MapStatus, MapTheme } from './MapAdapter';
import { getMapLayer, getMapMode, styleForLayer, subscribeMapLayer, subscribeMapMode, type MapLayer } from './mapMode';
import { getTransportLayers, subscribeTransportLayers } from './transportLayers';
import { configuredMapStyleUrl } from './mapConfig';

type Props = { route: Coordinate[]; vehicle?: Coordinate | null; heading?: number | null; theme?: MapTheme; /** 2D information layers (metro, buses, bikes, ...). Off for navigation, which keeps a clean map. */ overlays?: boolean; onTransportHint?: (message: string | null) => void; onStatus: (status: MapStatus) => void; onAdapter: (adapter: MapAdapter | null) => void };
export function MarshGoMap({ route, vehicle, heading = null, theme = 'MARSHGO_NAVIGATION_LIGHT', overlays = false, onTransportHint, onStatus, onAdapter }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const adapter = useRef<MapAdapter | null>(null);
  const syncOverlays = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    void Promise.all([import('./MapLibreAdapter'), import('maplibre-gl/dist/maplibre-gl.css'), resolveMapAssets(theme)]).then(([{ MapLibreAdapter }, _css, assets]) => {
      if (cancelled || !container.current) return;
      const initialMode = getMapMode();
      const initialLayer = getMapLayer();
      const instance = new MapLibreAdapter(container.current, styleForLayer(initialLayer, initialMode, configuredMapStyleUrl) ?? assets.style, onStatus, mapTilesConfigured(), assets.styles, theme);
      instance.setMode(initialMode);
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
  useEffect(() => { adapter.current?.setTheme(theme); }, [theme]);
  useEffect(() => subscribeMapMode((mode) => adapter.current?.setMode(mode)), []);
  useEffect(() => subscribeMapLayer((layer) => adapter.current?.setLayer(layer)), []);
  // Information layers exist only on the 2D map and only while the user keeps them switched on.
  const layerRef = useRef<MapLayer>(getMapLayer());
  syncOverlays.current = () => adapter.current?.setTransportLayers(overlays && layerRef.current === 'standard' ? getTransportLayers() : new Set());
  useEffect(() => { syncOverlays.current(); }, [overlays]);
  useEffect(() => subscribeMapLayer((layer) => { layerRef.current = layer; syncOverlays.current(); }), []);
  useEffect(() => subscribeTransportLayers(() => syncOverlays.current()), []);
  return <div ref={container} className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_40%_40%,#dceeff,#eff6ff_45%,#d6e5f3)]" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-label="Карта маршруту MARSHGO" role="img" />;
}
