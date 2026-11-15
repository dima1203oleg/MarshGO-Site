/** Keep the active planner query when navigation temporarily replaces its URL. */
export function captureJourneySearchReturnPath(pathname: string, search: string): string | null {
  if (!/^\/journeys\/search\/?$/.test(pathname)) return null;
  return `${pathname}${search}`;
}

export type JourneyRouteBackTarget =
  | { readonly kind: 'planner'; readonly path: string }
  | { readonly kind: 'trips' }
  | { readonly kind: 'dismiss' };

export function resolveJourneyRouteBackTarget(returnPath: string | null, hasStoredJourney: boolean): JourneyRouteBackTarget {
  if (returnPath) return { kind: 'planner', path: returnPath };
  if (hasStoredJourney) return { kind: 'trips' };
  return { kind: 'dismiss' };
}
