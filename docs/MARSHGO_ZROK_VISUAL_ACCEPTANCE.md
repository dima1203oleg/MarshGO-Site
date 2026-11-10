# MARSHGO zrok visual acceptance record

**Candidate source/fixture snapshot:** `87684e96d4323dcb8243761037dbcba606c16b79` · **Status: BLOCKED** · **Production: NOT_RELEASED**

## Candidate browser used instead

- Local visual candidate: [http://127.0.0.1:4178/tests/visual/hyperflight-navigation.html](http://127.0.0.1:4178/tests/visual/hyperflight-navigation.html)
- Worktree: `/Users/dima1203/.codex/worktrees/marshgo-bottom-sheet-density-20261110`
- Branch: `codex/bottom-sheet-density-20261110`; current source and preview-fixture SHA `87684e96d4323dcb8243761037dbcba606c16b79` (includes prior navigation work).
- Preview process: PID `30897`; local Vite preview at port `4178`.
- Fixture mode: synthetic five-stage route, visibly disclosed; no GPS transmission and no API/auth request.
- The current preview visibly includes the five-item bottom navigation and active-navigation sheet. The CTA sits above the navigation. The basemap was black with a missing `wood-pattern` image warning, so this does not verify map styling or route geometry.
- Local checks on this candidate: 677 tests passed, typecheck, targeted ESLint and production build passed. PR head `4c51990022742e471ee507e046948913f7ed49e5` passed exact-head CI run `42835947180`, including Chromium boot smoke.

## Shared zrok inspected

- URL: [https://marshgo-dima.shares.zrok.io](https://marshgo-dima.shares.zrok.io)
- Target: local `127.0.0.1:7777`, PID `59193`.
- Owning worktree: `/Users/dima1203/.qoder/worktrees/app/330dd3/MarshGO-Site`.
- Branch/SHA: `qoder/site-mobile-touch-gestures-20261110` / `d8e813d08446c851604a9f229172fa9979dc4cdd`.
- Result: zrok serves a different worktree and SHA, so it cannot accept this candidate. Neither that process nor the shared tunnel was restarted, redirected or modified; no new public tunnel was created.

## Security and runtime notes

- The inspected zrok address is HTTPS, but this record does not certify its authentication policy or debug-endpoint exposure.
- The candidate's fixture does not use authentication because it makes no service request. It is not a substitute for protected live-route acceptance.
- No credentials, public debug access, new endpoint or production data were exposed by this work.
- The latest CUA console query returned no entries. Previous fixture runs produced local missing-style-image warnings, a fit-bounds warning and an unscoped observer error during Vite reconnect; console cleanliness is not verified.

## Result

**BLOCKED for zrok candidate acceptance.** Continue visual review only at the local candidate URL above. Do not claim zrok, live-data, authenticated, iPhone Safari or production verification until that specific environment serves the exact candidate and the corresponding checks are completed.
