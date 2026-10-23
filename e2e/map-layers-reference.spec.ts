import { expect, test } from '@playwright/test';

test('transport layers match the grouped reference and only enable available data', async ({ page }, testInfo) => {
  const user = { id: 'map-layers-user', display_name: 'Тестовий пасажир', phone_e164: '+380991234567', roles: ['passenger'], is_verified: true, driver_photo_url: null };
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const json = (data: unknown, status = 200) => route.fulfill({ status, json: { data } });
    if (path === '/auth/refresh') return route.fulfill({ status: 401, json: { error: { message: 'Сесія відсутня' } } });
    if (path === '/auth/otp/request') return json({ expiresInSeconds: 300, delivery: 'development', developmentCode: '123456' });
    if (path === '/auth/otp/verify') return json({ user, accessToken: 'e2e-map-layers-token' });
    if (path === '/users/me') return json(user);
    if (path === '/transport/layers') return json([
      { id: 'BUS', available: true }, { id: 'MINIBUS', available: true }, { id: 'TROLLEYBUS', available: true },
      { id: 'TRAIN', available: true }, { id: 'TRAM', available: true }, { id: 'BICYCLE', available: false },
      { id: 'METRO', available: false }, { id: 'SCOOTER', available: false }, { id: 'CARPOOL', available: false },
      { id: 'CARSHARING', available: false }, { id: 'TAXI', available: false }, { id: 'TRANSFER', available: false },
      { id: 'STOPS', available: true }, { id: 'RENTAL_POINTS', available: false },
    ]);
    if (path === '/transport/cities') return json([]);
    return json([]);
  });

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__MARSHGO_BOOTED__'))).toBe(true);
  await page.getByRole('button', { name: 'Почати', exact: true }).click();
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await page.getByPlaceholder('Ваше ім’я').fill(user.display_name);
  await page.getByPlaceholder('+380 номер телефону').fill(user.phone_e164);
  await page.getByRole('button', { name: 'Почати', exact: true }).click();
  await page.getByPlaceholder('••••••').fill('123456');
  await page.getByRole('button', { name: 'Підтвердити номер' }).click();
  await page.getByRole('button', { name: /Карта транспорту/ }).click();

  await page.getByRole('button', { name: 'Шари карти' }).click();
  const dialog = page.getByRole('dialog', { name: 'Шари карти' });
  await expect(dialog).toBeVisible();
  await testInfo.attach('transport-layers-sheet', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  for (const heading of ['Транспорт', 'Відображення', 'Інфраструктура']) await expect(dialog.getByRole('button', { name: heading, exact: true })).toHaveAttribute('aria-expanded', 'true');
  for (const category of ['Автобуси', 'Маршрутки', 'Тролейбуси', 'Поїзди', 'Трамваї', 'Велосипеди', 'Метро', 'Самокати', 'Попутки', 'Каршеринг', 'Таксі', 'Трансфери']) {
    await expect(dialog.getByText(category, { exact: true })).toBeVisible();
  }
  const buses = dialog.getByRole('switch', { name: 'Автобуси' });
  await expect(buses).toBeEnabled();
  await expect(buses).not.toBeChecked();
  await dialog.getByText('Автобуси', { exact: true }).click();
  await expect(buses).toBeChecked();
  await expect(dialog.getByRole('switch', { name: /Час прибуття \(ETA\): дані недоступні/ })).toHaveAttribute('aria-disabled', 'true');

  const display = dialog.getByRole('button', { name: 'Відображення', exact: true });
  await display.click();
  await expect(display).toHaveAttribute('aria-expanded', 'false');
  await expect(dialog.getByRole('switch', { name: 'Лінії маршрутів' })).toHaveCount(0);
  await display.click();
  await expect(dialog.getByRole('switch', { name: 'Лінії маршрутів' })).toBeVisible();
  const quickSettings = dialog.locator('details');
  await expect(quickSettings.locator('summary')).toHaveText('Швидкі налаштування карти');
  await quickSettings.locator('summary').click();
  await quickSettings.getByRole('button', { name: 'Чиста карта' }).click();
  await expect(buses).not.toBeChecked();
  await expect(dialog.getByRole('switch', { name: 'Лінії маршрутів' })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Закрити шари карти' }).click();
  await expect(dialog).toHaveCount(0);
});
