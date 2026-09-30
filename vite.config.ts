import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
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
      proxy: {
        '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3002', changeOrigin: true },
        '/healthz': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3002', changeOrigin: true },
        '/readyz': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3002', changeOrigin: true },
      },
    },
  };
});
