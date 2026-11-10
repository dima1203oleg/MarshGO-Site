# MARSHGO bottom-sheet density acceptance

**Status: PARTIAL** · **Release: NOT_RELEASED**

This candidate updates the shared route-preview and active-navigation sheets in the canonical Site source. A second density pass now targets a 25–35% compact-height reduction while preserving the 44 px primary-action target. Browser review used the clearly synthetic route fixture, not a live journey or provider response. `:7777`, the active Site checkout, the API, and production were not changed.

## What changed

- Compact route cards show mode/name, duration, fare when known, exact times, and both place names in two rows. Stop lists remain available behind a thumb-sized disclosure; interactive stop rows retain 44 px targets.
- The summary ribbon scrolls natively on narrow screens. The page itself has no horizontal overflow.
- Floating segment callouts now choose a screen-space anchor that avoids the visible map-control rail, route sheet, header, route chip and viewport edge when another safe placement exists.
- Bottom safe area is included once in the sheet height and inner padding. The four detents remain ordered.
- Active navigation starts compact, keeps its current instruction and primary action visible, and hides secondary stage/status metadata until the sheet is opened. The previous overlap between the instruction and CTA is removed.
- The expanded route-details sheet measures its actual content, including opened stop rows. It shrinks to the content height when possible and grows to the configured cap when the content needs more room. Camera padding uses the measured sheet height.

## Browser measurements

Baseline and candidate were measured in the same Chromium preview at CSS viewport sizes 320×568, 375×812, 390×844, and 430×932. The baseline worktree and candidate share base `895f51e0e1f728c5b3ba0458b2d98e74ad5fb62f`. Heights are CSS pixels. The test browser reported a 0 px safe-area inset; physical iPhone safe areas are not verified here.

### Compact detent

| Viewport | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| 320×568 | 240 | 178 | 62 px · 25.8% |
| 375×812 | 240 | 178 | 62 px · 25.8% |
| 390×844 | 245 | 178 | 67 px · 27.3% |
| 430×932 | 270 | 186 | 84 px · 31.1% |

Candidate compact-sheet DOM measurements in the local fixture were 178 px at 320×568, 375×812 and 390×844, and 186 px at 430×932. The route summary measured 30 px, the segment ribbon 50 px, the CTA 44 px, and all three route stages were visible at each viewport. The active-navigation view shares the compact-detent calculation and now uses the same 44 px compact CTA class; its full live-navigation layout was not part of this visual fixture.

An interactive browser pass at 375×667 measured the expanded sheet at 364 px with 318 px of content; it retained all three stages. Selecting the bus stage zoomed the map to its synthetic 7.4 km geometry and displayed the segment callout. This confirms the compact/expanded interaction in the local fixture only; it does not verify live route geometry.

### Expanded route details

| Viewport | Before height / full cards visible | After height / full cards visible |
| --- | --- | --- |
| 320×568 | 396 px / 1 of 5 | 396 px / 3 of 5; remaining rows scroll inside the sheet |
| 375×812 | 640 px / 4 of 5 | 566 px / 5 of 5 |
| 390×844 | 672 px / 4 of 5 | 566 px / 5 of 5 |
| 430×932 | 760 px / 5 of 5 | 566 px / 5 of 5 |

Baseline cards were 94–98 px tall; candidate cards measured 53.7 px each and retain all route times and place names. The 390×844 five-leg fixture left an 11 px gap between its final card and CTA after content fitting. Opening a two-stop list grew the sheet from 566 to 672 px; closing it returned the sheet to 566 px. On the 320×568 viewport, the available space cannot show all five stages simultaneously; the remaining stages are available through the sheet's own vertical scroll.

### Half detent and horizontal chain

The half detent deliberately uses more height on 375–430 px wide screens so more compact cards are visible at once. Before/after heights were 300/284 px at 320×568, 304/365 px at 375×812, 316/380 px at 390×844, and 349/419 px at 430×932. Full cards visible changed from 1/1/1/2 to 2/3/4/4. This is a content-density trade-off: the half sheet is taller on the three larger viewports, while exposing more route stages.

