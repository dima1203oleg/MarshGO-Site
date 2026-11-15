import { pathToFileURL } from 'node:url';

const pwPath = process.env.MARSHGO_PLAYWRIGHT
  ?? '/Users/dima1203/Desktop/MarshGO/node_modules/playwright/index.js';
const playwrightModule = await import(pathToFileURL(pwPath).href);
const { chromium } = playwrightModule.default ?? playwrightModule;

const BASE = process.env.MARSHGO_PREVIEW_URL ?? 'https://a602584pesfa.shares.zrok.io';

const PATHS = [
  '/', '/search', '/journeys/search', '/trips', '/profile', '/map', '/navigate',
  '/demands', '/messages', '/this-route-does-not-exist',
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
const share = page.getByRole('button', { name: /Visit Share/i });
if (await share.count()) {
  await share.first().click();
  await page.waitForLoadState('networkidle', { timeout: 60_000 });
}
// the interstitial cookie is now set for this context; sweep the guest routes
for (const path of PATHS) {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => ({
    auth: !!document.querySelector('main.auth-screen'),
    production: !!document.querySelector('.production-app'),
    notFound: /Не знайдено|404/.test(document.body.innerText),
    heading: document.querySelector('h1')?.innerText?.replace(/\s+/g, ' ').slice(0, 60) ?? null,
    storageKeys: (() => { try { return Object.keys(localStorage).sort().join(',') || 'empty'; } catch { return 'blocked'; } })(),
  }));
  console.log(
    `${path.padEnd(28)} auth-screen=${String(r.auth).padEnd(5)} production-app=${String(r.production).padEnd(5)} 404=${String(r.notFound).padEnd(5)} storage=[${r.storageKeys}]  h1="${r.heading}"`,
  );
}
await browser.close();
