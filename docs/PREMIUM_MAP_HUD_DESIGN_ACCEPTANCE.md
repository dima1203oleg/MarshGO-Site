# MARSHGO Premium Map & HUD — acceptance

Status: **PARTIAL** · Release: **NOT_RELEASED**

## Candidate

- Site base/`HEAD`: `895f51e0e1f728c5b3ba0458b2d98e74ad5fb62f` (`origin/main`)
- Branch: `codex/intelligent-navigation-premium-20261110`
- All candidate changes are currently uncommitted in the isolated worktree.

## Changes made

- Focused transit overlay now displays only the confirmed passenger segment B; it no longer draws full A/C route continuations or places terminus callouts beyond the rider's alighting point.
- Fresh, server-confirmed arrivals are capped at three and ranked from the server's trip/stop evidence. Other fresh vehicles are muted; stale positions are excluded.
- ETA minutes require valid confidence or a future predicted arrival supplied by the server.
- Vehicle priority values are preserved through the map adapter and map layers use clearer stepped opacity.
- The ETA badge now follows the canonical blue action token.

## Review by area

| Area | Status | Result |
|---|---|---|
| Passenger-focused transit geometry | PARTIAL | Unit-verified B-only overlay; no rendered map screenshot. |
| Vehicle emphasis and ETA | PARTIAL | Unit-verified selection and evidence rules; live provider behavior not replayed. |
| Camera solver and route reveal | NOT_TESTED | No code change or visual acceptance on this candidate. |
| 3D stage navigation | NOT_TESTED | No device/browser run. |
| Bottom sheet density and gesture coordination | NOT_TESTED | Existing four-detent UI was not visually measured or reworked. |
| Theme contrast | PARTIAL | ETA badge uses design token; full light/dark visual review not captured. |
| iOS/Android touch, FPS, memory | NOT_TESTED | No touch recording or performance trace. |

## Checks

- Focused unit tests: **18 passed, 0 failed, 0 skipped**.
- Focused ESLint: **passed**.
- TypeScript: **passed** (`tsc --noEmit`).
- `git diff --check`: **passed**.
- No full production build, browser run, screenshot, video, physical-device test, commit, push, merge, or deployment.

The canonical Site checkout and existing `:7777` service were left untouched. `:7777` points to another Qoder worktree, so it cannot be used as visual evidence for this candidate. Production remains `NOT_RELEASED` until the visual/device and live API gates are completed.
