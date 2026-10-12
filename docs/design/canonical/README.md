# MARSHGO canonical mobile design

These two owner-approved boards are the visual source of truth for the MARSHGO mobile experience:

- [Light theme](./marshgo-light-canonical.jpg)
- [Dark theme](./marshgo-dark-canonical.jpg)

The files are the original supplied references. Their SHA-256 digests are checked by `tests/canonical-design.test.ts`; update a reference only when the owner approves a replacement.

| Reference | SHA-256 | Canonical screen order |
|---|---|---|
| Light | `3e9a728f6aaf9bf59a26f6698ffa78989aee778ec80d710f0e9cde52820eeedf` | Home without trip → Home with MarshPass → route search → results → map → route details → private-ride details → MarshPass → MarshPass details |
| Dark | `827223e04296385e55955d3689dc518ed38705c5aadde2d6cb94ea5fa600979f` | Same nine screens and same order as Light |

Both boards describe the same nine-screen product flow. The light board defines the white, blue, and green visual language; the dark board is its graphite and midnight-blue adaptation.

The route-map and route-details interaction is refined by the dedicated [canonical route-map / bottom-sheet references](./route-map-bottom-sheet/README.md), with approved [light-theme screenshots](./route-map-bottom-sheet/light/README.md). The route map and details share one screen; the map remains behind the draggable bottom sheet in both themes.

## Invariants

- Keep the same screen order and information architecture in both themes.
- Keep Home's four quick actions in a two-column square-tile grid and retain the five-item bottom navigation with its centered create action.
- Keep route search, ranked results, private-ride details, MarshPass, and MarshPass details as distinct user flows. The route map and step-by-step journey details are one synchronized screen with a draggable bottom sheet.
- Use the same transport color for a segment in route cards, timelines, and map overlays.
- Show MarshPass only for a confirmed MARSHGO private-ride booking. Public-transport tickets and saved multimodal journeys do not qualify.
- Preserve the supplied blue brand accents, compact cards, rounded controls, visible route segments, and Ukrainian labels. Dark mode uses layered matte graphite and navy surfaces with electric-blue emphasis.
- Improve readability, touch target sizes, and responsive behavior without changing the approved hierarchy or navigation.
- Keep the four Home actions square at the canonical phone size; on short displays allow the Home content itself to scroll so every action remains reachable.
- Treat the mountain-road cover as the preferred Home banner image. Crop responsively while keeping the mountains and road scene visible behind readable copy.
- Use the light board as the primary geometry reference. Apply the dark board's graphite/navy palette to those same surfaces and components.

These reference boards are retained in the repository so future UI work and visual reviews can compare against the approved design.
