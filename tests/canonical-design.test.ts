import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const canonicalDir = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/design/canonical');

test('search provider dialog does not repeat transport type controls', async () => {
  const [panel, marketplace] = await Promise.all([
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/components/TransportTypesPanel.tsx'), 'utf8'),
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/views/ProductionMarketplace.tsx'), 'utf8'),
  ]);

  assert.match(marketplace, /<TransportTypesPanel providersOnly selection=\{transportSelection\}/, 'the search Providers action must open a provider-only dialog');
  assert.match(marketplace, /<h2 id="transport-picker-title" className="font-extrabold">Провайдери<\/h2>/, 'the dialog title must match its action');
  assert.match(panel, /!providersOnly && <div className="mb-1 flex items-center justify-between gap-2"/, 'transport controls must stay out of the provider dialog');
  assert.match(panel, /showDiagnostics && !providersOnly && groups !== null && localProviderTypes\.length < supportedJourneySearchTypes\.length - 1/, 'partial provider coverage belongs in explicit diagnostics');
  assert.match(panel, /Провайдери біля вибраних точок знайдені для/, 'diagnostics must retain endpoint coverage detail');
  assert.match(panel, /«Усі види» додасть решту/, 'diagnostics must explain that coverage gaps do not block corridor search');
  assert.match(panel, /!compact && !providersOnly && <button type="button" onClick=\{\(\) => setProvidersOpen/, 'the provider dialog must not show a second Configure Providers toggle');
  assert.match(panel, /providersOnly && selection\.active\.length === 0/, 'an empty provider selection must have a clear status message');
  assert.doesNotMatch(marketplace, /Обрати на мапі: \\{\(routePlaceField/, 'the duplicated wide map picker must be absent');
});

test('static bicycle points do not imply live inventory or booking', async () => {
  const [panel, api] = await Promise.all([
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/components/TransportTypesPanel.tsx'), 'utf8'),
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/services/productionApi.ts'), 'utf8'),
  ]);
  assert.match(api, /availabilityStatus\?: string; bookingAvailable\?: boolean/, 'the client retains availability and booking evidence');
  assert.match(panel, /type\.id === 'bike' && providers\.some\(provider => provider\.availabilityStatus === 'UNKNOWN' \|\| provider\.bookingAvailable === false\)/, 'the caveat is driven by provider evidence');
  assert.match(panel, /наявність велосипедів і бронювання не підтверджені/, 'customers are told that static points are not live inventory');
});

test('traveler surfaces keep technical search and map diagnostics out of the default design', async () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const [panel, mapDetails, transportMap, marketplace, transportTypes, canonicalDesign] = await Promise.all([
    readFile(resolve(root, '../src/views/JourneyResultsPanel.tsx'), 'utf8'),
    readFile(resolve(root, '../src/views/JourneyRouteMapScreen.tsx'), 'utf8'),
    readFile(resolve(root, '../src/views/TransportMapView.tsx'), 'utf8'),
    readFile(resolve(root, '../src/views/ProductionMarketplace.tsx'), 'utf8'),
    readFile(resolve(root, '../src/components/TransportTypesPanel.tsx'), 'utf8'),
    readFile(resolve(root, '../docs/design/canonical/README.md'), 'utf8'),
  ]);

  assert.match(panel, /showDiagnostics && blockingHeadline/);
  assert.match(panel, /showDiagnostics && \(detailNotices\.length/);
  assert.match(mapDetails, /showDiagnostics && dataCaveat/);
  assert.match(mapDetails, /showDiagnostics && <span data-testid="journey-route-segment-source"/);
  assert.match(transportMap, /showDiagnostics && hint/);
  assert.match(transportMap, /Карта недоступна/);
  assert.doesNotMatch(transportMap, /bg-amber-50/);
  assert.match(transportTypes, /showDiagnostics && !providersOnly && groups !== null/);
  assert.match(canonicalDesign, /Keep technical diagnostics out of the default customer interface/);
  assert.match(marketplace, /Немає з’єднання\. Деякі дані можуть бути неактуальними\./);
  assert.doesNotMatch(marketplace, /Офлайн: новий пошук, розклади, живі позиції/);
});

const references = [
  ['task-2026-10-13/1-Фото-1.jpg', 'f9d4b61d267cb7ada6041d43f5ebab1c6b434ae8fb7f35e758f4c332bda0505f'],
  ['task-2026-10-13/8-Фото-8.jpg', 'ddf757b52ad00fc36e93b1fe1c45ea519b6612b94f30a0fafb98e163f9f6aa08'],
  ['marshgo-light-canonical.jpg', '3e9a728f6aaf9bf59a26f6698ffa78989aee778ec80d710f0e9cde52820eeedf'],
  ['marshgo-dark-canonical.jpg', '827223e04296385e55955d3689dc518ed38705c5aadde2d6cb94ea5fa600979f'],
  ['route-map-bottom-sheet/01-expanded-route-details.jpg', '9d59fa0820870320af9ac2bdb604c6b2ca0dd16ad75c328736f52d38d5928fe7'],
  ['route-map-bottom-sheet/02-half-sheet.jpg', '52896dd5b94f35506b4ac68550345f4c258ffe395236baabf9cc0dce72a02900'],
  ['route-map-bottom-sheet/03-map-overview.jpg', '4a72f1308dc9ca74cbe7bea88b1a6ae903330788f6220215f9991259a0c0c630'],
  ['route-map-bottom-sheet/04-route-details-map.jpg', '56654feb65be639e06b38b3962c8a7329ddd4fd535826f07041feebc69daba0b'],
  ['route-map-bottom-sheet/05-route-details-sheet.jpg', '3ee7cac6b35b273dc65fe3b5fb2acae7f1065ceb116dd70a6f0ba6a2d53b460e'],
  ['route-map-bottom-sheet/light/01-expanded-route-details.jpg', '3aaa6d452c6f05e842eb1ce35dd1888977b0ef131fa1287129877c70de195f91'],
  ['route-map-bottom-sheet/light/02-half-sheet.jpg', '37c647a4cadf7bd3b62bc250cb10436ec8caa964b6facbfe399e4a03660a49ac'],
  ['route-map-bottom-sheet/light/03-map-overview.jpg', 'c798aae62becae863386698d2548462afa88ef45711203c001c9c234b0a200be'],
  ['journey-search-results/01-results-light-dark-board.jpg', '81ec8c9049a12a29b093faa0b6d0977f3102e16c4a90e9c8e696debf7d5862a5'],
  ['journey-search-results/02-results-light-detail.jpg', '2cd6bf47ad92f9ece3622a29803286148e1d2fbe21f76c6995fe3bffb7286259'],
  ['journey-search-results/03-results-dark-final.jpg', 'ed3954cce34fa604d6d14570b533b242ebb3b8c089f0a00b7503de408a9b6e00'],
  ['route-map-bottom-sheet/06-expanded-route-details-dark-final.jpg', '93d3c8db8eadedb3d3ae339be40a87adfcd097633f37d1b3d4edfed68b1b1df9'],
  ['route-map-bottom-sheet/07-half-sheet-dark-final.jpg', 'c029db8f7f0afcd55649ae66d2b29a791d13b8e8c558710546427fad0b9da8ee'],
  ['route-map-bottom-sheet/08-collapsed-map-dark-final.jpg', '104dae85afe60d83b66040006f0628f166e790248f96ca13ababb4a23899a884'],
] as const;

test('canonical MARSHGO design references stay owner-approved', async () => {
  for (const [filename, expectedHash] of references) {
    const bytes = await readFile(resolve(canonicalDir, filename));
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(actualHash, expectedHash, `${filename} changed; replace only with an owner-approved canonical board`);
  }
});

// A duplicate rule later in the sheet silently wins the cascade, which is how tile
// text drifted back to 8.5 px after the legibility pass.
test('route-result segment tiles stay at or above the 12 px legibility floor', async () => {
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
  const undersized = [...css.matchAll(/([^{}]*journey-segment-tile[^{}]*)\{([^}]*)\}/g)]
    .flatMap(([, selector, body]) => [...body.matchAll(/font-size:\s*(?:clamp\(\s*)?([\d.]+)px/g)]
      .filter(size => Number(size[1]) < 12)
      .map(size => `${selector.trim()} → ${size[1]}px`));
  assert.deepEqual(undersized, []);
});

// Five-leg routes switch to the wide-detail tiles; overriding only their flex-basis
// left every tile at 1 px, so the ribbon under the line rendered as an empty bar.
test('wide screens keep five-leg ribbon tiles sharing the full width', async () => {
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
  const blocks = [...css.matchAll(/@media \(min-width: 640px\) \{([\s\S]*?)\n\}/g)];
  const rule = blocks
    .flatMap(([, body]) => [...body.matchAll(/\.journey-segment-tile--scroll \{([^}]*)\}/g)])
    .at(-1);
  assert.ok(rule, 'the wide-screen tile override went missing');
  const flex = rule![1].match(/flex:\s*([\d.]+)\s+([\d.]+)\s+([^;]+)/);
  assert.ok(flex, 'wide-screen tiles must declare the flex shorthand, not a bare basis');
  assert.ok(Number(flex![1]) > 0, `wide-screen tiles must grow, got flex-grow ${flex![1]}`);
});

const legibleSurfaces = [
  'src/views/JourneyRouteMapScreen.tsx',
  'src/views/TransportMapView.tsx',
  'src/views/HomeView.tsx',
  'src/components/MapLayersControl.tsx',
  'src/design-system/journey/CanonicalRouteLip.tsx',
  'src/design-system/ui/StatusBadge.tsx',
];

// Anything the passenger has to read is body copy, not a watermark: 10 px is the floor.
test('the app keeps a 10 px text floor on every screen', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
  const sources = readdirSync(root, { recursive: true })
    .filter(entry => entry.endsWith('.tsx'))
    .map(entry => ({ file: entry, source: readFileSync(resolve(root, entry), 'utf8') }));
  const undersized = sources.flatMap(({ file, source }) => [...source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)]
    .filter(size => Number(size[1]) < 10)
    .map(size => `${file} → ${size[1]}px`));
  assert.deepEqual(undersized, []);
});

