import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 4173);

// The root MarshGO repo's config points its baseURL at the public zrok tunnel, which serves the
// frozen root app tree — a Site-only change would pass there while the defect stayed live. These
// specs run against this repo's own preview build, and E2E_BASE_URL re-points them at a deployed
// target without editing the file.
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'off',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  webServer: {
    // --host is not decoration: vite preview binds ::1 only by default, and a 127.0.0.1 URL check
    // then times out after 120 s with no hint that the server is up and listening on the other family.
    command: `npx vite preview --port ${port} --strictPort --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
