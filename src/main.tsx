import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import {createRoot} from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
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

function NativeSplashHandoff({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let hideRequested = false;
    let secondFrame = 0;
    const hideAfterShellPaint = () => {
      if (cancelled || hideRequested) return;
      hideRequested = true;
      window.clearTimeout(watchdog);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      void SplashScreen.hide({ fadeOutDuration: reducedMotion ? 0 : 180 }).catch(() => undefined);
    };
    const watchdog = window.setTimeout(hideAfterShellPaint, 12_000);
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(hideAfterShellPaint);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  return children;
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
      <NativeSplashHandoff>
        <Suspense fallback={<AppStartupFallback />}>
          <ProductionMarketplace />
        </Suspense>
      </NativeSplashHandoff>
    </ProductionErrorBoundary>,
  );
}
Reflect.set(window, '__MARSHGO_BOOTED__', true);
