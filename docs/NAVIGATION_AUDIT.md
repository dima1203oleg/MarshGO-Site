# MARSHGO Navigation 3.0 — аудит

Дата: 2026-10-14  
Репозиторій UI: `MarshGO-Site`, базовий коміт `68bae61bfbf3a3721ba11c4a7cc325f9d014a9ab`, гілка `codex/sync-journey-mobility-ui`.  
Стан цього звіту: P0 аудит виконаний; P1 зміни в робочому дереві, ще не відправлені в PR.

## Канонічні власники

| Частина | Репозиторій | Поточний стан |
| --- | --- | --- |
| Web/PWA UI, MapLibre, клієнтські navigation state та GPS | MarshGO-Site | Основне джерело UI; P1 зміни локальні |
| Навігаційні API, PostGIS, маршрутизація, transport adapters | MarshGO-Server | Окремий PR #3, попередній CI успішний |
| Capacitor та Xcode wrapper | MarshGO-iOS | Окремий PR #2; застосунок вбудовує Site bundle |
| Umbrella acceptance / E2E | MarshGO | Окремий PR #1; CI на базовому SHA успішний |
| Android native клієнт | — | У перевірених репозиторіях відсутній |

Реєстр репозиторіїв і порядок синхронізації описано в `docs/RELEASE_SYNC.md` та umbrella `docs/REPOSITORIES.md`.

## Статус відомих модулів

| Модуль / можливість | Статус | Підстава або обмеження |
| --- | --- | --- |
| `src/navigation/NavigationCore.ts` | IMPLEMENTED_AND_TESTED | Є state machine для активної сесії, route version, ETA/offline/arrival; covered unit tests |
| `src/navigation/NavigationStore.ts` | IMPLEMENTED_AND_TESTED | Один зовнішній store в `ProductionNavigation`; transition tests проходять |
| `src/navigation/OffRouteGuard.ts` | IMPLEMENTED_AND_TESTED | Вимагає послідовні відхилення і cooldown; шумові GPS-пакети не спричиняють нескінченний reroute |
| `src/navigation/OfflineNavigationStore.ts` | IMPLEMENTED_AND_TESTED | Локально зберігає маршрут/сесію без сирої історії позицій; тести restore/clear проходять |
| `src/navigation/BasicRouteMapMatchingProvider.ts` | IMPLEMENTED_NEEDS_FIX | Проєкція на геометрію маршруту; це не road-graph matching для паралельних доріг і рівнів розв’язок |
| `src/views/ProductionNavigation.tsx` | PARTIALLY_IMPLEMENTED | Реальні browser GPS fixes, guidance, reroute, ETA, голос; ще бракує дій уздовж маршруту, speed limit data та повного UX |
| `src/map/MapLibreAdapter.ts` | PARTIALLY_IMPLEMENTED | Реальний MapLibre canvas, route/transport overlays, GPS puck і camera follow; static satellite imagery потребує налаштованого джерела |
| Схема / Супутник / 3D | IMPLEMENTED_NEEDS_FIX | P1 відділяє 3D camera perspective від двох базових карт; супутниковий провайдер не підтверджений для production |
| Глобальна нижня панель під час навігації | IMPLEMENTED_NEEDS_FIX | Було приховано раннім return; P1 прибирає return і зберігає панель під картою |
| Сесія при переході між вкладками | IMPLEMENTED_NEEDS_FIX | P1 залишає єдиний `ProductionNavigation` змонтованим після першого входу; фонова поведінка поза відкритою вкладкою браузера не гарантується |
| Транспортні шари | PARTIALLY_IMPLEMENTED | UI має 12 незалежних категорій; шари без підтверджених джерел блокуються. Лінії, номери, зупинки й live-позиції керуються окремо. ETA та інфраструктура без джерел вимкнені |
| Live-рух / затори | BLOCKED_EXTERNAL | Немає підтвердженого універсального live GPS/traffic джерела; `NoTrafficProvider` не видає затори як реальні |
| iOS background GPS/audio | BLOCKED_EXTERNAL | Wrapper Capacitor існує; реальна фоново-нативна навігація не пройшла фізичне тестування |
| Android | BLOCKED_EXTERNAL | Android app/Capacitor target у доступних репозиторіях відсутній |
| `/navigation` у production | BLOCKED_EXTERNAL | Немає налаштованого production host/deploy target у перевірених release manifests |

`IMPLEMENTED_AND_TESTED` означає наявність перевірюваної логіки й автоматичних тестів. Вона не означає тестування на фізичному телефоні або production SLA.

## P1 зміни в цьому наборі

- У моделі карти залишено `simple` (Схема) і `satellite`; `3d` зберігається окремо як перспектива камери. Старе збережене значення `threeD/navigation` мігрує без втрати вибору перспективи.
- В навігації з’являються окремі кнопки шарів, 3D, геолокації та постійна мініатюра, що перемикає базову карту. Мініатюра не створює другого MapLibre canvas; raster tile використовується лише якщо задані ліцензовані джерело й attribution.
- `ProductionNavigation` лишається змонтованим після першого відкриття, щоб перемикання вкладок не скидало GPS listener та local navigation store.
- Нижня навігація лишається видимою, «Головна» позначена активною під час навігації, а поза картою з’являється кнопка повернення до активної сесії.
- Вибір карти прибрано з панелі шарів і профілю; тип карти не змішується з transport overlays.
- Панель шарів показує 12 категорій, відфільтрованих за відповіддю backend, зберігає вибір і має три visibility-only пресети. Недоступні категорії не запитують вигадані об’єкти.

## Точність приймання

Надані 15 зображень використано як візуальні референси. Автоматизоване pixel-overlay порівняння з ескізами ще не виконувалося. Точні GPS-швидкість, speed limit і tile imagery залежать лише від реальних джерел; непідтверджені значення не домальовуються.
