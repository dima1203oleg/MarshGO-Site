# MARSHGO QUALITY GATES — що реально перевіряється і де доказ

Оновлено: 2026-11-03. Статус продукту: **NOT_RELEASED**.
Правило читання: гейт закритий лише тоді, коли є посилання на run, вимір або скриншот —
не твердження «зелено».

Позначки: **VERIFIED** (доказ цієї дати) / **PARTIAL** / **BLOCKED** / **NOT_TESTED**.

---

## 1. Карта гейтів

| # | Гейт | Де виконується | Що саме перевіряє | Статус | Доказ |
|---|---|---|---|---|---|
| G1 | lint (`eslint src scripts shared vite.config.ts`) | Site CI, `verify` | правила коду front-end | VERIFIED | run 41572468734 |
| G2 | typecheck (`tsc --noEmit`) | Site CI | типи React 19 + Vite 8 | VERIFIED | той самий run |
| G3 | **тестовий набір** (`npm test` = `tsx --test tests/*.test.ts`) | Site CI — **лише з PR #47** | 319 поведінкових тестів без браузера й мережі | VERIFIED | `ℹ tests 314 / pass 314 / fail 0` у run 41572468734 (на базі інтеграції); локально на пілот-гілці 319/319 |
| G4 | bundle budget (`check:bundle`) | Site CI | розмір бандла | VERIFIED | run 41572468734 |
| G5 | build (`vite build`) | Site CI | збірність | VERIFIED | той самий run |
| G6 | канонічний дизайн (SHA-256 дошки light/dark) | `tests/canonical-design.test.ts` (всередині G3) | візуальний канон не зламаний | VERIFIED | 314 → 319 |
| G7 | преміум-підлога: 44 px тап-зони, 12 px кегль | `tests/premium-mobile-ergonomics*`, `tests/v41-contrast*` (G3) + вимір у браузері | підлога ергономіки | VERIFIED | виміри пілота 8a: `touchTargetsBelow44: []`, minFont 10→12 px |
| G8 | мобільна при 320×568 / 390×844 / 430×932 × дві теми | **не в CI** — локальний Playwright-harness | чи вміщується канонічна сітка дій | VERIFIED локально | `docs/audit/home-quickactions-320/` (12 PNG + 2 JSON), PR #49 |
| G9 | prefers-reduced-motion | локальний harness | кінцевий стан без анімації | VERIFIED локально | `after-320x568-light-reduced-motion.png`: 0 анімацій, 4 квадратні тайли |
| G10 | e2e (Playwright) | кореневий `MarshGO/` (acceptance-скрипти) | повні сценарії | NOT_TESTED тут | належить іншому репо; в Site CI свідомо не додано — потрібні runner-браузери і фікстури |
| G11 | server: API/PostGIS/Redis/GTFS | `MarshGO-Server` `npm test` | бекенд | NOT_TESTED цією сесією | запускається окремо; числа брати зі свіжого запуску |
| G12 | iOS-узгодженість | `MarshGO-iOS` | Capacitor-оболонка | NOT_TESTED | немає пристрою/симулятора в цій сесії |
| G13 | secrets hygiene | PreToolUse `guard-secrets.sh` (Write/Edit) | не записувати креденшелі | VERIFIED | `MarshGO/.qoder/hooks/` + `failures.log` |
| G14 | руйнівні git-дії | PreToolUse `guard-destructive-bash.sh`, `guard-protected-branch.sh` | reset --hard / clean -fd / force-push / main / codex/* / видалення гілок і worktree | VERIFIED | цієї сесії заблокував `git branch -D` і `git worktree remove --force` |

---

## 2. Як з'явився G3 (і чому це була головна прогалина)

До PR #47 `.github/workflows/ci.yml` мав п'ять кроків — `npm ci`, lint, typecheck, build,
`check:bundle` — і **не запускав тести**, хоча в репозиторії 56 тест-файлів. Тобто зелений CI
означав «проєкт збирається», а не «поведінка правильна». Будь-який релізний висновок,
побудований на такому зеленому CI, був би хибним доказом.

Зміна — два рядки (крок `Test suite` між `typecheck` і `build`, щоб падіння тесту не
ховалося під збіркою).

Негативний контроль: до зміни той самий набір не виконувався в CI взагалі; після — виконується
і повідомляє власний лічильник (`ℹ tests N`). Різниця вимірюється числом у логі run, а не
твердженням.

---

## 3. Що тестується вперше (пілот коду 8b)

`tests/auth-token-refresh.test.ts` (PR #50) — перші тести, які **виконують** мережевий шар
`src/services/productionApi.ts`, а не імпортують його лише заради типів. Фіксують контракт
гілки 401: один refresh на 401, один повтор, цикл неможливий, `/auth/*` не самооновлюється,
паралельні 401 ділять один refresh, пізній refresh не перезаписує новіший токен.

Знайдений дефект: результат refresh записувався безумовно і двічі, тому завершення `login()`
під час незавершеного refresh лишало повтор запиту з токеном **попередньої** сесії.
До: 4 passed / 1 failed (`Bearer token-2` замість `Bearer token-3`). Після: 5/5,
набір 314 → 319.

---

## 4. Відкриті боргові гейти

| Предмет | Поточний вимір | Критичність |
|---|---|---|
| `!important` у `src/index.css` | 187 на базі інтеграції → **185** після пілота 8a | ціль плану ≤175; решта — правила, не залучені до Головної. Метрика `grep -c '!important'` |
| Dead CSS у блоках коротких екранів | блок `max-height: 620px` (PR #39) повністю перекривається пізнішим `max-width: 639px` | не містить дефекту, а вводить в оману; чистка — окреме рішення |
| Worktree-гігієна Site | 56 записів `git worktree list`, з них 21 під `/tmp` | потребує дозволу власника (хук блокує примусове видалення) |
| Тести в CI на всіх гілках | G3 діє лише після мержу PR #47 | PR #50 зелений, але без тестового кроку — це задокументовано в коментарі до PR |

---

## 5. Як відтворити locally

```bash
cd /Users/dima1203/Desktop/MarshGO/MarshGO-Site      # або свій worktree на qoder/*
npm test                                             # tsx --test tests/*.test.ts
npm run typecheck && npm run lint

# браузерний evidence (один важкий процес за раз — це 8 GB Mac)
API_PROXY_TARGET=http://127.0.0.1:3902 npx vite --port=3001 --host=127.0.0.1 &
cd docs/audit/home-quickactions-320
MARSHGO_EMAIL=… MARSHGO_PASSWORD=… node measure-home-grid.mjs http://127.0.0.1:3001/ check
MARSHGO_EMAIL=… MARSHGO_PASSWORD=… node verify-reduced-motion.mjs http://127.0.0.1:3001/
```

Логінів у CI немає: браузерні гейти (G8, G9) — локальні, бо runner-браузери і фікстури
належать кореневому acceptance-контуру, не Site.
