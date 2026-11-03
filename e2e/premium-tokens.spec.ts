import { expect, test, type Page } from '@playwright/test';
import { readThemeScopes } from '../tests/support/themeScopes';

/*
 * The CP5 gate: a token that exists in the source registry is not the same thing as a token that
 * reaches the screen. index.css can be internally consistent while the bundle the browser loads
 * references a role nobody declares — and then the element silently loses its colour or its
 * stacking layer, with no error anywhere. These specs read the compiled cascade from a real
 * Chromium, in both themes, and compare it against the token source.
 *
 * The dark theme is switched through localStorage ('mg_theme'), which is how themeService decides
 * html.dark — not by pre-painting the class ourselves, so the spec also proves the service ran.
 */

const { raw, resolved } = readThemeScopes();
const mgKeys = (scope: Record<string, string>) => Object.keys(scope).filter((token) => token.startsWith('--mg-'));

// The route sheet owns its own palette and CP5 deliberately left it alone; its --mg-* roles resolve
// inside .route-map-screen, not on <html>, so they are carved out rather than failed.
const routeScoped = new Set([...mgKeys(raw['.route-map-screen']), ...mgKeys(raw['.route-map-screen[data-theme="dark"]'])]);
const chromeTokens = [...new Set([...mgKeys(raw[':root']), ...mgKeys(raw['html.dark'])])].filter((t) => !routeScoped.has(t)).sort();
const hexOf = (value: string) => {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((d) => d + d)
    : [match[1].slice(0, 2), match[1].slice(2, 4), match[1].slice(4, 6)];
  return `rgb(${digits.map((d) => parseInt(d, 16)).join(', ')})`;
};

const openApp = async (page: Page, dark: boolean) => {
  await page.addInitScript((value) => localStorage.setItem('mg_theme', value), dark ? 'dark' : 'light');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('html');
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'), 'themeService did not apply the stored theme')).toBe(dark);
};

const readTokens = (page: Page, tokens: string[]) => page.evaluate((list) => {
  const probe = document.createElement('div');
  document.documentElement.append(probe);
  const declared: Record<string, string> = {};
  const painted: Record<string, string> = {};
  for (const token of list) {
    declared[token] = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    probe.style.color = `var(${token})`;
    painted[token] = getComputedStyle(probe).color;
  }
  probe.remove();
  return { declared, painted };
}, tokens);

/* Walks every same-origin rule the page actually loaded, tracking whether the chain sits under
   html.dark. Returns how many rules it reached so a silent failure to read the cascade cannot
   pass the checks below by looking at nothing. */
