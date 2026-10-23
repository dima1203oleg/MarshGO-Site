import { expect, test, type Page, type Route } from '@playwright/test';

const passenger = {
  id: 'e2e-passenger',
  display_name: 'Тестовий пасажир',
  phone_e164: '+380991234567',
  roles: ['passenger', 'driver'],
  is_verified: true,
  driver_photo_url: null,
};

const origin = { label: 'Площа Ринок, Львів', latitude: 49.8419, longitude: 24.0315, providerId: 'e2e-lviv-origin' };
const destination = { label: 'Сихівська, Львів', latitude: 49.7941, longitude: 24.0576, providerId: 'e2e-lviv-destination' };

async function installJourneyApiFixture(page: Page) {
  const journeySearchBodies: unknown[] = [];
  const now = Date.now();
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
  const journey = {
    id: 'e2e-multimodal-route',
    offerId: null,
    origin: { name: origin.label, coordinates: [origin.longitude, origin.latitude] as [number, number] },
    destination: { name: destination.label, coordinates: [destination.longitude, destination.latitude] as [number, number] },
    source: 'e2e-fixture',
    strategy: 'BALANCED',
    recommendedStrategies: ['BALANCED', 'FASTEST', 'CHEAPEST'],
    strategyRanks: { BALANCED: 1, FASTEST: 1, CHEAPEST: 1 },
    state: 'PLANNED',
    requestedDepartureAt: at(60),
    totalDurationSeconds: 55 * 60,
    waitingSeconds: 0,
    totalPriceMinor: 1500,
    confirmedPriceMinor: null,
    estimatedPriceMinMinor: null,
    estimatedPriceMaxMinor: null,
    currency: 'UAH',
    priceStatus: 'LOCKED',
    walkingMeters: 350,
    transfers: 1,
    reliabilityScore: null,
    legs: [
      {
        id: 'e2e-carpool-leg', mode: 'COMMUNITY', transportType: 'carpool', offerId: 'e2e-offer',
        bookingId: 'e2e-confirmed-booking',
        origin: { name: 'Площа Ринок', coordinates: [24.0315, 49.8419] },
        destination: { name: 'вул. Наукова, 7', coordinates: [24.025, 49.812] },
        departureAt: at(60), arrivalAt: at(80), durationSeconds: 20 * 60, distanceMeters: 4200,
        priceMinor: 1500, currency: 'UAH', priceStatus: 'LOCKED', availabilityStatus: 'AVAILABLE',
        source: 'marshgo-community', lastUpdatedAt: at(0), routeGeometry: [[24.0315, 49.8419], [24.025, 49.812]],
        driver: { id: 'e2e-driver', name: 'Водій тестового маршруту', averageRating: null, reviewCount: 0 },
        vehicle: { id: 'e2e-car', make: 'Skoda', model: 'Octavia' },
      },
      {
        id: 'e2e-walk-transfer', mode: 'WALK', transportType: 'walk', offerId: null,
        origin: { name: 'вул. Наукова, 7', coordinates: [24.025, 49.812] },
        destination: { name: 'Зупинка Наукова', coordinates: [24.031, 49.807] },
        departureAt: at(80), arrivalAt: at(85), durationSeconds: 5 * 60, distanceMeters: 350,
        priceMinor: 0, currency: 'UAH', priceStatus: 'LOCKED', availabilityStatus: 'AVAILABLE',
        source: 'walking-routing', lastUpdatedAt: at(0), routeGeometry: [[24.025, 49.812], [24.031, 49.807]],
        driver: null, vehicle: null,
      },
      {
        id: 'e2e-bus-leg', mode: 'BUS', transportType: 'bus', routeName: 'A20', offerId: null,
        origin: { name: 'Зупинка Наукова', coordinates: [24.031, 49.807] },
        destination: { name: destination.label, coordinates: [destination.longitude, destination.latitude] },
        departureAt: at(85), arrivalAt: at(115), durationSeconds: 30 * 60, distanceMeters: 7100,
        priceMinor: null, currency: 'UAH', priceStatus: 'UNKNOWN', availabilityStatus: 'SCHEDULED',
        source: 'gtfs-static', providerId: 'e2e-lviv-feed', routeId: 'A20', lastUpdatedAt: at(0),
        routeGeometry: [[24.031, 49.807], [24.044, 49.8], [24.0576, 49.7941]],
        stops: [
          { id: 'naukova', name: 'Наукова', coordinates: [24.031, 49.807], arrivalAt: at(85), departureAt: at(85) },
          { id: 'sykhivska', name: 'Сихівська', coordinates: [24.0576, 49.7941], arrivalAt: at(115), departureAt: at(115) },
        ],
        driver: null, vehicle: null,
      },
    ],
  };
  const liveJourney = {
    journeyId: journey.id,
    checkedAt: at(0),
    segments: [{
      legId: 'e2e-bus-leg',
      status: 'LIVE',
      vehiclePositionStatus: 'UNAVAILABLE',
      boardingStopArrival: { status: 'PREDICTED', scheduledAt: at(85), predictedAt: at(87), realtimeUpdatedAt: at(0) },
      lineRoutes: [
        { id: 'a20-outbound', providerId: 'e2e-lviv-feed', routeId: 'A20', name: 'A20', direction: 'До Сихівської', directionId: 'outbound', geometrySource: 'gtfs_shape', coordinates: [[24.031, 49.807], [24.044, 49.8], [24.0576, 49.7941]] },
        { id: 'a20-inbound', providerId: 'e2e-lviv-feed', routeId: 'A20', name: 'A20', direction: 'До Наукової', directionId: 'inbound', geometrySource: 'gtfs_shape', coordinates: [[24.0576, 49.7941], [24.044, 49.8], [24.031, 49.807]] },
      ],
      vehicles: [
        { id: 'a20-vehicle-1', providerId: 'e2e-lviv-feed', coordinates: [24.035, 49.804], bearing: 90, speed: 8, updatedAt: at(0), tripId: 'a20-trip-1', routeId: 'A20', directionId: 'outbound', approachingBoarding: true, remainingStops: 2, emphasized: true, etaSeconds: 420, approachEvidence: { source: 'OBSERVED_PROGRESS', remainingStops: 2, predictedArrivalAt: at(7), realtimeUpdatedAt: at(0) } },
        { id: 'a20-vehicle-2', providerId: 'e2e-lviv-feed', coordinates: [24.033, 49.805], bearing: 90, speed: 7, updatedAt: at(0), tripId: 'a20-trip-2', routeId: 'A20', directionId: 'outbound', approachingBoarding: true, remainingStops: 3, emphasized: true, etaSeconds: 600, approachEvidence: { source: 'TRIP_UPDATE_PREDICTION', predictedArrivalAt: at(10), realtimeUpdatedAt: at(0) } },
        { id: 'a20-vehicle-3', providerId: 'e2e-lviv-feed', coordinates: [24.031, 49.806], bearing: 90, speed: 6, updatedAt: at(0), tripId: 'a20-trip-3', routeId: 'A20', directionId: 'outbound', approachingBoarding: true, remainingStops: 0, emphasized: true, etaSeconds: null, approachEvidence: { source: 'OBSERVED_PROGRESS', remainingStops: 0 } },
        { id: 'a20-vehicle-4', providerId: 'e2e-lviv-feed', coordinates: [24.052, 49.797], bearing: 270, speed: 9, updatedAt: at(0), tripId: 'a20-trip-4', routeId: 'A20', directionId: 'inbound', approachingBoarding: false, remainingStops: null, emphasized: false, etaSeconds: null, approachEvidence: null },
        { id: 'a20-vehicle-unknown-progress', providerId: 'e2e-lviv-feed', coordinates: [24.041, 49.801], bearing: 180, speed: 5, updatedAt: at(0), tripId: 'a20-trip-5', routeId: 'A20', directionId: null, approachingBoarding: false, remainingStops: null, emphasized: false, etaSeconds: null, approachEvidence: null },
      ],
    }],
  };
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error') console.log(`[browser console] ${message.text()}`); });
  page.on('requestfailed', request => console.log(`[request failed] ${request.url()} ${request.failure()?.errorText ?? ''}`));

  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const json = (data: unknown, status = 200) => route.fulfill({ status, json: { data } });
    if (path === '/auth/refresh') return route.fulfill({ status: 401, json: { error: { message: 'Сесія відсутня' } } });
    if (path === '/auth/otp/request') return json({ expiresInSeconds: 300, delivery: 'development', developmentCode: '123456' });
    if (path === '/auth/otp/verify') return json({ user: passenger, accessToken: 'e2e-only-access-token' });
    if (path === '/users/me') return json(passenger);
    if (path === '/places/suggest') {
      const query = url.searchParams.get('q')?.toLocaleLowerCase('uk-UA') ?? '';
      return json([query.includes('сих') || query.includes('с') ? destination : origin]);
    }
    if (path === '/journeys/search') {
      journeySearchBodies.push(route.request().postDataJSON());
      return json({ journeys: [journey], requestedStrategy: 'BALANCED', availableStrategies: ['BALANCED', 'FASTEST', 'CHEAPEST'],
        candidateCount: 48, paretoCount: 24, returnedCount: 1, alternativeLimitPerStrategy: 12,
        resultsTruncated: true, resultSamplingTruncated: true, partial: true, partialReasons: ['candidate_generation_truncated'],
        candidateGenerationTruncated: true, blockedProviders: [], unsupportedPreferences: [], providerErrors: [] });
    }
    if (path === `/journeys/${journey.id}/live`) return json(liveJourney);
    if (path === '/bookings/e2e-confirmed-booking/rendezvous') return json({
      id: 'e2e-rendezvous', bookingId: 'e2e-confirmed-booking', journeyLegId: 'e2e-carpool-leg', state: 'ACTIVE',
      pickup: { label: 'вул. Городоцька, 55', coordinates: [24.025, 49.812] }, plannedPickupAt: at(60), predictedPickupAt: null,
      activationAt: at(45), locationSharingEnabled: true, driverArrivedAt: null, passengerArrivedAt: null,
      currentParticipant: 'passenger', currentParticipantConsent: true, otherParticipantConsent: true,
      locations: {
        driver: { coordinates: [24.022, 49.814], accuracyMeters: 12, capturedAt: at(0), freshness: 'LIVE' },
        passenger: { coordinates: [24.021, 49.813], accuracyMeters: 18, capturedAt: at(0), freshness: 'LIVE' },
      },
    });
    if (path === '/rendezvous/e2e-rendezvous/approaches') return json({
      rendezvousId: 'e2e-rendezvous', pickup: { label: 'вул. Городоцька, 55', coordinates: [24.025, 49.812] },
      driver: {
        location: { coordinates: [24.022, 49.814], accuracyMeters: 12, capturedAt: at(0), freshness: 'LIVE' },
        approach: { status: 'ROUTED', geometry: [[24.022, 49.814], [24.023, 49.813], [24.025, 49.812]], distanceMeters: 430, durationSeconds: 110, calculatedAt: at(0) },
      },
      passenger: {
        location: { coordinates: [24.021, 49.813], accuracyMeters: 18, capturedAt: at(0), freshness: 'LIVE' },
        approach: { status: 'ROUTED', geometry: [[24.021, 49.813], [24.023, 49.812], [24.025, 49.812]], distanceMeters: 330, durationSeconds: 270, calculatedAt: at(0) },
      },
      updatedAt: at(0),
    });
    if (path === '/mobility/providers') return json([]);
    return json([]);
  });
  return { journeySearchBodies, pageErrors };
}

