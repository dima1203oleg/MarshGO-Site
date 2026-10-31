# Canonical MARSHGO journey search results

The owner-approved light board and the latest dark reference are canonical for the multimodal journey results screen. The latest dark image below supersedes earlier dark geometry for this screen. All supplied images are preserved byte-for-byte and SHA-256 locked by `tests/canonical-design.test.ts`.

| Reference | Canonical use | SHA-256 |
|---|---|---|
| [Light and dark results board](./01-results-light-dark-board.jpg) | Compact result-card hierarchy, the three strategy controls, theme comparison, and the approved 4×3 transport catalogue | `81ec8c9049a12a29b093faa0b6d0977f3102e16c4a90e9c8e696debf7d5862a5` |
| [Light results detail](./02-results-light-detail.jpg) | Card spacing, large duration and fare, proportional segment ribbon, segment details, and safe separation of save and open actions | `2cd6bf47ad92f9ece3622a29803286148e1d2fbe21f76c6995fe3bffb7286259` |
| [Latest final dark results](./03-results-dark-final.jpg) | Dark-mode canonical geometry: route header with edit action, three strategy controls, compact result cards, ribbon, mode icons, fare/time, transfer count, save, and open actions | `ed3954cce34fa604d6d14570b533b242ebb3b8c089f0a00b7503de408a9b6e00` |

## Locked screen contract

- Show one compact header with Back and the actual origin → destination labels from the current search. Do not repeat search fields, dates, passenger controls, or a second results title.
- Keep exactly three strategy controls in order: Оптимальний, Найшвидший, Найдешевший. Use scales, timer, and coins icons; show the eligible group for each mode, not a single winner. The optimal mode is the default unless the search explicitly requests another available strategy.
- Each compact card presents total journey duration and price, the active strategy icon, transfer count, a separate 44×44 save action, and a clear open-details chevron in one primary row. Departure and arrival times remain visible. Do not add a second strategy badge.
- Draw one continuous ribbon whose interval widths are proportional to actual leg and wait durations. Below it, show every leg, including walking and waiting, with its mode, duration, and sourced fare. Long chains may scroll horizontally within the card; do not silently omit legs.
- Transfer counts come from the server journey model and exclude first/last-mile walking and waiting. Unknown fares stay unknown; approximate fares remain marked. Never take demo prices, currencies, stops, or routes from the images as live data.
- The whole card opens the existing route-map plus draggable details sheet. Saving toggles independently from opening details. The results card must not add a separate per-route map or immediate booking action; private-ride booking remains on the details flow.
- Use exactly the twelve approved MARSHGO transport categories: bus, minibus, trolleybus, tram, metro, private rideshare, taxi, train (including suburban train), bicycle, scooter, car sharing, and transfer. Walking and waiting are itinerary segments, not selectable categories.
- Both themes retain the same structure and segment colours. Light mode uses white/light-gray surfaces and restrained blue controls; dark mode uses graphite/navy surfaces with readable high-contrast text. Icons and names accompany colour everywhere.

The reference boards contain illustrative values and a transport catalogue legend. They define visual hierarchy only; they are not route, fare, service-availability, or city-coverage data. The latest dark board is the pixel reference for dark results; the approved light board remains the light-theme reference.
