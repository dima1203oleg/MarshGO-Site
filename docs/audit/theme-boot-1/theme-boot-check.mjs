// THEME-1 evidence harness (real Chromium on the built production graph; API proxy points at a
// dead port so error pills come from genuine fetch failures — no mocked data is displayed).
// Usage: node docs/audit/theme-boot-1/theme-boot-check.mjs --url http://127.0.0.1:4174 --label before
import { createRequire } from 'node:module';
const require = createRequire('/Users/dima1203/Desktop/MarshGO/');
const { chromium } = require('playwright');
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => {
  if (!a.startsWith('--')) return [];
  return [a.slice(2), arr[i + 1]];
}));
const url = args.url;
const label = args.label;
const outDir = path.resolve(import.meta.dirname);
if (!url || !label) throw new Error('need --url and --label');

const parseRgb = (value) => {
  const m = /rgba?\(([^)]+)\)/.exec(value);
  if (!m) return null;
  const [r, g, b, a] = m[1].split(',').map(Number);
  return { r, g, b, a: a === undefined ? 1 : a };
};

const measurePill = (el) => {
  const probe = document.createElement('canvas');
  probe.width = 1; probe.height = 1;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  const parseLayer = (value) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const layers = [];
  let node = el;
  while (node && layers.length < 12) {
    const layer = parseLayer(getComputedStyle(node).backgroundColor);
    if (layer && layer.a > 0) { layers.push(layer); if (layer.a >= 1) break; }
    node = node.parentElement;
  }
  if (!layers.length || layers[layers.length - 1].a < 1) {
    layers.push({ r: 255, g: 255, b: 255, a: 1 });
  }
  let out = layers[layers.length - 1];
  for (let i = layers.length - 2; i >= 0; i--) {
    const top = layers[i];
    out = { r: Math.round(top.r * top.a + out.r * (1 - top.a)), g: Math.round(top.g * top.a + out.g * (1 - top.a)), b: Math.round(top.b * top.a + out.b * (1 - top.a)), a: 1 };
  }
  const textEl = el.querySelector('span') || el;
  const color = parseLayer(getComputedStyle(textEl).color);
  return { surface: `rgb(${out.r}, ${out.g}, ${out.b})`, ink: `rgb(${color.r}, ${color.g}, ${color.b})`,
    role: el.getAttribute('role'), icon: Boolean(el.querySelector('svg')),
    alertIcon: Boolean(el.querySelector('svg[class*="alert"]')),
    srText: Boolean(el.querySelector('.sr-only')) };
};
const luminance = ({ r, g, b }) => {
  const ch = [r, g, b].map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const sampler = ({ storedTheme }) => {
  try { localStorage.setItem('mg_theme', storedTheme); } catch { /* ignore */ }
  window.__bootSamples = [];
  const t0 = performance.now();
  const tick = () => {
    const el = document.documentElement;
    if (el) {
      window.__bootSamples.push({
        ms: Math.round(performance.now() - t0),
        darkClass: el.classList.contains('dark'),
        bootDark: el.classList.contains('boot-dark'),
        htmlBg: getComputedStyle(el).backgroundColor,
        bodyBg: document.body ? getComputedStyle(document.body).backgroundColor : null,
      });
    }
    if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
  };
  tick();
};

const browser = await chromium.launch();
const results = { label, url, flash: {}, auto: {}, pills: {} };

// --- (a) cold boot with OS dark + stored "Авто" (system) ---
{
  const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
  await context.addInitScript(sampler, { storedTheme: 'system' });
  const page = await context.newPage();
  const started = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  let shotMs = Date.now() - started;
  try {
    await page.screenshot({ path: path.join(outDir, `flash-${label}-firstframe.png`), timeout: 5000 });
  } catch {
    // the compositor can refuse a capture during navigation; the rAF sample timeline is the primary evidence
    shotMs = null;
  }
  await page.waitForFunction('window.__MARSHGO_BOOTED__ === true', null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(outDir, `flash-${label}-settled.png`) });
  const samples = await page.evaluate('window.__bootSamples');
  const firstDark = samples.find(s => s.darkClass);
  const lightFrames = firstDark ? samples.filter(s => !s.darkClass && s.ms < firstDark.ms).length : samples.filter(s => !s.darkClass).length;
  results.flash = {
    firstFrameScreenshotAtMs: shotMs,
    firstSample: samples[0],
    firstDarkFrameMs: firstDark ? firstDark.ms : null,
    lightFramesBeforeDark: lightFrames,
    totalFrames: samples.length,
    darkAtT0: Boolean(samples[0] && samples[0].darkClass),
  };
  // --- (b) live OS scheme flips while stored theme stays "system" ---
  const flip = async (scheme) => {
    await page.emulateMedia({ colorScheme: scheme });
    const t = Date.now();
    const want = scheme === 'dark';
    const ok = await page.waitForFunction(
      `document.documentElement.classList.contains('dark') === ${want}`, null, { timeout: 4000 }
    ).then(() => true).catch(() => false);
    return { ok, ms: Date.now() - t };
  };
  results.auto = {
    toLight: await flip('light'),
    backToDark: await flip('dark'),
    settledDarkClass: await page.evaluate("document.documentElement.classList.contains('dark')"),
  };
  await page.screenshot({ path: path.join(outDir, `auto-${label}-dark.png`) });
  await context.close();
}

