import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * Gate G7: boot-smoke
 * Verifies production build boots in headless Chromium without crashing or showing a black screen.
 * Tests Light/Dark themes and mobile/desktop viewports (390x720, 1280x800).
 *
 * The responsive-shell configs (tablet 834x1112 / 768x1024, desktop 1440x900 / 1920x1080)
 * additionally boot a MOCK/DEMO session — the static preview has no backend, so /api/v1 is
 * fulfilled with empty fixtures — and assert the navigation orientation: a fixed LEFT
 * sidebar (desktop) or icon rail (tablet), never a bottom bar. No live data is implied.
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

// MOCK-session configs only: the preview server cannot upgrade the realtime WebSocket,
// so the handshake failure is expected. The original 11 configs keep the strict list.
const MOCK_SESSION_ALLOWED_ERROR_PATTERNS = [
  /WebSocket connection to .*\/api\/v1\/realtime/i,
];

function isAllowedError(text, extraPatterns = []) {
  return [...ALLOWED_ERROR_PATTERNS, ...extraPatterns].some((pattern) => pattern.test(text));
}

// The smoke assertions read the same layout tokens the stylesheet uses, so a geometry
// change in the registry cannot silently drift away from this gate.
const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
const layoutToken = (name) => {
  const match = indexCss.match(new RegExp(`${name}:\\s*([^;]+);`));
  return match ? Number.parseFloat(match[1]) : Number.NaN;
};
const SHELL_SIDEBAR_W = layoutToken('--mg-shell-sidebar-w');
const SHELL_RAIL_W = layoutToken('--mg-shell-rail-w');

// MOCK/DEMO fixture: an empty passenger account, never live data.
const MOCK_USER = {
  id: 'boot-smoke-mock-user',
  display_name: 'Boot Smoke',
  phone_e164: '+380000000000',
  email: 'boot-smoke@marshgo.local',
  roles: ['passenger'],
  is_verified: false,
};

async function mockApiRoute(route) {
  const path = new globalThis.URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, '');
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  if (path === '/auth/refresh') return json({ user: MOCK_USER, accessToken: 'boot-smoke-mock-token' });
  if (path === '/users/me') return json(MOCK_USER);
  if (path === '/users/me/deletion-request') return json(null);
  if (path.startsWith('/notifications')) return json({ items: [], nextCursor: null, unreadCount: 0 });
  if (path === '/realtime/ticket') return json({ ticket: 'boot-smoke-mock-ticket' });
  if (path === '/navigation/sessions/active') return json(null);
  return json([]);
}

/**
 * Orientation contract for the responsive shell: the navigation must be a fixed LEFT
 * sidebar/rail (never a bottom bar), create must lead it, every destination keeps its
 * canonical accessible name and the 44px touch floor, and content must clear the rail.
 */
