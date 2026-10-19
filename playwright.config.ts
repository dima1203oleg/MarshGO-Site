import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const externalBaseURL = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { ...devices['iPhone 16'], browserName: 'chromium' } },
    { name: 'firefox', use: { ...devices['iPhone 16'], browserName: 'firefox' } },
    { name: 'webkit', use: { ...devices['iPhone 16'], browserName: 'webkit' } },
  ],
  use: {
    ...devices['iPhone 16'],
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: externalBaseURL ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
