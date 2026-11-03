# SCREEN INVENTORY — MARSHGO Premium Design 3.0, ЕТАП A0

**Базис:** MarshGO-Site `8d927e8` (див. `BASELINE_PIN.md`). Всі `file:line` — з цього SHA.
**Мета документа:** звірити обов'язкову матрицю покриття §14 документу (35 екранів)
з тим, що фактично існує і фактично досяжне в продакшн-збірці.

Позначки статусу:
- **Є** — існує і досяжне в продакшн-оболонці
- **Є, інакше** — реалізовано, але не як окремий екран (шторка/стан/модалка)
- **Частково** — частина вимоги є, частина ні
- **Лише демо** — код існує, але недосяжний у збірці
- **Немає** — в коді відсутнє

---

## 0. Як влаштована навігація (детермінує всю матрицю)

Роутера-бібліотеки немає. URL — рукописний History-API хук:

| Що | Де |
|---|---|
| Точка входу | `src/main.tsx:2,21` — монтує **лише** `<ProductionMarketplace />` |
| Оболонка | `src/views/ProductionMarketplace.tsx` (1883 LOC) |
| Стан «який екран» | `src/routing/useProductionTabRouter.ts:6` — `const [tab, setTab] = useState<ProductionTab>(…)` від `window.location.pathname` |
| Пуш URL | `useProductionTabRouter.ts:26-37` (`history.pushState` на `:33`), `popstate` `:11-24` |
| Зміна таба без URL | `useProductionTabRouter.ts:39-43` `activateTab` (для глибоких посилань і flow запитів) |
| 13 значень таба | `src/routing/productionRoutes.ts:1-3` |
| Таблиця шляхів | `productionRoutes.ts:8-22`; alias `/navigation` на `:27`; сутнісні route `/offers/:id`, `/bookings/:id`, `/trips/:id`, `/demands/:id`, `/journeys/:id`, `/messages/:id` на `:54-60` |
| Глибоке посилання пошуку | `src/routing/searchRouteState.ts` (`buildSearchRoute`/`parseSearchRoute`), споживається на `ProductionMarketplace.tsx:326,630-635` |

**Диспетч екрана** — один ланцюг тернарників, з пріоритетом по ньому:

```
ProductionMarketplace.tsx:1841  activeJourneyNavigation ? <JourneyActiveNavigation/>
                    :1842-1843  selectedRouteMap | selectedJourney ? routeMapScreen(...)
                    :1844       selectedOffer ? «Деталі поїздки»
                    :1844       tab==='map' | 'plan' | 'home'|'search'|'trips'|'chat'|'profile'|'admin'|'demand'|'offer-new'|...
                    :1858       {screen}
```

Оверлеї монтуються **окремо** від цього ланцюга: `:1846` (оверлей навігації),
`:1861` (вибір точки), `:1862-1866` (таб-бар), `:1867-1881` (шторки й модалки).
Ранні повернення до оболонки: `:1449` завантаження, `:1450-1501` авторизація/
онбординг, `:1503` 404.

**Канонічна нижня панель (§6 документу) — чи вона та?** Так за складом:
`ProductionMarketplace.tsx:56-59` `tabItems` = `Головна | Пошук | Поїздки | Профіль`
+ центральной «+» (`:1864`, `h-14 w-14 -mt-5`, `bg-[var(--mg-action)]`,
aria «Створити поїздку або запит»), контейнер `grid grid-cols-5` на `:1862-1865`.
Висота: `.app-tabbar button { min-height: 2.9rem }` (46.4 px, `index.css:583`),
безпечна зона — `padding-bottom: max(.45rem, env(safe-area-inset-bottom))`
(`index.css:578`). Порушення канону одне: панель **скасовується** на
повноекранній карті маршруту — `immersiveRouteView` на `:1850`, guard на `:1862`.
§6 вимагає «Під час навігації глобальна панель не зникає».

---

## 1. Матриця 35 екранів §14

