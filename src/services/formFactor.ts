import { useEffect, useState } from 'react';

/**
 * Form factor drives the responsive shell: the phone keeps the canonical bottom
 * navigation, the tablet gets an icon rail, the desktop a labelled left sidebar.
 * Resolution is matchMedia-based (not a resize listener) so the shell only
 * re-renders when a breakpoint is actually crossed. themeService owns the theme;
 * this service owns nothing but width, and never reads prefers-color-scheme.
 */
export type FormFactor = 'mobile' | 'tablet' | 'desktop';

export const TABLET_MIN_WIDTH = 768;
export const DESKTOP_MIN_WIDTH = 1100;

export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;
/**
 * The tablet query intentionally has no max-width: desktop is evaluated first, so a
 * fractional viewport (browser zoom at 1099.5px) still resolves to tablet instead of
 * falling through both queries into the phone shell.
 */
export const TABLET_QUERY = `(min-width: ${TABLET_MIN_WIDTH}px)`;

/** Pure breakpoint resolution — the single source of truth for tests and SSR. */
export function resolveFormFactor(width: number): FormFactor {
  if (width >= DESKTOP_MIN_WIDTH) return 'desktop';
  if (width >= TABLET_MIN_WIDTH) return 'tablet';
  return 'mobile';
}

/** SSR-safe: without a window (node tests, prerender) the phone shell is the default. */
export function currentFormFactor(): FormFactor {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'mobile';
  if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'mobile';
}

/**
 * Subscribes to both breakpoint queries and reports the resolved factor on every
 * change. Returns an unsubscribe function; safe to call without a window.
 */
export function subscribeFormFactor(onChange: (factor: FormFactor) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const desktop = window.matchMedia(DESKTOP_QUERY);
  const tablet = window.matchMedia(TABLET_QUERY);
  const handle = () => onChange(currentFormFactor());
  desktop.addEventListener('change', handle);
  tablet.addEventListener('change', handle);
  return () => {
    desktop.removeEventListener('change', handle);
    tablet.removeEventListener('change', handle);
  };
}

export function useFormFactor(): FormFactor {
  const [formFactor, setFormFactor] = useState<FormFactor>(currentFormFactor);
  useEffect(() => {
    // The width may have changed between render and mount (rotation, zoom).
    setFormFactor(currentFormFactor());
    return subscribeFormFactor(setFormFactor);
  }, []);
  return formFactor;
}