async function responsiveShellFailures(page, config) {
  const failures = [];
  const nav = page.locator('[data-testid="global-bottom-navigation"]');
  const shell = page.locator('main.production-app');
  const factor = await shell.getAttribute('data-formfactor');
  if (factor !== config.expectedFormFactor) {
    failures.push(`data-formfactor="${factor}" but expected "${config.expectedFormFactor}" at ${config.viewport.width}px`);
  }
  const navBox = await nav.boundingBox();
  if (!navBox) {
    failures.push('navigation has no bounding box');
  } else {
    if (navBox.x > 1 || navBox.y > 1) failures.push(`navigation is not pinned left/top (x=${navBox.x}, y=${navBox.y}) — a bottom bar leaked in`);
    if (Math.abs(navBox.width - config.expectedNavWidth) > 1) failures.push(`navigation width ${navBox.width}px != expected ${config.expectedNavWidth}px`);
    if (navBox.height < config.viewport.height - 2) failures.push(`navigation height ${navBox.height}px is not full-height (${config.viewport.height}px)`);
  }
  const shellBox = await shell.boundingBox();
  if (!shellBox || shellBox.x > 1 || Math.abs(shellBox.width - config.viewport.width) > 1) {
    failures.push('shell is not full-bleed — the centred card layout leaked in');
  }
  const createBox = await page.locator('.app-create-button').boundingBox();
  const tabButtons = nav.locator('button:not(.app-create-button)');
  const firstTabBox = await tabButtons.first().boundingBox();
  if (!createBox || !firstTabBox || createBox.y >= firstTabBox.y) failures.push('create action does not lead the navigation');
  if (createBox && (createBox.width < 44 || createBox.height < 44)) failures.push(`create target ${createBox.width}x${createBox.height} is below the 44px floor`);
  const tabs = await tabButtons.evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    const label = button.querySelector('span');
    return { name: button.getAttribute('aria-label'), width: rect.width, height: rect.height, labelDisplay: label ? button.ownerDocument.defaultView.getComputedStyle(label).display : 'missing' };
  }));
  const expectedNames = ['Головна', 'Пошук', 'Поїздки', 'Профіль'];
  if (tabs.length !== 4) failures.push(`expected 4 destination tabs, found ${tabs.length}`);
  for (const tab of tabs) {
    if (!expectedNames.includes(tab.name)) failures.push(`tab accessible name "${tab.name}" is not one of the canonical four`);
    if (tab.width < 44 || tab.height < 44) failures.push(`tab "${tab.name}" target ${tab.width}x${tab.height} is below the 44px floor`);
    if (config.expectedFormFactor === 'tablet' && tab.labelDisplay !== 'none') failures.push('tablet rail must hide the visible label (aria-label carries the name)');
    if (config.expectedFormFactor === 'desktop' && tab.labelDisplay === 'none') failures.push('desktop sidebar must show the visible label');
  }
  const createLabelDisplay = await page.locator('.desktop-create-label').evaluate((element) => element.ownerDocument.defaultView.getComputedStyle(element).display);
  if (config.expectedFormFactor === 'desktop' && createLabelDisplay === 'none') failures.push('desktop create pill must show the "Створити" label');
  if (config.expectedFormFactor === 'tablet' && createLabelDisplay !== 'none') failures.push('tablet create button must stay icon-only');
  const headerBox = await page.locator('.app-header').boundingBox();
  if (headerBox && headerBox.x < config.expectedNavWidth - 1) failures.push(`header starts at ${headerBox.x}px, under the ${config.expectedNavWidth}px navigation`);
  return failures;
}

/**
 * Desktop workspace contract: the canonical Home must recompose into a wide
 * dashboard (no centred max-w-xl column), with four quick actions in ONE row and
 * three large destination photos across. This proves the desktop is a genuinely
 * different full-screen layout, not a stretched phone stack. MOCK session only.
 */
