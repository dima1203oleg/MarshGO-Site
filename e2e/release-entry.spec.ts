import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
];

test('production entry, onboarding and phone sign-in fit mobile and desktop viewports', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(`${error.name}: ${error.message}`));

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__MARSHGO_BOOTED__'))).toBe(true);
  await expect(page).toHaveTitle(/MARSHGO/);
  await expect(page.getByRole('heading', { name: /Усі способи доїхати — в одному застосунку/ })).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('button', { name: 'Почати', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'У мене вже є акаунт' })).toBeVisible();
    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    expect(layout.documentWidth, `document overflow at ${viewport.width}px`).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.bodyWidth, `body overflow at ${viewport.width}px`).toBeLessThanOrEqual(layout.viewportWidth);
  }

  await page.getByRole('button', { name: 'Почати', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Їдеш\? MARSHGO знайде попутника по дорозі/ })).toBeVisible();
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await expect(page.getByRole('heading', { name: 'Вхід за номером телефону' })).toBeVisible();
  await expect(page.getByPlaceholder('Ваше ім’я')).toBeVisible();
  await expect(page.getByPlaceholder('+380 номер телефону')).toBeVisible();
  expect(pageErrors, 'production entry should not raise uncaught browser errors').toEqual([]);
});

test('production entry paints a useful shell while the authenticated app chunk loads', async ({ page }) => {
  await page.route('**/assets/ProductionMarketplace-*.js', async route => {
    await new Promise(resolve => setTimeout(resolve, 800));
    await route.continue();
  });

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__MARSHGO_BOOTED__'))).toBe(true);
  await expect(page.getByTestId('app-startup-fallback')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Усі способи доїхати — в одному застосунку/ })).toBeVisible();
});

test('production entry deep links return the Ukrainian app shell', async ({ page }) => {
  await page.goto('/journeys/search?from=lviv-origin&to=lviv-destination');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__MARSHGO_BOOTED__'))).toBe(true);
  await expect(page).toHaveTitle(/MARSHGO/);
  await expect(page.getByRole('heading', { name: /Усі способи доїхати — в одному застосунку/ })).toBeVisible();
});

test('a failed initial app chunk offers a manual retry without an automatic reload loop', async ({ page }) => {
  let mainFrameNavigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) mainFrameNavigations++; });
  await page.route('**/assets/index-*.js', route => route.abort());
  await page.goto('/');

  await expect(page.getByRole('alert')).toContainText('Не вдалося завантажити MARSHGO');
  const beforeManualRetry = mainFrameNavigations;
  await page.waitForTimeout(500);
  expect(mainFrameNavigations).toBe(beforeManualRetry);

  await page.getByRole('button', { name: 'Спробувати ще раз' }).click();
  await expect.poll(() => mainFrameNavigations).toBeGreaterThan(beforeManualRetry);
  await expect(page.getByRole('alert')).toContainText('Не вдалося завантажити MARSHGO');
});
