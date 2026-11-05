#!/usr/bin/env node
/**
 * Why this exists: vite.config.ts sets `envDir` to the PARENT of the Site repository, because the
 * workspace keeps the shared VITE_MAP_* basemap settings in the orchestration root `.env`. A
 * worktree checked out anywhere else (for example /tmp/mg-site-fixes) then resolves envDir to a
 * directory with no `.env`, the build silently loses VITE_MAP_STYLE_URL / _DARK, and MapLibre
 * paints an empty background instead of the light/dark basemap — the passenger sees a route over
 * a blank field and the honest chip «Базові тайли карти не налаштовані».
 *
 * This wrapper re-exports only the VITE_MAP_* keys resolved from the candidate `.env` files below
 * into the child process, so a worktree build matches the canonical one. Keys are merged first-file-
 * wins: a partial `.env` may add a setting nobody else defines, never override a real one. Values are
 * never printed — the script reports key names and byte lengths only, because deployment env files may
 * carry licensed endpoints alongside public style URLs.
 *
 * Usage: node scripts/with-map-env.mjs <command> [args...]
 * Override the env file with MG_WORKSPACE_ENV=/path/to/.env when the workspace lives elsewhere.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A linked worktree points at `<main repo>/.git/worktrees/<name>`, so the main repository root is
 * everything before the `.git` path component. Getting this wrong one level up is exactly how the
 * wrapper ends up reading `<main repo>/.env` (nothing there) instead of the workspace `.env` that
 * vite's `envDir` actually uses.
 */
function mainRepoRootFrom(gitDir) {
  const gitIndex = gitDir.split(path.sep).lastIndexOf('.git');
  if (gitIndex > 0) return gitDir.split(path.sep).slice(0, gitIndex).join(path.sep) || path.sep;
  return gitDir.endsWith('.git') ? path.dirname(gitDir) : '';
}

/**
 * Candidate `.env` locations, best first: an explicit override, the parent of the main repository
 * discovered through git (the workspace the owner maintains — this is how a linked worktree in /tmp
 * finds it), and the parent of this checkout. The git-discovered workspace is checked BEFORE the
 * literal parent because a scratch tree can hold a stray partial `.env`; taking that one first
 * dropped VITE_MAP_SATELLITE_TILE_URL from every worktree build while still looking like a success.
 * For a normal checkout both paths resolve to the same directory.
 */
function candidateEnvFiles() {
  const out = [process.env.MG_WORKSPACE_ENV];
  try {
    const commonDir = readFileSync(path.join(repoRoot, '.git'), 'utf8').trim();
    const pointer = /^gitdir:\s*(.+)$/m.exec(commonDir);
    if (pointer) {
      const gitPath = path.resolve(repoRoot, pointer[1]);
      const mainRepoRoot = mainRepoRootFrom(gitPath);
      // .../<workspace>/MarshGO-Site/.git/worktrees/<name>  →  <workspace>/.env
      if (mainRepoRoot) out.push(path.resolve(mainRepoRoot, '..', '.env'));
    }
  } catch { /* plain checkout, or no git metadata: the candidates below still cover it */ }
  out.push(path.resolve(repoRoot, '..', '.env'));
  return [...new Set(out.filter(Boolean))];
}

function mapSettingsFromEnvFile(file) {
  if (!existsSync(file)) return {};
  const found = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match || !match[1].startsWith('VITE_MAP_')) continue;
    found[match[1]] = match[2].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
  return found;
}

/** Keys already resolved from a better-ranked file win; a stray `.env` may add, never override. */
function mergeMapSettings(candidates) {
  const merged = {};
  const sources = {};
  for (const file of candidates) {
    for (const [key, value] of Object.entries(mapSettingsFromEnvFile(file))) {
      if (key in merged) continue;
      merged[key] = value;
      sources[key] = file;
    }
  }
  return { merged, sources };
}

const candidates = candidateEnvFiles();
const { merged, sources } = mergeMapSettings(candidates);
// An explicit VITE_MAP_* in the caller's environment is the narrowest possible statement of intent,
// so it outranks any file.
const settings = { ...merged, ...pickProcessMapSettings(process.env) };
const usedFiles = [...new Set(Object.values(sources))];
// The first candidate that defines anything is the primary file; point vite's own envDir at the same
// directory so a wrapped build and an unwrapped `npm run dev` cannot disagree about which `.env` wins.
const primaryEnvFile = candidates.find((file) => Object.keys(mapSettingsFromEnvFile(file)).length > 0);
if (primaryEnvFile) process.env.MG_WORKSPACE_ENV = primaryEnvFile;

function pickProcessMapSettings(env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) if (key.startsWith('VITE_MAP_') && value) out[key] = value;
  return out;
}

const names = Object.keys(settings).sort();
if (names.length === 0) {
  console.warn(`[with-map-env] no VITE_MAP_* found in ${candidates.join(' or ')}; the basemap will fall back to the built-in scheme style.`);
} else {
  console.log(`[with-map-env] ${usedFiles.join(' + ') || 'process environment'} → ${names.map((n) => `${n}(${settings[n].length})`).join(' ')}`);
}


const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: node scripts/with-map-env.mjs <command> [args...]');
  process.exit(2);
}
const child = spawn(command, args, {
  stdio: 'inherit',
  shell: false,
  env: { ...process.env, ...settings },
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
