# Map Layers Reference Implementation — 2026-10-24

## Scope

Updated the production `MapLayersControl` sheet to follow the supplied paired, two-column mobile reference while retaining existing layer controls and truthful provider availability.

## Changes

- Transport controls use the approved paired order and cover the twelve canonical transport categories.
- The sheet groups controls under collapsible Transport, Display, and Infrastructure headings.
- Transport rows use the canonical mode pictograms and colors.
- Unavailable or not-yet-supported layers state that status on a separate line and remain disabled; the existing return-location row is retained.
- The quick map presets remain available.

## Verification

- Site unit tests: 103 passed, 0 failed.
- TypeScript typecheck: passed.
- ESLint: passed.
- Vite production build: passed.
- `git diff --check`: passed.
- Browser interaction audit on the exact base Site candidate exercised 200 controls over 15 routes, with no JavaScript exceptions or unexpected 5xx responses. The audit predates this sheet-only change.
- Visual inspection of the updated sheet found no overlapping labels or switches. The existing screenshot golden differs by about 5% because it captures the previous layer layout; it was not refreshed automatically. That golden uses a synthetic map and is not equivalent to acceptance against all ten supplied references.

## Limits

These are local Site checks on a build artifact. They do not prove staging, provider-live, production, or physical-device acceptance, and they do not establish overall product release readiness.
