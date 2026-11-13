import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const routeScreen = readFileSync(new URL('../src/views/JourneyRouteMapScreen.tsx', import.meta.url), 'utf8');
const navigationScreen = readFileSync(new URL('../src/views/JourneyActiveNavigation.tsx', import.meta.url), 'utf8');
const densityCss = readFileSync(new URL('../src/views/routeSheetDensity.css', import.meta.url), 'utf8');

const sheetBlock = css.slice(css.indexOf('.route-map-screen {'), css.indexOf('}', css.indexOf('.route-map-screen {')));
const darkBlock = css.slice(css.indexOf('.route-map-screen[data-theme="dark"] {'), css.indexOf('}', css.indexOf('.route-map-screen[data-theme="dark"] {')));

function tokenPx(name: string): number {
  const match = sheetBlock.match(new RegExp(`--${name}:\\s*([\\d.]+)px;`));
  assert.ok(match, `--${name} must be declared in px on the route sheet`);
  return Number(match![1]);
}

test('the compact density contract lives in one token set on the route sheet', () => {
  for (const name of [
    'mg-sheet-stack-gap', 'mg-sheet-card-pad-y', 'mg-sheet-card-pad-x',
    'mg-sheet-summary-pad-top', 'mg-sheet-summary-pad-bottom', 'mg-sheet-endpoints-pad-bottom',
    'mg-sheet-ribbon-height', 'mg-sheet-label-leading', 'mg-sheet-cta-min-height',
  ]) {
    assert.match(sheetBlock, new RegExp(`--${name}:`), `--${name} must be part of the shared density set`);
  }
  assert.doesNotMatch(darkBlock, /--mg-sheet-/, 'density is geometry: the dark theme must inherit the same rhythm, not redeclare it');
  assert.doesNotMatch(sheetBlock.match(/--mg-sheet-[^;]+;/g)!.join(' '), /#|rgb|hsl/, 'density tokens must stay spacing-only, never colors');
});

test('the token values keep the sheet dense without breaking the touch floor', () => {
  assert.ok(tokenPx('mg-sheet-stack-gap') <= 4, 'the segment stack must keep the one-step 4 px rhythm');
  assert.ok(tokenPx('mg-sheet-card-pad-y') <= 4, 'card vertical padding must stay compact');
  assert.ok(tokenPx('mg-sheet-card-pad-x') <= 8, 'card horizontal padding must not waste the narrow column');
  assert.ok(tokenPx('mg-sheet-summary-pad-top') <= 4, 'the summary header must not reintroduce a tall top gap');
  assert.ok(tokenPx('mg-sheet-summary-pad-bottom') <= 6, 'the summary must sit close to the ribbon');
  assert.ok(tokenPx('mg-sheet-endpoints-pad-bottom') <= 4, 'street names must sit close to the summary');
  const ribbon = tokenPx('mg-sheet-ribbon-height');
  assert.ok(ribbon >= 44 && ribbon <= 56, 'the stage row must clear the 44 px tap floor without becoming a second header');
  const cta = tokenPx('mg-sheet-cta-min-height');
  assert.ok(cta >= 44 && cta <= 56, 'the primary CTA stays prominent but must not eat the panel');
  const leading = Number(sheetBlock.match(/--mg-sheet-label-leading:\s*([\d.]+);/)![1]);
  assert.ok(leading <= 1.25, 'compact labels must not carry a roomy line-height');
});

test('summary, endpoints, ribbon, labels and CTA consume the density tokens', () => {
  const summary = css.slice(css.indexOf('.route-sheet-summary {'), css.indexOf('}', css.indexOf('.route-sheet-summary {')));
  assert.match(summary, /padding: var\(--mg-sheet-summary-pad-top\) 12px var\(--mg-sheet-summary-pad-bottom\);/);
  const endpoints = css.slice(css.indexOf('.route-sheet-endpoints {'), css.indexOf('}', css.indexOf('.route-sheet-endpoints {')));
  assert.match(endpoints, /padding: 0 12px var\(--mg-sheet-endpoints-pad-bottom\);/);
  const ribbon = css.slice(css.indexOf('.mg-route-ribbon--compact {'), css.indexOf('}', css.indexOf('.mg-route-ribbon--compact {')));
  assert.match(ribbon, /height: var\(--mg-sheet-ribbon-height\);/);
  const cta = css.slice(css.indexOf('.mg-route-cta {'), css.indexOf('}', css.indexOf('.mg-route-cta {')));
  assert.match(cta, /min-height: var\(--mg-sheet-cta-min-height\);/);
  const label = css.slice(css.indexOf('.mg-route-ribbon__label {'), css.indexOf('}', css.indexOf('.mg-route-ribbon__label {')));
  assert.match(label, /line-height: var\(--mg-sheet-label-leading\);/);
});

test('the segment list and card bodies take their rhythm from the same tokens', () => {
  // minmax(0,1fr) is load-bearing: the cards keep overflow visible for the rail
  // node, so an auto track would size to content and push row meta off-screen.
  assert.match(css, /\.mg-route-segment-list \{ display: grid; grid-template-columns: minmax\(0, 1fr\); gap: var\(--mg-sheet-stack-gap\); padding-block-start: 0; \}/);
  assert.match(css, /\.mg-route-segment__body \{ padding: var\(--mg-sheet-card-pad-y\) var\(--mg-sheet-card-pad-x\); \}/);
  assert.match(routeScreen, /<ol className="mg-route-segment-list">/);
  assert.match(routeScreen, /className="mg-route-segment__body flex items-start gap-1\.5"/);
  assert.doesNotMatch(routeScreen, /className="space-y-1 pt-0\.5"/, 'the hand-tuned list rhythm must not come back beside the tokens');
  assert.doesNotMatch(routeScreen, /px-1\.5 py-1"/, 'card padding must not drift back into per-component literals');
});

test('waiting is a compact service row, not a tall card', () => {
  const waitAt = routeScreen.indexOf('Очікування · {formatDuration(item.durationSeconds)}');
  assert.ok(waitAt > 0, 'the wait row must stay a single subject-first line');
  const waitBlock = routeScreen.slice(waitAt - 400, waitAt);
  assert.match(waitBlock, /px-3 py-0\.5 text-xs/, 'the informational wait row uses compact 2 px vertical padding');
  assert.doesNotMatch(waitBlock, /py-1|py-1\.5|py-2/, 'the wait row must not grow back into a tall card');
});

test('walking-geometry warning stays compact without hiding its full accessible meaning', () => {
  for (const screen of [routeScreen, navigationScreen]) {
    assert.match(screen, /aria-label="Для частини пішого маршруту немає перевіреної геометрії — лінію не домальовано\."/, 'assistive technology retains the complete reason');
    assert.match(screen, /Частина пішої геометрії не підтверджена/, 'the visible message is concise');
    assert.match(screen, /min-h-7 items-center truncate rounded-lg[\s\S]{0,140}px-2 py-1 text-\[12px\]/, 'the warning fits one compact row instead of taking a second card row');
  }
});

test('density never drops the interactive rows below the 44 px tap floor', () => {
  const transferAt = routeScreen.indexOf('data-testid="route-inline-transfer"');
  const transferBlock = routeScreen.slice(transferAt, transferAt + 1200);
  assert.match(transferBlock, /min-h-11 w-full/, 'the transfer row stays tappable at 44 px');
  assert.match(routeScreen, /className="mg-press-subtle grid h-11 w-11 place-items-center rounded-lg text-\[var\(--route-muted\)\]/, 'the stops toggle keeps its 44 px square');
  assert.match(css, /\.mg-route-ribbon--compact \.mg-route-ribbon__pill\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;/s, 'compact stage pills keep the tap floor');
});

test('the sheet reserves the device safe area once and keeps a compact CTA edge', () => {
  assert.match(routeScreen, /paddingBottom: bottomNavigationInset > 0 \? '8px' : 'max\(8px, env\(safe-area-inset-bottom\)\)'/, 'the sheet uses one bottom inset and does not reserve the tab bar safe area twice');
  assert.match(routeScreen, /sheetSnap === 'peek' \? '' : 'mt-auto'/, 'the CTA wrapper adds no second vertical gap above the button');
  assert.match(navigationScreen, /paddingBottom: bottomNavigationInset > 0 \? '8px' : 'max\(8px, env\(safe-area-inset-bottom\)\)'/, 'active navigation uses the same single-inset rule');
  assert.match(navigationScreen, /className="shrink-0 px-4"/, 'active navigation CTA adds no extra top gap');
  assert.match(densityCss, /section:is\(\[data-testid="route-bottom-sheet"\], \[data-testid="active-navigation-sheet"\]\)\s*\{\s*border-top-left-radius: 2rem;\s*border-top-right-radius: 2rem;/, 'details and active navigation share the same sheet top corners');
  assert.doesNotMatch(routeScreen, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\] pt-0\.5 mb-0\.5/, 'the old double bottom reserve must not come back');
});

test('phone route cards keep the transport title, duration and stop count in a compact row', () => {
  assert.match(densityCss, /\.mg-route-segment__body > button > span:last-child > span:first-child\s*\{[^}]*flex-wrap:\s*wrap;[^}]*gap:\s*2px 8px;/s, 'title and metrics have a visible gap and may wrap');
  assert.match(densityCss, /span\.mg-route-leg-heading\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*justify-content:\s*space-between;/s, 'the main phone width keeps title and compact route metrics on one line');
  assert.match(routeScreen, /mg-route-leg-title[\s\S]*mg-route-leg-meta[\s\S]*mg-route-leg-stop-count-short/, 'narrow phones retain the full transit title and provide a compact stop-count label');
  assert.match(densityCss, /@media \(max-width: 360px\)[\s\S]*?\.mg-route-leg-title \{\s*flex:\s*1 1 100%;/s, 'very narrow phones allow the full title to take its own row instead of truncating it');
  assert.doesNotMatch(densityCss, /span:first-child > b\s*\{[^}]*max-width:\s*50%/s, 'route names must not be cut in half');
  assert.match(densityCss, /@media \(max-width: 430px\)[\s\S]*?\.route-map-screen \[data-testid="route-bottom-sheet"\] \.route-sheet-endpoints\s*\{[^}]*position:\s*absolute;[^}]*clip:\s*rect\(0, 0, 0, 0\);/s, 'duplicate route-level street row is visually removed on phones while kept accessible');
  assert.match(densityCss, /@media \(max-width: 380px\)[\s\S]*?\.mg-route-endpoints__name\s*\{[^}]*white-space:\s*nowrap;[^}]*text-overflow:\s*ellipsis;/s, 'very narrow phones keep endpoint names to one line');
  assert.match(densityCss, /\.mg-route-endpoints\s*\{\s*margin-top:\s*0;\s*line-height:\s*1;\s*column-gap:\s*2px;/, 'street names sit on a tighter line and closer together without changing the touch target');
  assert.match(densityCss, /\.mg-route-endpoints\s*\{[^}]*row-gap:\s*0;/s, 'street-name rows cannot acquire an extra vertical grid gap');
  assert.match(densityCss, /\.mg-route-segment__body > button > span:last-child > span:first-child\s*\{[^}]*white-space:\s*normal;[^}]*line-height:\s*1\.3;/s, 'text remains readable at enlarged sizes');
  assert.match(routeScreen, /aria-label=\{liveStatusLabel\}[^>]*>[\s\S]*route-status-full[\s\S]*route-status-short/s, 'the compact status keeps its full accessible label');
  assert.match(densityCss, /@media \(max-width: 430px\)[\s\S]*?route-status-full\s*\{\s*display:\s*none;\s*\}[\s\S]*?route-status-short\s*\{\s*display:\s*inline;/s, 'phone status labels shorten to leave room for route times');
});

test('details retain the magnetic stage ribbon and the selectable vertical detail cards', () => {
  assert.match(routeScreen, /compactDominoRef = useMagneticDomino\(ribbonItems.length, sheetSnap !== 'peek'\)/, 'the shared ribbon is mounted for compact and detailed states');
  assert.match(routeScreen, /ref=\{compactDominoRef\} data-testid="route-stage-ribbon" data-domino-pattern="ribbon" tabIndex=\{0\}/, 'the horizontal ribbon remains keyboard reachable');
  assert.match(routeScreen, /data-testid="route-segment-list"[\s\S]*?<ol className="mg-route-segment-list">/, 'the expanded list remains the detailed, selectable route chain');
  assert.match(routeScreen, /aria-label=\{`Вибрати сегмент:/, 'each detailed leg remains an accessible segment selector');
});

test('segment cards use only the 44 px interaction row for vertical height', () => {
  assert.match(densityCss, /--mg-sheet-stack-gap:\s*4px;/, 'cards keep the compact 4 px separation shown in the route-details design');
  assert.match(densityCss, /--mg-sheet-card-pad-y:\s*3px;/, 'cards have enough inner breathing room without wasting vertical space');
  assert.match(routeScreen, /className="mg-route-segment__body flex items-start gap-1\.5"/, 'the compact card keeps the existing content and control structure');
  assert.match(densityCss, /\.mg-route-segment__body > button\s*\{[^}]*min-height:\s*44px;/s, 'compaction preserves the comfortable touch target');
});

test('route details match the map, summary and paired actions hierarchy', () => {
  assert.match(routeScreen, /className="route-details-title min-w-0 flex-1 truncate text-left font-black tracking-tight">Деталі маршруту/);
  assert.match(densityCss, /route-sheet-summary__metrics,[\s\S]*?route-sheet-summary__fare\s*\{[^}]*min-height:\s*38px;[^}]*border-radius:\s*999px;/);
  assert.match(routeScreen, /aria-label="Показати маршрут на карті"[\s\S]*?<span>На карті<\/span>/, 'the map CTA stays separate from starting GPS navigation');
  assert.match(routeScreen, /sheetSnap !== 'peek' && \([\s\S]*?route-sheet-map-cta/, 'the paired map action appears in route details, not the tiny peek state');
  assert.match(densityCss, /grid-template-columns:\s*minmax\(0, 1fr\) auto;/, 'the navigation CTA remains primary beside the map action');
});

test('selected journeys open in the reference details state and reveal only short stop lists', () => {
  assert.match(routeScreen, /useState<RouteSheetSnap>\('expanded'\)/, 'the route opens with details visible beneath the map');
  assert.match(routeScreen, /routeSheetHeights\(availableHeight\)\.expanded/, 'the initial expanded sheet preserves the navigation inset');
  assert.match(routeScreen, /const initialExpandedStopsLeg = journey\.legs\.find\(leg =>\s*isScheduledRouteLeg\(leg\) && \(leg\.stops\?\.length \?\? 0\) > 0 && \(leg\.stops\?\.length \?\? 0\) <= 8,/s, 'a short verified timetable opens like the reference while long stop lists stay compact');
  assert.match(routeScreen, /useState<string \| null>\(\(\) => initialExpandedStopsLeg\?\.id \?\? null\)/);
  assert.match(routeScreen, /!mapAdapterReady \|\| mapStatus !== 'available'/, 'the route refit waits for map layers before choosing the initial zoom');
  assert.match(routeScreen, /\}, \[[^\]]*mapAdapterReady[^\]]*mapPadding[^\]]*mapStatus[^\]]*routeFitKey[^\]]*segmentFocusKey[^\]]*sheetSnap[^\]]*\]\);/, 'map readiness reruns the first route fit after geometry focus is available');
});

test('expanded details and active navigation do not reserve a decorative tail below the last stage', () => {
  assert.match(routeScreen, /className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-0\.5" data-testid="route-segment-list"/, 'route details keep only a 2 px scroll tail');
  assert.match(navigationScreen, /className="mt-2 shrink-0 px-4 pb-2" data-testid="active-navigation-stages"/, 'timeline uses 16px sides and a bounded 8px tail');
  assert.match(densityCss, /\.route-sheet-endpoints\s*\{\s*padding-bottom:\s*0;/, 'the endpoint line has no decorative bottom padding');
});

test('compact and medium detents measure content and remove flex-created blue space', () => {
  assert.match(routeScreen, /heights\.collapsed = fitCollapsedRouteSheetHeight\(heights, collapsedContentHeight\)/, 'compact detent uses measured content height');
  assert.match(routeScreen, /heights\.half = fitMediumRouteSheetHeight\(heights, mediumContentHeight\)/, 'medium detent uses measured route-card content');
  assert.match(routeScreen, /currentSheetHeight - listRect\.height \+ listContentHeight/, 'medium height removes only unused flex height below the real list content');
  assert.match(routeScreen, /currentSheetHeight - freeGap/, 'compact height removes the measured empty gap before its CTA');
  assert.match(routeScreen, /sheetSnap !== 'collapsed' && sheetSnap !== 'half'/, 'only content detents are dynamically compacted');
});

test('viewport tracking does not clear fitted sheet measurements on every snap recalculation', () => {
  const viewportEffectStart = routeScreen.indexOf('const updateViewport = () =>');
  const viewportEffectEnd = routeScreen.indexOf('const mapUnavailable =', viewportEffectStart);
  const viewportEffect = routeScreen.slice(viewportEffectStart, viewportEffectEnd);
  assert.ok(viewportEffectStart >= 0 && viewportEffectEnd > viewportEffectStart, 'the viewport listener remains a distinct effect');
  assert.doesNotMatch(viewportEffect, /set(?:Collapsed|Medium|Expanded)ContentHeight\(null\)/, 'snap-model updates must not discard the measured content fit');
  assert.doesNotMatch(viewportEffect, /\}, \[sheetSnap, snapHeight\]\);/, 'the resize listener must not be recreated when content measurements change');
});

test('active navigation trims redundant vertical gaps while retaining the shared compact sheet', () => {
  assert.match(navigationScreen, /h1 data-testid="active-nav-leg-title" className="truncate text-\[17px\] font-extrabold leading-6/, 'compact state keeps a readable title');
  const destinationRowStart = navigationScreen.indexOf('data-testid="active-nav-leg-destination"');
  const destinationRowEnd = navigationScreen.indexOf('</p>', destinationRowStart);
  const destinationRow = navigationScreen.slice(destinationRowStart, destinationRowEnd);
  assert.ok(destinationRow.includes('data-testid="active-nav-leg-meta"') && destinationRow.includes('{activeLegMeta(leg)}'), 'destination and leg metrics share one compact row');
  assert.doesNotMatch(navigationScreen, /<p className="text-xs font-semibold tabular-nums text-\[var\(--route-subtle\)\]">\{activeLegMeta\(leg\)\}<\/p>/, 'leg metrics do not consume a second vertical row');
  assert.match(navigationScreen, /data-testid="active-nav-next-hint"/, 'the next stage remains a thin service line');
  assert.doesNotMatch(navigationScreen, /mx-5 mt-2 shrink-0 rounded-2xl border/, 'compact navigation has no duplicate instruction card');
  assert.match(navigationScreen, /showTimeline && <div className="mt-2 shrink-0 px-4 pb-2" data-testid="active-navigation-stages"/, 'only HALF and EXPANDED render the full timeline');
  assert.match(navigationScreen, /className="mg-route-segment-list" aria-label=\{`Усі етапи маршруту:/, 'the route list keeps its accessible label without a duplicate visible heading');
  assert.match(navigationScreen, /className="flex min-h-7 items-center px-3 py-1 text-xs/, 'wait events stay thin rows without a separate card');
});

test('expanded active navigation uses selectable leg cards instead of duplicating the stage ribbon', () => {
  assert.doesNotMatch(navigationScreen, /mg-route-ribbon__pill/, 'horizontal leg copies are not rendered beside the current leg');
  assert.match(navigationScreen, /!showTimeline && <div/, 'the main current-leg card is hidden when the timeline is visible');
  assert.match(navigationScreen, /aria-label=\{`Етап \$\{index \+ 1\}: \$\{activeLegTitle\(item\)\}/, 'the remaining leg cards are still individually selectable');
  assert.match(navigationScreen, /const showTimeline = sheetSnap === 'half' \|\| sheetSnap === 'expanded';/, 'the detailed list is exclusive to HALF and EXPANDED');
  assert.match(navigationScreen, /activeNavigationStageLabel\(following, Boolean\(freshNavigationFix\), legIndex, legs\.length, journey\.transfers\)/, 'stage label follows GPS guidance, GPS wait, or preview mode');
  assert.match(navigationScreen, /<ol className="mg-route-segment-list" aria-label=\{`Усі етапи маршруту:/, 'the detailed list remains explicitly labelled for assistive technology');
  assert.doesNotMatch(navigationScreen, /<p className="mb-1 text-xs font-extrabold uppercase tracking-\[\.12em\] text-\[var\(--route-muted\)\]">Увесь маршрут/, 'the duplicate visible section heading no longer consumes a full line');
});

test('expanded active navigation fits its measured content instead of stretching to the viewport cap', () => {
  assert.match(navigationScreen, /fitExpandedRouteSheetHeight/, 'navigation reuses the shared expanded-sheet content-fit rule');
  assert.match(navigationScreen, /data-testid="active-navigation-content"/, 'the scroll content has a stable measurement target');
  assert.match(navigationScreen, /sheet\.getBoundingClientRect\(\)\.height - content\.clientHeight \+ content\.scrollHeight/, 'natural height includes the fixed handle and CTA plus the full itinerary');
  assert.match(navigationScreen, /setExpandedContentHeight\(previous => previous !== null && Math\.abs\(previous - naturalHeight\) < 2 \? previous : naturalHeight\)/, 'sub-pixel observer noise does not keep resizing the sheet');
  assert.match(navigationScreen, /if \(sheetSnap !== 'expanded' \|\| draggingRef\.current\) return;/, 'user dragging takes priority over the measured resize');
});

test('static stop rows compact while selectable stops retain a 44px touch target', () => {
  assert.match(densityCss, /\.mg-journey-stop-row\s*\{[^}]*grid-template-columns:\s*44px 16px minmax\(0, 1fr\);[^}]*min-height:\s*34px;/s, 'static stops use the three-column 34px rhythm');
  assert.match(densityCss, /button\.mg-journey-stop-row\s*\{[^}]*min-height:\s*44px;/s, 'selectable stop rows retain the accessible touch target');
  assert.match(densityCss, /\.mg-route-stop-name\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s, 'long stop names can wrap instead of disappearing');
  assert.match(densityCss, /\.mg-route-stop-badge\s*\{[^}]*white-space:\s*nowrap;/s, 'boarding, alighting and skipped-stop labels remain intact');
  assert.match(readFileSync(new URL('../src/views/JourneyLegStops.tsx', import.meta.url), 'utf8'), /aria-label=\{`Зупинка: \$\{shortPlace\(stop\.name\)\}, час \$\{stopTime\(stop, index\)\}`\}/, 'the complete stop name and time remain available to assistive technology');
});

test('details and navigation recover the sheet when pointer capture is interrupted', () => {
  for (const screen of [routeScreen, navigationScreen]) {
    assert.match(screen, /window\.addEventListener\('blur', recoverInterruptedDrag\)/, 'window focus loss settles an in-progress sheet drag');
    assert.match(screen, /document\.addEventListener\('visibilitychange', recoverWhenHidden\)/, 'backgrounding the tab settles an in-progress sheet drag');
    assert.match(screen, /onLostPointerCapture=\{handlePointerEnd\}/, 'lost pointer capture completes the same drag lifecycle');
    assert.match(screen, /suppressHandleClick\.current = false/, 'recovery does not swallow the next deliberate handle tap');
  }
});
