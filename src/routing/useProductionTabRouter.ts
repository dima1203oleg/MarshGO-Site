import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { pathForProductionTab, productionRouteForPath, type ProductionTab } from './productionRoutes';

export function useProductionTabRouter() {
  const [route, setRoute] = useState(() => productionRouteForPath(window.location.pathname));
  const [tab, setTabState] = useState<ProductionTab>(() => productionRouteForPath(window.location.pathname)?.tab ?? 'home');
  const [notFound, setNotFound] = useState(() => productionRouteForPath(window.location.pathname) === null);
  const tabRef = useRef(tab);

  useEffect(() => {
    const onPopState = () => {
      const next = productionRouteForPath(window.location.pathname);
      setRoute(next);
      setNotFound(next === null);
      if (next) {
        tabRef.current = next.tab;
        setTabState(next.tab);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setTab: Dispatch<SetStateAction<ProductionTab>> = useCallback((nextOrUpdater) => {
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(tabRef.current) : nextOrUpdater;
    tabRef.current = next;
    setTabState(next);
    setNotFound(false);
    const path = pathForProductionTab(next);
    if (window.location.pathname !== path || window.location.search || window.location.hash) {
      window.history.pushState({ marshgoRoute: true }, '', path);
    }
    setRoute(productionRouteForPath(path));
  }, []);

  const activateTab = useCallback((next: ProductionTab) => {
    tabRef.current = next;
    setTabState(next);
    setNotFound(false);
  }, []);

  const setRoutePath = useCallback((path: string) => {
    if (!path.startsWith('/') || path.startsWith('//')) return false;
    const next = productionRouteForPath(path.split(/[?#]/, 1)[0] ?? '/');
    if (!next) return false;
    window.history.pushState({ marshgoRoute: true }, '', path);
    setRoute(next);
    setNotFound(false);
    tabRef.current = next.tab;
    setTabState(next.tab);
    return true;
  }, []);

  return { tab, setTab, activateTab, route, setRoutePath, notFound, goHome: () => setTab('home') };
}