// The listed screens carry the journey wording, so they are also checked by name.
test('passenger journey and map surfaces keep the 10 px text floor', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const undersized = await Promise.all(legibleSurfaces.map(async file => {
    const source = await readFile(resolve(root, file), 'utf8');
    return [...source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)]
      .filter(size => Number(size[1]) < 10)
      .map(size => `${file} → ${size[1]}px`);
  }));
  assert.deepEqual(undersized.flat(), []);
});

// Tailwind utilities lose to this rule, so the sheet controls are only 44 px while it says so.
test('route sheet actions keep the 44 px touch-target floor', async () => {
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
  const rule = css.match(/\.route-summary-actions > :is\(span, button\) \{([^}]*)\}/);
  assert.ok(rule, 'route sheet action sizing went missing');
  const sizes = [...rule![1].matchAll(/(?:width|height|min-width):\s*([\d.]+)rem/g)].map(value => Number(value[1]));
  assert.ok(sizes.length >= 3 && sizes.every(size => size >= 2.75), `route sheet actions shrank below 2.75rem: ${sizes.join(', ')}`);
});

// The results screen only mounts after showResults flips, so a pending panel wired into that
// screen alone stays invisible for the whole 20-50 s search. That is exactly how it failed once.
test('journey search enters the results screen and shows a pending panel while providers answer', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const [marketplace, panel, css] = await Promise.all([
    readFile(resolve(root, 'src/views/ProductionMarketplace.tsx'), 'utf8'),
    readFile(resolve(root, 'src/views/JourneyResultsPanel.tsx'), 'utf8'),
    readFile(resolve(root, 'src/index.css'), 'utf8'),
  ]);
  assert.match(marketplace, /setJourneySearchStartedAt\(Date\.now\(\)\); setShowResults\(true\)/,
    'search must move the passenger to the results screen before awaiting providers');
  assert.match(marketplace, /journeySearchStartedAt !== null \? <JourneySearchPending/,
    'results body lost its pending branch');
  assert.match(marketplace, /setTimeout\(\(\) => controller\.abort\('timeout'\), JOURNEY_SEARCH_DEADLINE_MS\)/,
    'search must stop on its own deadline instead of waiting for the gateway to cut it');
  assert.match(marketplace, /signal: controller\.signal,/,
    'the search request must carry the abort signal, or cancel does nothing');
  assert.match(marketplace, /window\.clearTimeout\(deadlineId\);[\s\S]{0,200}setBusy\(false\); setJourneySearchStartedAt\(null\);/,
    'the pending clock must stop when the search settles');
  assert.match(marketplace, /<JourneySearchPending startedAt=\{journeySearchStartedAt\} onCancel=\{cancelJourneySearch\}/,
    'the pending panel lost its way out');
  assert.match(panel, /data-testid="journey-search-cancel"/,
    'a passenger who waits 45 s must be able to stop waiting');
  assert.match(panel, /data-testid="journey-search-pending"[\s\S]{0,200}aria-live="polite"/,
    'pending state must be announced to screen readers');
  assert.match(panel, /mg-skeleton/, 'pending cards stopped using the shimmer placeholder');
  assert.match(css, /\.mg-skeleton\s*\{[\s\S]*animation: mg-shimmer/, 'the skeleton shimmer lost its animation');
});

