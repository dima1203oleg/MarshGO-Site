# MARSHGO Intelligent Navigation 4.0 — acceptance

Status: **PARTIAL** · Release: **NOT_RELEASED**

## Candidate and scope

- Site branch: `codex/intelligent-navigation-premium-20261110`
- Base `origin/main`: `895f51e0e1f728c5b3ba0458b2d98e74ad5fb62f`.
- Candidate commit: `8c5d4953b31832e255a2a87cd6179168fb9621c7` on `codex/intelligent-navigation-premium-20261110`; draft PR [#128](https://github.com/dima1203oleg/MarshGO-Site/pull/128) is open.
- No merge or deployment has occurred.
- Scope is limited to the Site map presentation. Server files and API behavior were inspected read-only and were not changed.

## Implemented

- **Passenger geometry — PARTIAL/UNIT-VERIFIED.** The focused live-transit overlay now emits only zone B, the server-sliced boarding-to-alighting segment. A/C are not drawn or annotated. An unzoned line is retained only when the API explicitly says `geometryScope: 'leg_only'`; otherwise the itinerary's own confirmed leg geometry remains the displayed route. The full line and A/C data remain available to the API and other network layers.
- **Approaching vehicles — PARTIAL/UNIT-VERIFIED.** The Site requires the server's `approachingBoarding` signal, a valid coordinate, and a position no older than 90 seconds (allowing at most 30 seconds of clock skew). It selects at most three, following observed stop progress before prediction evidence and preserving server selection ordering. Other fresh vehicles stay muted; stale-position records are omitted.
- **ETA — PARTIAL/UNIT-VERIFIED.** A label shows minutes only for an explicit `OBSERVED`/`PREDICTED` confidence or a valid future `approachEvidence.predictedArrivalAt` paired with a positive ETA. The current Server implementation includes the latter evidence but may omit `etaConfidence`; the Site now reads that documented evidence instead of dropping a valid prediction or inventing one. Without either signal, only “наближається” may be shown for a server-confirmed approach.
- **Brightness hierarchy — PARTIAL.** Server priority is preserved through the adapter. When no explicit priority level is sent, the view uses the server's exact approach, stop-progress, and ETA evidence: L4 at the boarding stop, L3 for a confirmed ETA under three minutes, L2 for another verified approach, L1 for unrelated fresh vehicles, and L0 for stale background. Opacity steps are 0.30 / 0.40 / 0.54 / 0.84 / 1.00. These are design states, not measured physical distance.
- **Visual treatment — PARTIAL.** The ETA capsule now uses canonical `--mg-action` blue and a token-derived shadow rather than hard-coded purple.

## Verification

- `tests/transport-visual-zones.test.ts` and `tests/route-map-annotations.test.ts`: **18 passed, 0 failed, 0 skipped**.
- Focused ESLint over the changed TypeScript/TSX files: **passed**.
- `tsc --noEmit`: **passed**.
- `git diff --check`: **passed**.
- The backend freshness contract was read-only checked: live mobility positions expire after 90 seconds with 30 seconds of future clock-skew allowance.
- No live vehicle/ETA scenario was replayed, and no visual screenshot, video, touch-device, browser, or iPhone acceptance was captured.

## Remaining criteria

| Area | Status | Evidence / blocker |
|---|---|---|
| A/C hidden on focused ride, B kept exact | PARTIAL | Unit tests cover B-only slicing and full-route preservation; rendered map is not visually checked. |
| Maximum three current approaches | PARTIAL | Unit tests cover evidence ordering, cap, stale data, bad coordinates, and direction flag; no live feed replay. |
| ETA confidence and no fabricated countdown | PARTIAL | Unit tests cover predicted evidence and unknown confidence; no current live API capture. |
| Brightness after passing boarding | PARTIAL | The server's approach signal controls selected emphasis; there is no client-observed, time-based fade animation acceptance. A stale or passed vehicle is not promoted. |
| `USER_ONBOARD` / confirmed boarding | BLOCKED | The current API supplies vehicle progress and approach evidence, but no user-confirmed boarding state or verified link between this user's boarding action and a vehicle. The Site does not infer this from proximity or speed. Requires an explicit user-confirmation interaction/API contract. |
| Whole-route reveal, 3D stage focus, camera transitions, compact sheet | NOT_TESTED | Existing route/map components remain in place; no browser/device acceptance was run for this candidate. |
| iOS Safari / PWA touch, FPS, memory, reduced motion | NOT_TESTED | No physical-device or browser interaction recording is available. |
| Production deployment | NOT_RELEASED | No production action was performed. |

## Resource and environment note

At the last checkpoint `/` had 23 GiB available, memory-pressure reported 38% free, encrypted swap used 9.14 GiB, and the existing Qoder/Vite process on `:7777` plus a Virtualization process were active. That `:7777` instance serves a separate Qoder worktree and was not restarted, modified, or used to claim this candidate's visual behavior. Full build/browser acceptance was deferred to avoid competing with active work.

## Changed paths

- `src/map/transportVisualZones.ts`
- `src/map/MapLibreAdapter.ts`
- `src/services/productionApi.ts`
- `src/views/JourneyRouteMapScreen.tsx`
- `src/views/JourneyActiveNavigation.tsx`
- `src/views/routeMapAnnotations.ts`
- `src/index.css`
- `tests/transport-visual-zones.test.ts`
- `tests/route-map-annotations.test.ts`
