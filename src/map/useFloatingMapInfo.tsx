import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { FloatingMapInfo, MapAdapter } from './MapAdapter';

/** Shares visual popup state with a polite screen-reader announcement and keyboard dismissal. */
export function useFloatingMapInfo(
  mapAdapter: MutableRefObject<MapAdapter | null>,
  reducedMotion: boolean,
) {
  const [announcement, setAnnouncement] = useState('');
  const mounted = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const clear = useCallback(() => {
    generation.current += 1;
    mapAdapter.current?.clearFloatingInfo?.();
    if (mounted.current) setAnnouncement('');
  }, [mapAdapter]);

  const show = useCallback((info: FloatingMapInfo, delayMs = 180) => {
    const message = [info.title, info.detail].filter(Boolean).join(', ');
    const adapter = mapAdapter.current;
    if (!adapter?.showFloatingInfo) {
      if (mounted.current) setAnnouncement('');
      return;
    }
    const currentGeneration = ++generation.current;
    adapter.showFloatingInfo(info, {
      reducedMotion,
      delayMs,
      onPhase: phase => {
        if (!mounted.current || generation.current !== currentGeneration) return;
        if (phase === 'HIDDEN') setAnnouncement('');
        else if (phase === 'VISIBLE') setAnnouncement(message);
      },
    });
    if (mounted.current) setAnnouncement(message);
  }, [mapAdapter, reducedMotion]);

  const accessibility = <>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    {announcement && <button
      type="button"
      onClick={clear}
      aria-label={`Закрити підказку: ${announcement}`}
      className="mg-floating-map-info__keyboard-dismiss"
    >Закрити підказку</button>}
  </>;

  return { announcement, show, clear, accessibility };
}
