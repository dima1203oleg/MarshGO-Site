# Frontend release workflow

## Site development release

1. Work in `dima1203oleg/MarshGO-Site`, after checking the exact branch and worktree state.
2. Develop on the existing PR head while PR #6 remains the active design/navigation integration. For new work after it is resolved, use one short-lived feature/fix branch.
3. Run dependency, lint, type, unit, build, and bundle checks relevant to the change. For design work, inspect the real app in `/?studio=1` at phone, tablet, and desktop viewport settings and check both themes.
4. Push normally to the feature branch. Confirm the exact commit SHA, CI, and preview status. If no hosted preview exists, report the local preview URL and do not imply it is GitHub-hosted.
5. Merge only through the approved PR review and protected `main` checks.
6. For Site+iOS, record the exact Site SHA used by the iOS build. Never build iOS from a floating branch or an untracked local copy.

## Central integration

The central `MarshGO` repository should consume the five product repositories by immutable commit SHA and own manifests, integration CI, and deployment configuration. Until that pipeline is verified, Site CI does not constitute an umbrella release. A Site build does not prove API compatibility, migrations, Admin RBAC, Partner tenant isolation, iOS simulator behavior, staging acceptance, or production readiness.

## Current evidence boundary

At audit time, PR #6 was open and not merged. The local Site build passed; the Site's API health check did not, because the isolated preview target had no Server listening. This workflow therefore describes a local design preview and PR process, not a verified unified release or production deployment.
