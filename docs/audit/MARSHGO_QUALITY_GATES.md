# MARSHGO QUALITY GATES — що реально перевіряється і де доказ

Оновлено: 2026-11-05 18:41 UTC. База: `MarshGO-Site` `main` = `2cc96ee`. Статус продукту: **NOT_RELEASED**.
Правило читання: гейт закритий лише тоді, коли є посилання на run, вимір або скриншот —
не твердження «зелено».

Позначки: **VERIFIED** (доказ цієї дати) / **PARTIAL** / **BLOCKED** / **NOT_TESTED**.

---

## 1. Що виконує CI Site

`.github/workflows/ci.yml` → job `verify` (ubuntu-latest, Node 24.21.0), кроки по порядку:
`npm ci` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run check-tokens` ·
`npm run build` · `npm run check:bundle` · `npm run check-single-react` ·
`npx playwright install --with-deps chromium` · `npm run boot-smoke`.

Тестовий крок **уже є на main** і реально виконується. Доказ — лог рану `42084065957`
(гілка `qoder/search-abort-main-1`, 2026-11-05T18:26Z):

```
ℹ tests 430
ℹ suites 37
ℹ pass 430
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

`skipped 0` принципове: набір, що self-skip’иться, не може бути зеленим CI.

## 2. Карта гейтів

| # | Гейт | Де | Статус | Доказ |
|---|---|---|---|---|
| G1 | lint (`eslint src scripts shared vite.config.ts`) | Site CI `verify` | VERIFIED | run 42084065957 |
| G2 | typecheck (`tsc --noEmit`) | Site CI `verify` | VERIFIED | той самий run |
| G3 | тести (`npm test` = `tsx --test tests/*.test.ts`, 88 тест-файлів) | Site CI `verify` | VERIFIED | run 42084065957 — 430/430, fail 0, skipped 0 |
| G4 | bundle budget (`check:bundle`) | Site CI `verify` | VERIFIED | той самий run |
| G5 | build (`vite build`) | Site CI `verify` | VERIFIED | той самий run |
| G6 | єдиний React у збірці (`check-single-react`) | Site CI `verify` | VERIFIED | той самий run; історичний дефект — чорний екран через дубль React |
| G7 | реєстр токенів (`check-tokens`) | Site CI `verify` | VERIFIED | той самий run |
| G8 | boot-smoke (Chromium, чистий старт без білого екрана) | Site CI `verify` | VERIFIED | той самий run |
| G9 | канонічний дизайн (SHA-256 дошки light/dark) | у складі G3 (`tests/canonical-design.test.ts`) | VERIFIED | `docs/design/canonical/marshgo-{light,dark}-canonical.jpg` |
| G10 | преміум-підлога: 44 px тап-зони, 12 px кегль | у складі G3 + вимір у браузері | VERIFIED | `tests/v41-contrast.test.ts`; виміри ланцюгів 390×844 у чаті |
| G11 | 320×568 / 390×844 / 430×932 × дві теми | **не в CI** — локальний Playwright | PARTIAL | локальні харнеси; регулярного рану немає |
| G12 | prefers-reduced-motion | локальний харнес | PARTIAL | перевіряється вибірково, не в CI |
| G13 | e2e-сценарії | кореневий `MarshGO/` (acceptance) | NOT_TESTED цим репо | належить іншому контуру |
| G14 | Server: API/PostGIS/Redis/GTFS | `MarshGO-Server` `npm test` | NOT_TESTED цього чекпоінта | числа брати зі свіжого запуску, не з пам’ятки |
| G15 | iOS-узгодженість | `MarshGO-iOS` | NOT_TESTED | немає пристрою/симулятора |
| G16 | secrets hygiene | PreToolUse `guard-secrets.sh` | VERIFIED | `MarshGO/.qoder/hooks/` |
| G17 | руйнівні git-дії | PreToolUse `guard-destructive-bash.sh`, `guard-protected-branch.sh` | VERIFIED | цього сеансу хук заблокував `git worktree remove --force` |

## 3. Що цей документ виправляє в попередній версії

Попередня редакція (PR #47, база 2026-11-03) стверджувала, що тестовий крок з’явиться
«лише з PR #47» і що «PR #50 зелений, але без тестового кроку». На `main` `2cc96ee`
це не так: `npm test` у workflow уже є і дає 430/430 у CI. Твердження залишається
історичним і не має потрапляти в релізний маніфест як актуальне.

## 4. Відкритий борг (виміряно на `main` `2cc96ee`)

| Предмет | Поточний вимір | Коментар |
|---|---|---|
| `!important` у `src/index.css` | **14** | було 187 на базі інтеграції; метрика `grep -c '!important'` |
| Worktree-гігієна Site | 20 записів, з них 15 під `/tmp` | примусове видалення блокує хук; прибирання — лише за дозвілом власника |
| Браузерні гейти G11/G12 у CI | відсутні | потрібні стабільні фікстури й облікові дані acceptance-контуру |
| Інтеграційні тести Server | не в складі G3 | окремий контур, окремий дозвіл на запуск |

## 5. Як відтворити локально

```bash
cd MarshGO-Site            # або свій worktree на qoder/*
npm ci
npm run lint && npm run typecheck && npm test
npm run check-tokens && npm run build && npm run check:bundle && npm run check-single-react

# візуальний доказ (один важкий процес за раз — це 8 GB Mac)
API_PROXY_TARGET=http://127.0.0.1:<порт-API> npx vite preview --port=<порт> --host=127.0.0.1
```

Логінів у CI немає: браузерні гейти G11/G12 лишаються локальними, бо runner-браузери
і фікстури належать кореневому acceptance-контуру, а не Site.
