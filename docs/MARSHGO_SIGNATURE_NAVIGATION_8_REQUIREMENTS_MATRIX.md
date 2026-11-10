# MARSHGO Signature Navigation 8 — requirements checkpoint

Date: 2026-11-10 (Europe/Kyiv)
Candidate branch: `codex/bottom-sheet-density-20261110`
Candidate base at start of this checkpoint: `4d6eacedd0c19ed4a4c0e8e0cf33fbc0cc4366fa`
Release status: `NOT_RELEASED`

This checkpoint implements and visually reviews the short map callout for a selected route leg, stop, or transfer. It does not claim completion of the full Signature Navigation 8 product specification. Previously delivered route-camera work remains recorded in `docs/MARSHGO_HYPERFLIGHT_9_ACCEPTANCE.md` and is not re-accepted here.

| Requirement in this checkpoint | Status | Evidence / boundary |
|---|---|---|
| Show a compact label at the selected route’s map coordinate | VERIFIED | Local Codex browser preview showed “Автобус A53 · 33 хв · 7,4 км” on the selected geometry. The label uses a vertex from the supplied route geometry or the supplied endpoint coordinate; it does not interpolate a coordinate. |
| Explain boarding, alighting, walking, stop, and transfer selections | VERIFIED | Callout builders use the selected itinerary fields and require finite map coordinates. Boarding/alighting classification is based on endpoint name and coordinate match. |
| Keep the label temporary and replaceable | VERIFIED | Lifecycle is `ENTERING → VISIBLE → DISSOLVING → HIDDEN`; 350 ms entrance, 4 s readable hold, 750 ms dissolve. A new selection cancels the previous lifecycle. |
| Let the rider dismiss the callout | VERIFIED | The visual marker is a button and click dismissal does not change the selected route stage. A screen-reader close action is also exposed in the live region. |
| Support reduced motion | VERIFIED | Reduced motion skips animated phases while preserving the readable hold; covered by lifecycle tests. |
| Announce replacements and expose keyboard dismissal | VERIFIED | Selecting Bus then Walk replaced the live-region message; keyboard focus visibly exposed the close action, and Enter dismissed it without changing the selected bus stage. |
| Preserve the existing compact sheet and map controls | VERIFIED in local preview | The map, control rail, selected segment, 44-minute / 30 ₴ summary, and compact bottom sheet rendered together at the tested phone-sized viewport. |
| Validate the public :7777 / zrok runtime | NOT_TESTED | The user-owned :7777 and zrok process were deliberately left untouched. This local preview is served by the isolated candidate worktree. |
| Validate authenticated live route data and provider-backed geometry | NOT_TESTED | The visual route is a labeled synthetic fixture, not a live journey or transport-provider response. |
| Validate physical iPhone Safari, other viewport sizes, and performance | NOT_TESTED | The browser viewport is phone-sized, but it is not a physical iPhone/Safari test. No FPS, long-task, or memory profile was captured. |
| Complete every page and every item in Signature Navigation 8 | PARTIAL | This checkpoint is limited to the selected-map-information interaction. Do not infer completion of the full design, navigation, device, or release scope. |