test('real production transit focus hides other journey legs and retains the selected line overlay', async ({ page }, testInfo) => {
  const { journeySearchBodies, pageErrors } = await installJourneyApiFixture(page);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__MARSHGO_BOOTED__'))).toBe(true);
  await page.getByRole('button', { name: 'Почати', exact: true }).click();
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await page.getByPlaceholder('Ваше ім’я').fill(passenger.display_name);
  await page.getByPlaceholder('+380 номер телефону').fill(passenger.phone_e164);
  await page.getByRole('button', { name: 'Почати', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Вхід за номером' })).toBeVisible();
  await page.getByPlaceholder('••••••').fill('123456');
  await page.getByRole('button', { name: 'Підтвердити номер' }).click();

  const navigation = page.getByRole('navigation', { name: 'Основна навігація' });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('button', { name: 'Пошук', exact: true }).click();
  const transportModes = page.locator('.transport-mode-grid > button[aria-label]');
  await expect(transportModes).toHaveCount(12);
  expect(await transportModes.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')))).toEqual([
    'Попутки', 'Маршрутки', 'Автобуси', 'Таксі', 'Трамваї', 'Тролейбуси',
    'Метро', 'Поїзди', 'Велосипеди', 'Самокати', 'Каршеринг', 'Трансфери',
  ]);
  await page.getByPlaceholder('Місто відправлення').fill('Площа Ринок');
  await page.getByRole('button', { name: origin.label, exact: true }).click();
  await page.getByPlaceholder('Місто призначення').fill('Сихівська');
  await page.getByRole('button', { name: destination.label, exact: true }).click();
  await page.getByRole('button', { name: 'Знайти маршрут' }).click();

  await expect(page.locator('p[role="status"]').filter({ hasText: 'Пошук неповний:' }))
    .toContainText('частина маршрутів могла не потрапити до результатів.');
  await expect(page.getByText(/Показано до 12 різних варіантів на режим із 24 Pareto-варіантів/)).toContainText(
    'Частина альтернатив не увійшла до списку; це обмеження вибірки, а не помилка джерела.',
  );
  await expect(page.getByTestId('journey-result-card')).toHaveCount(1);
  await expect(page.getByTestId('journey-result-card').getByText('Попутка')).toBeVisible();
  await expect(page.getByTestId('journey-result-card').getByText('Пішки')).toBeVisible();
  await expect(page.getByTestId('journey-result-card').getByText('Автобус', { exact: true })).toBeVisible();
  await expect(page.getByTestId('journey-result-card').locator('.journey-segment-tile-meta').nth(2)).toContainText('—');
  expect(journeySearchBodies).toHaveLength(1);
  expect(journeySearchBodies[0]).toMatchObject({ origin: { name: origin.label }, destination: { name: destination.label }, passengers: 1 });

  await page.getByTestId('journey-result-card').getByRole('button', { name: /Відкрити маршрут:/ }).click();
  const routeMap = page.getByRole('main', { name: 'Побудований маршрут' });
  await expect(routeMap).toBeVisible();
  const routeSheet = routeMap.getByTestId('route-bottom-sheet');
  await routeMap.getByRole('button', { name: 'Розгорнути панель повністю' }).click();
  await expect(routeSheet).toHaveAttribute('data-sheet-state', 'expanded');
  const exposedMapPixels = await routeSheet.evaluate((element) => element.getBoundingClientRect().top);
  expect(exposedMapPixels, 'expanded itinerary details should leave a stable map band visible').toBeGreaterThanOrEqual(112);
  const carpool = routeMap.locator('[data-segment-id="e2e-carpool-leg"]');
  const walking = routeMap.locator('[data-segment-id="e2e-walk-transfer"]');
  const bus = routeMap.locator('[data-segment-id="e2e-bus-leg"]');
  await expect(carpool).toBeVisible();
  await expect(walking).toBeVisible();
  await expect(bus).toBeVisible();
  await expect(bus.getByText('—', { exact: true })).toBeVisible();
  await carpool.getByRole('button', { name: /Вибрати сегмент: Попутка/ }).click();
  if (testInfo.project.name === 'chromium') {
    const mapCanvas = routeMap.locator('.maplibregl-map');
    await expect.poll(() => mapCanvas.getAttribute('data-marshgo-rideshare-count')).toBe('2');
    await expect.poll(() => mapCanvas.getAttribute('data-marshgo-rideshare-approach-route-count')).toBe('2');
    await expect(routeMap.locator('.marshgo-rideshare-marker')).toHaveCount(2);
    await expect(routeMap.locator('.marshgo-rideshare-marker[data-participant="driver"]')).toHaveAttribute('aria-label', 'Зустріч: актуальне GPS водія');
    await expect(routeMap.locator('.marshgo-rideshare-marker[data-participant="passenger"]')).toHaveAttribute('aria-label', 'Зустріч: актуальне GPS пасажира');
  }
  await bus.getByRole('button', { name: /Вибрати сегмент: Автобус A20/ }).click();
  await expect(bus).toHaveAttribute('data-active', 'true');
  await expect(carpool).toHaveAttribute('data-active', 'false');
  await expect(walking).toHaveAttribute('data-active', 'false');
  await expect(bus.getByRole('button', { name: /Згорнути зупинки: Автобус/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(routeMap.getByRole('list', { name: 'Зупинки сегмента A20' })).toContainText('Наукова');
  await expect(routeMap.getByRole('list', { name: 'Зупинки сегмента A20' })).toContainText('Сихівська');
  await expect(bus.getByTestId('selected-line-live-status')).toContainText('На карті 5 машин зі свіжими GPS-позиціями; виділено 2 на під’їзді та 1 на точці посадки.');
  await expect(bus.getByTestId('selected-line-live-status')).toContainText('прогноз фіда, не GPS-позиція');
  await page.getByRole('button', { name: 'Показати весь маршрут' }).click();
  await expect(bus.getByRole('button', { name: 'Вибрати сегмент: Автобус A20' })).toHaveAttribute('aria-pressed', 'false');
  if (testInfo.project.name === 'chromium') {
    const mapCanvas = routeMap.locator('.maplibregl-map');
    const mapStateTimeout = { timeout: 15_000 };
    await expect.poll(() => mapCanvas.getAttribute('data-marshgo-selected-route-segment-count'), mapStateTimeout).toBe('3');
    await expect.poll(() => mapCanvas.getAttribute('data-marshgo-hidden-route-segment-count'), mapStateTimeout).toBe('0');
    await bus.getByRole('button', { name: 'Вибрати сегмент: Автобус A20', exact: true }).click();
    await expect.poll(() => mapCanvas.getAttribute('data-marshgo-selected-route-segment-count'), mapStateTimeout).toBe('1');
    await expect.poll(() => mapCanvas.getAttribute('data-marshgo-dimmed-route-segment-count'), mapStateTimeout).toBe('0');
    await expect.poll(() => mapCanvas.getAttribute('data-marshgo-hidden-route-segment-count'), mapStateTimeout).toBe('2');
    await expect.poll(() => mapCanvas.getAttribute('data-marshgo-transit-line-direction-count'), mapStateTimeout).toBe('2');
    await expect.poll(() => mapCanvas.getAttribute('data-marshgo-transit-fleet-count'), mapStateTimeout).toBe('5');
    await expect.poll(() => mapCanvas.getAttribute('data-marshgo-transit-fleet-emphasized-count'), mapStateTimeout).toBe('3');
    const vehicleMarkers = routeMap.locator('.marshgo-transit-fleet-marker');
    await expect(vehicleMarkers).toHaveCount(5);
    await expect(vehicleMarkers).toHaveText(['🚌', '🚌', '🚌', '🚌', '🚌']);
    await expect(vehicleMarkers.nth(0)).toHaveAttribute('title', /^Живий GPS і послідовність зупинок: прямує до посадки/);
    await expect(vehicleMarkers.nth(1)).toHaveAttribute('title', /^Прогноз прибуття до посадки/);
    await expect(vehicleMarkers.nth(2)).toHaveAttribute('title', /^Живий GPS і зупинки: на точці посадки/);
    await expect(vehicleMarkers.nth(4)).toHaveAttribute('title', /^Транспорт на вибраній лінії/);
    await expect(vehicleMarkers.nth(4)).toHaveCSS('opacity', '0.42');
  }
  expect(pageErrors).toEqual([]);
});

test('a failed lazy screen import shows a recoverable error instead of a blank view', async ({ page }) => {
  let mainFrameNavigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) mainFrameNavigations++; });
  await installJourneyApiFixture(page);
  await page.route('**/assets/ProductionNavigation-*.js', route => route.abort());
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__MARSHGO_BOOTED__'))).toBe(true);
  await page.getByRole('button', { name: 'Почати', exact: true }).click();
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await page.getByPlaceholder('Ваше ім’я').fill(passenger.display_name);
  await page.getByPlaceholder('+380 номер телефону').fill(passenger.phone_e164);
  await page.getByRole('button', { name: 'Почати', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Вхід за номером' })).toBeVisible();
  await page.getByPlaceholder('••••••').fill('123456');
  await page.getByRole('button', { name: 'Підтвердити номер' }).click();

  await expect(page.getByRole('navigation', { name: 'Основна навігація' })).toBeVisible();
  await page.getByRole('button', { name: /Навігація/ }).click();
  await expect(page.getByRole('alert')).toContainText('Не вдалося відкрити цей екран');
  await expect(page.getByRole('button', { name: 'Спробувати ще раз' })).toBeVisible();
  const beforeManualRetry = mainFrameNavigations;
  await page.waitForTimeout(500);
  expect(mainFrameNavigations).toBe(beforeManualRetry);
  await page.getByRole('button', { name: 'Спробувати ще раз' }).click();
  await expect.poll(() => mainFrameNavigations).toBeGreaterThan(beforeManualRetry);
});