| # | Екран §14 | Статус | Де в коді | Ключові стилі | Взаємодія / CTA | API | Стан даних | Тести | Дефект / ризик |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Головна без поїздок | **Є** | `HomeHero` `src/views/HomeHero.tsx:45`; монт `ProductionMarketplace.tsx:1586-1603` | `index.css:1318-1377` (`--home-*`) | банер → «Знайти маршрут», 4 плитки | `offers`, `journeys/me` | guest — ні (вимога логіну) | `v41-home-and-create-menu.test.ts:5`, `home-fit-and-profile-ink.test.ts:7`, `canonical-design.test.ts:147,197` | §7: поле «Звідки/Куди» на Головній — вимога «не показувати»; плитки відповідають |
| 2 | Головна з MarshPass | **Є, інакше** | `HomeHero.tsx:108-120` ( картка активного пропуску) | `HomeHero.tsx:117` `text-[10px]` ціна | «Відкрити квиток» | `bookings`, `journeys/me` | потребує підтвердженого попутки | `canonical-design.test.ts:197` | D-05/D-02: ціна пропуску на 10 px |
| 3 | Пошук | **Є** | inline `searchScreen` `:1547-1550`, форма `:1515-1534` | `.journey-search-card` `index.css:649`, `.search-submit` `:1269` | «Знайти маршрут» | `POST /journeys` (`:611-658`) | 401 → викидає з повідомленням `:651-655` | `v41-results-nav.test.ts:5`, `search-deeplink-departure.test.ts:3` | D-01, D-09, D-10 (сирий `#0B63D6` у `.search-submit`) |
| 4 | Вибір точки на карті | **Є** | `src/components/MapPointPicker.tsx:12`, lazy `:44`, монт `:1825-1827,1861` | власні інлайн-класи | «Звідки/Куди» довгим натисканням, підтвердження | `placeQuery` | не потребує GPS | `canonical-design.test.ts` — 0 згадок | D-16: другий бутстреп MapLibre, губить статус тілів |
| 5 | Фільтри | **Є** | `src/components/TransportTypesPanel.tsx:27`, монт `:1869` | `TransportTypesPanel.tsx:19` compact `text-[10px]`; `index.css:626` 9 px | мультівиклик 12 категорій | `mobility/availability` | потребує сесії (401 guest) | `canonical-design.test.ts:274` | **D-01 (P0)** назви категорій 9 px |
| 6 | Провайдери | **Частково** | `TransportTypesPanel.tsx:57,59` чіпи провайдерів | `bg-white text-slate-500` без dark-гілки | «Налаштувати провайдерів» `:50` (≈16 px hit) | `mobility/operators` | потребує сесії | 0 | D-07 (залежить від `!important`-шару), D-13 |
| 7 | Результати з картою | **Є, інакше** | `JourneyResultsPanel.tsx:201`, монт `:1621-1628`; карта — **окремий екран** `:1842-1843` | `JourneyResultsPanel.tsx:188` stagger; `:254` 10 px | картка → відкриває `JourneyRouteMapScreen` | `POST /journeys`, `offers` | потребує успішного пошуку | `canonical-design.test.ts:112,163,181,295` | **Конфлікт із §9**: специфікація вимагає ОДИН екран «результати+деталі в одному sheet», факт — дві послідовні поверхні з повторним монтуванням карти. Детально в `FEATURE_PARITY_AND_PR_CONFLICTS.md` |
| 8 | Деталі маршруту в тому самому sheet | **Є, інакше** | `src/views/JourneyRouteMapScreen.tsx:92` (741 LOC) | `.route-map-screen` `index.css:78-114`, `[data-theme=dark]` `:115-150` | drag шторки, стрічка сегментів `:637` | те саме + geometry | потребує вибраного маршруту | `journey-route-map.test.ts`, `journey-route-map-canonical-modes.test.ts`, `canonical-design.test.ts:65,130,296` | **D-03, D-05**; snap-стани `routeSheet.ts:4` = **три** — `collapsed / half / expanded`, а §9 вимагає чотирьох (12/34/64/100 %). Висоти з `routeSheet.ts:15-31`: `collapsed = clamp(viewport*0.30, 248…300)`, `half = clamp(viewport*0.375, 300…430)`, `expanded = min(840, viewport*0.90, viewport−172)`; поріг fling — швидкість 0.45 (`JourneyRouteMapScreen.tsx:437`, `JourneyActiveNavigation.tsx:257`); стартовий стан — `half` (`JourneyRouteMapScreen.tsx:114-115`, SSR-фолбек 316 px) |
| 9 | Детальний список зупинок | **Є** | `JourneyRouteMapScreen.tsx:700` рядки зупинок | `grid min-h-7 … py-1 text-[10px]` | tap рядка → фокус сегмента | `journeys` geometry | порожньо без даних провайдера | `journey-route-map.test.ts` | 28 px рядок; порожній стан «Перевізник не надав список зупинок…» `:706` на 10 px |
| 10 | Карта транспорту | **Є** | `src/views/TransportMapView.tsx:18` (86 LOC), lazy `:46` | `.transport-map-*` | перемикання шарів | `transport/routes`, `/stops`, `/vehicles`, `/micromobility` | потребує сесії + `VITE_MAP_*` | `transport-map-basemap-notice.test.ts:5`, `transport-quality.test.ts:77`, `layer-availability.test.ts:34`, `canonical-design.test.ts:66` | нелаштована базова карта має окремий стан (`transport-map-basemap-notice`) — плюс |
| 11 | Панель шарів | **Є** | `src/components/MapLayersControl.tsx:87` | `:80` count-bubble 10 px, `:90` статус 11 px | тумблери `min-h-11` | `transport/layers` (401 guest) | потребує сесії | `canonical-design.test.ts:69` | розмір ОК, підписи 10 px |
| 12 | Активна навігація | **Є** | `src/views/JourneyActiveNavigation.tsx:41` (481 LOC), монт `:1841` | `:269,298` `data-theme`, `:301` `--route-map-inset` | вихід `:355`, керування картою | `navigation/sessions` | сервер-авторитет, GPS | `journey-active-navigation.test.ts:16` — **лише хелпер**, сам екран 0 | D-15: дублює всю оболонкову логіку `JourneyRouteMapScreen` |
| 13 | Контекстне меню навігації | **Є** | `ProductionNavigation.tsx:655-659` `role="dialog"` | `max-h-[calc(100dvh-5.5rem-…)]`, `bottom: sheetHeight \|\| 240` | дії сесії | `navigation/sessions` | потребує GPS | `canonical-design.test.ts:277` | **D-04**; третя окрема реалізація шторки без `routeSheet.ts` |
| 14 | Попутки | **Є** | inline offer-результати `:1540-1545`, монт `:1621-1628` | `:1541,1543` `text-[10px]` «за місце» | картка → деталі | `offers` | потребує сесії | `v41-results-nav.test.ts` | D-09 (та сама дія в `bg-blue-600` і в токені) |
| 15 | Я водій | **Частково** | `requestsScreen` `:1783-1814`, `myDemandsScreen` `:1781` | — | «Запропонувати ціну» `:1871` | `demands/mine`, `demands` | потребує ролі `driver` + верифікованого авто | 0 | роль-гейт `:1640`; **немає** окремого «водійського кабінету» як у §14 |
| 16 | Я пасажир | **Є, інакше** | `demandFormScreen` `:1754-1766`, `myDemandsScreen` `:1781` | — | «Створити запит» | `demands` | потребує ролі `passenger` | `v41-home-and-create-menu.test.ts` («keeps existing passenger demand action reachable») | — |
| 17 | Публікація поїздки | **Є** | `offerFormScreen` `:1741-1752` | `:1748` label 10/11 px | «Опублікувати поїздку» `:1763` | `POST /journeys` (publish) | гейт: рол+auto+фото (`vehicleUsable :63`, `:1747`) | 0 | D-02-подібні 10 px підписи полів ціни |
| 18 | Заявка пасажира | **Є** | `demandDetailScreen` `:1779`, `proposalCard` `:1768-1777` | — | «Запропонувати», «Прийняти» | `demands/:id` | власник vs водій `:412-419` | 0 | — |
| 19 | Бронювання | **Є** | `bookingToConfirm` `:1881`, `bookingToCancel` `:1880`, `visibleBookingTicket` `:217` | alert-dialog класи | підтвердження/скасування | `POST /bookings` | потребує оферти | `bookingFailureState.ts:26` тестується | D-06: помилка бронювання = синя плашка |
| 20 | MarshPass | **Є, інакше** | картка в `HomeHero.tsx:108-120`; квиток у поїздках `:1652` | `TicketQr.tsx:4` | відкрити квиток | `bookings` | потребує `confirmed` passenger booking | `canonical-design.test.ts:215` (TicketQr) | **немає окремого екрана** MarshPass. Карусель квитків §7 — **уже реалізована**: свайп-жест з порогом 40 px і кнопки «Попередній/Наступний» у `HomeHero.tsx:110-120+` (стан `passIndex`) |
| 21 | Деталі MarshPass | **Є, інакше** | той самий QR-стан `:1652` | `TicketQr.tsx` | — | `bookings` | як вище | `canonical-design.test.ts:215` | §11 вимагає QR-атестації з сервера; факт — клієнтський HMAC-QR, серверного ендпоінту немає |
| 22 | Мої поїздки | **Є** | `tripsScreen` `:1637-1661`; секції `src/views/tripsSections.ts:7-21` | — | секції «Активні/Майбутні/Минулі/Збережені/Запити» | `journeys/me`, `bookings` | потребує сесії | `v41-*` частково | D-05-подібне: часи відправлення `:1641,1642,1648,1651,1657,1667` на 10 px |
| 23 | Профіль | **Є** | `profileScreen` `:1718-1731` | `DriverPhotoCard.tsx:6` | секції, вихід | `me`, `auth/logout` | потребує сесії | `canonical-design.test.ts:198,278` | `bg-white` 97× проти `dark:bg-` 11× у файлі (D-07/D-13) |
| 24 | Чат | **Є** | `chatScreen` `:1663-1670` | — | надіслати `:1668` | `messages`, `/conversation-unread-counts` | потребує **підтвердженого бронювання**: `:1664` «Чат з'явиться після підтвердження бронювання» | 0 | **D-19** кнопка надсилання без `aria-label`; чата немає як пункта таб-бара (вимога §6 — у верхньому контексті — дотримано) |
| 25 | Сповіщення | **Є** | шторка `:1870`, стан `showNotifications :131`, дзвоник `:1511` | `text-[10px]` елементи | «Прочитати всі» | `notifications/read-all` | потребує сесії | 0 | — |
| 26 | Налаштування | **Є** | `ProfileSections.tsx:43`, гілка `:173` «Налаштування застосунку» | — | ThemeToggle `ThemeToggle.tsx` | — | потребує сесії | `canonical-design.test.ts:198` | **D-17** `animate-spin-slow` не існує; **D-08** «Авто» не застосовується на старті |
| 27 | Авторизація | **Є** | `:1450-1501`: інтро `:1457-1472`, онбординг `:1473-1475`, вхід `:1477-1484`, реєстрація `:1485-1494` | `AuthField` `:69-100` | «Почати», «Увійти» | `auth/login`, `auth/register` | — | 0 | `requestOtp/verifyOtp` (`productionApi.ts:548-559`) **не мають UI** — телефонна автентифікація заявлена, але неіснуюча |
| 28 | Permission screens | **Частково** | крок дозволу GPS `:1437-1447` | — | дозвіл локації | — | — | 0 | немає екранів дозволу на camera (QR-сканер), notifications, background — лише GPS |
| 29 | Loading | **Є** | `:1449` раннє повернення; `JourneySearchPending` `JourneyResultsPanel.tsx:170` | `mg-shimmer` `index.css:1210` | — | — | — | `v41-hook-order.test.ts:5` | — |
| 30 | Empty | **Частково** | `JourneyResultsPanel.tsx:279-290` | `:283` перелік недоступних режимів 11 px | — | — | — | 0 | немає компонента стану: решта порожніх — «голі» `<p>` на `:1641,1725,1657`, `ProductionNavigation.tsx:578,627`, `JourneyRouteMapScreen.tsx:706` |
| 31 | Error | **Частково** | `role="alert"` на `:1495` (auth), `:1503` (404), `TransportMapView.tsx:81-82` | синя «status»-плашка `:1505` | — | — | — | 0 | **D-06 (P0)**; **D-25** сирий HTTP-код у тексті для пасажира |
| 32 | Offline | **Є** | `:1853-1856` `data-testid="offline-notice"` | `text-[11px]` | — | `productionApi.ts:481` NETWORK_ERROR_CODE | `navigator.onLine` `:231`, `:580-582` | `v41-results-nav.test.ts` | **D-20** 11 px; три окремі моделі онлайн-стану (`:231`, `NavigationCore.ts:5`, `services/pwa.ts:12`) |
| 33 | Degraded data | **Частково** | `liveStatus` `LIVE/SCHEDULED/PREDICTED/UNAVAILABLE/UNVERIFIED/UNKNOWN`, чіпи `JourneyRouteMapScreen.tsx:572,573` («ЗА РУХОМ» / «ЗА РОЗКЛАДОМ» / «ПРОГНОЗ») | 10 px чіпи | — | `dataQuality`, `fareSource`, `geometrySource` | — | `transport-quality.test.ts:77` | `dataFreshnessSeconds` приходить із сервера і **не читається** (D-23) — «degraded» показується без свіжості |
| 34 | Admin | **Є** | `adminScreen :1733`, `moderationScreen :1735`, `MobilityAdminPanel.tsx:14` lazy `:42`, 403-панель `:1738` | `MobilityAdminPanel.tsx` 12× 10 px | черга документів | `admin/verification` | ролі `admin/moderator` `:1727,290-295` | 0 | 22 sub-12px у панелі |
| 35 | Partner | **Немає в Site** | портал — окремий репозиторій `../MarshGO-Partner/` (контейнер `marshgo-acceptance-partner-1`, :3904) | — | — | — | — | поза цим репо | §14 рахує Partner як екран PWA; зафактом — окремий застосунок |

