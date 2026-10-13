# MARSHGO Navigation 3.0 — production readiness

Статус на 2026-10-14: **NOT PRODUCTION READY**.

## Працює / автоматично перевірено

- Browser foreground GPS fixes із timestamp/accuracy sanity checks.
- Route geometry, локальне progress matching, turn guidance, ETA за наявними даними, off-route guard та контрольований reroute API.
- Offline збереження маршруту/сесії без показу offline ETA як live.
- MapLibre route renderer, базові UI layers, вибір двох basemaps та незалежна камера-перспектива у поточних P1 змінах.
- Навігаційний actions sheet: route overview, голос, завершення сесії та destination-only share link; дії без відповідного API відключені й позначені.
- Згорнута картка ведення показує наступний маршрутний маневр із доступними ETA/відстанню/тривалістю; це browser UI, а не native lock-screen guidance.
- Поточний локальний Site baseline: 76/76 unit tests, typecheck, lint, build і gzip bundle check проходять.
- Unit/lint/typecheck/build пройшли на локальному Site tree.

## Заблоковано або не підтверджено

- Немає налаштованого production/staging host, backend URL, production secrets, DB/Redis і автоматизованого deploy target у цьому task checkout.
- Satellite imagery вимагає ліцензованого tile URL та attribution.
- Kiwitaxi каталоги/API та Intui credentials/API Wide залишаються зовнішніми блокерами з integration audit.
- Traffic, speed limit, lane guidance та міські live vehicle feeds не можна позначати production-live без провайдерського контракту, freshness і реально перевіреного payload.
- Bike/scooter pickup-dropoff compatibility не підтверджує статичний OSM point сам по собі.
- Background GPS/audio/lock-screen для iOS не пройшли device acceptance; Android app не знайдений.
- Немає вимірів FPS, пам’яті та заряду на цільових телефонах.
- Активний navigation screen не перевірений у signed-in preview на фізичному пристрої; локальний preview у доступній браузерній сесії показує екран входу.

## Релізне правило

Site PR #3 лишається окремим від root PR #1 та iOS PR #2. Відкритий PR або локальний preview не є production deploy. У цьому аудиті жодної збірки не опубліковано і жодного production booking/payment не виконано. Перед деплоєм потрібні точні environment/release inputs із `docs/DEPLOYMENT.md`, staging smoke та окремий review за цим spec.
