import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' });
    const forward = (signal) => child.kill(signal);
    process.once('SIGINT', forward);
    process.once('SIGTERM', forward);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      process.removeListener('SIGINT', forward);
      process.removeListener('SIGTERM', forward);
      resolve(signal ? 1 : code ?? 1);
    });
  });
}

const runnerArgs = ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)];
if (process.env.E2E_BASE_URL) {
  process.exitCode = await run(process.execPath, runnerArgs, process.env);
} else {
  const e2eRoot = await mkdtemp(join(tmpdir(), 'marshgo-site-e2e-'));
  const distDirectory = join(e2eRoot, 'dist');
  const env = { ...process.env };
  delete env.CAPACITOR_BUILD;
  delete env.VITE_API_BASE_URL;
  env.VITE_MAP_STYLE_URL = '';
  env.VITE_MAP_STYLE_MANIFEST_URL = 'http://127.0.0.1:3306/maps/v1.0.0/manifest.json';
  env.VITE_MAP_TILE_URL = '';
  env.VITE_MAP_TILE_ATTRIBUTION = 'MARSHGO synthetic E2E map fixture';
  delete env.VITE_MAP_SATELLITE_TILE_URL;
  delete env.VITE_MAP_SATELLITE_ATTRIBUTION;
  env.E2E_DIST_DIR = distDirectory;

  try {
    const buildCode = await run(process.execPath, [
      'node_modules/vite/bin/vite.js', 'build', '--outDir', distDirectory, '--emptyOutDir',
    ], env);
    if (buildCode !== 0) {
      process.exitCode = buildCode;
    } else {
      process.exitCode = await run(process.execPath, runnerArgs, env);
    }
  } finally {
    await rm(e2eRoot, { recursive: true, force: true });
  }
}
