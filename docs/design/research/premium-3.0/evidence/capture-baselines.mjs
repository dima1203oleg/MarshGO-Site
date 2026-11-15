#!/usr/bin/env node
/**
 * Visual baseline capture for the Premium 3.0 audit (A0 · CP3).
 *
 * Own harness, deliberately NOT a repo Playwright project: the baseline SHA of
 * MarshGO-Site ships no playwright dependency, no config and no e2e folder (see
 * FEATURE_PARITY_AND_PR_CONFLICTS.md §5). Playwright is therefore resolved by
 * absolute path from the orchestration repo and neither package.json is touched.
 *
 *   node docs/design/research/premium-3.0/evidence/capture-baselines.mjs
 *
 * Rules encoded here:
 *   - the target is the public HTTPS preview, re-probed on every run;
 *   - the served entry bundle must still be the pinned one, else the run aborts:
 *     a screenshot of an unknown build is not a baseline;
 *   - the zrok interstitial is passed once per context and itself captured, so a
 *     reader can see that the public URL gates the first visit;
 *   - one browser context at a time (8 GB host), no parallel workers;
 *   - PNGs land only inside evidence/baselines/;
 *   - only states reachable WITHOUT login, GPS or a booking are walked. The
 *     authenticated screens are recorded as NOT_VERIFIED rows in the manifest,
 *     never as invented pixels.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pwPath = process.env.MARSHGO_PLAYWRIGHT
  ?? '/Users/dima1203/Desktop/MarshGO/node_modules/playwright/index.js';
if (!existsSync(pwPath)) throw new Error(`playwright not found at ${pwPath}`);
// playwright ships CommonJS, so the namespace's default holds the API.
const playwrightModule = await import(pathToFileURL(pwPath).href);
const { chromium } = playwrightModule.default ?? playwrightModule;

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, 'baselines');
const BASE = process.env.MARSHGO_PREVIEW_URL ?? 'https://a602584pesfa.shares.zrok.io';
const BUILD_SHA = '8d927e8098a36f94f2ac519e52f7c720f1e0d239';
// Recorded in BASELINE_PIN.md §3 as the entry asset served over public HTTPS.
const PINNED_ENTRY = 'assets/index-Ci-jmXW8.js';
const PINNED_ENTRY_SHA256 =
  'eeae08878658e7f5d7b14da7a47ccdf8793c60f0fa0d0581e194fa5d1d1ac1f0';

const VIEWPORTS = [
  { name: 'iphone15', width: 390, height: 844, dpr: 3 },
  { name: 'iphone-se', width: 375, height: 667, dpr: 2 },
  { name: 'iphone-max', width: 430, height: 932, dpr: 3 },
  { name: 'desktop', width: 1440, height: 900, dpr: 1 },
];

/** Guest walks: each entry is reachable by the listed click path, nothing more. */
const GUEST_STATES = [
  { state: 'landing-intro', steps: [], expect: 'Усі способи' },
  { state: 'onboarding-step', steps: ['Почати'], expect: 'Пропустити' },
  { state: 'login-form', steps: ['У мене вже є акаунт'], expect: 'Вхід' },
];

/** States the audit cares about but a guest cannot reach; captured as rows only. */
const NOT_VERIFIED = [
  'home', 'search', 'results', 'route-map', 'route-details', 'private-ride-details',
  'marshpass', 'marshpass-details', 'active-navigation', 'driver-flow', 'chat',
  'profile-own', 'trips-list', 'booking-confirmed', 'offline-notice', 'all-12-modes',
].map((state) => ({
  state,
  reason: 'needs an authenticated session, GPS consent or a confirmed booking',
}));

const THEMES = ['light', 'dark'];

async function probeEntry() {
  const res = await fetch(`${BASE}/`, { headers: { accept: 'text/html' } });
  if (!res.ok) throw new Error(`preview ${BASE}/ -> HTTP ${res.status}`);
  const html = await res.text();
  const entry = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
  if (!entry) throw new Error('no hashed entry in served HTML');
  const bytes = new Uint8Array(await (await fetch(`${BASE}/${entry}`)).arrayBuffer());
  return { entry, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}

async function probeGuestApi() {
  const out = {};
  for (const p of ['/api/v1/health', '/api/v1/journeys/search', '/api/v1/bookings',
    '/api/v1/transport-regions', '/api/v1/marshpass']) {
    try {
      out[p] = (await fetch(`${BASE}${p}`, { method: 'GET' })).status;
    } catch (error) {
      out[p] = `ERR ${error.name}`;
    }
  }
  return out;
}

/**
 * Computed facts about the frame we are about to save. Kept next to the pixels so
 * a later claim ("the label is 10 px") is a measurement, not a reading of CSS.
 */
async function measure(page) {
  return page.evaluate(() => {
    const size = (el) => (el ? Number.parseFloat(getComputedStyle(el).fontSize) : null);
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    };
    const buttons = [...document.querySelectorAll('button')].filter((el) => el.textContent.trim());
    const smallest = buttons
      .map((el) => ({ label: el.textContent.trim().slice(0, 28), font: size(el), box: box(el) }))
      .filter((x) => Number.isFinite(x.font))
      .sort((a, b) => a.font - b.font)
      .slice(0, 5);
    return {
      htmlClass: document.documentElement.className,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      buttonCount: buttons.length,
      smallestFonts: smallest,
      inputs: [...document.querySelectorAll('input')].map((el) => ({
        type: el.type, label: el.getAttribute('aria-label') || el.placeholder || null,
        font: size(el), box: box(el),
      })),
      h1: (document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      headingFont: size(document.querySelector('h1')),
      mapCanvas: Boolean(document.querySelector('canvas.maplibregl-canvas')),
      productionShell: Boolean(document.querySelector('.production-app')),
      authShell: Boolean(document.querySelector('.auth-screen')),
    };
  });
}

async function passInterstitial(page) {
  const button = page.getByRole('button', { name: /Visit Share/i });
  if (await button.count()) {
    await button.first().click({ timeout: 8000 });
    await page.waitForTimeout(2500);
    return true;
  }
  return false;
}

async function walk(page, steps) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await passInterstitial(page);
  await page.waitForTimeout(1500);
  for (const label of steps) {
    await page.getByRole('button', { name: label }).first().click({ timeout: 8000 });
    await page.waitForTimeout(900);
  }
}

