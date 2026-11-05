// Measures the canonical Home quick-action grid on the production screen.
// Run: MARSHGO_EMAIL=... MARSHGO_PASSWORD=... node measure-home-grid.mjs <baseUrl> <label>
// Writes <label>-grid-metrics.json and <label>-<w>x<h>-<theme>.png next to this file.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const require = createRequire('/Users/dima1203/Desktop/MarshGO/');
const { chromium } = require('playwright');

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.argv[2] || 'http://127.0.0.1:3000/';
const LABEL = process.argv[3] || 'run';
const EMAIL = process.env.MARSHGO_EMAIL;
const PASSWORD = process.env.MARSHGO_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('MARSHGO_EMAIL and MARSHGO_PASSWORD must be set');

const VIEWPORTS = [
  { w: 320, h: 568 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
];
const THEMES = ['light', 'dark'];

const probe = () => {
  const hero = document.querySelector('.home-hero');
  const g = (el) => getComputedStyle(el);
  hero.scrollTop = 0;
  const heroBox = hero.getBoundingClientRect();
  const tabbar = document.querySelector('.app-tabbar');
  const cards = [...document.querySelectorAll('.home-action-card')].map((c) => {
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  const visible = cards.map((c) => Math.max(0, Math.min(c.bottom, heroBox.bottom) - Math.max(c.top, heroBox.top)));
  const banner = document.querySelector('.home-canonical-banner');
  const textNodes = [...document.querySelectorAll('.home-hero p, .home-hero h1, .home-hero h2, .home-hero span, .home-hero button')]
    .filter((el) => el.textContent.trim() && el.getClientRects().length)
    .map((el) => parseFloat(g(el).fontSize));
  const targets = [...document.querySelectorAll('.home-hero button, .app-tabbar button')]
    .filter((el) => el.getClientRects().length)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { label: (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) };
    });
  return {
    windowInner: [innerWidth, innerHeight],
    hero: {
      top: Math.round(heroBox.top),
      bottom: Math.round(heroBox.bottom),
      clientHeight: hero.clientHeight,
      scrollHeight: hero.scrollHeight,
      maxScroll: hero.scrollHeight - hero.clientHeight,
      paddingBottom: g(hero).paddingBottom,
    },
    tabbarTop: Math.round(tabbar.getBoundingClientRect().top),
    deadBand: Math.round(tabbar.getBoundingClientRect().top - heroBox.bottom),
    banner: banner
      ? { boxHeight: Math.round(banner.getBoundingClientRect().height), contentHeight: banner.scrollHeight, clipped: banner.scrollHeight > Math.ceil(banner.getBoundingClientRect().height) }
      : null,
    cards,
    squareTiles: cards.every((c) => Math.abs(c.w - c.h) <= 1),
    rowTwoVisibleRatio: cards.length === 4 ? Number((visible[2] / cards[2].h).toFixed(2)) : null,
    minFontSizePx: Math.min(...textNodes),
    touchTargetsBelow44: targets.filter((t) => t.h < 44 || t.w < 44),
  };
};

async function openHome(browser, viewport, theme) {
  const context = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h }, deviceScaleFactor: 1 });
  await context.addInitScript((value) => localStorage.setItem('mg_theme', value), theme);
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'load' });
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
  await page.waitForTimeout(700);
  return { context, page };
}

const browser = await chromium.launch();
const results = [];
for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    const { context, page } = await openHome(browser, viewport, theme);
    const metrics = await page.evaluate(probe);
    const file = join(OUT, `${LABEL}-${viewport.w}x${viewport.h}-${theme}.png`);
    await page.screenshot({ path: file, scale: 'css', type: 'png' });
    results.push({ ...metrics, label: LABEL, screen: `${viewport.w}x${viewport.h}`, theme, file });
    console.log(`${viewport.w}x${viewport.h} ${theme}: row2 ${results.at(-1).rowTwoVisibleRatio}, deadBand ${metrics.deadBand}, maxScroll ${metrics.hero.maxScroll}, bannerClipped ${metrics.banner?.clipped}, minFont ${metrics.minFontSizePx}`);
    await context.close();
  }
}
await browser.close();
writeFileSync(join(OUT, `${LABEL}-grid-metrics.json`), `${JSON.stringify(results, null, 2)}\n`);
