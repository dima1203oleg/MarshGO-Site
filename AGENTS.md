# MarshGO-Site

This is the canonical source for the MARSHGO Web/PWA, responsive UI, journey search/results, maps, navigation screens, shared browser UI, and design system. Keep the approved light/dark designs and bottom navigation `Головна / Пошук / + / Поїздки / Профіль`. Do not copy the React app into the central orchestrator or maintain a second copy in iOS.

Before editing, inspect `git status`, current branch, remotes, and the relevant PR. Preserve dirty changes. Use a short-lived `feature/*` or `fix/*` branch and a PR; do not push to `main`, force-push, or merge outside the repository review process.

With Node 24.21.0 and the committed lockfile, run:

```sh
npm ci
npm run lint
npm run typecheck
npm run build
npm run check:bundle
```

Run the repository's unit and browser checks when defined by the checked-out branch and relevant to the change. Map/navigation changes should preserve the global navigation when route guidance is compact and verify mobile sheet states, selected transport legs, and both themes.

The central `MarshGO` repository consumes this repository at an exact full commit SHA for integration builds. `MarshGO-iOS` must build and sync the exact Site SHA in the release manifest; change its pin only in a coordinated, reviewable update. API contracts and authorization remain Server-owned.
