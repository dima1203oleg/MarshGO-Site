# MARSHGO Master 10 — requirements matrix

**Review date:** 2026-11-10 · **Release:** `NOT_RELEASED` · **Scope:** first implementation checkpoint; this is not final acceptance.

Evidence distinguishes source code, focused automated checks, synthetic browser interaction, live runtime, device, and production. A status below applies only to the evidence explicitly listed.

| Requirement ID | Requirement | Implemented component | Test / browser scenario | zrok / test environment | Candidate SHA | Screenshot / evidence | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M10-G1 | Compact route sheet: 25–35% lower collapsed height, readable content and action | `routeSheetHeights`, route and active-navigation compact CTA | 39 focused tests; synthetic sheet measured at four phone CSS sizes; segment selection and expanded sheet interaction | Local fixture `http://127.0.0.1:4178/bottom-sheet-visual.html?viewport=375x667`; zrok points elsewhere | `37bbad15d94217ba818b7906a91fd1e33422c478` | Browser screenshot observed in Codex; no repository screenshot file yet | PARTIAL |
| M10-G2 | Same bottom-sheet design in details, navigation and stage preview | Shared route sheet styles and active-navigation sheet | Active-navigation compact sheet visually measured at 320×568, 390×844 and 1280×720; live navigation session not opened | Local synthetic fixture | `209f1aaec595622aa4c3667190aeb3a7c93ce545` | Current Codex browser tab; screenshot observed, no image file | PARTIAL |
| M10-G2.1 | Five-item global navigation stays reachable above the route sheet; safe area is reserved once | `ProductionMarketplace`, `routeSheetViewportHeights`, immersive route CSS | Source regression for mounted nav/reservation/z-order; local active-navigation fixture visibly shows bar above sheet and CTA. Full suite 677/677; typecheck, ESLint, build pass | `http://127.0.0.1:4178/tests/visual/hyperflight-navigation.html` (synthetic); zrok serves another worktree | `87684e96d4323dcb8243761037dbcba606c16b79` | Current visible Codex browser screenshot; no image file saved. Basemap is black due missing style image, so map appearance is not verified | PARTIAL |
| M10-G3 | Twelve distinct transport icons | `transportModeRegistry`, shared `TransportIcon`, local icon matrix fixture | Registry uniqueness and bus/marshrutka/tram/trolleybus tests; actual picker keeps all 12 modes selectable; browser matrix checked at 16/20/24/32 px in monochrome with no visible labels | Local fixture `http://127.0.0.1:4178/tests/visual/transport-icon-matrix.html?size=32`; zrok points elsewhere | `eb32f54ee436b2889d9d37caa2fa727e555d261d` | 4×3 visual screenshot observed in Codex; no repository screenshot file yet | PARTIAL |
| M10-G4 | Accurate route line, focused passenger segment and A/B/C behavior | MapLibre route geometry and focus layers | Synthetic bus, transfer walk and tram stage focus manually reviewed; focused route line remains subordinate to the basemap | Local fixture only | `8b1ca056459dc976a67fbdd9eac50422926b0cb0` | Current browser view at `/tests/visual/hyperflight-navigation.html`; synthetic geometry only | PARTIAL |
| M10-G5 | “Start” begins real GPS navigation; unavailable GPS stays honest | Navigation start flow | No permission prompt accepted and no real GPS session started | Not tested | — | None | NOT_TESTED |
| M10-G6 | Previous/Next stage preview never changes actual journey progress | Stage-preview controller in `JourneyActiveNavigation` | 35 focused tests pass; manual browser preview advanced through bus, transfer walk and tram. No GPS is sent by fixture. | Local synthetic fixture | `209f1aaec595622aa4c3667190aeb3a7c93ce545` | `http://127.0.0.1:4178/tests/visual/hyperflight-navigation.html`; screenshot observed in Codex, no file saved | PARTIAL |
| M10-G7 | HyperFlight follows verified geometry and docks at the next segment | HyperFlight controller, stable route prop and route path sampler | Path sampler/timing tests pass; browser stage transitions and destination framing observed. Current PR-head CI run `42829380818` passed. Entire animation duration/FPS not recorded. | Local synthetic fixture | `56b71cc6d51f0577202a6833742f77bee0cb3025` | Visible in current Codex browser tab; no video captured | PARTIAL |
| M10-G8 | Camera framing accounts for visible sheet and segment focus | Map camera, map-ready initial focus, visible-area solver | Initial mobile focus no longer runs before map status is ready; stage focuses observed at 320×568, 390×844 and 1280×720 viewport configurations | Local synthetic fixture | `8b1ca056459dc976a67fbdd9eac50422926b0cb0` | Browser view shows active tram segment and boarding point; local only | PARTIAL |
| M10-G9 | Floating segment info avoids map controls, dismisses correctly and does not imitate live data | `floatingInfoPlacement`, route map callout, walk-stage suppression | Placement tests pass; bus/tram cards appeared; duplicate walk card removed. Complete four-second hold/dissolve not timed in this pass. | Local synthetic fixture | `209f1aaec595622aa4c3667190aeb3a7c93ce545` | Screenshot was observed in browser, no repository image file | PARTIAL |
| M10-G10 | Fresh vehicle positions, ETA confidence and onboard evidence | Server response and Site vehicle visibility | No live response validated in this checkpoint | zrok candidate unavailable | — | None | NOT_TESTED |
| M10-G11 | Pan, pinch, rotation, double-tap, inertia, horizontal and vertical gestures | MapLibre and sheet gesture layers | No real touch device/browser gesture session performed | No iPhone/Android touch evidence | — | None | NOT_TESTED |
| M10-G12 | Motion, memory and frame-time performance remain stable | Map and animation lifecycle | No FPS, long-frame, CPU or memory profile captured | Not tested | — | None | NOT_TESTED |
| M10-G13 | Browser candidate under review is the intended zrok build | zrok binding and local preview | Existing zrok URL inspected; its `:7777` process belongs to a different Qoder worktree | `https://marshgo-dima.shares.zrok.io` → `127.0.0.1:7777`, PID 59193, branch `qoder/site-mobile-touch-gestures-20261110`, SHA `d8e813d08446c851604a9f229172fa9979dc4cdd`. Do not use as candidate acceptance. | Local Site candidate runs separately on `:4178` | Process/worktree/SHA inspection recorded in Codex progress | BLOCKED |
| M10-G14 | Full authenticated route journey through details, navigation, transfers and arrival | Site + Server integration | No authenticated live end-to-end journey performed | Not tested | — | None | NOT_TESTED |
| M10-G15 | Six-repository release manifest pins exact compatible revisions | Central `MarshGO` release artifacts | No complete six-repository SHA/contract/migration manifest assembled in this checkpoint | Not tested | — | None | NOT_TESTED |