**Підсумок:** з 35 рядків матриці **16** повноцінно є, **8** існують в іншій формі
(шторка/стан замість екрана), **6** частково, **1** (Partner) поза цим репо, і
жоден із 35 не має **render-тесту**.

---

## 2. Реальні екрани, яких немає в §14

Специфікація не передбачає, але вони в продакшн-збірці й займають місце в IA:

| Екран | Де | Коментар |
|---|---|---|
| «Запланувати поїздку» — вибір ролі | `PlanTripChoice.tsx:4` (21 LOC), монт `:1844`, вхід з плитки `:1589` | водійська гілка гейтиться (`:1606`) і кидає в Профіль |
| Деталі оферта з превʼю маршруту | `selectedOffer` `:213`, `OfferRoutePreview.tsx:6` | не «Попутки» і не «Бронювання», а проміжна поверхня |
| 404 | `:1503` | `notFound` з `useProductionTabRouter.ts:7` |
| Редагування оферта | `TripManagement.tsx:14` `OfferEditSheet`, монт `:1878` | |
| Кабінет транспортних операторів | `MobilityAdminPanel.tsx:14` | §14 не згадує |
| Скасування/пошук альтернатив | `:503-516`, `:1657` | rescue-лист на скасованому бронюванні |
| Вікторина безпеки / скарга | `:1874` `showReportForm` | |
| Верифікація документів (модалка) | `:1875` `verificationTarget` + evidence-reviewer `:1876` (iframe) | |
| Додати авто | `:1873` `showVehicleForm` | |
| Видалити авто / видалити акаунт | `:1877`, `:1879` | |
| «Швидкі дії» центральне меню | `:1816-1821`, `showCreateMenu :154` | 4 дії; §7 вимагає саме ці чотири — збіг |

