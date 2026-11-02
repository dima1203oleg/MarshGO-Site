# MARSHGO Navigation 3.0 — каталог шарів

| Група | Поточні джерела / контракти | Статус |
| --- | --- | --- |
| Базова карта: Схема | Конфігурований style manifest, style URL або tile URL; attribution із конфігурації | Частково: production URL не підтверджено цим аудитом |
| Базова карта: Супутник | `VITE_MAP_SATELLITE_TILE_URL` + обов’язкове `VITE_MAP_SATELLITE_ATTRIBUTION` | Заблоковано без licensed provider configuration |
| Маршрут / waypoint / vehicle | Серверна route geometry та підтверджені GPS fixes | Увімкнено в навігаційному сценарії |
| Громадські маршрути / зупинки | API viewport endpoint; GTFS static та доступність фідів — server-owned | Частково; видимі лише доступні API layers і потрібний zoom |
| Live vehicles | API може повертати свіжі позиції від підключеного фіда | Джерело/свіжість залежать від міського оператора; не вважати всі шари LIVE |
| Велосипеди / самокати / прокат | Mobility registry, GBFS та статичні OSM-об’єкти | Наявність і return rights не випливають зі статичної точки |
| Каршеринг | Підтримується окремим `CARSHARING` layer id | Реальна доступність залежить від provider API |
| Затори / події | `TrafficProvider` interface; `NoTrafficProvider` | Немає реального traffic feed; цей слой не можна показувати як live |
| Паркування / зарядки / доступність | Окремі інфраструктурні API потрібні | Неповна інтеграція; відсутні дані означають відсутність шару |
| Таксі / трансфер / попутки | Результати пошуку/пропозиції, не універсальні live vehicle feeds | Відображати лише підтверджені пропозиції, не як рух транспорту |

Користувацькі транспортні категорії MARSHGO визначені в `src/map/transportLayerConfig.ts` і `src/design-system/transport/transportModeRegistry.ts`. Доступність маршруту, станції, live GPS та інфраструктури — різні факти; toggles не створюють відсутнє джерело.

### Зовнішні джерела з попереднього інтеграційного аудиту

- Zelectra GBFS: live sample включав 732–733 координати в Україні; публічний sample не містив station feed. Це не підтверджує дозвіл повернення або booking.
- OSM/Geofabrik: 317 велосипедних rental-подібних точок у попередньому snapshot; 236 із невідомим оператором. Для всіх точок у тому аудиті не було live availability і підтвердженого one-way return.
- Kiwitaxi: legacy `countries` endpoint без авторизації повернув 404; потрібні актуальні partner credentials.
- Intui.travel: credentials і API Wide договірна документація відсутні.

Детальні результати попереднього інтеграційного аудиту містяться в `MarshGO/docs/INTEGRATION_AUDIT_2026-10-13.md` та `MarshGO-Server/docs/data/osm-bike-rentals-2026-10-12/BIKE_RENTAL_UKRAINE_AUDIT.md` у відповідних репозиторіях.
