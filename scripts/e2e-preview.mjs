import { preview } from 'vite';
import process from 'node:process';

const outDir = process.env.E2E_DIST_DIR;
if (!outDir) throw new Error('E2E_DIST_DIR must point to the temporary test-only Site bundle.');

const server = await preview({
  build: { outDir },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});

const close = () => server.httpServer.close(() => process.exit(0));
process.once('SIGINT', close);
process.once('SIGTERM', close);
