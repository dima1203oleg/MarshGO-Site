import { spawnSync } from 'node:child_process';

// E2E serves the web bundle from dist. Never reuse the simulator build, which embeds
// an HTTP localhost API origin that is cross-origin and unavailable to browser runs.
const env = { ...process.env };
delete env.CAPACITOR_BUILD;
delete env.VITE_API_BASE_URL;

const result = spawnSync('npm', ['run', 'build'], { env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
