import { chromium } from '/Users/dima1203/Desktop/MarshGO/node_modules/playwright/index.mjs';

const ARTIFACT_DIR = '/Users/dima1203/.gemini/antigravity/brain/420442b4-8c8b-4642-9dfa-0f198beb740c';
const BASE_URL = 'http://127.0.0.1:4176/';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  console.log('1. Logging in...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const welcomeLogin = page.locator('button:has-text("У мене вже є акаунт")');
  if (await welcomeLogin.isVisible().catch(() => false)) {
    await welcomeLogin.click();
    await page.waitForTimeout(300);
  }

  const emailField = page.locator('#login-email');
  if (await emailField.isVisible().catch(() => false)) {
    await emailField.fill('dima@marshgo.local');
    await page.locator('#login-password').fill('Marshgo#2026dev');
    await page.locator('button[type="submit"]:has-text("Увійти")').click();
  }

  await page.waitForSelector('.production-app', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 1. Home screen with MarshPass ticket
  console.log('1. Capturing Home screen with MarshPass ticket...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/screen-1-home-marshpass-v6.png`, fullPage: false });
  console.log('Saved screen-1-home-marshpass-v6.png');

  // 2. Search form
  console.log('2. Navigating to Search tab...');
  const searchTabBtn = page.locator('button:has-text("Пошук")').first();
  await searchTabBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${ARTIFACT_DIR}/screen-2-search-form-v6.png`, fullPage: false });
  console.log('Saved screen-2-search-form-v6.png');

  // 3. Search route "Малоголосківська" -> "Сихів, Львів"
  console.log('3. Searching route...');
  const originInput = page.locator('input[placeholder="Місто відправлення"]');
  await originInput.click();
  await originInput.fill('Малоголосківська');
  await page.waitForSelector('#route-place-origin-list button', { timeout: 5000 });
  await page.locator('#route-place-origin-list button').first().click();

  const destInput = page.locator('input[placeholder="Місто призначення"]');
  await destInput.click();
  await destInput.fill('Сихів, Львів');
  await page.waitForSelector('#route-place-destination-list button', { timeout: 5000 });
  await page.locator('#route-place-destination-list button').first().click();

  await page.waitForTimeout(500);
  const searchSubmit = page.locator('button.search-submit');
  await searchSubmit.click();
  console.log('Waiting up to 45s for route results...');

  await page.waitForSelector('[data-testid="journey-result-card"]', { timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/screen-3-search-results-v6.png`, fullPage: false });
  console.log('Saved screen-3-search-results-v6.png');

  // 4. Open first route on Route Map
  console.log('4. Opening first route on Route Map...');
  const firstCard = page.locator('[data-testid="journey-result-card"]').first();
  await firstCard.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/screen-4-route-map-overview-v6.png`, fullPage: false });
  console.log('Saved screen-4-route-map-overview-v6.png');

  // 5. Toggle 3D perspective
  console.log('5. Toggling 3D perspective...');
  const btn3D = page.locator('button[aria-label*="3D-перспектива"]').first();
  if (await btn3D.isVisible().catch(() => false)) {
    await btn3D.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ARTIFACT_DIR}/screen-5-route-map-3d-v6.png`, fullPage: false });
    console.log('Saved screen-5-route-map-3d-v6.png');
    // Toggle back to 2D
    await btn3D.click();
    await page.waitForTimeout(500);
  }

  // 6. Toggle Satellite mode
  console.log('6. Toggling Satellite mode...');
  const btnSat = page.locator('button[aria-label*="Супутникова карта"]').first();
  if (await btnSat.isVisible().catch(() => false)) {
    await btnSat.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ARTIFACT_DIR}/screen-6-route-map-satellite-v6.png`, fullPage: false });
    console.log('Saved screen-6-route-map-satellite-v6.png');
    // Toggle back to scheme
    await btnSat.click();
    await page.waitForTimeout(500);
  }

  // 7. Expand route sheet to Full
  console.log('7. Expanding bottom sheet...');
  const sheetHeader = page.locator('[data-testid="route-sheet-header"], button[aria-label*="Розгорнути"]').first();
  if (await sheetHeader.isVisible().catch(() => false)) {
    await sheetHeader.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${ARTIFACT_DIR}/screen-7-route-map-details-v6.png`, fullPage: false });
    console.log('Saved screen-7-route-map-details-v6.png');
  }

  // 8. Close map and navigate to Trips tab
  console.log('8. Navigating to Trips tab...');
  const backBtn = page.locator('button[aria-label="Назад до результатів"]').first();
  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click();
    await page.waitForTimeout(800);
  }
  const tripsTabBtn = page.locator('button:has-text("Поїздки"), [data-tab="trips"]').first();
  await tripsTabBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/screen-8-trips-v6.png`, fullPage: false });
  console.log('Saved screen-8-trips-v6.png');

  // 9. Navigate to Profile tab
  console.log('9. Navigating to Profile tab...');
  const profileTabBtn = page.locator('button:has-text("Профіль"), [data-tab="profile"]').first();
  await profileTabBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/screen-9-profile-v6.png`, fullPage: false });
  console.log('Saved screen-9-profile-v6.png');

  await browser.close();
  console.log('ALL 9 SCREENS CAPTURED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('Error in Playwright script:', err);
  process.exit(1);
});
