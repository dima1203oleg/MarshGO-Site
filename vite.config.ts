import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';

// Only the local machine and the zrok tunnel may reach the dev/preview server (DNS-rebinding protection).
const tunnelHosts = ['localhost', '127.0.0.1', '.zrok.io'];
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const explicitPreviewHost = process.env.MARSHGO_PREVIEW_HOST?.trim();
const allowedHosts = explicitPreviewHost ? [...tunnelHosts, explicitPreviewHost] : tunnelHosts;

function gitValue(args: string[]): string {
  try { return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return 'unavailable'; }
}

const buildMetadata = {
  sha: gitValue(['rev-parse', 'HEAD']).slice(0, 12),
  branch: gitValue(['branch', '--show-current']),
  dirty: gitValue(['status', '--porcelain']) !== '',
  builtAt: new Date().toISOString(),
};

export default defineConfig(() => {
  return {
    define: { __MARSHGO_BUILD_METADATA__: JSON.stringify(buildMetadata) },
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
      allowedHosts,
      proxy: {
        '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3002', changeOrigin: true },
        '/healthz': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3002', changeOrigin: true },
        '/readyz': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3002', changeOrigin: true },
      },
    },
    preview: {
      allowedHosts,
      proxy: {
        '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3002', changeOrigin: true },
        '/healthz': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3002', changeOrigin: true },
        '/readyz': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3002', changeOrigin: true },
      },
    },
  };
});
