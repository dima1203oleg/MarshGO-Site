# MARSHGO Master 10 — implementation checkpoint

**Status:** IN PROGRESS · **Production:** `NOT_RELEASED` · **Date:** 2026-11-10

This is an interim, evidence-based checkpoint for the first Master 10 implementation block. It does not claim full-product acceptance.

## Worktree and browser targets

- Work is isolated in `/Users/dima1203/.codex/worktrees/marshgo-bottom-sheet-density-20261110`, branch `codex/bottom-sheet-density-20261110`, current branch SHA `209f1aaec595622aa4c3667190aeb3a7c93ce545`; active-navigation fixes are in `8b1ca056459dc976a67fbdd9eac50422926b0cb0`, followed by a visual-fixture-only mobile disclosure adjustment. Compact-sheet and icon checkpoints are earlier commits on the same draft Site PR #129 line. The base worktree and shared canonical Site checkout remain untouched.
- Local preview: `http://127.0.0.1:4178/tests/visual/hyperflight-navigation.html`; it uses the real active-navigation component and synthetic five-stage itinerary data.
- Current shared zrok URL: `https://marshgo-dima.shares.zrok.io`. It forwards to `127.0.0.1:7777`, PID 59193, from Qoder's `/Users/dima1203/.qoder/worktrees/app/330dd3/MarshGO-Site` worktree, branch `qoder/site-mobile-touch-gestures-20261110`, SHA `d8e813d08446c851604a9f229172fa9979dc4cdd`. It is not serving this candidate and was not altered.
- The candidate preview's local Vite process is PID 30897 on port 4178. This is not a public tunnel and no new tunnel was created.

## Completed in this checkpoint

- Reduced the collapsed sheet target from 22.5% of viewport height (with a 186 px floor) to 20% (178 px floor); the compact CTA remains a usable 44 px high.
- Applied the compact CTA style to both route details and the collapsed active-navigation sheet.
- Added a regression assertion for the requested 25–35% collapsed-height reduction across 320×568, 375×812, 390×844 and 430×932.
- Fixed a visual overlap found during the browser pass: floating stage info now evaluates its position against the map controls, header, sheet and viewport, and selects another anchor when needed.
- Audited the twelve-mode icon registry. Each canonical mode maps to a distinct component; transfer now has a clear roof suitcase at small sizes. Added a monochrome 4×3 browser matrix and checked its rendering at 16, 20, 24 and 32 px.
- Improved the local-only visual fixture to report actual sheet/content dimensions and let the reviewer choose phone CSS dimensions.
- In the browser, verified collapsed and expanded states, selected the synthetic A53 stage, and observed map focus plus the route callout. At 375×667 the collapsed sheet measured 178 px; expanded measured 364 px with 318 px of content.
- Fixed HyperFlight cancellation caused by the active-navigation render passing a fresh empty route array into the map on every render; the stable route reference now preserves the preview animation across UI updates.
- Delayed initial route framing until the map reports a ready style, so the first mobile view frames the current leg instead of briefly fitting the whole-country background.
- Removed the duplicate floating callout on walking stages, where the persistent walk ribbon already shows the same distance and duration.
- Reduced selected-route direction chevrons after the wide browser view exposed a bright white stripe in a pitched view. The second visual pass shows sparse marks and an unobstructed route body.
- Added an explicitly synthetic, local-only five-stage browser route and manually stepped through access walk → bus → transfer walk → tram in the real component. The fixture disclosure says the route is invented and GPS is not sent.
- Repositioned and shortened the fixture-only disclosure after 320 px review found it covering a stop label and then the tram information chip. The final 320×568 stage-4 view keeps the disclosure in a single line below the navigation header, clear of the floating chip, control rail and stop labels.

## Verification

- Latest focused automated set: **35 passed, 0 failed, 0 skipped** across GPS/navigation state, HyperFlight path sampling, floating-info placement and route geometry rendering. Earlier adjacent sheet/icon sets were recorded separately above.
- `npm run typecheck`: passed. Targeted ESLint over all changed implementation and fixture files: passed. `git diff --check`: passed before commit.
- Chromium preview was visually observed on 320×568 and 390×844 mobile CSS viewports and at the default 1280×720 browser viewport. At 390×844, active-navigation sheet height measured 178 px and the main action 44 px. The five-stage fixture showed the bus, transfer walk and tram focus; the route is synthetic. A physical iPhone, iOS Safari touch gestures, authenticated live API and full live-route acceptance remain unverified.
- A separate local 4×3 monochrome icon matrix was observed at 16, 20, 24 and 32 px. It verified glyph distinctness only; production theme/surface integration across every screen remains a partial gate.
- The latest CUA console-log query returned no entries, but earlier fixture runs reported missing local style images (`circle-11`, `wood-pattern`), a fit-bounds warning and an unscoped `MutationObserver.observe` error during Vite reconnect. Console-clean remains unverified.
- Exact-head CI for the current PR head `56b71cc6d51f0577202a6833742f77bee0cb3025` passed in run `42829380818`: lint, typecheck, 676 tests (0 failed), token checks, production build, bundle/single-React checks and Chromium boot smoke. Product fix is in `8b1ca056459dc976a67fbdd9eac50422926b0cb0`; `209f1aaec595622aa4c3667190aeb3a7c93ce545` is a fixture-only visual-disclosure follow-up, and `56b71cc...` records acceptance evidence.

## Gate snapshot

- **G1 UI Density — PARTIAL:** target reduction is measured in the local synthetic preview; device safe-area and live routes remain unverified.
- **G2 Unified Sheet — PARTIAL:** the active-navigation compact sheet was inspected in a local fixture at mobile and desktop CSS viewports; authenticated live-navigation and device safe-area acceptance remain.
- **G3 Icons — PARTIAL:** the twelve registered components and 4×3 monochrome browser matrix are checked; use across every production context and physical display remains to be accepted.
- **G4 Geometry — PARTIAL:** a synthetic stage can focus the map; real route geometry and complete A/B/C acceptance remain.
- **G5 GPS Navigation — NOT_TESTED.**
- **G6 Stage Preview — PARTIAL:** manual synthetic browser stepping reached bus, transfer walk and tram; GPS/lifecycle separation is covered by focused tests. No authenticated live route was used.
- **G7 HyperFlight — PARTIAL:** the map route prop is stable across UI updates; path/timing tests pass and segment transitions were observed. This browser pass did not capture or time the entire in-flight animation on a live route.
- **G8 Camera — PARTIAL:** initial focus waits for the map style to be ready, and synthetic segment framing was visually observed; device-specific and live geometry remain.
- **G9 Floating Info — PARTIAL:** bus/tram info appears, walking duplication is removed, and prior placement tests cover controls; full four-second hold and dissolve were not measured in this pass.
- **G10 Live Transport — NOT_TESTED.**
- **G11 Touch — NOT_TESTED.**
- **G12 Performance — NOT_TESTED.**
- **G13 zrok Browser QA — BLOCKED:** current tunnel points to another worktree/build.
- **G14 Full Journey E2E — NOT_TESTED.**

The detailed per-gate ledger is in [MARSHGO_MASTER_10_REQUIREMENTS_MATRIX.md](MARSHGO_MASTER_10_REQUIREMENTS_MATRIX.md). See also [HyperFlight acceptance](MARSHGO_HYPERFLIGHT_ACCEPTANCE.md), [zrok visual acceptance](MARSHGO_ZROK_VISUAL_ACCEPTANCE.md) and [bottom-sheet density acceptance](MARSHGO_BOTTOM_SHEET_DENSITY_ACCEPTANCE.md). No production deployment or database mutation occurred.
