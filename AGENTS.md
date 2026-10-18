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

## Handoff across Codex windows and tasks

Codex chats, cloud tasks, local worktrees and feature branches are **not** shared conversation memory. Before assuming work from another window is present, verify the checked-out repository, working tree, current branch and HEAD SHA, upstream/ref, and relevant open PRs. Fetch remote refs when access allows, without overwriting dirty files or automatically merging. An open PR or a successful build does **not** mean its changes are on `main` or deployed. If expected functionality exists only in another branch, name that branch/PR and exact commit; do not silently recreate it or replace a newer implementation with an older one.

For a task spanning Server, Site or iOS, identify the exact source commit of each dependent repository and reconcile it with the canonical release manifest before integrating or building; do not use a floating `main` branch as proof of which version is deployed. Verify actual deployment access and deployed SHA before making production claims. Never modify production, force-push, merge open PRs, or discard another task's work without explicit authorization.

At the end of each task, leave a concise handoff in the PR description when applicable and always in the final report: repository, branch, HEAD commit, PR URL/status, changed files, checks run and skipped, dependent branch/commit SHAs, unresolved blockers, and next action. The next Codex chat must verify these facts from Git rather than assuming it sees the preceding conversation.

Keep verification proportional to risk: run focused checks during development, reserve full suites, complete native/iOS builds and release packaging for meaningful checkpoints, PR gates or changes requiring them. Do not skip required CI or release checks; report omitted validation explicitly. Avoid repeatedly feeding large successful build logs into the model.
