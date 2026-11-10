import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { FloatingMapInfo, MapAdapter } from './MapAdapter';

/** Shares visual popup state with a polite screen-reader announcement and keyboard dismissal. */
export function useFloatingMapInfo(
  mapAdapter: MutableRefObject<MapAdapter | null>,
  reducedMotion: boolean,
) {
  const [announcement, setAnnouncement] = useState('');
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const clear = useCallback(() => {
    mapAdapter.current?.clearFloatingInfo?.();
    if (mounted.current) setAnnouncement('');
  }, [mapAdapter]);

  const show = useCallback((info: FloatingMapInfo, delayMs = 180) => {
    const message = [info.title, info.detail].filter(Boolean).join(', ');
    if (mounted.current) setAnnouncement(message);
    mapAdapter.current?.showFloatingInfo?.(info, {
      reducedMotion,
      delayMs,
      onPhase: phase => {
        if (!mounted.current) return;
        if (phase === 'HIDDEN') setAnnouncement('');
      },
    });
  }, [mapAdapter, reducedMotion]);

  const accessibility = <div className="sr-only">
    <span role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    {announcement && <button type="button" onClick={clear} aria-label={`Закрити підказку: ${announcement}`}>
      Закрити підказку
    </button>}
  </div>;

  return { announcement, show, clear, accessibility };
}
