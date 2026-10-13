# MARSHGO Navigation 3.0 — тест-звіт

Дата: 2026-10-14. Перевірки виконані локально у `MarshGO-Site` на робочих P1 змінах.

| Перевірка | Результат |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 74 тести, 0 падінь |
| `npm run build` | PASS — Vite production build |
| `npm run check:bundle` | PASS — 17 JavaScript chunks, кожен ≤ 350 KB gzip; найбільший MapLibre chunk 274.5 KB gzip |
| `git diff --check` | PASS |
| `MarshGO-Server` `npm run typecheck` | PASS |
| `MarshGO-Server` `npm run lint` | PASS |
| `MarshGO-Server` `npm test` | PASS — 195 тестів, 194 пройшли, 1 opt-in integration test пропущено |
| Root GitHub CI | PASS для базового umbrella SHA `e5734701c930c50075c0c838a893df29d1c995e4`, до поточних P1 змін |
| Фізичний iPhone GPS/background | НЕ ВИКОНУВАВСЯ |
| Android | НЕМАЄ target у перевірених репозиторіях |
| FPS/довга продуктивність | НЕ ВИМІРЮВАЛИСЯ |

Поточні Site тести перевіряють дві базові карти й окремість 3D у map model, незалежну оцінку готовності кожної підкладки, усі 12 транспортних категорій, розділення автобусів і маршруток, міський пресет без приватної мікромобільності, а також GPS validation, route projection, reroute guards, offline state і route presentation. Серверний тест перевіряє, що відсутні map feeds лишаються недоступними. Повна Playwright matrix для цього P1 SHA ще має бути запущена через umbrella acceptance після синхронізації source; вона потребує ізольованої E2E бази даних.
