import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { pathForProductionTab, productionTabForPath, type ProductionTab } from './productionRoutes';

export function useProductionTabRouter() {
  const [tab, setTabState] = useState<ProductionTab>(() => productionTabForPath(window.location.pathname) ?? 'home');
  const [notFound, setNotFound] = useState(() => productionTabForPath(window.location.pathname) === null);
  const tabRef = useRef(tab);

  useEffect(() => {
    const onPopState = () => {
      const next = productionTabForPath(window.location.pathname);
      setNotFound(next === null);
      if (next) {
        tabRef.current = next;
        setTabState(next);
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
  }, []);

  return { tab, setTab, notFound, goHome: () => setTab('home') };
}
