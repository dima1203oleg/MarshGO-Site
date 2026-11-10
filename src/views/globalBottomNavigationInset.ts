/** Distance from the viewport bottom to the top edge of the shared floating navigation. */
export function globalBottomNavigationInset(viewportHeight: number, navigationTop: number): number {
  if (!Number.isFinite(viewportHeight) || !Number.isFinite(navigationTop)) return 0;
  return Math.max(0, Math.ceil(viewportHeight - navigationTop));
}

/** Read the visible inset instead of assuming a fixed bar height or safe-area size. */
export function measureGlobalBottomNavigationInset(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
  const navigation = document.querySelector<HTMLElement>('[data-testid="global-bottom-navigation"]');
  if (!navigation) return 0;
  return globalBottomNavigationInset(window.innerHeight, navigation.getBoundingClientRect().top);
}