const readCssRules = (page: Page) => page.evaluate(() => {
  const darkImportant: string[] = [];
  const references: string[] = [];
  const declaredAnywhere = new Set<string>();
  let rulesWalked = 0;
  const skipped: string[] = [];

  const walk = (rules: CSSRuleList, underDark: boolean) => {
    for (const rule of Array.from(rules)) {
      const styleRule = rule as CSSStyleRule & { cssRules?: CSSRuleList };
      const own = !!styleRule.selectorText && /(^|[\s,])html\.dark\b/.test(styleRule.selectorText);
      const isDark = underDark || own;
      rulesWalked += 1;
      for (const property of Array.from(styleRule.style ?? [])) {
        if (property.startsWith('--mg-')) declaredAnywhere.add(property);
        if (isDark && styleRule.style.getPropertyPriority(property) === 'important')
          darkImportant.push(`${styleRule.selectorText} { ${property}: … !important }`);
      }
      // A reference with a fallback can never paint nothing, so --mg-stagger-i — which React sets
      // inline per index and CSS reads as var(--mg-stagger-i, 0) — is not a dangling token.
      for (const match of (styleRule.cssText || '').matchAll(/var\((--mg-[a-z0-9-]+)(\s*,)?/g))
        if (!match[2]) references.push(match[1]);
      if (styleRule.cssRules) walk(styleRule.cssRules, isDark);
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (!sheet.cssRules) skipped.push(sheet.href ?? '<inline style>');
      else walk(sheet.cssRules, false);
    }
    catch { skipped.push(sheet.href ?? '<inline style>'); }
  }
  return { darkImportant, references, declaredAnywhere: [...declaredAnywhere], rulesWalked, skipped };
});

test.describe('premium tokens on a real screen', () => {
  test('every chrome token resolves to a painted value in light and dark', async ({ page }) => {
    const light = await (async () => { await openApp(page, false); return readTokens(page, chromeTokens); })();
    const dark = await (async () => { await page.goto('about:blank'); await openApp(page, true); return readTokens(page, chromeTokens); })();
    for (const [name, { declared }] of [['light', light], ['dark', dark]] as const) {
      const empty = chromeTokens.filter((token) => declared[token] === '');
      expect(empty, `${name}: a chrome token paints nothing at document level`).toEqual([]);
      expect(Object.keys(declared).length, 'token set shrank under the probe').toBe(chromeTokens.length);
    }
  });

  test('the dark theme paints the dark ramp, and the source hex is what reaches the screen', async ({ page }) => {
    await openApp(page, false);
    const light = await readTokens(page, chromeTokens);
    await page.goto('about:blank');
    await openApp(page, true);
    const dark = await readTokens(page, chromeTokens);

    // A hex-resolved role is checkable against the browser without re-implementing color-mix.
    // The floor matters: if every role became a color-mix, the loop below would vacuate and still pass.
    let checked = 0;
    for (const [name, theme, painted] of [
      ['light', ':root', light.painted],
      ['dark', 'html.dark', dark.painted],
    ] as const) {
      for (const token of chromeTokens) {
        const expected = hexOf(resolved[theme][token] ?? '');
        if (!expected) continue;
        checked += 1;
        expect(painted[token], `${name}: ${token} is declared ${resolved[theme][token]} in the token source but the browser paints something else`)
          .toBe(expected);
      }
    }
    expect(checked, 'too few tokens resolve to a plain hex — the source-to-screen check has vacuated').toBeGreaterThanOrEqual(20);

    const identity = ['--mg-canvas', '--mg-blue', '--mg-blue-ink', '--mg-ink-primary', '--mg-surface-primary'];
    const unchanged = identity.filter((token) => light.painted[token] === dark.painted[token]);
    expect(unchanged, 'a themed role paints the same pixel in both themes, so the dark ramp is not answering')
      .toEqual([]);
    // The one role that deliberately does NOT move: --mg-action is a fill carrying --mg-on-action,
    // so it stays the same deep blue on both pages. Pinned, because if it changes in dark the
    // label contrast has to be re-checked, and that is a decision, not an accident.
    expect(dark.painted['--mg-action'], 'the filled control changed its blue between themes').toBe(light.painted['--mg-action']);
  });

  test('no html.dark rule in the loaded bundle uses !important', async ({ page }) => {
    await openApp(page, true);
    const { darkImportant, rulesWalked, skipped } = await readCssRules(page);
    expect(rulesWalked, 'the walk reached no rules — a green run here would mean nothing').toBeGreaterThan(200);
    // Cross-origin sheets throw on cssRules. The only one this app loads is the webfont CSS, which
    // holds @font-face and can never carry an html.dark override; anything else unreadable is a hole
    // in the sweep and must fail rather than be excused.
    const holes = skipped.filter((href) => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(href));
    expect(holes, 'a stylesheet could not be read and is not the webfont CSS').toEqual([]);
    expect(darkImportant, 'the dark theme went back to overriding with !important').toEqual([]);
  });

  test('every --mg-* the bundle references is declared somewhere the browser can see', async ({ page }) => {
    await openApp(page, false);
    const { references, declaredAnywhere, rulesWalked } = await readCssRules(page);
    expect(rulesWalked).toBeGreaterThan(200);
    const declaredInSource = new Set([...chromeTokens, ...mgKeys(raw[':root']), ...mgKeys(raw['html.dark'])]);
    const declared = new Set([...declaredInSource, ...declaredAnywhere]);
    // z-index and radius are the ones that fail silently: var(--mg-z-typo) is invalid to the
    // browser, so the element loses its stacking layer and nothing logs.
    const dangling = [...new Set(references.filter((token) => !declared.has(token) && !routeScoped.has(token)))];
    expect(dangling, 'a rule reads a role the registry never declares').toEqual([]);
    expect(new Set(references).size, 'the walk found no var(--mg-*) references, so the guard is not reading real CSS')
      .toBeGreaterThan(10);
  });
});
