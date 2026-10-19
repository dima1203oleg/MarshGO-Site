# MARSHGO Site design system

## Ownership

The customer Site owns the web design system and its React components. The iOS Capacitor container renders the same web UI; native-only integration belongs in `MarshGO-iOS`. Admin and Partner are separate products and may adopt the same visual language without sharing the customer's navigation structure. No separate design-token repository is introduced.

## Current implementation map

- Global CSS variables, theme colors, safe-area rules, and shared layout styles: `src/index.css`.
- Theme persistence and `html.dark` handling: `src/services/theme.ts` (`mg_theme`: `light`, `dark`, `system`).
- Canonical transport names, colors, and icons: `src/design-system/transport/transportModeRegistry.ts`.
- Route map styles and route presentation: `src/views/JourneyRouteMapScreen.tsx`, `src/map/`, and related design-system modules.
- Existing reference images and their provenance: `docs/design/canonical/`.

Use existing token/component definitions first. Do not globally change palette or spacing as an incidental effect of a feature. Keep transport identity distinct by color and icon, maintain readable map overlays, and preserve safe-area and touch-target behavior. Add shared component APIs only when actual call sites share both behavior and visual intent.

## Themes and checks

The Design Studio changes the same `mg_theme` preference used by the app. Test at least light and dark for any shared surface change; system mode follows the device setting. Run lint, typecheck, tests, and production build for shared-component changes. Existing canonical images are references, not an automatic browser visual-regression suite; do not add or approve new baselines without owner review.
