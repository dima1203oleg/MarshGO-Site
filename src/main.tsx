import { lazy, Suspense } from 'react';
import {createRoot} from 'react-dom/client';
import { ProductionErrorBoundary } from './components/ProductionErrorBoundary';
import './index.css';
import './services/theme';

// Keep the first React paint small. The production marketplace pulls in the
// full authenticated app graph, so defer it until the shell is already visible
// in a cold WKWebView/PWA launch.
const ProductionMarketplace = lazy(async () => {
  const module = await import('./views/ProductionMarketplace');
  return { default: module.ProductionMarketplace };
});

function AppStartupFallback() {
  return (
    <main
      data-testid="app-startup-fallback"
      className="grid min-h-[100svh] place-items-center bg-[#f5f8fd] px-6 text-center text-[#14243b] dark:bg-[#071321] dark:text-white"
      role="status"
      aria-live="polite"
    >
      <div className="grid justify-items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-blue-600 text-lg font-black text-white">M</span>
        <span className="text-sm font-semibold">Відкриваємо MARSHGO…</span>
      </div>
    </main>
  );
}

const rootElement = document.getElementById('root')!;
rootElement.replaceChildren();
const root = createRoot(rootElement);
const isDesignStudio = import.meta.env.DEV && new URLSearchParams(window.location.search).get('studio') === '1';

if (isDesignStudio) {
  void import('./dev/DesignStudio').then(({ DesignStudio }) => root.render(
    <ProductionErrorBoundary><DesignStudio /></ProductionErrorBoundary>,
  ));
} else {
  // The release entry imports only the server-backed application. The legacy
  // localStorage prototype in App.tsx is intentionally not in this module graph.
  root.render(
    <ProductionErrorBoundary>
      <Suspense fallback={<AppStartupFallback />}>
        <ProductionMarketplace />
      </Suspense>
    </ProductionErrorBoundary>,
  );
}
Reflect.set(window, '__MARSHGO_BOOTED__', true);
