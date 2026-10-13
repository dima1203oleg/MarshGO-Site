# MARSHGO Navigation 3.0 — контракти даних

## Наявні контракти

- Shared navigation coordinates/route result/maneuvers: `shared/navigation/contracts.ts`.
- API session: `ApiNavigationSession` у `src/services/productionApi.ts` — id/state, destination, route, route version, session opt-in, vehicle availability, last location та accuracy/time.
- Клієнтська state machine: `src/navigation/NavigationCore.ts` — lifecycle, connectivity, current route, ETA та matched location.
- GPS fix: `LocationFix` — координати, accuracy, captured time та available motion metadata.
- Посилання навігації: `/navigate?lat=…&lon=…&destination=…`; у URL передається лише кінцева точка. Координати перевіряються за межами WGS84; початок маршруту, історія GPS, ID сесії та дані бронювання не передаються.
- Map route: GeoJSON/coordinate arrays передаються MapLibre adapter; transport data використовує provider/vehicle freshness fields на API межі.

## Контрактні обмеження

- Map match у клієнті є проєкцією на надану route geometry, не повноцінним road graph matching.
- Паралельна дорога, рівень мосту/тунелю та правомірність маневру не мають повного confidence contract.
- Speed limit та lane guidance не виводяться з довільних констант; придатного джерела в навігаційному UI поки немає.
- Traffic і live arrival мають зберігати provenance та freshness; якщо провайдер не підтвердив їх, стан має бути `UNKNOWN/STALE/SCHEDULED`.
- Невідома вартість і непідтверджена доступність лишаються `null/UNKNOWN`, а не нульовою сумою.

Перед розширенням API DTO перевірити сумісність із `/api/v1/navigation` у Server та з версіями release manifest.