### Latest bottom-navigation checkpoint

- Site commit `87684e96d4323dcb8243761037dbcba606c16b79` passed **677 tests (0 failed)**, typecheck, targeted ESLint and production build locally. Exact-head CI is pending.
- A desktop-sized local browser screenshot showed the five navigation items over the active route sheet and the CTA above the tab bar. Synthetic itinerary only; base map tiles/style assets were not available in the screenshot.
- `M10-G2.1` is **PARTIAL**. The shared zrok still targets the Qoder branch/SHA in G13; this checkpoint was not accepted through zrok.

## G1 measurements captured in the local fixture

| CSS viewport | Previous collapsed target | Current collapsed sheet | Reduction |
| --- | ---: | ---: | ---: |
| 320×568 | 240 px | 178 px | 25.8% |
| 375×812 | 240 px | 178 px | 25.8% |
| 390×844 | 245 px | 178 px | 27.3% |
| 430×932 | 270 px | 186 px | 31.1% |

At 375×667, the fixture's expanded sheet measured 364 px with 318 px of scroll content and all three fixture stages. At compact height, the measured sheet was 178 px with a 30 px summary, 50 px segment ribbon and 44 px primary action. Safe-area inset in this browser fixture was 0 px; these numbers do not verify physical iPhone safe areas.

## Current browser and release limits

- The preview uses synthetic route data and local MapLibre assets; it is not a live provider itinerary.
- The latest CUA console-log query returned no entries. Earlier preview runs reported missing `circle-11`/`wood-pattern` style assets, a fixture fit-bounds warning and an unscoped `MutationObserver.observe` error during Vite reconnect. Console cleanliness is not verified.
- The shared zrok URL currently serves an unrelated Site worktree. Do not claim the modified branch was tested through zrok.
- Site production release remains `NOT_RELEASED`; no merge or deployment was performed.
- This matrix is expected to grow into individual requirements and evidence records as the remaining gates are implemented and tested.