## 3. Шторки й оверлеї з §2c — де вони втрачають канал

`ProductionMarketplace.tsx` містить **14 входжень `fixed inset-0`**
(вісім модалок `:1867-1881` майже дослівно повторюють `bg-slate-950/40`,
`max-w-md rounded-[1.7rem] bg-white p-5 shadow-xl`, і кожна — своє закриття).
Окрім трьох пан-шторок (`JourneyRouteMapScreen`, `JourneyActiveNavigation`,
`ProductionNavigation`) — разом 5 способів зробити «висувну поверхню».
Це D-15.

## 4. Демо-шар (недосяжний у збірці) — повний перелік

Ворота: `src/App.tsx:34` `if (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true') return <DemoApp />`.
`src/main.tsx` **не імпортує** `App.tsx` взагалі (коментар `:9-10`), тож у
деплоєному білді цього немає. Імʼя «DemoApp» — `App.tsx:38-407`.

| Категорія | Що | Де |
|---|---|---|
| 14 views, лише демо | `HomeView:40`, `SearchView:45`, `OfferDetailView:28`, `DemandNewView:26`, `DemandDetailView:27`, `DriverDashboardView:30`, `DriverRequestsView:23`, `DriverOfferNewView:26`, `DriverVehicleView:27`, `NavigationView:25`, `MyTripsView:26`, `MessagesView:17`, `ProfileView:48`, `AdminView:25` | монт `App.tsx:183-366` через `currentView` `:52` |
| Оболонка | `components/BottomNav.tsx:11` (5 слотів, ярлики `text-[11px]`), `AppHeader`, `ActionDrawer`, `PWAInstallModal`, `OnboardingTour` | `App.tsx:4-8` |
| Компоненти, які більше ніхто не бере | `RatingModal`, `NegotiationModal`, `SafetyTripModal`, `FuelCostCalculatorModal`, `BlacklistModal`, `AddVehicleModal`, `AvatarGeneratorModal`, `RouteSubscriptionModal`, `WeeklyPriceComparisonChart`, `ExpenseStatistics`, `DriverTrustBar`, `UserAvatar`, `OfferCard`, `DemandCard`, `MapPreview`, `InteractiveMapPicker`, `HeroIllustration` | `App.tsx`/demo views |
| Дані-фікстури | `src/data/seedData.ts` (`CURRENT_USER:3`, `INITIAL_OFFERS:140`) → лише `services/storage.ts:21` | не «живі» дані |
| Симулятор | `?demo=` set (`src/demoEntry.ts:1-14`), DEV-only; `demoEntryView.tsx:5`, `RideshareLifecycleSimulator.tsx:53` | `main.tsx:12-19` |
| Сирітки | `RideshareLifecycleExperience.tsx:122` — 0 імпортерів; `src/firebase.ts` — 0 імпортерів; `services/mapTileStatus.ts` — тільки тести | |