// Moving this onto a CSS class would strand the imperative style.transition='none' the drag
// handlers set, and the sheet would stop snapping back with animation.
test('route sheet snap uses the motion tokens without leaving the style prop', async () => {
  const sheet = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/views/JourneyRouteMapScreen.tsx'), 'utf8');
  assert.doesNotMatch(sheet, /280ms cubic-bezier/, 'the sheet snap reverted to an off-system curve');
  assert.match(sheet, /style=\{\{[\s\S]{0,240}transition: routeSheetTransition\(draggingRef\.current, reducedMotion\)/,
    'sheet snap must keep its transition in the React style prop, on the motion tokens');
});

// An animated wait is only honest while the motion preference is still honoured.
test('prefers-reduced-motion still neutralizes every animation and transition', async () => {
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,160}animation-duration:\s*\.01ms !important/,
    'reduced-motion guard changed shape; verify it still overrides inline styles');
});

// The trip-details row used to be three hand-tuned Tailwind soups: a 32x24 px seat stepper and
// two different paddings made the row read as three unrelated widgets.
test('search trip details share one control family with thumb-sized steppers', async () => {
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
  const marketplace = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/views/ProductionMarketplace.tsx'), 'utf8');
  assert.match(css, /\.search-screen \.journey-search-card \.trip-tile \{[\s\S]*?min-height: 3\.5rem;[\s\S]*?background: var\(--mg-surface-secondary\);/,
    'date, time and seats stopped sharing one surface, height and radius');
  assert.match(css, /html\.dark \.search-screen \.journey-search-card \.trip-tile \{ background: var\(--mg-surface-secondary\); color: var\(--mg-ink-primary\); \}/,
    'the dark theme must remap the same family, not each tile again');
  assert.match(marketplace, /className="trip-tile trip-tile--stepper/, 'the seat stepper left the shared tile class');
  assert.match(marketplace, /className="size-11[^"]*" aria-label="Менше пасажирів"/, 'seat steppers must be 44x44 pt, not 24 px wide');
  assert.doesNotMatch(marketplace, /h-8 w-6/, 'a 24 px wide stepper is below the 44 pt minimum and regressed back');
  // The 8.6rem radial circle behind «Куди їдемо?» was pure decoration and fought the headline.
  assert.doesNotMatch(css, /\.home-intro::after \{[\s\S]{0,200}radial-gradient/, 'the decorative blob behind the search heading came back');
});

// Route ranking remains visible after opening a detail sheet, not as another badge on every card.
test('result-card ranking moves into route details without faking a selected state', async () => {
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
  const panel = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/views/JourneyResultsPanel.tsx'), 'utf8');
  const routeDetails = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/views/JourneyRouteMapScreen.tsx'), 'utf8');
  assert.match(panel, /recommendation=\{index === 0 \? `Перший варіант у режимі/,
    'the strategy winner must be passed to the detail sheet');
  assert.match(routeDetails, /data-testid="journey-route-recommendation"/, 'the ranking reason belongs in route details');
  assert.doesNotMatch(panel, /Рекомендований/, 'recommendation text must not take space on the compact result card');
  assert.doesNotMatch(panel, /ring-blue-100/, 'a selection ring on an unselected card is a false affordance');
  assert.doesNotMatch(css, /data-top-pick/, 'a separate rank accent would still visually label the card as recommended');
  assert.doesNotMatch(css, /\.journey-result-card:first-of-type \{[\s\S]{0,80}border-color: #1687FF/,
    'position-based border styling came back; it highlighted the first card in every tab');
});

// Unknown fare detail stays explicit while the result card keeps only the requested total price.
test('compact result strips prices and keeps unknown-fare detail and segment scroll behavior', async () => {
  const read = (relative: string) => readFile(resolve(dirname(fileURLToPath(import.meta.url)), relative), 'utf8');
  const [strip, lip, panel, fare, routeDetails] = await Promise.all([
    read('../src/design-system/journey/JourneySegmentStrip.tsx'),
    read('../src/design-system/journey/CanonicalRouteLip.tsx'),
    read('../src/views/JourneyResultsPanel.tsx'),
    read('../src/views/cashFare.ts'),
    read('../src/views/JourneyRouteMapScreen.tsx'),
  ]);
  assert.match(strip, /const scrolls = hidden > 10;/, 'the edge fade needs a floor a real stage chip can actually cross');
  assert.match(lip, /priceCaption\?: ReactNode;/, 'the shared lip needs one caption slot for unavailable prices');
  assert.match(fare, /тариф невідомий/, 'an unknown fare has to say why instead of showing a bare dash');
  assert.match(panel, /priceLabel: ''/, 'per-leg fares must not repeat under every segment on compact cards');
  assert.doesNotMatch(panel, /priceCaption=/, 'payment basis belongs in route details, not the compact result');
  assert.match(routeDetails, /route-total-fare-caption/, 'the route detail keeps fare basis visible');
  assert.match(routeDetails, /journeyLegCaveat\(/, 'source and estimate caveats remain available per route leg');
  assert.match(routeDetails, /showDiagnostics && <span data-testid="journey-route-segment-source"/, 'provider provenance is developer-only');
  assert.match(panel, /spokenJourneyPrice\(journeyPrice\)/, 'the spoken price has to carry the qualifier too');
  assert.match(panel, /priceAccessibleLabel=\{`Загальна вартість:/, 'the total fare keeps an accessible unknown-price explanation');
  assert.match(panel, /showDiagnostics && \(detailNotices\.length > 0/, 'technical search completeness is hidden from the passenger UI');
  assert.match(panel, /showDiagnostics && blockingHeadline/, 'provider diagnostics are only shown in developer mode');
  assert.match(panel, /showDiagnostics && groups\.length > 0 && unavailable\.length > 0/, 'unavailable-mode explanations are developer-only');
});

// The profile used to hide the privacy and safety screens behind a menu that only listed three
// entries, the FAQ told users to open them anyway, and their buttons fabricated outcomes:
// an alert() claiming a data-wipe request was filed, an unauthenticated export GET, and a
// switch that toggled local state while the browser owned the real permission.
test('privacy and safety screens are reachable and only report real outcomes', async () => {
  const read = (relative: string) => readFile(resolve(dirname(fileURLToPath(import.meta.url)), relative), 'utf8');
  const [marketplace, profile] = await Promise.all([
    read('../src/views/ProductionMarketplace.tsx'),
    read('../src/views/ProfileSections.tsx'),
  ]);
  assert.match(marketplace, /\['privacy','Приватність і геолокація'/, 'the privacy section must be in the profile menu');
  assert.match(marketplace, /\['safety','Безпека та скарги'/, 'the safety section must be in the profile menu');
  assert.match(marketplace, /onRequestDeletion=\{\(\)=>setConfirmDeletion\(true\)\}/,
    'deletion has to open the real cooling-off dialog, not a message');
  assert.doesNotMatch(profile, /alert\(/, 'an alert() is a fabricated outcome — the goal forbids fake success');
  assert.doesNotMatch(profile, /window\.open\('\/api\/v1\/users\/me\/export'\)/,
    'export must go through the authenticated download helper, not a bare GET in a new tab');
  assert.match(profile, /navigator\.permissions\?\.query\(\{ name: 'geolocation'/,
    'the GPS card reports the browser permission instead of a switch MARSHGO cannot enforce');
  assert.match(profile, /Не вдалося сформувати файл/, 'a failed export has to say so on screen');
});

// A boarding ticket whose QR failed rendered an empty box under «Покажіть цей QR-код водієві»,
// leaving the passenger at the car with no explanation and no way forward.
test('boarding QR shows progress and an honest failure with a retry', async () => {
  const qr = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/components/TicketQr.tsx'), 'utf8');
  assert.match(qr, /if \(!dataUrl\) return <div aria-busy="true"/, 'the QR box needs a loading state instead of rendering nothing');
  assert.match(qr, /QR-код не вдалося побудувати/, 'a failed QR must explain itself');
  assert.match(qr, /Спробувати ще раз/, 'the passenger needs a retry, not a dead box');
  assert.doesNotMatch(qr, /if \(!dataUrl\) return null;/, 'returning null hid the failure completely');
});

// The only dismiss control for every global message was a 16 px icon with no accessible name.
test('global status messages have a labelled thumb-sized dismiss', async () => {
  const marketplace = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/views/ProductionMarketplace.tsx'), 'utf8');
  assert.match(marketplace, /aria-label="Закрити повідомлення" onClick=\{\(\) => setStatusMessage\(''\)\} className="-mr-2 grid h-11 w-11/,
    'the status close button regressed to an unnamed 16 px target');
});

// A stage chip sliced in half by the viewport edge reads as a rendering bug, so the row fades at
// the cut — but the fade must lift once the last chip is fully visible.
test('segment ribbon fades only while chips are actually sliced', async () => {
  const [strip, css] = await Promise.all([
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/design-system/journey/JourneySegmentStrip.tsx'), 'utf8'),
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8'),
  ]);
  assert.match(strip, /element\.dataset\.fadeEnd = /,
    'the scroller itself must expose whether the row is scrolled to its end');
  assert.match(css, /\.journey-segment-tiles\[data-fade-end="true"\] \{ --mg-fade-x-end/,
    'the slice fade is CSS-driven and must lift at the end of the row');
});

// Trips rows, bookings and chat titles printed the raw 120-character geocoder label.
test('trip and booking titles use the compact place label with the full address preserved', async () => {
  const [marketplace, saved] = await Promise.all([
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/views/ProductionMarketplace.tsx'), 'utf8'),
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/design-system/journey/SavedJourneyCard.tsx'), 'utf8'),
  ]);
  assert.match(saved, /title=\{routeFullAddress\}/, 'the tooltip must still carry the complete address');
  assert.match(saved, /compactPlaceLabel\(journey\.origin_name\)/, 'the saved card title reverted to the raw label');
  assert.match(saved, /тариф невідомий/, 'a saved journey with an unknown fare has to caption the dash');
  assert.match(marketplace, /compactPlaceLabel\(booking\.origin_name\)/, 'the booking card reverted to the raw label');
  assert.match(marketplace, /compactPlaceLabel\(offer\.origin_name\)/, 'the offer rows reverted to the raw label');
});

// Cards used to be frozen by an unlayered rule, so every screen utility lost to it silently.
test('the default card surface is a component-layer rule driven by theme tokens', async () => {
  const [css, marketplace] = await Promise.all([
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8'),
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/views/ProductionMarketplace.tsx'), 'utf8'),
  ]);
  const cardBlock = css.match(/@layer\s+components\s+\{\s*\.production-app\s+:is\(article,\s+\[data-surface="card"\]\)\s+\{([\s\S]{0,400}?)\n\s+\}/);
  assert.ok(cardBlock, 'the card surface must live inside @layer components so screen utilities win');
  assert.match(cardBlock[1], /background-color: var\(--color-marshgo-card\)/, 'the card background must come from the theme token');
  assert.doesNotMatch(css, /html\.dark \.production-app :is\(article[^}]*!important/, 'a !important card override re-freezes the surface against the token');
  assert.equal((css.match(/--mg-surface-tint:/g) || []).length, 2, 'the tint token must be defined once per theme');
  assert.match(marketplace, /bg-\[var\(--mg-surface-tint\)\]/, 'sub-surfaces must be tinted through the token');
  assert.doesNotMatch(marketplace, /bg-\[#f6f8fc\]/, 'a hardcoded light tint cannot flip with the theme');
});

test('home quick-action cards inherit text, surface, and border colors from the active theme', async () => {
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
  const base = css.match(/\.home-action-card\s*\{([^}]+)\}/)?.[1] ?? '';
  const dark = css.match(/html\.dark \.home-action-card\s*\{([^}]+)\}/)?.[1] ?? '';

  for (const block of [base, dark]) {
    assert.match(block, /--home-ink:\s*var\(--color-marshgo-text\)/);
    assert.match(block, /--home-sub:\s*var\(--color-marshgo-muted\)/);
    assert.match(block, /border-color:\s*var\(--color-marshgo-border\)/);
  }
  assert.match(base, /background:\s*var\(--home-surface,\s*var\(--color-marshgo-card\)\)/);
  assert.match(dark, /--home-surface:\s*var\(--color-marshgo-card\)/);
  assert.doesNotMatch(dark, /!important/);
});

// Three blues used to ship at once: #1687FF, #0877f9 and #0B63D6, hand-written per component.
test('a single action blue comes from the token, never a per-component hex', async () => {
  const files = [
    'src/views/ProductionMarketplace.tsx',
    'src/components/TransportTypesPanel.tsx',
    'src/components/OnboardingSlides.tsx',
    'src/components/MapLayersControl.tsx',
    'src/views/ProductionNavigation.tsx',
    'src/components/DriverPhotoCard.tsx',
  ];
  const sources = await Promise.all(files.map((file) => readFile(resolve(dirname(fileURLToPath(import.meta.url)), '..', file), 'utf8')));
  sources.forEach((source, index) => {
    assert.doesNotMatch(source, /\b(?:bg|text|border|from|to)-\[#0[bB]63[dD]6\]/, `${files[index]} still hardcodes the action blue`);
  });
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
  assert.equal((css.match(/--mg-action:/g) || []).length, 2, '--mg-action must be declared once per theme');
  assert.equal((css.match(/--mg-blue:/g) || []).length, 2, '--mg-blue must be declared once per theme');
});

// The route sheet used to carry five blues at once, and the active sort tab put white labels on a
// #1687FF gradient — 3.53:1, under AA for the one control every journey comparison depends on.
test('the journey screens read one accent token set and the sort tabs stay AA-safe', async () => {
  const read = (file: string) => readFile(resolve(dirname(fileURLToPath(import.meta.url)), '..', file), 'utf8');
  const [sheet, results, routeScreen, savedCard] = await Promise.all([
    read('src/index.css'),
    read('src/views/JourneyResultsPanel.tsx'),
    read('src/views/JourneyRouteMapScreen.tsx'),
    read('src/design-system/journey/SavedJourneyCard.tsx'),
  ]);
  for (const token of ['--mg-blue-tint', '--mg-blue-ink']) {
    assert.equal((sheet.match(new RegExp(`${token}:`, 'g')) || []).length, 2, `${token} must be declared once per theme`);
  }
  assert.doesNotMatch(sheet, /--mg-electric/, 'an unused duplicate of --mg-blue keeps the token language ambiguous');
  assert.doesNotMatch(routeScreen, /#1687FF|#7CBFFF|#0B6EF3/, 'the route screen must not hand-pick blues — #7CBFFF measured 1.95:1 on the light sheet, so the selected card border vanished');
  assert.doesNotMatch(results, /#1687FF|#EAF3FF|#0B57A8|#0E2A44|#7FC0FF/, 'the results panel must not hand-pick blues');
  assert.doesNotMatch(savedCard, /bg-blue-50|dark:bg-\[#102746\]/, 'chip tones must come from the tint/ink tokens, not per-file dark: pairs');
  assert.match(results, /bg-\[var\(--mg-action\)\] text-white/, 'the active sort tab is a filled AA control: --mg-action is 5.57:1 under white, #1687FF was 3.53:1');
  assert.doesNotMatch(results, /bg-gradient-to-b from-\[#1687FF\]/, 'the sort-tab gradient put half of its white label under AA');
});

// Compact result cards omit repeated time rows; exact leg times remain in the route detail sheet.
test('compact result cards keep time in route details with transport chain and favorite actions', async () => {
  const read = (relative: string) => readFile(resolve(dirname(fileURLToPath(import.meta.url)), relative), 'utf8');
  const [css, panel, strip, mapScreen, marketplace] = await Promise.all([
    read('../src/index.css'),
    read('../src/views/JourneyResultsPanel.tsx'),
    read('../src/design-system/journey/JourneySegmentStrip.tsx'),
    read('../src/views/JourneyRouteMapScreen.tsx'),
    read('../src/views/ProductionMarketplace.tsx'),
  ]);
  assert.doesNotMatch(panel, /journey-result-window|formatJourneyClock|journeyArrivalDayNote/,
    'repeated start/end times must not add height or detail text to compact result cards');
  assert.doesNotMatch(css, /\.journey-result-window/,
    'the removed time row must not leave unused card styling behind');
  assert.doesNotMatch(panel, /Відправлення:|Прибуття:|Рекомендований|У дорозі|Пішки \{formatJourneyDuration/,
    'the result card must not repeat labels or secondary travel summaries');
  assert.match(panel, /data-testid="journey-result-details-button"/, 'each compact card needs a visible route-details action');
  assert.match(panel, /journey-result-save-button/, 'each compact card keeps its favorite action');
  assert.match(mapScreen, /data-testid="journey-alternative-departures"/, 'grouped departures remain reachable in route details');
  assert.match(mapScreen, /journey-route-recommendation/, 'strategy ranking remains in route details');
  assert.match(mapScreen, /function legTimeLabel\(leg: JourneyLeg, durationSeconds: number\)[\s\S]{0,220}formatTime\(leg\.departureAt\)[\s\S]{0,120}formatTime\(leg\.arrivalAt\)/,
    'exact start and end times remain in the route details timeline');
  assert.match(mapScreen, /\{legTimeLabel\(leg, item\.durationSeconds\)\}/,
    'each route detail segment still renders its own exact times');
  assert.match(mapScreen, /const alternativeDepartureAt = altFirst\.departureAt;/, 'alternative departure rows must use the itinerary departure, not the requested search time');
  assert.match(mapScreen, /journeyArrivalDayNote\(altLast\.arrivalAt, alternativeDepartureAt\)/, 'overnight labels must compare arrival to the actual first leg departure');
  assert.doesNotMatch(mapScreen, /formatTime\(alternative\.requestedDepartureAt \?\? altFirst\.departureAt\)/, 'alternative rows must not show the search time as the departure');
  assert.doesNotMatch(panel, /durationTitle=/, 'a title-only duration is the reason the window was invisible');
  // Both screens mount the same strip, so the route number has to appear on both.
  assert.match(panel, /badge: journeyRouteBadge\(segment\.leg\?\.routeName\)/, 'the results strip lost the route number');
  assert.match(mapScreen, /badge: journeyRouteBadge\(leg\.routeName\)/, 'the route sheet strip lost the route number');
  assert.match(strip, /item\.badge/, 'the strip must branch on the route number');
  assert.match(strip, /className="journey-segment-tile-badge" style=\{\{ \['--segment-color' as string\]: item\.color \}\} title=\{item\.label\}>\{item\.badge\}/,
    'the pill takes the segment colour through a variable and keeps the mode word as its tooltip');
  assert.match(strip, /className="journey-segment-tile-label" title=\{item\.label\}>\{item\.label\}/,
    'a leg without a route number must still say what the vehicle is');
  assert.match(css, /\.journey-segment-tile-badge \{[\s\S]{0,400}background-color: color-mix\(in srgb, var\(--segment-color\) 18%, transparent\)/,
    'the pill tint must come from the segment colour, and the ink stays inherited for AA');
  assert.doesNotMatch(css, /\.journey-segment-tile-badge \{[\s\S]{0,400}color: #/, 'white or hand-picked text on a saturated mode pill falls under WCAG AA');
  // Selection is a fact about what the passenger opened, so it is owned by the screen switcher.
  assert.match(marketplace, /setChosenJourneyId\(journey\.id\); setSelectedRouteMap\(journey\)/,
    'opening a card must record which journey is chosen');
  assert.match(marketplace, /setJourneySearchStartedAt\(Date\.now\(\)\); setShowResults\(true\); setChosenJourneyId\(null\)/,
    'a new search must clear the previous choice');
  assert.match(panel, /data-testid="journey-result-details-button" aria-label=\{chosen \? `Обраний маршрут\. \$\{openLabel\}` : openLabel\}/,
    'the chosen card state remains attached to the visible details action');
  assert.match(css, /\.journey-result-card\[data-chosen="true"\] \{ border-color: var\(--mg-blue\)/,
    'the chosen ring must use the single action blue token');
  assert.doesNotMatch(css, /\.journey-segment-tile-heading \{ font-size:/,
    'a duplicate heading rule later in the sheet silently wins the cascade and shrinks tile text again');
  assert.doesNotMatch(panel, /text-\[(?:[89]|1[01])(?:\.\d+)?px\]/, 'results-card chrome drifted under the 12 px floor');
});

// Dark is the product default (owner decision, 2026-11-04). The shell has to agree, or the first
// frame paints light and the theme arrives only after the bundle boots.
test('the theme defaults to dark and the boot shell paints it first', async () => {
  const [html, themeModule] = await Promise.all([
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../index.html'), 'utf8'),
    import('../src/services/theme'),
  ]);
  assert.equal(themeModule.themeService.getTheme(), 'dark', 'a first run with no stored choice must open dark');
  assert.match(html, /classList\.add\('boot-dark'\)/, 'the boot shell must carry the same dark default');
  assert.doesNotMatch(html, /getItem\('mg_theme'\) === 'dark'\)/, 'the shell went dark only for an explicit stored choice, so the default flashed light');
});

// At 320–390 px the summary row cannot hold duration + price + action chips on one line, and the
// children are shrink-0 on purpose — a cut-off fare is worse than a taller header. So the row has to
// wrap. With a zero flex basis the line-break test never sees the real content width, the left group
// shrinks and the chips paint over «≈ 23 ₴», which is exactly the 2026-11-04 visual-pass defect.
test('the compact route lip wraps instead of painting action chips over the price', async () => {
  const lip = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/design-system/journey/CanonicalRouteLip.tsx'), 'utf8');
  const compactRow = lip.match(/'flex min-h-9[^']*'/);
  assert.ok(compactRow, 'the compact summary row lost its own class string');
  assert.match(compactRow[0], /flex-wrap/, 'a nowrap summary row overflows and hides the price under the action chips');
  assert.match(lip, /flex-\[1_1_auto\]/, 'a zero flex basis hides the content width from the wrap test');
  const undersized = [...lip.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)]
    .filter(size => Number(size[1]) < 12)
    .map(size => `${size[1]}px`);
  assert.deepEqual(undersized, [], `the lip carries the numbers a passenger compares, so 12 px is its floor: ${undersized.join(', ')}`);
});

// Measured on 2026-11-04 at 390 px: each place row carried two 44 px buttons (map pin + clear), the
// value column got 179 px and «Аеропорт, Торгмаш, вул. Мічурина» lost 103 px; the seat stepper squeezed
// its own text to 24 px so «1 пасажир» wrapped under the minus button. The destination keeps one compact
// map pin inside its row; the redundant full-width picker below the fields is removed.
test('the search screen gives each field the width its value needs', async () => {
  const read = (relative: string) => readFile(resolve(dirname(fileURLToPath(import.meta.url)), relative), 'utf8');
  const [css, marketplace] = await Promise.all([read('../src/index.css'), read('../src/views/ProductionMarketplace.tsx')]);
  // Every assertion below is scoped to the search card: the same place-row markup also exists in the
  // offer and demand forms, and a strip that only has to sit under the search rows passes a file-wide
  // grep from anywhere in the file.
  const searchFormStart = marketplace.indexOf('const searchForm = <form');
  assert.notEqual(searchFormStart, -1, 'the search card left the markup');
  const searchForm = marketplace.slice(searchFormStart, marketplace.indexOf('</form>', searchFormStart));
  const placeRows = [...searchForm.matchAll(/<div role="group" aria-label="(?:Початкова|Кінцева) точка"[\s\S]*?<\/div>/g)];
  assert.equal(placeRows.length, 2, 'the place rows left the shared group markup');
  assert.equal((placeRows[0][0].match(/aria-label="Обрати на мапі"/g) || []).length, 0, 'the origin row keeps only its location action');
  assert.equal((placeRows[1][0].match(/aria-label="Обрати на мапі"/g) || []).length, 1, 'the destination keeps the compact in-field map pin from the approved layout');
  assert.equal((searchForm.match(/Обрати на мапі: \{\(routePlaceField/g) || []).length, 0, 'the redundant full-width map picker must stay out of the search card');
  assert.match(searchForm, /setPicker\(\{ form: 'search', field: 'destination' \}\)/, 'the compact destination map pin must fill the destination field');
  assert.match(searchForm, /\{destination \? <button type="button" aria-label="Очистити кінцеву точку"/, 'the entered destination keeps its clear action');
  assert.match(searchForm, /<input required title=\{(?:origin|destination) \|\| undefined\}/, 'a clipped address must still be readable in full');
  assert.equal((searchForm.match(/aria-label="Вибрати дату й час (?:відправлення|прибуття)"[\s\S]{0,700}?<ChevronDown/g) || []).length, 0,
    'the chevron inside a date tile is decoration on a control that is already a button, and it costs the value its last characters');
  assert.match(searchForm, /search-trip-details search-trip-details--stack/, 'the seat stepper and the budget share one row at every width (owner, 2026-11-08)');
  assert.match(searchForm, /search-trip-details--armed/, 'an armed arrival tile carries a 44 px clear button next to its value');
  assert.doesNotMatch(searchForm, /Скасувати обмеження прибуття[\s\S]{0,220}?size-8/, 'a 32 px clear button breaks the 44 px target rule');
  assert.match(css, /@media \(max-width: 430px\)[\s\S]{0,320}\.search-trip-details--armed \{ grid-template-columns: minmax\(0, 1fr\); \}/,
    'without the armed stack the 164 px half clips «5 лист., 20:00» by 18 px');
  assert.doesNotMatch(css, /\.search-trip-details--stack \{ grid-template-columns: minmax\(0, 1fr\); \}/,
    'the owner asked for passengers and budget on one row; the full-width stack must not come back');
  assert.match(css, /@media \(max-width: 360px\)[\s\S]{0,700}\.search-trip-details:not\(\.search-trip-details--stack\) \{ grid-template-columns: minmax\(0, 1fr\); \}/,
    'at 320 px only the date pair may stack; the stepper+budget row keeps its two columns');
  assert.match(css, /\.trip-tile--stepper \{ flex-wrap: wrap; justify-content: center;/,
    'the 44 px stepper pair wraps inside its tile instead of squeezing «1 пасажир» down to 24 px');
  assert.doesNotMatch(css, /\.search-trip-details:not\(\.search-trip-details--stack\)[\s\S]{0,80}!important/,
    'a forced two-column date row came back; at 320 px it clips the departure time');
  assert.doesNotMatch(css, /\.trip-tile button\s*\{/,
    'the square-button treatment leaked from the seat stepper to the arrival tile and made «З» and «По» look like different controls');
});

// FIELD-X-1 (2026-11-05, seen in /tmp/mgshots11/70-dark-route-form.png at 390×844): the «Куди» row offered
// «Очистити кінцеву точку» while the field was empty — a destructive control with nothing to destroy. The
// owner's rule is a × only once there is text. Main shipped the stronger form of the same rule: the slot
// never goes inert, it changes job — clear when there is text, «Обрати на мапі» when there is not. The
// origin row keeps its own second job (the location arrow). Both keep one 44 px box so the card cannot jump
// on the first keystroke.
test('a place row only offers to clear a value that is actually there', async () => {
  const read = (relative: string) => readFile(resolve(dirname(fileURLToPath(import.meta.url)), relative), 'utf8');
  const marketplace = await read('../src/views/ProductionMarketplace.tsx');
  const searchFormStart = marketplace.indexOf('const searchForm = <form');
  assert.notEqual(searchFormStart, -1, 'the search card left the markup');
  const searchForm = marketplace.slice(searchFormStart, marketplace.indexOf('</form>', searchFormStart));
  const rowFor = (label: string) => searchForm.match(new RegExp(`<div role="group" aria-label="${label}"[\\s\\S]*?</div>`))?.[0] ?? '';
  const originRow = rowFor('Початкова точка');
  assert.match(originRow, /\{origin \? <X size=\{16\}\/> : <Navigation size=\{16\}\/>\}/,
    'the origin row must keep its empty-state job — the location arrow, not a dead ×');
  assert.match(originRow, /data-field-action=\{origin \? 'clear' : 'locate'\}/,
    'the origin slot must name the job it is doing, so the icon is never the only signal');
  const destinationRow = rowFor('Кінцева точка');
  assert.notEqual(destinationRow, '', 'the destination row left the shared group markup');
  assert.match(destinationRow, /setPicker\(\{ form: 'search', field: 'destination' \}\)/,
    'the destination field retains its compact map pin action');
  assert.match(destinationRow, /aria-label="Обрати на мапі" title="Обрати на мапі"/,
    'the map pin remains accessible and clearly named');
  assert.match(destinationRow, /\{destination \? <button[\s\S]*?: <button/,
    'the same action slot switches from map selection to clearing once text exists');
  assert.match(destinationRow, /\{destination \? <button type="button" aria-label="Очистити кінцеву точку"/,
    'the clear action only appears after a destination exists');
  assert.match(originRow, /className="grid h-11 w-11/, 'the origin location action keeps its 44 px target');
  assert.match(destinationRow, /\{destination \? <button[\s\S]{0,420}className="grid h-11 w-11/,
    'the conditional destination clear action keeps its 44 px target');
});
