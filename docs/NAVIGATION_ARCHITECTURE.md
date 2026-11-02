# MARSHGO Navigation 3.0 — архітектура

## Поточний потік

`ProductionMarketplace` володіє application tabs. Після першого входу в навігацію він утримує один `ProductionNavigation` змонтованим, але приховує його представлення на інших вкладках. Компонент володіє одним `NavigationStore`, browser `WebGeolocationProvider`, `OffRouteGuard`, offline store та одним `MarshGoMap`.

`MarshGoMap` створює один MapLibre canvas. `MapLibreAdapter` малює route, waypoint, vehicle і дані транспортних шарів; `TransportLayerController` завантажує лише вибрані layers для viewport та перевстановлює власні джерела після зміни style.

Нормалізатор навігаційної сесії переносить server maneuvers до того самого `RouteResult`, який отримує `NavigationStore`; геометрія, маневри й `route_version` залишаються узгодженими.

Backend session, reroute та place search проходять через `/api/v1` у `productionApi`. Server залишається власником сесії й версії маршруту; клієнт не підтверджує booking.

## Канонічний стан карти

- Basemap: `simple | satellite`.
- Camera perspective: `2d | 3d`.
- Camera follow/maneuver state: `CameraMode` в MapLibre adapter.
- Transport overlays: окремий набір `TransportLayerId`.
- Navigation lifecycle, connectivity та route version: `NavigationCore`.

Постійний другий renderer для мініатюри не створюється. Її preview читає один raster tile лише за наявності шаблону URL та attribution; інакше показує placeholder без географії. Готовність кожної basemap перевіряється окремо. Під час зміни стилю custom sources/layers перевстановлюються, а стан камери відновлюється.

## Невирішені архітектурні межі

- GPS/store життєвий цикл поки належить React-компоненту, а не окремому application-level coordinator.
- `BasicRouteMapMatchingProvider` не має road graph або confidence для багаторівневих розв’язок.
- Camera logic зосереджена у MapLibre adapter; окремий SmartNavigationCamera ще не завершений.
- Replanning контролюється клієнтом через авторитетний API; Rescue/Replan для transit disruptions ще відсутній.
- iOS wrapper повторно використовує веб-логіку; Android target відсутній.

## Правило синхронізації

`MarshGO-Site` — джерело frontend UI, `MarshGO-Server` — backend, `MarshGO-iOS` — shell, `MarshGO` — umbrella acceptance. Не вводити окрему бізнес-логіку навігації в iOS/Android оболонках.
