import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';

// Only the local machine and the zrok tunnel may reach the dev/preview server (DNS-rebinding protection).
const tunnelHosts = ['localhost', '127.0.0.1', '.zrok.io'];
const rootDir = path.dirname(fileURLToPath(import.meta.url));
// The API this checkout proxies to (and upgrades the realtime WebSocket against).
const apiProxyTarget = process.env.API_PROXY_TARGET || 'http://127.0.0.1:3002';

/** A `.env` counts as the workspace one only if it actually carries map settings. */
function hasMapSettings(file: string): boolean {
  try {
    return /^\s*VITE_MAP_[A-Z0-9_]+=/m.test(readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * The workspace keeps the shared, explicitly VITE_-prefixed map settings in the MarshGO orchestration
 * root `.env` while the Site stays its own repository, so vite reads its environment from the parent
 * directory. That is exact for a normal checkout and silently wrong for a linked worktree: a worktree
 * created anywhere else (for example /tmp/mg-site-fixes) has a parent with no `.env`, the build drops
 * VITE_MAP_STYLE_URL and VITE_MAP_STYLE_URL_DARK, and MapLibre is left painting a bare background
 * layer — the passenger sees the route floating over an empty field and, in the dark theme, over what
 * looks like a broken map. Nothing fails, so the loss only shows up as «карта зникла після збірки».
 *
 * Follow this checkout's worktree pointer (`<repo>/.git` is a file reading `gitdir: …/.git/worktrees/
 * <name>`) back to the repository it was cloned from and use that repository's parent, which is where
 * the workspace `.env` actually lives. An explicit MG_WORKSPACE_ENV wins, then the git-discovered
 * workspace, then the historical parent-of-checkout.
 *
 * The order matters twice over. A scratch tree can carry a stray `.env` (an `/private/tmp/.env` left
 * by an experiment really did shadow the workspace file), and such a partial file holds only some of
 * the keys — enough to pass `hasMapSettings` while silently dropping VITE_MAP_SATELLITE_TILE_URL, so
 * the imagery toggle goes back to «не налаштовано» in every worktree build. The git-discovered
 * workspace is the file the owner maintains, so it is matched before the literal parent; for a normal
 * checkout both resolve to the same directory.
 */
function resolveMapEnvDir(): string {
  const fallback = path.resolve(rootDir, '..');
  const candidates: string[] = [];
  if (process.env.MG_WORKSPACE_ENV) candidates.push(path.dirname(path.resolve(process.env.MG_WORKSPACE_ENV)));
  try {
    const pointer = /^gitdir:\s*(.+)$/m.exec(readFileSync(path.join(rootDir, '.git'), 'utf8').trim());
    if (pointer) {
      const gitPath = path.resolve(rootDir, pointer[1]);
      const components = gitPath.split(path.sep);
      const gitIndex = components.lastIndexOf('.git');
      // …/<workspace>/MarshGO-Site/.git/worktrees/<name>  →  <workspace>
      const mainRepoRoot = gitIndex > 0 ? components.slice(0, gitIndex).join(path.sep) : path.dirname(gitPath);
      if (mainRepoRoot) candidates.push(path.resolve(mainRepoRoot, '..'));
    }
  } catch {
    // Plain checkout (`.git` is a directory) or no git metadata: the fallback already covers it.
  }
  candidates.push(fallback);
  const dirs = [...new Set(candidates)];
  const chosen = dirs.find((dir) => hasMapSettings(path.join(dir, '.env')));
  if (!chosen) return fallback;
  // vite reads exactly one `envDir`, so name the files it therefore ignores: a stray `.env` upstream
  // of the workspace must show up in the build log rather than surface as «супутник знову вимкнено».
  const ignored = dirs.filter((dir) => dir !== chosen && hasMapSettings(path.join(dir, '.env')));
  if (ignored.length) console.log(`[map-env] using ${chosen}/.env; ignoring ${ignored.map((d) => `${d}/.env`).join(', ')} — a partial env file upstream of the workspace shadows map settings`);
  return chosen;
}

export default defineConfig(() => {
  return {
    // This workspace keeps shared, explicitly VITE_-prefixed map settings in
    // the workspace root .env while the Site remains its own repository.
    envDir: resolveMapEnvDir(),
    // Capacitor serves bundled files from its own scheme; relative assets keep
    // the packaged entry point independent of an HTTP origin.
    base: process.env.CAPACITOR_BUILD === 'true' ? './' : '/',
    // MapLibre's separately loaded renderer is ~1 MB raw but ~285 KB gzip;
    // check:bundle enforces the actual transfer budget for every JS chunk.
    build: { chunkSizeWarningLimit: 1100 },
    plugins: [react(), tailwindcss()],
    resolve: {
      // Keep hooks and the renderer on one runtime instance in isolated
      // worktrees, where the optimizer can otherwise prebundle React twice.
      dedupe: ['react', 'react-dom'],
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
