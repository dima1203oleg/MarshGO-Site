# MARSHGO HyperFlight 9 — acceptance record

Date: 2026-11-10 (Europe/Kyiv)

Candidate: `codex/bottom-sheet-density-20261110`

Base SHA: `bebecdba1e7319d7f2fec7d2816a7bac6d13cbef`

Release status: `NOT_RELEASED`

## Delivered in this candidate

- Added a temporary route-preview Scout that follows the existing confirmed leg geometry. It is separate from the user's GPS puck and live vehicle markers.
- Added forward and reverse previews between adjacent navigation legs. The flight starts from the nearest point on the visible route, samples the source polyline at its actual bends, and only docks when route geometry meets the next leg anchor within the configured tolerance.
- Added a short progressive reveal along the same source geometry, adaptive preview timing, look-ahead camera framing, and reduced-motion handling. In 2D the map remains north-up; 3D may rotate with the route.
- Manual map gestures, sheet movement, route changes, map mode/layer changes, and enabling reduced motion cancel the preview. A user interruption preserves the user's camera frame.
- If geometry is estimated, invalid, disconnected, or otherwise cannot be docked safely, navigation uses the existing focus behavior instead of drawing a connector.
- The navigation preview does not update the user's location, GPS store, vehicle position, or server journey lifecycle.
- The Scout appearance uses the existing MARSHGO motion and color tokens. The bottom sheet keeps its existing height and layout; the adjacent Back control reuses the 44 px control size.

## Evidence

| Gate | Status | Evidence |
|---|---|---|
| Route geometry and timing | VERIFIED | `npx tsx --test tests/journey-navigation-gps.test.ts tests/route-preview-path.test.ts`: 17 passed, 0 failed, 0 skipped. Covers path sampling, turns, reverse travel, anchors, antimeridian, invalid jumps, and reduced motion. |
| Full Site test suite | VERIFIED | `npm test`: 662 passed, 0 failed, 0 skipped. Run before the final CSS-only motion-token adjustment. |
| TypeScript | VERIFIED | `npm run typecheck` passed before the final CSS-only motion-token adjustment. |
| ESLint | VERIFIED | `npm run lint -- --no-warn-ignored` exited 0. npm printed an unknown-option warning; ESLint itself passed. |
| Production build | VERIFIED | `npm run build` passed after the final CSS adjustment; Vite transformed 1,916 modules. |
| Design token check | VERIFIED | `npm run check-tokens`: 153 declared, 124 referenced; all referenced CSS properties defined. |
| Bundle and React runtime checks | VERIFIED | `npm run check:bundle`: 16 JavaScript chunks each at or below 350 KB gzip. `npm run check-single-react`: one React runtime. |
| Browser boot smoke | BLOCKED | The candidate worktree does not resolve the declared `playwright` package (`ERR_MODULE_NOT_FOUND`). It was not installed during this task. |
| Visual review through current zrok | BLOCKED | The open zrok route displayed “Сервіс MARSHGO тимчасово недоступний” and an existing route-details screen; it did not serve this candidate or show active navigation. The shared tunnel and port 7777 were left unchanged. |
| Physical iPhone / iOS Safari | NOT_TESTED | No physical-device touch acceptance was performed. |
| Frame rate, long tasks, memory | NOT_TESTED | No runtime performance profile was collected. |
| Video demonstration | NOT_TESTED | No video was captured because the candidate is not available in the open zrok session. |

## Changed implementation areas

- `src/map/routePreviewPath.ts`
- `src/map/MapAdapter.ts`
- `src/map/MapLibreAdapter.ts`
- `src/map/MarshGoMap.tsx`
- `src/views/JourneyActiveNavigation.tsx`
- `src/index.css`
- passenger GPS validation and route-lifecycle separation in `src/navigation/`, `src/views/`, and focused tests

## Remaining acceptance work

The code-level and build checks pass, but this candidate is **PARTIAL** overall until it is opened in a candidate-served browser session and verified on touch hardware. Do not infer live route behavior, smooth 60 FPS, iOS Safari gesture behavior, or production readiness from the fixture tests and build. Keep production `NOT_RELEASED`.