function sha(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const probe = await probeEntry();
  if (probe.entry !== PINNED_ENTRY || probe.sha256 !== PINNED_ENTRY_SHA256) {
    throw new Error(
      `served build is not the pinned one: ${probe.entry} ${probe.sha256.slice(0, 16)}…, ` +
      `expected ${PINNED_ENTRY} ${PINNED_ENTRY_SHA256.slice(0, 16)}…`,
    );
  }
  const apiProbe = await probeGuestApi();
  const browser = await chromium.launch({ headless: true });
  const entries = [];
  const measures = [];

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.dpr,
        isMobile: viewport.name !== 'desktop',
        hasTouch: viewport.name !== 'desktop',
        reducedMotion: 'no-preference',
      });
      await context.addInitScript(
        `try { localStorage.setItem('mg_theme', ${JSON.stringify(theme)}); } catch {}`,
      );

      // The interstitial belongs to the share infrastructure, not to MARSHGO. It is
      // saved once so nobody later mistakes a blank capture for a broken app.
      const firstPage = await context.newPage();
      await firstPage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (await firstPage.getByRole('button', { name: /Visit Share/i }).count()) {
        const png = await firstPage.screenshot({ type: 'png' });
        const file = `${viewport.name}-${theme}-proxy-interstitial.png`;
        writeFileSync(resolve(OUT_DIR, file), png);
        entries.push({
          file: `baselines/${file}`, sha256: sha(png), url: `${BASE}/`, buildSha: BUILD_SHA,
          viewport: `${viewport.width}x${viewport.height}@${viewport.dpr}`, theme,
          routePath: '/', state: 'proxy-interstitial', dataMode: 'NOT_PRODUCT_infrastructure',
          capturedAt: new Date().toISOString(), probe: apiProbe,
          notes: 'zrok first-visit consent page; not the MARSHGO UI',
        });
      }
      await firstPage.close();

      for (const guest of GUEST_STATES) {
        const page = await context.newPage();
        const capturedAt = new Date().toISOString();
        try {
          await walk(page, guest.steps);
          const png = await page.screenshot({ type: 'png' });
          const file = `${viewport.name}-${theme}-${guest.state}.png`;
          writeFileSync(resolve(OUT_DIR, file), png);
          entries.push({
            file: `baselines/${file}`, sha256: sha(png), url: `${BASE}/`, buildSha: BUILD_SHA,
            entryAsset: probe.entry, entrySha256: probe.sha256,
            viewport: `${viewport.width}x${viewport.height}@${viewport.dpr}`,
            viewportName: viewport.name, isMobile: viewport.name !== 'desktop', theme,
            routePath: '/', state: guest.state, path: guest.steps, dataMode: 'LIVE_API_GUEST',
            capturedAt, probe: apiProbe,
            notes: 'guest walk, no credentials, no geolocation, no booking',
          });
          measures.push({ key: `${viewport.name}/${theme}/${guest.state}`, ...await measure(page) });
        } catch (error) {
          entries.push({
            file: null, sha256: null, url: `${BASE}/`, buildSha: BUILD_SHA,
            viewport: `${viewport.width}x${viewport.height}@${viewport.dpr}`, theme,
            routePath: '/', state: guest.state, dataMode: 'LIVE_API_GUEST', capturedAt,
            probe: apiProbe, notes: `CAPTURE_FAILED: ${error.message}`,
          });
        } finally {
          await page.close();
        }
      }
      await context.close();
    }
  }

  for (const row of NOT_VERIFIED) {
    entries.push({
      file: null, sha256: null, url: `${BASE}/`, buildSha: BUILD_SHA,
      viewport: null, theme: null, routePath: '/', state: row.state,
      dataMode: 'NOT_VERIFIED', capturedAt: new Date().toISOString(), probe: apiProbe,
      notes: row.reason,
    });
  }

  await browser.close();
  entries.sort((a, b) => String(a.file ?? 'zz').localeCompare(String(b.file ?? 'zz')));
  writeFileSync(resolve(HERE, 'manifest.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(), base: BASE, buildSha: BUILD_SHA,
    entry: probe, viewports: VIEWPORTS, guestStates: GUEST_STATES, entries,
  }, null, 2)}\n`);
  writeFileSync(resolve(HERE, 'live-measures.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(), measures,
  }, null, 2)}\n`);
  const shots = entries.filter((e) => e.file).length;
  console.log(`captured ${shots} PNGs; not-verified rows ${entries.filter((e) => e.dataMode === 'NOT_VERIFIED').length}`);
  console.log(`entry ${basename(probe.entry)} sha256 ${probe.sha256.slice(0, 16)}… bytes ${probe.bytes}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
