import { pathToFileURL } from 'node:url';

const pwPath = process.env.MARSHGO_PLAYWRIGHT
  ?? '/Users/dima1203/Desktop/MarshGO/node_modules/playwright/index.js';
const playwrightModule = await import(pathToFileURL(pwPath).href);
const { chromium } = playwrightModule.default ?? playwrightModule;

const BASE = process.env.MARSHGO_PREVIEW_URL ?? 'https://a602584pesfa.shares.zrok.io';

const probe = async (theme) => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(
    `try { localStorage.setItem('mg_theme', ${JSON.stringify(theme)}); } catch {}`,
  );
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  const share = page.getByRole('button', { name: /Visit Share/i });
  if (await share.count()) {
    await share.first().click();
    await page.waitForLoadState('networkidle', { timeout: 60_000 });
  }
  await page.getByRole('button', { name: 'У мене вже є акаунт' }).first().click();
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.waitForTimeout(1200);

  const out = await page.evaluate(() => {
    const email = document.querySelector('input[type="email"]');
    const password = document.querySelector('input[type="password"]');
    const main = document.querySelector('main.auth-screen');
    const overlay = main?.querySelector('div.absolute.inset-0');
    const read = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        colorScheme: s.colorScheme,
        backgroundColor: s.backgroundColor,
        backgroundImage: s.backgroundImage.slice(0, 60),
        borderColor: s.borderTopColor,
        boxShadow: s.boxShadow.slice(0, 60),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        valueLength: 'value' in el ? el.value.length : null,
        active: document.activeElement === el,
      };
    };
    let autofill = 'unsupported';
    try {
      autofill = email.matches(':autofill');
    } catch {
      autofill = 'selector-threw';
    }
    return {
      htmlClass: document.documentElement.className,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      mainClass: main ? main.className : null,
      mainBgImage: overlay ? getComputedStyle(overlay).backgroundImage.slice(0, 90) : null,
      email: read(email),
      password: read(password),
      autofill,
      activeTag: document.activeElement?.tagName,
    };
  });
  const png = await page.screenshot({ path: `/tmp/probe-${theme}.png` });
  console.log(JSON.stringify({ theme, out }, null, 1));
  await browser.close();
  return png;
};

await probe('light');
await probe('dark');
