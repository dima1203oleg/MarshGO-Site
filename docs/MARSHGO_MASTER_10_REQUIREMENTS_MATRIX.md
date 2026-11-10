# MARSHGO Master 10 — requirements matrix

**Review date:** 2026-11-10 · **Release:** `NOT_RELEASED` · **Scope:** first implementation checkpoint; this is not final acceptance.

Evidence distinguishes source code, focused automated checks, synthetic browser interaction, live runtime, device, and production. A status below applies only to the evidence explicitly listed.

| Requirement ID | Requirement | Implemented component | Test / browser scenario | zrok / test environment | Candidate SHA | Screenshot / evidence | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M10-G1 | Compact route sheet: 25–35% lower collapsed height, readable content and action | `routeSheetHeights`, route and active-navigation compact CTA | 39 focused tests; synthetic sheet measured at four phone CSS sizes; segment selection and expanded sheet interaction | Local fixture `http://127.0.0.1:4178/bottom-sheet-visual.html?viewport=375x667`; zrok points elsewhere | `37bbad15d94217ba818b7906a91fd1e33422c478` | Browser screenshot observed in Codex; no repository screenshot file yet | PARTIAL |
| M10-G2 | Same bottom-sheet design in details, navigation and stage preview | Shared route sheet styles and active-navigation sheet | Shared-sheet source tests; no live navigation session opened | Local fixture; active navigation visual pass pending | `37bbad15d94217ba818b7906a91fd1e33422c478` | Focused test output; no active-navigation capture | PARTIAL |
| M10-G3 | Twelve distinct transport icons | `transportModeRegistry`, shared `TransportIcon`, local icon matrix fixture | Registry uniqueness and bus/marshrutka/tram/trolleybus tests; actual picker keeps all 12 modes selectable; browser matrix checked at 16/20/24/32 px in monochrome with no visible labels | Local fixture `http://127.0.0.1:4178/tests/visual/transport-icon-matrix.html?size=32`; zrok points elsewhere | `eb32f54ee436b2889d9d37caa2fa727e555d261d` | 4×3 visual screenshot observed in Codex; no repository screenshot file yet | PARTIAL |
| M10-G4 | Accurate route line, focused passenger segment and A/B/C behavior | MapLibre route geometry and focus layers | Synthetic bus segment selected; map zoomed to its fixture geometry | Local fixture only | Prior Site candidate; current diff does not change geometry | Browser screenshot showed focused synthetic bus callout | PARTIAL |
| M10-G5 | “Start” begins real GPS navigation; unavailable GPS stays honest | Navigation start flow | No permission prompt accepted and no real GPS session started | Not tested | — | None | NOT_TESTED |
| M10-G6 | Previous/Next stage preview never changes actual journey progress | Stage-preview controller | Existing focused tests cover state boundaries; full browser transition not replayed in this checkpoint | Local fixture / automated checks | Prior Site candidate | Test evidence only | PARTIAL |
| M10-G7 | HyperFlight follows verified geometry and docks at the next segment | HyperFlight controller and route path sampler | Existing candidate CI covered unit suite; complete animation not observed in this checkpoint | Browser animation acceptance pending | Prior Site candidate | No new video | PARTIAL |
| M10-G8 | Camera framing accounts for visible sheet and segment focus | Map camera and visible-area solver | Camera/sheet tests passed; selecting fixture bus focused the map | Local fixture | Prior Site candidate | Browser screenshot shows synthetic route focus | PARTIAL |
| M10-G9 | Floating segment info avoids map controls, dismisses correctly and does not imitate live data | `floatingInfoPlacement`, route map callout | Placement tests cover clear map, control-rail overlap and viewport edge; selected synthetic bus callout was visibly repositioned; full four-second/dissolve timing not newly measured | Local fixture | `37bbad15d94217ba818b7906a91fd1e33422c478` | Browser screenshot shows card clear of the right control rail; no repository screenshot file yet | PARTIAL |
| M10-G10 | Fresh vehicle positions, ETA confidence and onboard evidence | Server response and Site vehicle visibility | No live response validated in this checkpoint | zrok candidate unavailable | — | None | NOT_TESTED |
| M10-G11 | Pan, pinch, rotation, double-tap, inertia, horizontal and vertical gestures | MapLibre and sheet gesture layers | No real touch device/browser gesture session performed | No iPhone/Android touch evidence | — | None | NOT_TESTED |
| M10-G12 | Motion, memory and frame-time performance remain stable | Map and animation lifecycle | No FPS, long-frame, CPU or memory profile captured | Not tested | — | None | NOT_TESTED |
| M10-G13 | Browser candidate under review is the intended zrok build | zrok binding and local preview | Existing zrok URL inspected; its `:7777` process belongs to a different Qoder worktree | `https://marshgo-dima.shares.zrok.io` → `127.0.0.1:7777`, PID 59193, branch `qoder/site-mobile-touch-gestures-20261110`, SHA `d8e813d08446c851604a9f229172fa9979dc4cdd`. Do not use as candidate acceptance. | Local Site candidate runs separately on `:4178` | Process/worktree/SHA inspection recorded in Codex progress | BLOCKED |
| M10-G14 | Full authenticated route journey through details, navigation, transfers and arrival | Site + Server integration | No authenticated live end-to-end journey performed | Not tested | — | None | NOT_TESTED |
| M10-G15 | Six-repository release manifest pins exact compatible revisions | Central `MarshGO` release artifacts | No complete six-repository SHA/contract/migration manifest assembled in this checkpoint | Not tested | — | None | NOT_TESTED |

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
- The preview console reports missing `circle-11`/`wood-pattern` style assets, a fixture fit-bounds warning, and an unscoped `MutationObserver.observe` error on Vite reconnect. The source of the latter is not identified; console cleanliness is not verified.
- The shared zrok URL currently serves an unrelated Site worktree. Do not claim the modified branch was tested through zrok.
- Site production release remains `NOT_RELEASED`; no merge or deployment was performed.
- This matrix is expected to grow into individual requirements and evidence records as the remaining gates are implemented and tested.