At 320 px, the five-step ribbon measured 374 px of content in a 318 px scroller; at 375 px it measured 374 px in 373 px. At 390 and 430 px it fit. All four viewports kept the document width at the viewport width.

## Verification

- Focused route-sheet, camera-padding, shared-sheet and navigation tests after this density pass: **36 passed, 0 failed, 0 skipped**.
- Local Codex browser visual review: the synthetic route sheet rendered at 320×568, 375×812, 390×844 and 430×932. DOM measurements confirm the height, summary, segment ribbon, 44 px CTA and 3/3 visible stages. Screenshots were observed in the browser for each viewport; the preview uses no live itinerary.
- Full typecheck/lint/build and the full Site suite are pending the exact-head CI run for the current implementation commit. The preceding source head passed 667 tests, typecheck, lint, build, token, bundle, single-React and boot-smoke checks; that evidence does not replace the current-head run.
- Physical iPhone safe-area inset is not present in the browser fixture; no device claim is made.

## Limits and remaining gates

- **PARTIAL:** visual browser preview uses synthetic fixture data. The MapLibre test style logged missing `circle-11` and `wood-pattern` assets and a fixture bounds warning; this is not evidence about live map tiles or production geometry. The browser log also contains an unscoped `MutationObserver.observe` error at Vite reconnect; the candidate fixture no longer uses a MutationObserver, but the error's source has not been identified, so console cleanliness is not verified.
- **NOT_TESTED:** physical iPhone, iOS Safari/WebKit, Android touch input, PWA install mode, and real-device safe-area insets. Desktop browser resizing is not a substitute for these checks.
- **NOT_TESTED:** authenticated `/journeys/search` and `/journeys/:id` against live API data. The current `:7777` process was intentionally left untouched.
- Screenshot proof was captured from the local visual fixture during browser review; no screenshot file was added to the repository.
- Production release remains **NOT_RELEASED** pending real-device and live-runtime acceptance.

## Git record

- Previous source implementation commit: `fedf6e580ee7198a8d5f2df6268f8dd3de29b4a6`.
- Current compactness and callout-placement source commit: `37bbad15d94217ba818b7906a91fd1e33422c478` on `codex/bottom-sheet-density-20261110`; exact-head CI is pending.
- Draft pull request: [#129 — Compact shared journey bottom sheets](https://github.com/dima1203oleg/MarshGO-Site/pull/129).
- Exact-head GitHub CI was still running when this report was updated; no merge or deployment is authorized by this report.

## Follow-up — Master 10 active-navigation visual pass

- On source commit `8b1ca056459dc976a67fbdd9eac50422926b0cb0`, the collapsed active-navigation sheet measured 178 px high at 390×844; its primary action measured 44 px. The same 178 px target had been observed at 320×568. This is a local CSS viewport measurement, not physical iPhone safe-area validation.
- `JourneyActiveNavigation` now waits for MapLibre's ready status before fitting the initial route, uses one stable empty route reference to avoid resetting the preview flight on React rerenders, and does not duplicate floating distance/duration information on WALK stages.
- Browser review exposed selected direction chevrons visually merging into a white stripe in a wide, pitched map view. The new token set increases spacing, reduces icon size and lowers opacity. The retest at 1280×720 showed a clean route body without the stripe; 390×844 stage focus remained legible.
- At 320×568, the fixture's demo disclaimer was first moved away from the bottom stop label, then shortened to one line when it covered the tram info chip. The final preview keeps both labels clear and the document width at 320 px.
- Current PR head `56b71cc6d51f0577202a6833742f77bee0cb3025` passed exact-head CI run `42829380818` (676 tests, 0 failed, lint, typecheck, token checks, production build, bundle checks and Chromium boot smoke). This includes active-navigation source commit `8b1ca056459dc976a67fbdd9eac50422926b0cb0` and the fixture-only mobile disclosure follow-up.
- This follow-up does not change the earlier route-detail before/after measurements. The underlying demo route remains synthetic and physical-device acceptance remains NOT_TESTED.
