# Canonical MARSHGO route map and bottom sheet

These five owner-provided dark-theme references define the route-map, route-details, and bottom-sheet experience. The JPEGs are retained byte-for-byte and SHA-256 locked in `tests/canonical-design.test.ts`. The owner has also approved the corresponding [light-theme references](./light/README.md).

| Image | Canonical state | SHA-256 |
|---|---|---|
| [01 · Expanded route details](./01-expanded-route-details.jpg) | Public-transport stop lists expanded; full journey visible | `9d59fa0820870320af9ac2bdb604c6b2ca0dd16ad75c328736f52d38d5928fe7` |
| [02 · Half sheet](./02-half-sheet.jpg) | Main working state: map above, route cards below | `52896dd5b94f35506b4ac68550345f4c258ffe395236baabf9cc0dce72a02900` |
| [03 · Map overview](./03-map-overview.jpg) | Collapsed summary with the complete route visible | `4a72f1308dc9ca74cbe7bea88b1a6ae903330788f6220215f9991259a0c0c630` |
| [04 · Route and segment map](./04-route-details-map.jpg) | Color-coded segment map and synchronized itinerary | `56654feb65be639e06b38b3962c8a7329ddd4fd535826f07041feebc69daba0b` |
| [05 · Detailed segment cards](./05-route-details-sheet.jpg) | Summary, proportional timeline, expandable stops, and actions | `3ee7cac6b35b273dc65fe3b5fb2acae7f1065ceb116dd70a6f0ba6a2d53b460e` |

## Locked behavior

- One interactive screen: a full-screen map behind a draggable bottom sheet with collapsed, half-open, and expanded snap points.
- The map remains visible in every sheet state. The collapsed state preserves the trip summary and colored time-proportional segment bar.
- The same segment is selected from its map line, timeline interval, or card. Selection brightens and thickens its map line, dims other lines, centers and zooms to the selected segment, and brings its card into view.
- Scheduled transit cards have explicit expand/collapse controls. When the data source provides stop calls, show every stop in order with its published times. If it does not, disclose that the list is unavailable.
- Each segment shows its own price state. Missing fares remain unknown; estimated fares remain marked approximate.
- MARSHGO private rides use a purple accent and booking action. The button opens the existing offer details/booking flow; it does not book immediately.
- Do not add vehicle or driver photos to this route screen, separate map/detail pages, or per-card “На карті” buttons.
- Keep the route colors consistent in the map, timeline, card accents, and markers. Do not draw guessed geometry, stops, live positions, or availability.
- Preserve accessible labels, keyboard-operable sheet snapping, and touch targets.

The screenshots define visual layout and color treatment. Their illustrative route values are not production data; render only values and geometry returned by real MARSHGO/provider data.