**Практичний наслідок для дизайн-роботи:** демо-шар — це джерело копіпасту.
У ньому `#1769F4` 285×, власний таб-бар і власні модалки. Поки він у
репозиторії без позначки, наступний агент візьме звідти «брендовий синій».

## 5. Покриття тестами — структура, а не кількість

| Властивість | Факт |
|---|---|
| Файлів тестів | 69 (`tests/*.test.ts`) |
| Рівнів | 314 тестів, 28 suites, 0 skipped — VERIFIED запуском на базисі |
| Рендер-тестів | **0**. У `package.json` немає `jsdom`, `@testing-library`, `vitest`, `happy-dom` |
| Source-scan тестів | 10 файлів читають `.tsx` через `readFileSync` і assert'ять на рядках (`tests/canonical-design.test.ts:3,78`) |
| Екрани з хоча б рядковим assert | `ProductionMarketplace`, `HomeHero`, `JourneyRouteMapScreen`, `JourneyResultsPanel`, `TransportMapView`, `ProductionNavigation`, `ProfileSections`, `OnboardingSlides`, `DriverPhotoCard`, `TicketQr`, `TransportTypesPanel`, `MapLayersControl` |
| Екрани з **нулем** згадок | `JourneyActiveNavigation` (тестується лише хелпер `journeyStageNavigation.ts`), `PlanTripChoice`, `OfferRoutePreview`, `MapPointPicker`, `QrScanner` (лише `qrScannerCapability.ts`), `DepartureDateTimePicker`, `TripManagement`, `MobilityAdminPanel`, чат, авторизація, усі модалки §2c, усі demo views |
| Пастка охоронців | `canonical-design.test.ts:41-48` — єдиний типографський гейт, і він.scope — лише `journey-segment-tile` з підлогою **9 px**. Тобто тест законсервував дефект D-01, а не захищає від нього |
| Пастка охоронців 2 | `canonical-design.test.ts:265,286-301` рахують точну кількість оголошень `--mg-action`, `--mg-blue`, `--mg-blue-tint`, `--mg-blue-ink`, `--mg-surface-tint` — кожен рівно 2. Будь-яка міграція токенів (D-07, D-13) роняє цей assert, тому її треба планувати разом зі зміною тесту |

## 6. NOT_VERIFIED

- Жоден екран не відзнятий у браузері в цьому файлі — це CP3
  (`VISUAL_BASELINES_INDEX.md`). Таблиця вище описує код, не рендер.
- Стани, що потребують GPS, логіну, попутки-бронювання чи ролі водія,
  перелічені з коду, але не перевірені живими сесіями. Позначка «потребує» =
  прочитано з умови в коді, а не зі спроби.
- Partner-портал не аудитований: окремий репозиторій, поза базисом Site.
