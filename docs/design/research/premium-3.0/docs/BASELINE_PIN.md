# BASELINE PIN — MARSHGO Premium Design 3.0, ЕТАП A0

Документ зафіксований, щоб кожна цифра наступних аудит-файлів мала одну
відтворювану точку відліку. Без цього pins будь-яке «у нас 285 дрібних
шрифтів» стає неперевірним через тиждень.

- **Дата закріплення:** 2026-11-03 (локальний час), зріз навколо 06:05 UTC
- **Робоче дерево дослідження:** `/Users/dima1203/Desktop/marshgo-design3`
- **Гілка:** `qoder/premium-design-3-research` (створена саме з базисного SHA, не з `main`)
- **Межа:** до затвердження концепції власником цей worktree містить лише `docs/**`

---

## 1. Зафіксовані репозиторії

| Репозиторій | Канонічний SHA базису | Дата commit | Subject | Локальний `main` |
|---|---|---|---|---|
| MarshGO-Site | `8d927e8098a36f94f2ac519e52f7c720f1e0d239` | 2026-11-02 | release: integrate verified Site work onto main (10.0) | `029aae4` — **відсталий** |
| MarshGO-Server | `a632d873252c6d51687918f831e39bdb77240cb9` | 2026-11-02 | release: integrate verified Server work onto main (10.0) | — |
| MarshGO-iOS | `ad27b6f70b6255d1dd323bafcffafe4558232224` | 2026-11-02 | ios: integrate verified pin chain and align branch builds with Site/Server main | — |
| MarshGO (корінь-оркестрація) | `cdc8779173c08338bdd3696a0a03e9633412c3d6` | 2026-11-03 | docs(progress): PREMIUM-8 CP6 | гілка `qoder/checkpoint-20261031`, **453** брудні записи чужої роботи |

Пастка, зафіксована свідомо: локальний `main` у Site — це `029aae4`, а верхівка
`origin/main` — `8d927e8`; `029aae4` є предком `8d927e8` (різниця 135 commitів).
Тож «подивитися main локально» дає інший код, ніж задеплоєно. Всі цифри цього
пакета зняті з `8d927e8`, не з локального `main` і не з `13a1106` (гілка
`qoder/v41-ui-20261101`).

---

## 2. Чому базис = задеплоєний білд, а не «гілка, на якій щось лежить»

Доказ ланцюга, а не припущення:

```
docker inspect marshgo-acceptance-web-1 --format '{{.Config.Image}}'
  → marshgo/web:RC-2026-11-02-mainmerge.1

docker image inspect marshgo/web:RC-2026-11-02-mainmerge.1 \
  --format '{{json .Config.Labels}}'
  → com.marshgo.git.sha        = 8d927e8098a36f94f2ac519e52f7c720f1e0d239
  → org.opencontainers.image.revision = 8d927e8098a36f94f2ac519e52f7c720f1e0d239
  → org.opencontainers.image.source   = https://github.com/dima1203oleg/MarshGO-Site
```

Тобто образ, на якому крутиться превʼю, зібраний рівно з того SHA, на якому стоїть
дослідний worktree. Ланцюг перевірено 2026-11-03, контейнер — `Up 10 hours (healthy)`.

---

## 3. Публічне HTTPS-подання (зовнішній доказ, не localhost-_only)

Правило власника: функцію доводять через фактичний зовнішній HTTPS, а не лише
через локальний порт. Обидва шляхи віддали **той самий бандл**:

| Шлях | HTTP | Бандл |
|---|---|---|
| `https://a602584pesfa.shares.zrok.io/` | 200 | `assets/index-Ci-jmXW8.js` |
| `http://127.0.0.1:3900/` | 200 | `assets/index-Ci-jmXW8.js` |

Хеш бандла, відданого зовнішнім URL (завантажено 2026-11-03):

```
size:   757185 bytes
sha256: eeae08878658e7f5d7b14da7a47ccdf8793c60f0fa0d0581e194fa5d1d1ac1f0
```

Топологія превʼю (з `ops/nginx/nginx.conf`, який змонтований у `marshgo-proxy`):
`/` → `web:8080`, `/api/` → `api:3002`, `/admin/` → `admin:8080`,
`/partner/` → `partner:8080`, `/tiles/` → `host.docker.internal:3306`.
Zrok-share `a602584pesfa` дивиться на `localhost:8080`, тобто на цей edge.

Зауваження, щоб не будувати хибних висновків: стандартний
`/etc/nginx/conf.d/default.conf` у контейнері `marshgo-proxy` — це stock-конфіг
 nginx із чужим html (`Welcome to nginx!`). Реальний роутинг дає змонтований
`ops/nginx/nginx.conf`. Хтось, хто перевірятиме «чи живий застосунок» через
`curl :8080/readyz`, побачить 200 з HTML SPA-фолбека, а не readiness API —
це не доказ здоровʼя.

## 4. Стан середовища на момент зрізу

```
docker ps (скорочено)
  marshgo-acceptance-web-1    marshgo/web:RC-2026-11-02-mainmerge.1       127.0.0.1:3900->8080   healthy
  marshgo-acceptance-api-1    marshgo/api:RC-2026-11-02-mainmerge.1       127.0.0.1:3902->3002   healthy (перезапущений 3 хв тому)
  marshgo-acceptance-admin-1  marshgo/admin:RC-2026-11-02-mainmerge.1     127.0.0.1:3903->8080   healthy
  marshgo-acceptance-partner-1 marshgo/partner:RC-2026-11-02-mainmerge.1  127.0.0.1:3904->8080   healthy
  marshgo-acceptance-db-1     postgis/postgis:17-3.5                      (внутрішній 5432)      healthy
  marshgo-acceptance-redis-1 / -redis-cache-1   redis:7.4-alpine                                  healthy
  mg-viz-api / mg-viz-edge / marshgo-proxy / marshgo-walk-router(-kyiv) / marshgo-db-1 / marshgo-redis-1
```

