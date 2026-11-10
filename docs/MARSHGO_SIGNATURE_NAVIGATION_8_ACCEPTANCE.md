# MARSHGO Signature Navigation 8 — acceptance record

Date: 2026-11-10 (Europe/Kyiv)
Candidate: `codex/bottom-sheet-density-20261110`
Base SHA before this checkpoint: `4d6eacedd0c19ed4a4c0e8e0cf33fbc0cc4366fa`
Release status: `NOT_RELEASED`

## Delivered

- Added a disposable, geographically anchored map callout for a selected leg, stop, or transfer. A route callout anchors to a vertex supplied by the itinerary geometry, falling back to the supplied origin coordinate; stop and transfer callouts require their supplied coordinates.
- The callout displays only confirmed information already present in the itinerary: its label, duration, and distance. It is omitted when required coordinates are invalid.
- Added an explicit lifecycle: short entrance, four-second readable display, and dissolve. Replacing the focused item cancels the old timer; tapping the callout dismisses it without changing journey state.
- Added reduced-motion behavior, a polite assistive-technology announcement, and an accessible close action.
- When a new stage replaces the current callout, stale timer callbacks cannot clear the new announcement. The close action becomes visible on keyboard focus and closes only the callout.
- Preserved the route line, map controls, selected route, and compact route sheet.

## Changed files

- `src/map/MapAdapter.ts`
- `src/map/MapLibreAdapter.ts`
- `src/map/floatingInfoLifecycle.ts`
- `src/map/floatingMapInfo.ts`
- `src/map/useFloatingMapInfo.tsx`
- `src/views/JourneyRouteMapScreen.tsx`
- `src/views/JourneyActiveNavigation.tsx`
- `src/index.css`
- `tests/floating-info-lifecycle.test.ts`
- `tests/floating-map-info.test.ts`
- `tests/visual/signature-navigation.html`
- `tests/visual/signature-navigation-fixture.tsx`
- `bottom-sheet-visual.html`

## Verification

| Gate | Status | Evidence |
|---|---|---|
| TypeScript | VERIFIED | `npm run typecheck` passed after adding the accessible status and close action. |
| Full Site test suite | VERIFIED | `npm test`: 667 passed, 0 failed, 0 skipped. |
| ESLint | VERIFIED | `npm run lint` passed after the final source changes. |
| Local change whitespace check | VERIFIED | `git diff --cached --check` passed for the task-owned staged files. |
| Candidate visual review | VERIFIED | The Codex in-app browser opened `http://127.0.0.1:4178/bottom-sheet-visual.html`; bus and walking callouts appeared over their selected fixture geometry with the compact sheet visible. |
| Accessible replacement and keyboard dismissal | VERIFIED | Selecting Bus then Walk updated the live-region text to `Пішки, 4 хв · 330 м`. Tab focused a visible close button; Enter removed the callout while the bus route stage remained selected. |
| Pointer dismissal | VERIFIED by focused test / prior visual check | The lifecycle test covers tap dismissal; a prior visual interaction confirmed that dismissing the callout kept the bus stage selected. |
| Candidate build and exact-head CI | PENDING | The GitHub check is tracked on draft PR #129; a documentation-only follow-up will trigger a fresh exact-head run. No local production build was run while the visual preview was active. |
| Authenticated live route / public zrok | NOT_TESTED | The fixture is synthetic. The existing user-owned :7777 and zrok session were not changed. |
| Physical iPhone Safari and real touch hardware | NOT_TESTED | A phone-sized visual preview does not constitute a physical-device gesture test. |
| FPS, long tasks, memory, and video evidence | NOT_TESTED | No performance profile or recording was captured. |

The local preview is useful for seeing layout and interaction, but its route, fare, and timing are demo data. It is not a live transport result. The app remains `PARTIAL` for Signature Navigation 8 and `NOT_RELEASED` overall.

## Browser preview

The candidate preview is served from the isolated worktree at:

`http://127.0.0.1:4178/bottom-sheet-visual.html`

The local preview process is kept running for visual review. It is separate from the owner-managed `:7777` application and shared zrok tunnel.

## Git record

- Implementation commit: `a941c5d862cd9df78cc03ed798de64014cf30f2b`.
- Keyboard-accessibility follow-up: `fe7dc1883e824082bf88f7a8585da81c10497eb2`.
- Draft pull request: [#129 — Compact shared journey bottom sheets](https://github.com/dima1203oleg/MarshGO-Site/pull/129).
- Exact-head GitHub run `42816287670` was `in_progress` for `fe7dc188…` when this report-only follow-up was prepared. The report-only commit must pass its own exact-head check. No merge or deployment is part of this work.
