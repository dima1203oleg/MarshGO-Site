# MARSHGO HyperFlight visual checkpoint

**Status: PARTIAL** · **Release: NOT_RELEASED** · **Date: 2026-11-10**

## Candidate

- Site branch: `codex/bottom-sheet-density-20261110`
- Active-navigation source SHA: `8b1ca056459dc976a67fbdd9eac50422926b0cb0`
- Current branch head: `209f1aaec595622aa4c3667190aeb3a7c93ce545` (fixture disclosure placement only)
- Draft PR: [#129](https://github.com/dima1203oleg/MarshGO-Site/pull/129)
- Local preview: [HyperFlight navigation demo](http://127.0.0.1:4178/tests/visual/hyperflight-navigation.html)
- The preview runs `JourneyActiveNavigation` with a conspicuous synthetic-data disclosure. Its route, stops, fare and times are invented for visual interaction; GPS is not sent and no authenticated API is called.

## Changes and cause

- A fresh `route={[]}` value was passed to the map on each parent render. Map update logic treated it as a route change and cancelled the stage preview. The screen now passes a stable empty route reference; automated regression coverage guards this.
- Initial fit could run before the map style was ready and leave the first mobile view at a world-scale frame. Initial route focus now waits for a non-loading map status.
- Walking stages showed the persistent walk ribbon and a floating card with the same distance and duration. The duplicate floating card is suppressed for WALK.
- A wide, pitched browser view made repeated white route chevrons merge into a stripe. Their spacing, size and opacity are reduced; the route body and stop markers retain priority.

## Verification evidence

| Check | Result |
|---|---|
| Focused navigation, path, callout and geometry tests | 35 passed, 0 failed, 0 skipped |
| TypeScript | `npm run typecheck` passed |
| Targeted ESLint | passed for all changed source and fixture files |
| Diff whitespace | `git diff --check` passed before commit |
| Browser interaction | advanced the synthetic preview from access walk to bus, transfer walk and tram; inspected map focus and bottom sheet |
| Mobile CSS layout | 320×568 and 390×844 viewport configurations; 390×844 sheet 178 px, CTA 44 px |
| Wide visual check | 1280×720 showed separated route geometry after the chevron change |
| Exact-head hosted CI | PR head `56b71cc6d51f0577202a6833742f77bee0cb3025` passed run `42829380818`: lint, typecheck, 676 tests (0 failed), token checks, build, bundle/single-React checks and Chromium boot smoke. |

The local browser page is left open in Codex. Browser screenshots were visible during review but were not written as files; there is no video artifact. No continuous recording or frame-time profile was taken.

## Acceptance limits

- This proves only the current Site component in a synthetic local browser fixture. It does not prove live Lviv geometry, real segment scheduling, GPS, ETA, vehicle positions, user-onboard state or authenticated Server integration.
- CSS viewport resizing does not prove touch gestures, iOS Safari/WebKit, PWA behavior, device safe area or a physical iPhone.
- Forward stage changes were visually inspected after transitions; the entire in-flight sequence was not captured or timed, so full HyperFlight remains PARTIAL.
- On 320×568, the first disclosure position overlapped stop/callout labels. The fixture badge was shortened and moved to one line under the navigation header; final stage-4 capture showed it clear of the tram info chip and stop labels.
- Current shared zrok points to another worktree. See [MARSHGO_ZROK_VISUAL_ACCEPTANCE.md](MARSHGO_ZROK_VISUAL_ACCEPTANCE.md).

No merge, deployment, API restart, production-data change or modification of port 7777 occurred.
