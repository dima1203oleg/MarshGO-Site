import { useEffect } from 'react';

export function isMapToolbarContext(input: {
  tab: string;
  activeJourneyNavigation: boolean;
  journeyStartPending: boolean;
  selectedRouteMap: boolean;
  selectedJourney: boolean;
}): boolean {
  // Route details retain the global dock as shown in the canonical screen.
  // Hide it only while guidance is starting/running or a standalone map tab is open.
  if (input.activeJourneyNavigation || input.journeyStartPending) return true;
  return input.tab === 'map' || input.tab === 'navigation';
}

export function shouldShowGlobalBottomNavigation(isMapContext: boolean): boolean {
  return !isMapContext;
}

export function shouldRemeasureAfterNavigationTransition(
  eventTarget: EventTarget | null,
  navigation: EventTarget,
  propertyName: string,
): boolean {
  return eventTarget === navigation && propertyName === 'transform';
}

export function useMapAwareBottomNavigation(isMapContext: boolean) {
  const visible = shouldShowGlobalBottomNavigation(isMapContext);
  useEffect(() => {
    // The sheet and map measure their viewport after the dock moves on either transition.
    window.dispatchEvent(new Event('resize'));
  }, [isMapContext]);

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

  return { visible };
}
