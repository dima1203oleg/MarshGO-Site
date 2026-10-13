# MARSHGO Navigation 3.0 — тест-звіт

Дата: 2026-10-14. Локальні перевірки виконані на робочій копії після Site `f85e61c`; focus-mode зміни очікують окремого коміту й hosted CI.

| Перевірка | Результат |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 80 тестів, 0 падінь |
| `npm run build` | PASS — Vite production build |
| `npm run check:bundle` | PASS — 17 JavaScript chunks, кожен ≤ 350 KB gzip; найбільший MapLibre chunk 274.5 KB gzip |
| `git diff --check` | PASS |
| Site GitHub CI | PASS — два `verify` checks на code SHA `f85e61cb500ce628ee2f93cf8ba56e8fe2e9a49d`; focus-mode SHA ще очікує hosted CI |
| `MarshGO-Server` `npm run typecheck` | PASS |
| `MarshGO-Server` `npm run lint` | PASS |
| `MarshGO-Server` `npm test` | PASS — 195 тестів, 194 пройшли, 1 opt-in integration test пропущено |
| Root GitHub CI | PASS для базового umbrella SHA `e5734701c930c50075c0c838a893df29d1c995e4`, до поточних P1 змін |
| Фізичний iPhone GPS/background | НЕ ВИКОНУВАВСЯ |
| Android | НЕМАЄ target у перевірених репозиторіях |
| FPS/довга продуктивність | НЕ ВИМІРЮВАЛИСЯ |

Поточні Site тести перевіряють дві базові карти й окремість 3D у map model, незалежну оцінку готовності кожної підкладки, усі 12 транспортних категорій, розділення автобусів і маршруток, міський пресет без приватної мікромобільності, GPS validation, route projection, reroute guards, offline state, route presentation, destination-only share links і три стани navigation sheet. Фокус-режим має окремі unit-перевірки: він приховує map overlays без зміни збережених виборів. Серверний тест перевіряє, що відсутні map feeds лишаються недоступними. Повна Playwright matrix для цього P1 SHA ще не запускалася: umbrella runner очищує й повторно створює тестову БД, тому цей destructive setup не запускали без окремої згоди. Візуальну перевірку активної навігації через authenticated preview також не виконано; на локальному preview відображається екран входу.
