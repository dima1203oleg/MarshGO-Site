import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

const bookingId = 'e2e-rendezvous-booking';
const rendezvousId = 'e2e-rendezvous-session';
const pickup = { label: 'Площа Ринок, Львів', coordinates: [24.0315, 49.8419] as [number, number] };
const now = Date.now();

type Participant = 'driver' | 'passenger';
type Position = { coordinates: [number, number]; accuracyMeters: number; capturedAt: string; freshness: 'LIVE' | 'STALE' } | null;

const locations: Record<Participant, Position> = {
  driver: { coordinates: [24.0305, 49.8408], accuracyMeters: 12, capturedAt: new Date(now).toISOString(), freshness: 'LIVE' },
  passenger: { coordinates: [24.033, 49.843], accuracyMeters: 9, capturedAt: new Date(now).toISOString(), freshness: 'LIVE' },
};
const sentLocations = new Set<Participant>();
const observedLocations = new Map<Participant, Record<Participant, Position>>();

function rendezvousFor(participant: Participant) {
  return {
    id: rendezvousId,
    bookingId,
    journeyLegId: null,
    state: 'ACTIVE',
    pickup,
    plannedPickupAt: new Date(now + 10 * 60_000).toISOString(),
    predictedPickupAt: null,
    activationAt: new Date(now - 60_000).toISOString(),
    locationSharingEnabled: true,
    driverArrivedAt: null,
    passengerArrivedAt: null,
    currentParticipant: participant,
    currentParticipantConsent: true,
    otherParticipantConsent: true,
    locations,
  };
}

function bookingFor(participant: Participant) {
  return {
    id: bookingId,
    offer_id: 'e2e-offer',
    seat_count: 1,
    total_price_minor: 12000,
    currency: 'UAH',
    fee_class: 'community' as const,
    platform_fee_minor: 0,
    fee_rule_version: 'e2e',
    status: 'confirmed',
    origin_name: pickup.label,
    destination_name: 'вул. Наукова, Львів',
    departure_at: new Date(now + 10 * 60_000).toISOString(),
    driver_name: 'Тестовий водій',
    passenger_name: 'Тестовий пасажир',
    current_user_is_driver: participant === 'driver',
    completion_confirmation_count: 0,
    current_user_confirmed_completion: false,
    current_user_has_review: false,
  };
}

async function installParticipantApi(page: Page, participant: Participant) {
  const user = {
    id: `e2e-${participant}`,
    display_name: participant === 'driver' ? 'Тестовий водій' : 'Тестовий пасажир',
    phone_e164: participant === 'driver' ? '+380991111111' : '+380992222222',
    roles: participant === 'driver' ? ['driver', 'passenger'] : ['passenger'],
    is_verified: true,
    driver_photo_url: null,
  };
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.stack ?? error.message));
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const json = (data: unknown, status = 200) => route.fulfill({ status, json: { data } });
    if (path === '/auth/refresh') return route.fulfill({ status: 401, json: { error: { message: 'Сесія відсутня' } } });
    if (path === '/auth/otp/request') return json({ expiresInSeconds: 300, delivery: 'development', developmentCode: '123456' });
    if (path === '/auth/otp/verify') return json({ user, accessToken: `e2e-${participant}-token` });
    if (path === '/users/me') return json(user);
    if (path === '/bookings') return json([bookingFor(participant)]);
    if (path === `/bookings/${bookingId}/rendezvous`) {
      observedLocations.set(participant, { ...locations });
      return json(rendezvousFor(participant));
    }
    if (path === `/rendezvous/${rendezvousId}/location` && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { longitude: number; latitude: number; accuracyMeters: number; capturedAt: string };
      locations[participant] = { coordinates: [body.longitude, body.latitude], accuracyMeters: body.accuracyMeters, capturedAt: body.capturedAt, freshness: 'LIVE' };
      sentLocations.add(participant);
      return json({ rendezvousId, storedEphemerally: true, expiresInSeconds: 300, nearPickup: false, arrivalRequiresUserConfirmation: true });
    }
    if (path === `/rendezvous/${rendezvousId}/approaches`) return json({
      rendezvousId,
      pickup,
      driver: { location: locations.driver, approach: { status: 'ROUTED', geometry: [locations.driver!.coordinates, pickup.coordinates], distanceMeters: 150, durationSeconds: 100 } },
      passenger: { location: locations.passenger, approach: { status: 'ROUTED', geometry: [locations.passenger!.coordinates, pickup.coordinates], distanceMeters: 240, durationSeconds: 170 } },
      updatedAt: new Date().toISOString(),
    });
    if (path === '/conversations/unread') return json([]);
    if (path === '/journeys') return json([]);
    if (path === '/notifications') return json({ items: [], nextCursor: null, unreadCount: 0 });
    if (path === '/vehicles' || path === '/verification/records' || path === '/users/blocked' || path === '/users/account-deletion-request') return json([]);
    if (path === '/offers/mine' || path === '/demands/open' || path === '/demands/mine' || path === '/navigation/matches') return json([]);
    return json([]);
  });
  return pageErrors;
}

