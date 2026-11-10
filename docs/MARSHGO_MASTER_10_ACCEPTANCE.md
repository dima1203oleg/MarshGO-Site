# MARSHGO Master 10 — implementation checkpoint

**Status:** IN PROGRESS · **Production:** `NOT_RELEASED` · **Date:** 2026-11-10

This is an interim, evidence-based checkpoint for the first Master 10 implementation block. It does not claim full-product acceptance.

## Worktree and browser targets

- Work is isolated in `/Users/dima1203/.codex/worktrees/marshgo-bottom-sheet-density-20261110`, branch `codex/bottom-sheet-density-20261110`, source commit `37bbad15d94217ba818b7906a91fd1e33422c478`, based on the current draft Site PR #129 line. The base worktree and shared canonical Site checkout remain untouched.
- Local preview: `http://127.0.0.1:4178/bottom-sheet-visual.html?viewport=375x667`; it uses the real route-map screen with a synthetic itinerary fixture.
- Current shared zrok URL: `https://marshgo-dima.shares.zrok.io`. It forwards to `127.0.0.1:7777`, PID 59193, from Qoder's `/Users/dima1203/.qoder/worktrees/app/330dd3/MarshGO-Site` worktree, branch `qoder/site-mobile-touch-gestures-20261110`, SHA `d8e813d08446c851604a9f229172fa9979dc4cdd`. It is not serving this candidate and was not altered.
- The candidate preview's local Vite process is PID 30897 on port 4178. This is not a public tunnel and no new tunnel was created.

## Completed in this checkpoint

- Reduced the collapsed sheet target from 22.5% of viewport height (with a 186 px floor) to 20% (178 px floor); the compact CTA remains a usable 44 px high.
- Applied the compact CTA style to both route details and the collapsed active-navigation sheet.
- Added a regression assertion for the requested 25–35% collapsed-height reduction across 320×568, 375×812, 390×844 and 430×932.
- Fixed a visual overlap found during the browser pass: floating stage info now evaluates its position against the map controls, header, sheet and viewport, and selects another anchor when needed.
- Improved the local-only visual fixture to report actual sheet/content dimensions and let the reviewer choose phone CSS dimensions.
- In the browser, verified collapsed and expanded states, selected the synthetic A53 stage, and observed map focus plus the route callout. At 375×667 the collapsed sheet measured 178 px; expanded measured 364 px with 318 px of content.

## Verification

- Focused automated checks: **39 passed, 0 failed, 0 skipped** across route-sheet, map padding/focus, floating-info placement and active-navigation tests.
- `git diff --check`: passed.
- Chromium preview was visually observed at four CSS viewports. On the 375×667 view, a selected synthetic bus stage framed its geometry and its floating card no longer covered the map-control rail. The route is synthetic; browser safe area was 0 px. A physical iPhone, iOS Safari touch gestures, authenticated live API, full-route camera animation and the current change's exact-head CI remain unverified.
- Console review found missing test-style assets (`circle-11`, `wood-pattern`), a fixture bounds warning, and an unscoped `MutationObserver.observe` error at Vite reconnect. The candidate fixture no longer uses a MutationObserver, but the remaining error's source is unidentified; console cleanliness is not verified.
- Prior Site candidate commit `1646937859edd7d67c530e78713c7dda26d76784` passed CI run `42816504324` (667 tests and production build checks); report-only head `8632eb66746d508139c6ad8e54db4e04097af536` passed run `42817587235`. These runs predate `37bbad15d94217ba818b7906a91fd1e33422c478` and do not verify it; the current exact-head CI is pending.

## Gate snapshot

- **G1 UI Density — PARTIAL:** target reduction is measured in the local synthetic preview; device safe-area and live routes remain unverified.
- **G2 Unified Sheet — PARTIAL:** shared visual rhythm is covered by focused tests; full live-navigation visual acceptance remains.
- **G3 Icons — NOT_TESTED.**
- **G4 Geometry — PARTIAL:** a synthetic stage can focus the map; real route geometry and complete A/B/C acceptance remain.
- **G5 GPS Navigation — NOT_TESTED.**
- **G6 Stage Preview — PARTIAL:** state protections exist in tests; complete browser transition has not been replayed here.
- **G7 HyperFlight — PARTIAL:** earlier implementation/tests exist; this checkpoint did not observe the full animation.
- **G8 Camera — PARTIAL:** local segment focus and sheet-aware tests pass; live/device framing remains.
- **G9 Floating Info — PARTIAL:** a synthetic segment callout appears; the full timer/dissolve cycle was not measured here.
- **G10 Live Transport — NOT_TESTED.**
- **G11 Touch — NOT_TESTED.**
- **G12 Performance — NOT_TESTED.**
- **G13 zrok Browser QA — BLOCKED:** current tunnel points to another worktree/build.
- **G14 Full Journey E2E — NOT_TESTED.**

The detailed per-gate ledger is in [MARSHGO_MASTER_10_REQUIREMENTS_MATRIX.md](MARSHGO_MASTER_10_REQUIREMENTS_MATRIX.md). No production deployment or database mutation occurred.
