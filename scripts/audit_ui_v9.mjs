/* global document */
import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:4176';
const ARTIFACT_DIR = '/Users/dima1203/.gemini/antigravity/brain/420442b4-8c8b-4642-9dfa-0f198beb740c';

async function audit() {
  console.log('--- STARTING MARSHGO 9.0 COMPREHENSIVE UI AUDIT ---');
  const browser = await chromium.launch({ headless: true });

  // 1. Audit Unauthenticated / Welcome Screen
  const unauthContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  const unauthPage = await unauthContext.newPage();
  await unauthPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await unauthPage.waitForTimeout(1000);
  await unauthPage.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-01-welcome-light.png` });
  console.log('Saved v9-audit-01-welcome-light.png');

  // Toggle Dark scheme for Welcome
  await unauthPage.emulateMedia({ colorScheme: 'dark' });
  await unauthPage.evaluate(() => document.documentElement.classList.add('dark'));
  await unauthPage.waitForTimeout(500);
  await unauthPage.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-01-welcome-dark.png` });
  console.log('Saved v9-audit-01-welcome-dark.png');
  await unauthContext.close();

  // 2. Authenticated Session Audit
  const authContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  const page = await authContext.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

  // Login
  const loginLink = page.locator('button:has-text("У мене вже є акаунт"), a:has-text("Увійти")').first();
  if (await loginLink.isVisible().catch(() => false)) {
    await loginLink.click();
    await page.waitForTimeout(500);
  }
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="пошта" i]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill('dima@marshgo.local');
    const pwdInput = page.locator('input[type="password"]').first();
    await pwdInput.fill('Marshgo#2026dev');
    const submitBtn = page.locator('button[type="submit"]:has-text("Увійти"), button:has-text("Увійти")').first();
    await submitBtn.click();
    await page.waitForTimeout(2000);
  }

  // Ensure Light theme
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.waitForTimeout(600);

  // Home Light
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-02-home-light.png` });
  console.log('Saved v9-audit-02-home-light.png');

  // Home Dark
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-02-home-dark.png` });
  console.log('Saved v9-audit-02-home-dark.png');

  // Home 320px Mobile constraint
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-02-home-320px.png` });
  console.log('Saved v9-audit-02-home-320px.png');
  await page.setViewportSize({ width: 390, height: 844 });

  // 3. Search Form Tab
  const searchTab = page.locator('button:has-text("Пошук")').first();
  await searchTab.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-03-search-form-dark.png` });
  console.log('Saved v9-audit-03-search-form-dark.png');

  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-03-search-form-light.png` });
  console.log('Saved v9-audit-03-search-form-light.png');

  // Search 320px
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-03-search-form-320px.png` });
  console.log('Saved v9-audit-03-search-form-320px.png');
  await page.setViewportSize({ width: 390, height: 844 });

  // 4. Fill Search & Execute
  const originInput = page.locator('input[placeholder="Місто відправлення"]');
  await originInput.click();
  await originInput.fill('Малоголосківська');
  await page.waitForSelector('#route-place-origin-list button', { timeout: 8000 });
  await page.locator('#route-place-origin-list button').first().click();
  await page.waitForTimeout(600);

  const destInput = page.locator('input[placeholder="Місто призначення"]');
  await destInput.click();
  await destInput.fill('Сихів, Львів');
  await page.waitForSelector('#route-place-destination-list button', { timeout: 8000 });
  await page.locator('#route-place-destination-list button').first().click();
  await page.waitForTimeout(600);

  const submitSearch = page.locator('button.search-submit');
  await submitSearch.click();

  console.log('Waiting for multimodal routes from backend...');
  await page.waitForSelector('[data-testid="journey-result-card"]', { timeout: 45000 });
  await page.waitForTimeout(1500);

  // Search Results Light
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-04-search-results-light.png` });
  console.log('Saved v9-audit-04-search-results-light.png');

  // Search Results Dark
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-04-search-results-dark.png` });
  console.log('Saved v9-audit-04-search-results-dark.png');

  // 5. Open Route Map
  const firstRoute = page.locator('[data-testid="journey-result-card"]').first();
  await firstRoute.click();
  await page.waitForTimeout(3000);

  // Route Map Overview Dark
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-05-route-map-dark.png` });
  console.log('Saved v9-audit-05-route-map-dark.png');

  // Route Map Overview Light
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-05-route-map-light.png` });
  console.log('Saved v9-audit-05-route-map-light.png');

  // 3D Perspective
  const btn3D = page.locator('button[aria-label*="3D-перспектива"]').first();
  if (await btn3D.isVisible().catch(() => false)) {
    await btn3D.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-06-route-map-3d.png` });
    console.log('Saved v9-audit-06-route-map-3d.png');
    await btn3D.click();
    await page.waitForTimeout(500);
  }

  // Satellite Mode
  const btnSat = page.locator('button[aria-label*="Супутникова карта"]').first();
  if (await btnSat.isVisible().catch(() => false)) {
    await btnSat.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-07-route-map-satellite.png` });
    console.log('Saved v9-audit-07-route-map-satellite.png');
    await btnSat.click();
    await page.waitForTimeout(500);
  }

  // Expand bottom sheet to full
  const sheetHeader = page.locator('[data-testid="route-sheet-header"], button[aria-label*="Розгорнути"]').first();
  if (await sheetHeader.isVisible().catch(() => false)) {
    await sheetHeader.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-08-route-sheet-full.png` });
    console.log('Saved v9-audit-08-route-sheet-full.png');
  }

  // 6. Back to Results and Navigate to Trips Tab
  const backBtn = page.locator('button[aria-label="Назад до результатів"]').first();
  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click();
    await page.waitForTimeout(800);
  }

  const tripsTab = page.locator('button:has-text("Поїздки"), [data-tab="trips"]').first();
  await tripsTab.click();
  await page.waitForTimeout(1000);

  // Trips Light
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-09-trips-light.png` });
  console.log('Saved v9-audit-09-trips-light.png');

  // Trips Dark
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-09-trips-dark.png` });
  console.log('Saved v9-audit-09-trips-dark.png');

  // 7. Profile Tab
  const profileTab = page.locator('button:has-text("Профіль"), [data-tab="profile"]').first();
  await profileTab.click();
  await page.waitForTimeout(1000);

  // Profile Dark
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-10-profile-dark.png` });
  console.log('Saved v9-audit-10-profile-dark.png');

  // Profile Light
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${ARTIFACT_DIR}/v9-audit-10-profile-light.png` });
  console.log('Saved v9-audit-10-profile-light.png');

  await browser.close();
  console.log('--- COMPREHENSIVE UI AUDIT COMPLETED SUCCESSFULLY ---');
}

audit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