async function enterMeeting(context: BrowserContext, page: Page, participant: Participant) {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: participant === 'driver' ? 49.8409 : 49.8429, longitude: participant === 'driver' ? 24.0306 : 24.0331, accuracy: 12 });
  const pageErrors = await installParticipantApi(page, participant);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__MARSHGO_BOOTED__'))).toBe(true);
  await page.getByRole('button', { name: 'Почати', exact: true }).click();
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await page.getByPlaceholder('Ваше ім’я').fill(participant === 'driver' ? 'Тестовий водій' : 'Тестовий пасажир');
  await page.getByPlaceholder('+380 номер телефону').fill(participant === 'driver' ? '+380991111111' : '+380992222222');
  await page.getByRole('button', { name: 'Почати', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Вхід за номером' })).toBeVisible();
  await page.getByPlaceholder('••••••').fill('123456');
  await page.getByRole('button', { name: 'Підтвердити номер' }).click();
  const navigation = page.getByRole('navigation', { name: 'Основна навігація' });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('button', { name: 'Поїздки', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Мої поїздки' })).toBeVisible();
  await page.getByRole('button', { name: 'Відкрити зустріч' }).click();
  await expect(page.getByRole('button', { name: 'Відкрити карту зустрічі' })).toBeVisible();
  await page.getByRole('button', { name: 'Відкрити карту зустрічі' }).click();
  await expect(page.getByRole('main', { name: 'Карта зустрічі' })).toBeVisible();
  return pageErrors;
}

test('driver and passenger see the same consented live meeting with both positions and pickup approaches', async ({ browser }) => {
  const driverContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const passengerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  try {
    const driverPage = await driverContext.newPage();
    const passengerPage = await passengerContext.newPage();
    const driverErrors = await enterMeeting(driverContext, driverPage, 'driver');
    const passengerErrors = await enterMeeting(passengerContext, passengerPage, 'passenger');

    for (const [page, selfLabel, otherLabel] of [
      [driverPage, 'Ви (водій)', 'Пасажир'],
      [passengerPage, 'Ви (пасажир)', 'Водій'],
    ] as const) {
      await expect(page.getByRole('heading', { name: /Зустріч із/ })).toBeVisible();
      await expect(page.getByTestId('meeting-stage')).toHaveText('Ви наближаєтесь один до одного');
      await expect(page.getByTestId('meeting-between')).toBeVisible();
      await expect(page.getByTestId('meeting-driver-card')).toContainText(selfLabel === 'Ви (водій)' ? 'Ви (водій)' : otherLabel);
      await expect(page.getByTestId('meeting-passenger-card')).toContainText(selfLabel === 'Ви (пасажир)' ? 'Ви (пасажир)' : otherLabel);
      await expect(page.getByText('Позиції оновлюються кожні 5 с')).toBeVisible();
      await expect(page.getByRole('region', { name: 'Стан зустрічі' }).getByRole('button', { name: 'Зупинити й відкликати мою згоду' })).toBeVisible();
    }

    for (const page of [driverPage, passengerPage]) {
      await expect(page.getByTestId('meeting-driver-card')).toContainText('150 м до точки · ≈ 2 хв');
      await expect(page.getByTestId('meeting-passenger-card')).toContainText('240 м до точки · ≈ 3 хв');
    }
    await expect.poll(() => [...sentLocations].sort()).toEqual(['driver', 'passenger']);
    await expect.poll(() => {
      const driverView = observedLocations.get('driver');
      const passengerView = observedLocations.get('passenger');
      const hasBoth = (view: typeof driverView) => Boolean(view?.driver && view.passenger
        && view.driver.coordinates[0] === locations.driver?.coordinates[0]
        && view.passenger.coordinates[0] === locations.passenger?.coordinates[0]);
      return hasBoth(driverView) && hasBoth(passengerView);
    }, { timeout: 20_000 }).toBe(true);
    expect(driverErrors).toEqual([]);
    expect(passengerErrors).toEqual([]);
  } finally {
    await driverContext.close();
    await passengerContext.close();
  }
});
