import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Globe, Minus, Plus, Volume2, VolumeX } from 'lucide-react';
import type { MapAdapter } from '../map/MapAdapter';
import { getMapLayer, getMapPerspective, satelliteBasemapAvailable, setMapLayer, setMapPerspective, subscribeMapLayer, subscribeMapPerspective, type MapLayer, type MapPerspective } from '../map/mapMode';
import { setVoiceGuidancePreference, useVoiceGuidancePreference } from '../services/voiceGuidancePreference';

const controlClass = 'map-interaction-control mg-press-subtle grid h-12 w-12 shrink-0 place-items-center rounded-full shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)]';

function ZoomButton({ direction, map, enabled }: { direction: 1 | -1; map: MapAdapter | null; enabled?: boolean }) {
  const label = direction > 0 ? 'Збільшити масштаб' : 'Зменшити масштаб';
  const canZoom = enabled !== false && Boolean(map?.zoomBy);
  return <button
    type="button"
    aria-label={label}
    title={label}
    disabled={!canZoom}
    aria-disabled={!canZoom}
    onClick={() => map?.zoomBy?.(direction)}
    className={controlClass}
  >
    {direction > 0 ? <Plus size={20} aria-hidden="true"/> : <Minus size={20} aria-hidden="true"/>}
  </button>;
}

/** Shared vertical zoom pair; each 48px target aligns with the map's other round controls. */
export function MapZoomControls({ map, enabled }: { map: MapAdapter | null; enabled?: boolean }) {
  return <>
    <ZoomButton direction={1} map={map} enabled={enabled}/>
    <ZoomButton direction={-1} map={map} enabled={enabled}/>
  </>;
}

/** Shared sound preference used by every interactive map and active turn-by-turn guidance. */
export function MapVoiceControl({ enabled, onToggle }: { enabled?: boolean; onToggle?: (next: boolean) => void } = {}) {
  const preferred = useVoiceGuidancePreference();
  const voiceOn = enabled ?? preferred;
  const label = voiceOn ? 'Вимкнути голосові підказки' : 'Увімкнути голосові підказки';
  return <button
    type="button"
    aria-label={label}
    title={voiceOn ? 'Голосові підказки увімкнені' : 'Увімкнути голосові підказки для навігації'}
    aria-pressed={voiceOn}
    onClick={() => {
      const next = !voiceOn;
      if (onToggle) onToggle(next);
      else setVoiceGuidancePreference(next);
    }}
    className={controlClass}
  >
    {voiceOn ? <Volume2 size={20} aria-hidden="true"/> : <VolumeX size={20} aria-hidden="true"/>}
  </button>;
}

/** The one vertical control rail used by the full-screen, interactive map views. */
export function MapControlRail({ children, className = '', style, label = 'Керування картою', inert = false }: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  label?: string;
  inert?: boolean;
}) {
  return <div role="group" aria-label={label} className={`flex flex-col items-center gap-2 ${className}`} style={style} inert={inert}>{children}</div>;
}

/** Shared 2D/3D camera control, with its preference owned by mapMode. */
export function MapPerspectiveControl() {
  const [perspective, setPerspective] = useState<MapPerspective>(getMapPerspective);
  useEffect(() => subscribeMapPerspective(setPerspective), []);
  const next: MapPerspective = perspective === '3d' ? '2d' : '3d';
  return <button
    type="button"
    aria-label={perspective === '3d' ? 'Повернути плоский 2D-вигляд' : "Увімкнути об'ємну 3D-перспективу"}
    title={perspective === '3d' ? '2D' : '3D'}
    aria-pressed={perspective === '3d'}
    onClick={() => setMapPerspective(next)}
    className={`${controlClass} text-xs font-black`}
  >{perspective === '3d' ? '2D' : '3D'}</button>;
}

/** Shared basemap switch; it refuses satellite mode unless imagery and attribution are configured. */
export function MapBasemapControl() {
  const [layer, setLayer] = useState<MapLayer>(getMapLayer);
  useEffect(() => subscribeMapLayer(setLayer), []);
  const next: MapLayer = layer === 'simple' ? 'satellite' : 'simple';
  const label = satelliteBasemapAvailable
    ? layer === 'satellite' ? 'Повернути схематичну карту' : 'Увімкнути супутникову карту'
    : 'Супутникові знімки недоступні';
  return <button
    type="button"
    aria-label={label}
    title={satelliteBasemapAvailable ? (layer === 'satellite' ? 'Схема' : 'Супутник') : 'Супутникові знімки не підключені'}
    aria-pressed={satelliteBasemapAvailable && layer === 'satellite'}
    aria-disabled={!satelliteBasemapAvailable}
    disabled={!satelliteBasemapAvailable}
    onClick={() => { if (satelliteBasemapAvailable) setMapLayer(next); }}
    className={controlClass}
  ><Globe size={20} aria-hidden="true"/></button>;
}
