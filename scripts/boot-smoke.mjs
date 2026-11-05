import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * Gate G7: boot-smoke
 * Verifies production build boots in headless Chromium without crashing or showing a black screen.
 * Tests Light/Dark themes and mobile/desktop viewports (390x720, 1280x800).
 */

const distDir = resolve(process.cwd(), 'dist');
const artifactsDir = resolve('/tmp/mg-results');
if (!existsSync(artifactsDir)) {
  mkdirSync(artifactsDir, { recursive: true });
}

if (!existsSync(resolve(distDir, 'index.html'))) {
  console.error('G7 FAIL: dist/index.html does not exist. Run "npm run build" first.');
  process.exit(1);
}

// Allowed harmless network errors on static preview (no backend running on 3002)
const ALLOWED_ERROR_PATTERNS = [
  /status of 502/i, // Proxy 502 to backend
  /status of 401/i, // Cold start auth refresh
  /Failed to load resource.*\/api\//i,
];

function isAllowedError(text) {
  return ALLOWED_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

const PORT = process.env.BOOT_SMOKE_PORT || '4188';
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function main() {
  console.log(`[G7 boot-smoke] Starting preview server on ${BASE_URL}...`);
  const preview = spawn('npx', ['vite', 'preview', '--port', PORT, '--host', '127.0.0.1'], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  // Give preview server a moment to bind
  await new Promise((r) => globalThis.setTimeout(r, 1500));

  const browser = await chromium.launch({ headless: true });

  const testMatrix = [
    { name: 'mobile-light', viewport: { width: 390, height: 720 }, theme: 'light' },
    { name: 'mobile-dark', viewport: { width: 390, height: 720 }, theme: 'dark' },
    { name: 'desktop-light', viewport: { width: 1280, height: 800 }, theme: 'light' },
    { name: 'desktop-dark', viewport: { width: 1280, height: 800 }, theme: 'dark' },
  ];

  let anyFailure = false;

  try {
    for (const config of testMatrix) {
      console.log(`\n[G7 boot-smoke] Testing ${config.name} (${config.viewport.width}x${config.viewport.height}, theme=${config.theme})...`);
      const context = await browser.newContext({
        viewport: config.viewport,
        colorScheme: config.theme,
      });
      const page = await context.newPage();

      const criticalErrors = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!isAllowedError(text)) {
            criticalErrors.push(`Console Error: ${text}`);
          }
        }
      });

      page.on('pageerror', (err) => {
        const text = err.toString();
        if (!isAllowedError(text)) {
          criticalErrors.push(`Page Uncaught Exception: ${text}`);
        }
      });

      try {
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 12000 });
      } catch (navErr) {
        criticalErrors.push(`Navigation Error: ${navErr.message}`);
      }

      // Check root element
      const rootHtml = await page.$eval('#root', (el) => el.innerHTML).catch(() => '');
      const rootText = await page.$eval('#root', (el) => el.innerText).catch(() => '');

      const screenshotPath = resolve(artifactsDir, `boot-smoke-${config.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  Screenshot saved: ${screenshotPath}`);

      if (rootHtml.trim().length === 0) {
        console.error(`  FAIL: #root is EMPTY (Black Screen!). Error: ${criticalErrors.join('; ') || 'Render produced no DOM nodes'}`);
        anyFailure = true;
      } else if (!rootText.includes('MARSHGO')) {
        console.error(`  FAIL: Visible text does not contain "MARSHGO". Found: "${rootText.slice(0, 100)}..."`);
        anyFailure = true;
      } else if (criticalErrors.length > 0) {
        console.error(`  FAIL: Critical JavaScript error(s) detected: \n    ${criticalErrors.join('\n    ')}`);
        anyFailure = true;
      } else {
        console.log(`  PASS: #root has ${rootHtml.length} chars HTML, ${rootText.length} chars text. "MARSHGO" is visible.`);
      }

      await context.close();
    }
  } finally {
    await browser.close();
    preview.kill();
  }

  if (anyFailure) {
    console.error('\n[G7 boot-smoke] FAILED.');
    process.exit(1);
  } else {
    console.log('\n[G7 boot-smoke] ALL TEST CONFIGURATIONS PASSED.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[G7 boot-smoke] Fatal test runner error:', err);
  process.exit(1);
});
