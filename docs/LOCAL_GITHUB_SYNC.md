# Local ↔ GitHub workflow

GitHub is the canonical source for MARSHGO Site. The current PR #6 is [codex/journey-rendezvous-map](https://github.com/dima1203oleg/MarshGO-Site/pull/6), based on `main`. The pre-existing ref `codex/marshgo-sites-design-preview` was observed at the same commit during the audit, but it is not PR #6's head. Recheck both refs before continuing; do not assume they remain equal.

## Safe change cycle

1. Confirm `git remote -v`, `git status --short`, `git branch -avv`, and the intended GitHub PR. Preserve dirty worktrees.
2. Work on the existing PR head for its current scope. For a new task after that PR is resolved, create one short-lived `codex/<task>` branch from the confirmed base.
3. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run check:bundle` as appropriate.
4. Review `git diff --check` and the complete diff. Commit only the intended files.
5. Fetch the exact origin branch and verify the local commit is a fast-forward before pushing. Never force-push or overwrite another worktree.
6. Confirm the GitHub commit SHA and CI result. Let the PR preview, when available, identify the exact SHA; do not call a local server a hosted preview.
7. After review, use the repository's protected-branch merge process. Do not push directly to `main`.

## API, types, and iOS

Server-owned API schemas and behavior stay in `MarshGO-Server`. Keep Site API adapters/types compatible with the confirmed Server contract and record the paired Server SHA in release metadata when integration CI is configured. The iOS app consumes the web build through Capacitor; when changing shared UI, validate the Site build and then use the iOS repository's pinned Site SHA workflow. A desktop browser pass is not an iPhone native test.

## Restore context in a new Codex session

Start in `MarshGO-Site`, read this guide and `docs/DESIGN_STUDIO.md`, then inspect Git status, remotes, branches, worktrees, and current PR before editing. Do not depend on another chat's history. If a second session's working tree is unavailable, ask its owner to preserve it and provide `git status --short`, `git diff`, `git diff --cached`, untracked-file inventory, current branch, and `git log --oneline --decorate -20`; do not claim those changes were reviewed until received.
