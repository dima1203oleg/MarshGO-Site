import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';

// Only the local machine and the zrok tunnel may reach the dev/preview server (DNS-rebinding protection).
const tunnelHosts = ['localhost', '127.0.0.1', '.zrok.io'];
const rootDir = path.dirname(fileURLToPath(import.meta.url));
// The API this checkout proxies to (and upgrades the realtime WebSocket against).
const apiProxyTarget = process.env.API_PROXY_TARGET || 'http://127.0.0.1:3002';

export default defineConfig(() => {
  return {
    // This workspace keeps shared, explicitly VITE_-prefixed map settings in
    // the workspace root .env while the Site remains its own repository.
    envDir: path.resolve(rootDir, '..'),
    // Capacitor serves bundled files from its own scheme; relative assets keep
    // the packaged entry point independent of an HTTP origin.
    base: process.env.CAPACITOR_BUILD === 'true' ? './' : '/',
    // MapLibre's separately loaded renderer is ~1 MB raw but ~285 KB gzip;
    // check:bundle enforces the actual transfer budget for every JS chunk.
    build: { chunkSizeWarningLimit: 1100 },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: tunnelHosts,
      proxy: {
        // ws:true — the realtime channel is a WebSocket on /api/v1/realtime and the server
        // answers it from an 'upgrade' listener (MarshGO-Server/server/index.ts:6601). Without
        // the flag the dev/preview proxy dropped the upgrade handshake and the socket never
        // opened; measured 2026-11-04: the proxied upgrade now reaches the API in ~3 ms.
        // The page Origin is forwarded unchanged on purpose. The upgrade handler rejects any
        // Origin missing from CORS_ORIGINS with 403 before the ticket is read (index.ts:6698),
        // so the rule for every environment is "list the origin the passenger opens", which a
        // same-origin deployment satisfies automatically and a public preview satisfies with its
        // share host. Rewriting the header instead would replace an allowed public host with the
        // internal API host, which no CORS_ORIGINS may contain (config.ts:38 forbids http:// in
        // production), so it is deliberately not used here.
        '/api': { target: apiProxyTarget, changeOrigin: true, ws: true },
        '/healthz': { target: apiProxyTarget, changeOrigin: true },
        '/readyz': { target: apiProxyTarget, changeOrigin: true },
      },
    },
    preview: {
      allowedHosts: tunnelHosts,
      proxy: {
        '/api': { target: apiProxyTarget, changeOrigin: true, ws: true },
        '/healthz': { target: apiProxyTarget, changeOrigin: true },
        '/readyz': { target: apiProxyTarget, changeOrigin: true },
      },
    },
  };
});