// --- explicit-theme home screenshots + (c) info/error pills (session via the live acceptance API
// on 3902 through the preview proxy; the geocode failure is a real network error injected on the
// wire, so the app renders its genuine production error path) ---
const email = process.env.THEME1_E_EMAIL;
const password = process.env.THEME1_E_PASSWORD;
if (!email || !password) throw new Error('set THEME1_E_EMAIL / THEME1_E_PASSWORD for the pill phase');
for (const scheme of ['light', 'dark']) {
  for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ colorScheme: scheme, viewport: vp });
    await context.addInitScript("try { localStorage.setItem('mg_theme', 'system'); } catch {}");
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const login = await page.request.post(`${url}/api/v1/auth/login`, { data: { email, password } });
    if (!login.ok()) throw new Error(`login failed: ${login.status()}`);
    await page.route('**/api/v1/places/suggest*', route => route.abort('connectionrefused'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__MARSHGO_BOOTED__ === true', null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, `home-${vp.width}x${vp.height}-${scheme}-${label}.png`) });
    await page.getByRole('button', { name: /^Пошук/ }).first().click();
    const originBox = page.getByRole('combobox').first();
    await originBox.waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);

    // error path first: typing >=3 chars fires the debounced geocoder; the aborted route fails the fetch
    await originBox.fill('Хрещатик');
    const errorPill = page.locator(`[role="${label === 'after' ? 'alert' : 'status'}"]`, { hasText: /Немає зв’язку|Пошук місця недоступний|Не вдалося/ });
    const foundError = await errorPill.first().waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
    if (foundError) {
      const measured = await errorPill.first().evaluate(measurePill);
      const surface = parseRgb(measured.surface); const ink = parseRgb(measured.ink);
      results.pills[`error-${scheme}-${vp.width}x${vp.height}`] = { ...measured, ratio: surface && ink ? Number(contrast(ink, surface).toFixed(2)) : null };
      await errorPill.first().screenshot({ path: path.join(outDir, `pill-${label}-error-${vp.width}x${vp.height}-${scheme}.png`) }).catch(() => {});
    } else {
      results.pills[`error-${scheme}-${vp.width}x${vp.height}`] = { found: false };
    }

    // info path: both text fields filled but no geocoder place chosen → validation notice, info tone
    await page.getByRole('combobox').nth(1).fill('Київ');
    const searchButton = page.getByRole('button', { name: /Знайти маршрут/ }).first();
    await searchButton.click().catch(() => {});
    const info = page.locator('[role="status"]', { hasText: /оберіть обидві точки|Вкажіть початок/ });
    const foundInfo = await info.first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    if (foundInfo) {
      const measured = await info.first().evaluate(measurePill);
      const surface = parseRgb(measured.surface); const ink = parseRgb(measured.ink);
      results.pills[`info-${scheme}-${vp.width}x${vp.height}`] = { ...measured, ratio: surface && ink ? Number(contrast(ink, surface).toFixed(2)) : null };
      await info.first().screenshot({ path: path.join(outDir, `pill-${label}-info-${vp.width}x${vp.height}-${scheme}.png`) }).catch(() => {});
    } else {
      results.pills[`info-${scheme}-${vp.width}x${vp.height}`] = { found: false };
    }
    await context.close();
  }
}

await browser.close();
fs.writeFileSync(path.join(outDir, `measurements-${label}.json`), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
