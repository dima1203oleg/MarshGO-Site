import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const canonicalDir = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/design/canonical');
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
test('route-result segment tiles stay at or above the 9 px legibility floor', async () => {
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
  const undersized = [...css.matchAll(/([^{}]*journey-segment-tile[^{}]*)\{([^}]*)\}/g)]
    .flatMap(([, selector, body]) => [...body.matchAll(/font-size:\s*(?:clamp\(\s*)?([\d.]+)px/g)]
      .filter(size => Number(size[1]) < 9)
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
  assert.match(marketplace, /finally \{ setBusy\(false\); setJourneySearchStartedAt\(null\); \}/,
    'the pending clock must stop when the search settles');
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
  assert.match(sheet, /style=\{\{[\s\S]{0,120}transition: dragging \? 'none' : `height var\(--mg-dur-base\) var\(--mg-ease-entrance\)`/,
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
  assert.match(css, /\.search-screen \.journey-search-card \.trip-tile \{[\s\S]*?min-height: 3\.5rem;[\s\S]*?background: #f6f8fc;/,
    'date, time and seats stopped sharing one surface, height and radius');
  assert.match(css, /html\.dark \.search-screen \.journey-search-card \.trip-tile \{ background: #16202B; color: #F5F9FF; \}/,
    'the dark theme must remap the same family, not each tile again');
  assert.match(marketplace, /className="trip-tile trip-tile--stepper/, 'the seat stepper left the shared tile class');
  assert.match(marketplace, /className="size-11[^"]*" aria-label="Менше пасажирів"/, 'seat steppers must be 44x44 pt, not 24 px wide');
  assert.doesNotMatch(marketplace, /h-8 w-6/, 'a 24 px wide stepper is below the 44 pt minimum and regressed back');
  // The 8.6rem radial circle behind «Куди їдемо?» was pure decoration and fought the headline.
  assert.doesNotMatch(css, /\.home-intro::after \{[\s\S]{0,200}radial-gradient/, 'the decorative blob behind the search heading came back');
});

// The first card of every strategy tab used to carry a blue ring — the same visual language the
// app uses for "selected" — while nothing was selected; opening a card navigates to the map screen.
test('result cards mark the ranked pick instead of faking a selection state', async () => {
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
  const panel = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/views/JourneyResultsPanel.tsx'), 'utf8');
  assert.match(panel, /data-top-pick=\{index === 0 \? 'true' : undefined\}/,
    'the rank-1 journey must be exposed as data, not as an ad-hoc class');
  assert.match(panel, /Рекомендований/, 'the stronger-looking card has to say why it looks different');
  assert.doesNotMatch(panel, /ring-blue-100/, 'a selection ring on an unselected card is a false affordance');
  assert.match(css, /\.journey-result-card\[data-top-pick="true"\] \{ border-color: #B9D8F7; \}/,
    'the light theme lost its one-notch accent border for the ranked pick');
  assert.doesNotMatch(css, /\.journey-result-card:first-of-type \{[\s\S]{0,80}border-color: #1687FF/,
    'position-based border styling came back; it highlighted the first card in every tab');
});

// An unknown fare rendered as a bare em-dash with no explanation, and the segment scroll cue could
// appear for flex rounding alone. Keep a measured floor for the cue and a caption beside the dash.
test('segment scroll cue ignores rounding and unknown fare explains itself', async () => {
  const read = (relative: string) => readFile(resolve(dirname(fileURLToPath(import.meta.url)), relative), 'utf8');
  const [strip, lip, panel] = await Promise.all([
    read('../src/design-system/journey/JourneySegmentStrip.tsx'),
    read('../src/design-system/journey/CanonicalRouteLip.tsx'),
    read('../src/views/JourneyResultsPanel.tsx'),
  ]);
  assert.match(strip, /hidden >= 24/, 'the cue needs a floor a real stage chip can actually cross');
  assert.doesNotMatch(strip, /clientWidth \+ 2/, 'the cue threshold drifted back to 2 px, where rounding alone triggers it');
  assert.match(lip, /priceCaption\?: ReactNode;/, 'the shared lip needs one caption slot for unavailable prices');
  assert.match(panel, /тариф невідомий/, 'an unknown fare has to say why instead of showing a bare dash');
  assert.match(panel, /max-w-\[7\.5rem\] truncate/, 'the caption must not widen the summary row on 360 px phones');
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
  assert.match(strip, /data-cue-at-end=\{scrollState\.atEnd \? 'true' : 'false'\}/,
    'the viewport must expose whether the row is scrolled to its end');
  assert.match(css, /\.journey-segment-tiles-viewport:not\(\[data-cue-at-end="true"\]\)[\s\S]{0,120}mask-image: linear-gradient\(to right/,
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
  const cardBlock = css.match(/@layer components \{\s*\.production-app :is\(article, \[data-surface="card"\]\) \{([\s\S]{0,400}?)\n  \}/);
  assert.ok(cardBlock, 'the card surface must live inside @layer components so screen utilities win');
  assert.match(cardBlock[1], /background-color: var\(--color-marshgo-card\)/, 'the card background must come from the theme token');
  assert.doesNotMatch(css, /html\.dark \.production-app :is\(article[^}]*!important/, 'a !important card override re-freezes the surface against the token');
  assert.equal((css.match(/--mg-surface-tint:/g) || []).length, 2, 'the tint token must be defined once per theme');
  assert.match(marketplace, /bg-\[var\(--mg-surface-tint\)\]/, 'sub-surfaces must be tinted through the token');
  assert.doesNotMatch(marketplace, /bg-\[#f6f8fc\]/, 'a hardcoded light tint cannot flip with the theme');
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

// CP6b live review found the stage screen's primary CTA painted with a violet gradient (#A21CFF →
// #7C1BE3) while every other filled control in the app uses --mg-action. Owner decision: the action
// token wins, geometry unchanged.
test('the route CTA and the carpool book button are filled by the action token, not violet', async () => {
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
  const block = (selector: string) => {
    const match = css.match(new RegExp(`\\n\\${selector} \\{([^}]*)\\}`, 'm'));
    assert.ok(match, `${selector} went missing from the sheet`);
    return match![1];
  };
  const cta = block('.mg-route-cta');
  const focus = block('.mg-route-cta:focus-visible');
  const book = block('.mg-route-book');
  const violet = /#A21CFF|#7C1BE3|#A855F7|139, 60, 230|162, 28, 255|168, 85, 247/i;
  assert.match(cta, /background:\s*var\(--mg-action\);/, 'the filled control must carry white labels on --mg-action (5.57:1), the same token as the sort tab');
  assert.match(cta, /box-shadow:\s*var\(--mg-action-shadow\)/, 'the CTA glow must come from the action shadow token, not an inline violet rgba');
  assert.match(focus, /outline:\s*2px solid var\(--mg-blue\)/, 'focus is a 2px --mg-blue ring everywhere else in the system');
  for (const [name, body] of [['.mg-route-cta', cta], ['.mg-route-cta:focus-visible', focus], ['.mg-route-book', book]] as const) {
    assert.doesNotMatch(body, violet, `${name} still hand-picks a violet literal`);
  }
  assert.equal((css.match(/--mg-action-shadow:/g) || []).length, 2, '--mg-action-shadow must be declared once per theme');
});
