# MARSHGO Site agent guide

## Ownership

- This repository is the canonical source for the customer Web/PWA interface and its design system. The production entry is `src/main.tsx` → `src/views/ProductionMarketplace.tsx`.
- The iOS Capacitor shell consumes the Site build. Keep native permissions and lifecycle code in `MarshGO-iOS`; do not fork the web screens there.
- Server/API behavior belongs in `MarshGO-Server`. Admin and Partner remain separate frontends.
- The central `MarshGO` repository owns release orchestration, not a second Site implementation.

## Before editing

Run `git status --short`, `git remote -v`, `git branch -avv`, and `git worktree list`. Preserve local changes. Confirm the task's repository and branch against GitHub before switching or creating a branch. During the open design work, continue on the existing PR #6 head `codex/journey-rendezvous-map`; `codex/marshgo-sites-design-preview` was observed at the same base SHA but is not PR #6's head. Do not create another long-lived design branch or merge to `main` from a work session.

## Commands

This checkout pins Node `24.21.0` in `package.json` and has `package-lock.json`.

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run check:bundle
```

Run the checks relevant to the change. Browser-only checks and iOS Simulator checks do not prove physical-device GPS/background behavior.

## Design preview

- `npm run dev -- --host 127.0.0.1 --port 3011 --strictPort` starts the real application. Add `?studio=1` to open the dev-only Design Studio wrapper; it embeds the same app from `/`.
- The Vite proxy defaults to local Server port `3002`. Never point a preview at production. If no local API is running, set `API_PROXY_TARGET=http://127.0.0.1:3012` to keep API calls on an unused loopback port; the Studio will mark live data unavailable.
- For a same-Wi-Fi phone preview, bind to `0.0.0.0` and set `MARSHGO_PREVIEW_HOST` to the exact local interface IP. This is HTTP on the private LAN, not a public HTTPS deployment. Do not use an unauthenticated public tunnel for Admin/Partner or production data.
- Studio viewport and theme controls are local preview tools. No synthetic route, ETA, fare, GPS, or booking data is injected.

## Git and review workflow

Use short-lived `codex/<task>` branches for new work after the active PR is resolved. Keep the current base intact, make a focused commit, push normally, and open/update a PR to `main`. Never force-push, reset, clean, or delete a branch with unreviewed work. Before pushing, fetch the intended remote branch and verify the update is a fast-forward. Link API/type changes to the corresponding Server contract and record the compatible Server SHA in the release workflow; do not copy backend code here.

## Sites and release boundary

ChatGPT Sites has not been linked to this GitHub repository. Read `docs/SITES_INTEGRATION.md` before using it. The existing `marshgo` Site is public; every Sites deployment URL is production. Do not publish it or change its audience without explicit owner approval. A local build, saved Sites version, preview, and production deployment are different states.