async function desktopWorkspaceFailures(page, config) {
  const failures = [];
  const gridTracks = (value) => value.split(' ').filter((part) => part.length > 0).length;
  const content = page.locator('main.production-app > .pt-1');
  const contentStyle = await content.evaluate((element) => {
    const styles = element.ownerDocument.defaultView.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return { maxWidth: styles.maxWidth, width: rect.width, x: rect.x };
  });
  if (contentStyle.maxWidth !== 'none') failures.push(`desktop content maxWidth=${contentStyle.maxWidth}, expected none (the 1280px reading cap leaked in)`);
  if (Math.abs(contentStyle.width - (config.viewport.width - config.expectedNavWidth)) > 2) failures.push(`desktop content width ${Math.round(contentStyle.width)}px != viewport minus sidebar (${config.viewport.width - config.expectedNavWidth}px)`);
  if (contentStyle.x < config.expectedNavWidth - 1) failures.push(`desktop content starts at ${Math.round(contentStyle.x)}px, under the sidebar`);

  const hero = page.locator('.home-hero--canonical');
  if (await hero.count() !== 1) { failures.push('canonical Home hero did not render'); return failures; }
  const heroStyle = await hero.evaluate((element) => {
    const styles = element.ownerDocument.defaultView.getComputedStyle(element);
    return { display: styles.display, maxWidth: styles.maxWidth };
  });
  if (heroStyle.display !== 'grid') failures.push(`Home hero display=${heroStyle.display}, expected grid`);
  if (heroStyle.maxWidth !== 'none') failures.push(`Home hero maxWidth=${heroStyle.maxWidth}, expected none`);

  const actionTracks = await page.locator('.home-action-grid').evaluate((element) => element.ownerDocument.defaultView.getComputedStyle(element).gridTemplateColumns);
  if (gridTracks(actionTracks) !== 4) failures.push(`Home action grid has ${gridTracks(actionTracks)} columns, expected 4 across`);
  // Four distinct column positions prove 4-across; the tops only need to share one
  // row band. The mg-stagger entrance animates translateY per card, so at measure
  // time the tops differ by a few px — exact equality would false-fail mid-animation.
  // A phone 2×2 stack would instead span >= one card height (150px) vertically.
  const actionBoxes = await page.locator('.home-action-card').evaluateAll((cards) => cards.map((card) => {
    const rect = card.getBoundingClientRect();
    return { top: rect.top, left: rect.left };
  }));
  if (actionBoxes.length !== 4) failures.push(`expected 4 quick actions, found ${actionBoxes.length}`);
  else {
    const columns = new Set(actionBoxes.map((box) => Math.round(box.left))).size;
    const topSpread = Math.max(...actionBoxes.map((box) => box.top)) - Math.min(...actionBoxes.map((box) => box.top));
    if (columns !== 4) failures.push(`quick actions occupy ${columns} columns, expected 4 across`);
    if (topSpread > 40) failures.push(`quick actions span ${Math.round(topSpread)}px vertically — not one row (the phone 2×2 stack leaked in)`);
  }

  const routeStyle = await page.locator('.home-popular-routes__row').evaluate((element) => {
    const styles = element.ownerDocument.defaultView.getComputedStyle(element);
    return { display: styles.display, columns: styles.gridTemplateColumns };
  });
  if (routeStyle.display !== 'grid') failures.push(`popular routes display=${routeStyle.display}, expected grid`);
  if (gridTracks(routeStyle.columns) !== 3) failures.push(`popular routes has ${gridTracks(routeStyle.columns)} columns, expected 3 across`);
  const routeHeights = await page.locator('.home-popular-route').evaluateAll((routes) => routes.map((route) => Math.round(route.getBoundingClientRect().height)));
  if (routeHeights.some((height) => height < 180)) failures.push(`destination photos too short (${routeHeights.join(', ')}px), expected the 200px desktop tile`);
  return failures;
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

  const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    || (process.platform === 'darwin' && existsSync(systemChrome) ? systemChrome : undefined);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  const testMatrix = [
    { name: 'mobile-320-dark', viewport: { width: 320, height: 720 }, theme: 'dark' },
    { name: 'mobile-360-dark', viewport: { width: 360, height: 720 }, theme: 'dark' },
    { name: 'mobile-375-dark', viewport: { width: 375, height: 720 }, theme: 'dark' },
    { name: 'mobile-light', viewport: { width: 390, height: 720 }, theme: 'light' },
    { name: 'mobile-dark', viewport: { width: 390, height: 720 }, theme: 'dark' },
    { name: 'mobile-414-dark', viewport: { width: 414, height: 720 }, theme: 'dark' },
    { name: 'mobile-430-dark', viewport: { width: 430, height: 720 }, theme: 'dark' },
    { name: 'tablet-light', viewport: { width: 768, height: 900 }, theme: 'light' },
    { name: 'tablet-dark', viewport: { width: 768, height: 900 }, theme: 'dark' },
    { name: 'desktop-light', viewport: { width: 1280, height: 800 }, theme: 'light' },
    { name: 'desktop-dark', viewport: { width: 1280, height: 800 }, theme: 'dark' },
    // Responsive shell: MOCK session, left rail/sidebar orientation assertions.
    { name: 'tablet-834-rail-dark', viewport: { width: 834, height: 1112 }, theme: 'dark', mockSession: true, expectedFormFactor: 'tablet', expectedNavWidth: SHELL_RAIL_W },
    { name: 'tablet-768-rail-light', viewport: { width: 768, height: 1024 }, theme: 'light', mockSession: true, expectedFormFactor: 'tablet', expectedNavWidth: SHELL_RAIL_W },
    { name: 'desktop-1440-sidebar-light', viewport: { width: 1440, height: 900 }, theme: 'light', mockSession: true, expectedFormFactor: 'desktop', expectedNavWidth: SHELL_SIDEBAR_W },
    { name: 'desktop-1920-sidebar-dark', viewport: { width: 1920, height: 1080 }, theme: 'dark', mockSession: true, expectedFormFactor: 'desktop', expectedNavWidth: SHELL_SIDEBAR_W },
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
      const extraAllowedPatterns = config.mockSession ? MOCK_SESSION_ALLOWED_ERROR_PATTERNS : [];
      await page.addInitScript(({ theme, mockSession }) => {
        globalThis.localStorage.setItem('mg_theme', theme);
        // The session hint makes restoreSession() ask /auth/refresh, which the mock answers.
        if (mockSession) globalThis.localStorage.setItem('mg_session_hint', '1');
      }, { theme: config.theme, mockSession: Boolean(config.mockSession) });
      if (config.mockSession) {
        await page.route('**/api/v1/**', mockApiRoute);
      }

      const criticalErrors = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!isAllowedError(text, extraAllowedPatterns)) {
            criticalErrors.push(`Console Error: ${text}`);
          }
        }
      });

      page.on('pageerror', (err) => {
        const text = err.toString();
        if (!isAllowedError(text, extraAllowedPatterns)) {
          criticalErrors.push(`Page Uncaught Exception: ${text}`);
        }
      });

      try {
        if (config.mockSession) {
          // The mocked fan-out and the realtime reconnect keep the network busy, so
          // networkidle is not a reliable settle signal here; wait for the shell itself.
          await page.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 12000 });
          await page.locator('[data-testid="global-bottom-navigation"]').waitFor({ state: 'visible', timeout: 15000 });
        } else {
          await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 12000 });
        }
      } catch (navErr) {
        criticalErrors.push(`Navigation Error: ${navErr.message}`);
      }

      // Check root element
      const rootHtml = await page.$eval('#root', (el) => el.innerHTML).catch(() => '');
      const rootText = await page.$eval('#root', (el) => el.innerText).catch(() => '');
      const viewport = await page.locator('html').evaluate((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight }));
      const actions = await page.locator('.auth-intro-screen button').evaluateAll((buttons) => buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { label: button.innerText.trim(), top: rect.top, bottom: rect.bottom };
      }));
      const layout = { ...viewport, actions };
      if (layout.scrollWidth > layout.width + 1) {
        criticalErrors.push(`Horizontal overflow: ${layout.scrollWidth}px content in ${layout.width}px viewport`);
      }
      const clippedAction = layout.actions.find((action) => action.top < 0 || action.bottom > layout.height);
      if (clippedAction) {
        criticalErrors.push(`Entry action outside viewport: ${clippedAction.label} (${Math.round(clippedAction.top)}–${Math.round(clippedAction.bottom)}px)`);
      }

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

      if (config.mockSession) {
        const shellFailures = await responsiveShellFailures(page, config).catch((err) => [`Responsive shell probe failed: ${err.message}`]);
        if (shellFailures.length > 0) {
          console.error(`  FAIL: responsive shell contract:\n    ${shellFailures.join('\n    ')}`);
          anyFailure = true;
        } else {
          console.log(`  PASS: ${config.expectedFormFactor} shell — fixed left ${config.expectedFormFactor === 'desktop' ? 'sidebar' : 'rail'} (${config.expectedNavWidth}px), create leads, 4 named tabs >= 44px, content clears the navigation.`);
        }
        if (config.expectedFormFactor === 'desktop') {
          const workspaceFailures = await desktopWorkspaceFailures(page, config).catch((err) => [`Desktop workspace probe failed: ${err.message}`]);
          if (workspaceFailures.length > 0) {
            console.error(`  FAIL: desktop workspace contract:\n    ${workspaceFailures.join('\n    ')}`);
            anyFailure = true;
          } else {
            console.log('  PASS: desktop workspace — full-bleed content, Home dashboard with 4 actions in one row and 3 destination photos across.');
          }
        }
      }

      if (config.name === 'mobile-light' || config.name === 'mobile-dark') {
        await page.getByRole('button', { name: 'У мене вже є акаунт' }).click();
        const loginVisible = await page.getByRole('heading', { name: 'Вхід до MARSHGO' }).isVisible();
        const loginShadeCount = await page.locator('.auth-screen__shade--login').count();
        const loginPalette = await page.locator('.auth-screen__shade--login').evaluate((element) => {
          const styles = element.ownerDocument.defaultView.getComputedStyle(element.ownerDocument.documentElement);
          return {
            canvas: styles.getPropertyValue('--mg-auth-canvas').trim().toLowerCase(),
            surface: styles.getPropertyValue('--mg-auth-surface').trim().toLowerCase(),
          };
        }).catch(() => ({ canvas: '', surface: '' }));
        const navyLoginPalette = loginPalette.canvas === '#071521' && loginPalette.surface === '#0b1b2c';
        if (!loginVisible || loginShadeCount !== 1 || !navyLoginPalette) {
          console.error(`  FAIL: Sign-in state did not render with its theme-independent navy palette (heading=${loginVisible}, shade=${loginShadeCount}, canvas=${loginPalette.canvas || 'missing'}, surface=${loginPalette.surface || 'missing'}).`);
          anyFailure = true;
        } else {
          const loginScreenshotPath = resolve(artifactsDir, `boot-smoke-login-${config.theme}.png`);
          await page.screenshot({ path: loginScreenshotPath, fullPage: false });
          console.log(`  PASS: Sign-in state visible. Screenshot saved: ${loginScreenshotPath}`);
        }
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
