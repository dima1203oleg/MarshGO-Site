import { useCallback, useEffect, useRef, useState } from 'react';

export const MAP_NAVIGATION_AUTO_HIDE_MS = 1_650;
export const MAP_NAVIGATION_REVEAL_MS = 2_800;
export const MAP_NAVIGATION_EDGE_PX = 64;

export function isMapToolbarContext(input: {
  tab: string;
  activeJourneyNavigation: boolean;
  selectedRouteMap: boolean;
  selectedJourney: boolean;
}): boolean {
  return input.tab === 'map'
    || input.tab === 'navigation'
    || input.activeJourneyNavigation
    || input.selectedRouteMap
    || input.selectedJourney;
}

export function isBottomNavigationRevealEdge(clientY: number, viewportHeight: number): boolean {
  return Number.isFinite(clientY)
    && Number.isFinite(viewportHeight)
    && viewportHeight - clientY >= 0
    && viewportHeight - clientY <= MAP_NAVIGATION_EDGE_PX;
}

export function shouldRemeasureAfterNavigationTransition(
  eventTarget: EventTarget | null,
  navigation: EventTarget,
  propertyName: string,
): boolean {
  return eventTarget === navigation && propertyName === 'transform';
}

/** Briefly presents the shared dock on map entry, then tucks it away until the user needs it. */
export function useMapAwareBottomNavigation(isMapContext: boolean) {
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const revealTemporarily = useCallback(() => {
    if (!isMapContext) return;
    clearHideTimer();
    setVisible(true);
    hideTimer.current = window.setTimeout(() => {
      setVisible(false);
      hideTimer.current = null;
    }, MAP_NAVIGATION_REVEAL_MS);
  }, [clearHideTimer, isMapContext]);

  useEffect(() => {
    clearHideTimer();
    if (!isMapContext) {
      setVisible(true);
      return;
    }

    // Paint the dock from below the screen before its short map-entry reveal.
    setVisible(false);
    const revealFrame = window.requestAnimationFrame(() => setVisible(true));
    hideTimer.current = window.setTimeout(() => {
      setVisible(false);
      hideTimer.current = null;
    }, MAP_NAVIGATION_AUTO_HIDE_MS);

    return () => {
      window.cancelAnimationFrame(revealFrame);
      clearHideTimer();
    };
  }, [clearHideTimer, isMapContext]);

  useEffect(() => {
    if (!isMapContext) return;
    // Map and sheet layout already measure the dock on resize; notify them after its inset changes.
    window.dispatchEvent(new Event('resize'));
  }, [isMapContext, visible]);

  useEffect(() => {
    const remeasureAfterTransition = (event: TransitionEvent) => {
      const navigation = event.target instanceof HTMLElement
        && event.target.matches('[data-testid="global-bottom-navigation"]')
        ? event.target
        : null;
      if (!navigation) return;
      if (shouldRemeasureAfterNavigationTransition(event.target, navigation, event.propertyName)) {
        window.dispatchEvent(new Event('resize'));
      }
    };
    // Delegate to document so this still attaches if auth/loading renders the
    // global dock after this hook's first effect has already run.
    document.addEventListener('transitionend', remeasureAfterTransition);
    return () => document.removeEventListener('transitionend', remeasureAfterTransition);
  }, []);

  const onMapEdgePointerDown = useCallback((event: { clientY: number }) => {
    if (isMapContext && isBottomNavigationRevealEdge(event.clientY, window.innerHeight)) {
      revealTemporarily();
    }
  }, [isMapContext, revealTemporarily]);

  return { visible, onMapEdgePointerDown };
}
