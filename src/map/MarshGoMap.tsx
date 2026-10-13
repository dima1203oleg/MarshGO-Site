import { useEffect, useRef, useState } from 'react';
import type { Coordinate } from '../../shared/navigation/contracts';
import { mapTilesConfigured, resolveMapAssets } from './mapConfig';
import type { ColoredRouteSegment, MapAdapter, MapStatus, MapTheme, RouteFitPadding } from './MapAdapter';
import { getMapLayer, styleForLayer, subscribeMapLayer, type MapLayer } from './mapMode';
import { getTransportLayers, subscribeTransportLayers } from './transportLayers';
import { configuredMapStyleUrl } from './mapConfig';
import { themeService } from '../services/theme';

type Props = { route: Coordinate[]; routeSegments?: ColoredRouteSegment[]; routeWaypoints?: Array<{ coordinate: Coordinate; kind: string }>; routeFitPadding?: RouteFitPadding; activeRouteSegmentId?: string | null; onRouteSegmentSelect?: (id: string) => void; vehicle?: Coordinate | null; heading?: number | null; theme?: MapTheme; /** Information layers are independent from the three base map modes. */ overlays?: boolean; onTransportHint?: (message: string | null) => void; onStatus: (status: MapStatus) => void; onAdapter: (adapter: MapAdapter | null) => void };
function themeForMapLayer(layer: MapLayer, dark: boolean): MapTheme {
  if (layer === 'simple') return dark ? 'MARSHGO_DARK' : 'MARSHGO_LIGHT';
  return dark ? 'MARSHGO_3D_DARK' : 'MARSHGO_3D_LIGHT';
}
export function MarshGoMap({ route, routeSegments, routeWaypoints, routeFitPadding, activeRouteSegmentId = null, onRouteSegmentSelect, vehicle, heading = null, theme, overlays = false, onTransportHint, onStatus, onAdapter }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const adapter = useRef<MapAdapter | null>(null);
  const syncOverlays = useRef<() => void>(() => undefined);
  const routeSegmentSelect = useRef(onRouteSegmentSelect);
  const activeSegment = useRef(activeRouteSegmentId);
  const fitPadding = useRef(routeFitPadding);
  const routeRef = useRef(route);
  const routeSegmentsRef = useRef(routeSegments);
  const waypointsRef = useRef(routeWaypoints);
  const vehicleRef = useRef(vehicle);
  const headingRef = useRef(heading);
  routeSegmentSelect.current = onRouteSegmentSelect;
  activeSegment.current = activeRouteSegmentId;
  fitPadding.current = routeFitPadding;
  routeRef.current = route;
  routeSegmentsRef.current = routeSegments;
  waypointsRef.current = routeWaypoints;
  vehicleRef.current = vehicle;
  headingRef.current = heading;
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
      adapter.current = instance; instance.onRouteSegmentSelect = (id) => routeSegmentSelect.current?.(id); onAdapter(instance);
      instance.onTransportHint = (message) => onTransportHint?.(message);
      syncOverlays.current();
      const latestRouteSegments = routeSegmentsRef.current;
      if (latestRouteSegments?.length) instance.setRouteSegments(latestRouteSegments); else instance.setRoute(routeRef.current);
      if (waypointsRef.current) instance.setWaypoints(waypointsRef.current);
      if (vehicleRef.current) instance.setVehicle(vehicleRef.current, headingRef.current);
      const selectedSegmentId = activeSegment.current;
      instance.setActiveRouteSegment?.(selectedSegmentId);
      if (!selectedSegmentId || !instance.focusRouteSegment?.(selectedSegmentId, fitPadding.current)) instance.fitRoute(fitPadding.current);
    }).catch(() => onStatus('failed'));
    return () => { cancelled = true; adapter.current?.destroy(); adapter.current = null; onAdapter(null); };
  }, []);
  useEffect(() => { if (routeSegments?.length) adapter.current?.setRouteSegments?.(routeSegments); else adapter.current?.setRoute(route); adapter.current?.setActiveRouteSegment?.(activeRouteSegmentId); }, [route, routeSegments]);
  useEffect(() => { adapter.current?.setActiveRouteSegment?.(activeRouteSegmentId); }, [activeRouteSegmentId]);
  useEffect(() => { if (routeWaypoints) adapter.current?.setWaypoints(routeWaypoints); }, [routeWaypoints]);
  useEffect(() => {
    if (!routeFitPadding) return;
    if (activeRouteSegmentId && adapter.current?.focusRouteSegment?.(activeRouteSegmentId, routeFitPadding)) return;
    adapter.current?.fitRoute(routeFitPadding);
  }, [routeFitPadding, activeRouteSegmentId]);
  useEffect(() => { if (vehicle) adapter.current?.setVehicle(vehicle, heading); }, [vehicle?.[0], vehicle?.[1], heading]);
  useEffect(() => { adapter.current?.setTheme(activeTheme); }, [activeTheme]);
  useEffect(() => subscribeMapLayer((layer) => adapter.current?.setLayer(layer)), []);
  // Information layers remain independent from the selected 2D/3D/satellite basemap.
  syncOverlays.current = () => adapter.current?.setTransportLayers(overlays ? getTransportLayers() : new Set());
  useEffect(() => { syncOverlays.current(); }, [overlays]);
  useEffect(() => subscribeMapLayer(() => syncOverlays.current()), []);
  useEffect(() => subscribeTransportLayers(() => syncOverlays.current()), []);
  const fallbackBackground = activeTheme.endsWith('_DARK')
    ? 'radial-gradient(ellipse at 40% 40%, #132D47, #091726 45%, #050C14)'
    : 'radial-gradient(ellipse at 40% 40%, #dceeff, #eff6ff 45%, #d6e5f3)';
  return <div ref={container} className="absolute inset-0 z-0" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: fallbackBackground }} aria-label="Карта маршруту MARSHGO" role="img" />;
}
