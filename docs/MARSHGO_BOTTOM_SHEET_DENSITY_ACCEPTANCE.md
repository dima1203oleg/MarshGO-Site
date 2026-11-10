# MARSHGO bottom-sheet density acceptance

**Status: PARTIAL** · **Release: NOT_RELEASED**

This change updates the shared route-preview and active-navigation sheets in the canonical Site source. The browser review used a clearly synthetic five-leg fixture, not a live journey or provider response. `:7777`, the active Site checkout, the API, and production were not changed.

## What changed

- Compact route cards show mode/name, duration, fare when known, exact times, and both place names in two rows. Stop lists remain available behind a thumb-sized disclosure; interactive stop rows retain 44 px targets.
- The summary ribbon scrolls natively on narrow screens. The page itself has no horizontal overflow.
- Bottom safe area is included once in the sheet height and inner padding. The four detents remain ordered.
- Active navigation starts compact, keeps its current instruction and primary action visible, and hides secondary stage/status metadata until the sheet is opened. The previous overlap between the instruction and CTA is removed.
- The expanded route-details sheet measures its actual content, including opened stop rows. It shrinks to the content height when possible and grows to the configured cap when the content needs more room. Camera padding uses the measured sheet height.

## Browser measurements

Baseline and candidate were measured in the same Chromium preview at CSS viewport sizes 320×568, 375×812, 390×844, and 430×932. The baseline worktree and candidate share base `895f51e0e1f728c5b3ba0458b2d98e74ad5fb62f`. Heights are CSS pixels. The test browser reported a 0 px safe-area inset; physical iPhone safe areas are not verified here.

### Compact detent

| Viewport | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| 320×568 | 240 | 186 | 54 px · 22.5% |
| 375×812 | 240 | 186 | 54 px · 22.5% |
| 390×844 | 245 | 190 | 55 px · 22.4% |
| 430×932 | 270 | 210 | 60 px · 22.2% |

The active-navigation compact detent measured the same heights. The gap between its instruction and CTA was 26, 26, 30, and 50 px respectively, with no overlap and no page-width overflow.

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

- Focused route-sheet, adaptive map-padding, and touch-target tests: **28 passed, 0 failed**.
- Full Site unit suite: **644 passed, 0 failed, 0 skipped**.
- TypeScript typecheck: **passed**.
- ESLint on changed source and test files: **passed**.
- Production build: **passed**.
- `git diff --check`: **passed**.
- Chromium component-preview review: all detents at all four target viewports; compact navigation instruction/CTA spacing; expanded content fit; opened/closed stop details; no horizontal page overflow.

## Limits and remaining gates

- **PARTIAL:** visual browser preview uses synthetic fixture data. The MapLibre test style logged missing `circle-11` and `wood-pattern` assets and a fixture bounds warning; this is not evidence about live map tiles or production geometry.
- **NOT_TESTED:** physical iPhone, iOS Safari/WebKit, Android touch input, PWA install mode, and real-device safe-area insets. Desktop browser resizing is not a substitute for these checks.
- **NOT_TESTED:** authenticated `/journeys/search` and `/journeys/:id` against live API data. The current `:7777` process was intentionally left untouched.
- Screenshot proof was captured from the local visual fixture during browser review; no screenshot file was added to the repository.
- Production release remains **NOT_RELEASED** pending real-device and live-runtime acceptance.

## Git record

- Source implementation commit: `fedf6e580ee7198a8d5f2df6268f8dd3de29b4a6`.
- Draft pull request: [#129 — Compact shared journey bottom sheets](https://github.com/dima1203oleg/MarshGO-Site/pull/129).
- Exact-head GitHub CI was still running when this report was updated; no merge or deployment is authorized by this report.