`GET http://127.0.0.1:3902/readyz` → `200 {"status":"ready","database":"connected","realtime":"connected"}`.

Зовнішні проби даних через публічний URL (гостьова сесія, без логіну):

| Запит | Код | Зміст |
|---|---|---|
| `/api/v1/mobility/availability` | 401 | `{"error":{"code":"unauthorized", …}}` |
| `/api/v1/transport/layers` | 401 | те саме |
| `/api/v1/catalog/regions` | 404 | `Route not found` |

Наслідок для CP3 (скриншот-базиси): ранні екрани знімаються у режимі
`dataMode = LIVE_API_GUEST`. Сервер живий, але більшість даних потребує сесії,
тож «порожньо» на знімку — не дефект UI, а автентичний гостьовий стан. Це
пишеться заздалегідь, щоб жоден знімок не читають як «дані зникли».

Порти, яких **не** було у списку `lsof` на момент зрізу: 3001, 3002 (на хості),
3901. API доступний через 3902 і через edge 8080, не через 3002 напряму.

---

## 5. Які саме числа базиси зняті і як їх відтворити

Всі кількісні твердження аудиту — з одного скрипта, що читає файли через
`git show <rev>:<path>` (тобто з commitʼя, а не з робочого дерева; чужі
незакомічені правки не можуть підмінити цифру):

```
git -C /Users/dima1203/Desktop/marshgo-design3 \
  bash docs/design/research/premium-3.0/evidence/measure-debt.sh 8d927e8
```

Результат зрізу (повний вивід — там само, у голові файлу-доказу):

| Метрика | Значення |
|---|---|
| `src/index.css` | 2006 LOC |
| `src/views/ProductionMarketplace.tsx` | 1883 LOC |
| `src/views/ProductionNavigation.tsx` | 700 LOC |
| `src/views/JourneyResultsPanel.tsx` | 290 LOC |
| `src/map/MapLibreAdapter.ts` | 893 LOC |
| Файлів `ts/tsx/css/html` під `src` | 155 |
| Сирих hex-літералів у `.css` | 382 |
| Сирих hex-літералів у `.ts/.tsx` | 1462 (разом **1844**) |
| `text-[10px]` входжень | 285 |
| `text-[11px]` входжень | 212 (разом **497** нижче 12px) |
| Усіх `text-[Npx]` довільних розмірів | 533 |
| `min-h-11` (44 px) входжень | 49 |
| Оголошень custom properties в `index.css` | 150 |
| `--mg-*` / `--mode-*` / `--route-*` | 59 / 17 / 48 |

Незалежна перехресна перевірка (щоб не видавати дефект мірника за цифру
проєкту): інший прогін, `grep -rhoE '#[0-9a-fA-F]{3,8}\b' src`, дав 1844 —
збіг з 382+1462. Обидва числа наведено в аудиті.

## 6. Як цей worktree запускає гейти без `npm install`

Новий worktree не має `node_modules`, а ставити залежності вдруге — це 8 GB Mac
і зайві 5 хвилин. Тому `node_modules` — симлік на головне дерево Site:

```
ln -s /Users/dima1203/Desktop/MarshGO/MarshGO-Site/node_modules \
      /Users/dima1203/Desktop/marshgo-design3/node_modules
```

Це коректно лише тому, що маніфести залежностей тотожні за вмістом:

```
git rev-parse 13a1106:package.json       == git rev-parse 8d927e8:package.json        (c5259d27d2f5…)
git rev-parse 13a1106:package-lock.json  == git rev-parse 8d927e8:package-lock.json   (c38b18a14be5…)
```

Тобто бінарники з v41-дерева — це рівно той самий набір залежностей, що й для
базису. Симлік не засмічує Git: `git status --porcelain` у worktree показує
лише `?? docs/design/research/` (наші артефакти) і жодного рядка про
`node_modules` — правило `node_modules/` у `.gitignore` його покриває.
Жодного `npm install`, жодної
нової залежності, жодного `package.json`-редагування в цьому пакеті.

Гейти (`npm test`, `typecheck`, `lint:all`) запускаються **в цьому worktree**,
тож вони перевіряють код базисного SHA, а не чужу v41-гілку.

---

## 7. Що залишається неперевіреним на цьому pin

- Стану «задеплоєно в production» цей документ не стверджує. Зафіксовано лише
  те, на якому SHA зібрано локальний acceptance-образ і що віддає публічний
  превʼю-тунель. Статус продукту лишається `NOT_RELEASED`.
- Тунель zrok — тимчасова інфраструктура. Якщо `a602584pesfa` зникне, рядки §3
  треба зняти заново з актуального share (`zrok list shares`), а не вважати
  чинними вічно.
- `mg-viz-*` контейнери і ще ~50 чужих worktree (`/Users/dima1203/Desktop/ag-work/*`,
  `/private/tmp/*`) належать іншим агентам; цей пакет їх не читає як базис і не
  править. Зокрема `/Users/dima1203/Desktop/ag-work/rc-site` стоїть на `8d927e8`
  detached — це чужий майданчик, ми не будувалися в ньому.
