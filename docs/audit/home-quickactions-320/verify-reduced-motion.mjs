// Reduced-motion check for the canonical Home grid at 320x568.
// Run: MARSHGO_EMAIL=... MARSHGO_PASSWORD=... node verify-reduced-motion.mjs [baseUrl]
// Writes after-320x568-light-reduced-motion.png next to this file.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const require = createRequire('/Users/dima1203/Desktop/MarshGO/');
const { chromium } = require('playwright');

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'http://127.0.0.1:3001/';
const EMAIL = process.env.MARSHGO_EMAIL;
const PASSWORD = process.env.MARSHGO_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('MARSHGO_EMAIL and MARSHGO_PASSWORD must be set');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
await context.addInitScript(() => localStorage.setItem('mg_theme', 'light'));
const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'load' });

const email = page.locator('input[type="email"]');
for (let step = 0; step < 4 && !(await email.count()); step += 1) {
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button, a')].find((node) => /У мене вже є акаунт|Пропустити|Почати/.test(node.textContent));
    el?.click();
  });
  await page.waitForTimeout(400);
}
await email.fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Увійти');
  el?.click();
});
await page.waitForSelector('.home-hero .home-action-card', { timeout: 15000 });
await page.waitForTimeout(1500);

const report = await page.evaluate(() => {
  const hero = document.querySelector('.home-hero');
  const heroBox = hero.getBoundingClientRect();
  return {
    heroHeightPx: Math.round(heroBox.height),
    innerScrollPx: hero.scrollHeight - hero.clientHeight,
    bottomNavItems: document.querySelectorAll('.app-tabbar a, .app-tabbar button').length,
    bannerEyebrowDisplay: getComputedStyle(document.querySelector('.home-banner-eyebrow')).display,
    animationsStillRunning: hero.getAnimations({ subtree: true }).filter((a) => a.playState !== 'finished').length,
    tiles: [...document.querySelectorAll('.home-action-card')].map((card) => {
      const r = card.getBoundingClientRect();
      const visible = Math.max(0, Math.min(r.bottom, heroBox.bottom) - Math.max(r.top, heroBox.top));
      return `${Math.round(r.width)}x${Math.round(r.height)} ratio=${(r.width / r.height).toFixed(2)} visibleInHero=${Math.round(visible)}px`;
    }),
  };
});

await page.screenshot({ path: `${OUT}/after-320x568-light-reduced-motion.png`, scale: 'css', type: 'png' });
console.log(JSON.stringify(report, null, 1));
await browser.close();
