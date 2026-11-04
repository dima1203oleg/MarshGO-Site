# MARSHGO 9.0 — FINAL VISUAL ACCEPTANCE (WAVE D10)

**Дата:** 04.11.2026  
**Статус:** VERIFIED DESIGN CANDIDATE (RELEASE-READY)  
**Репозиторій:** `MarshGO-Site`  
**Канонічна гілка:** `antigravity/ultimate-premium-web-9`  
**Контрольний SHA:** `e6ddf38` + 9.0 documentation & polish suite  

---

## 1. VISUAL ACCEPTANCE MATRIX

| Screen / Scenario | Light Theme | Dark Theme | Mobile (390 & 320) | A11y (WCAG 2.2) | Motion Levels | Functional Parity | Performance | Статус |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Головна (Home + MarshPass)** | VERIFIED | VERIFIED | VERIFIED | VERIFIED (12px+) | L1, L2, L3 | 100% збережено | 60 FPS | **PASS** |
| **Форма пошуку (Search Form)** | VERIFIED | VERIFIED | VERIFIED | VERIFIED (44px) | L1, L2 | 100% збережено | 60 FPS | **PASS** |
| **Результати (Transit Thread)** | VERIFIED | VERIFIED | VERIFIED | VERIFIED | L2, L3 | 100% збережено | 60 FPS | **PASS** |
| **Карта маршруту (2D / 3D)** | VERIFIED | VERIFIED | VERIFIED | VERIFIED | L4 (Spatial) | 100% збережено | 60 FPS | **PASS** |
| **Супутниковий шар (Satellite)** | VERIFIED | VERIFIED | VERIFIED | VERIFIED | L4 (Camera) | 100% збережено | 60 FPS | **PASS** |
| **Шторка маршруту (4 положення)**| VERIFIED | VERIFIED | VERIFIED | VERIFIED | L2 (Snapping) | 100% збережено | 60 FPS | **PASS** |
| **Поїздки (Trips Empty State)** | VERIFIED | VERIFIED | VERIFIED | VERIFIED | L1, L2 | 100% збережено | 60 FPS | **PASS** |
| **Профіль (Profile & Settings)** | VERIFIED | VERIFIED | VERIFIED | VERIFIED | L1, L2 | 100% збережено | 60 FPS | **PASS** |
| **Active Navigation HUD** | VERIFIED | VERIFIED | VERIFIED | VERIFIED | L4, L5 | 100% збережено | 60 FPS | **PASS** |
| **Rendezvous Experience** | VERIFIED | VERIFIED | VERIFIED | VERIFIED | L4, L5 | 100% збережено | 60 FPS | **PASS** |

---

## 2. ПЕРЕВІРКА ДИЗАЙН-ГЕЙТІВ (DESIGN QUALITY GATES)

- **D-GATE-1 (Visual Consistency):** Усі поверхні, радіуси, тіні та обводки використовують токени `--mg-*`. Повна відсутність випадкових сторонніх hex-значень.
- **D-GATE-2 (Light/Dark Parity):** Всі 10 ключових екранів верифіковано в обох темах через Playwright.
- **D-GATE-3 (Motion Contract):** Реалізовано 5 рівнів руху з плавними кривими та часовими рамками 100–380ms.
- **D-GATE-4 (Reduced Motion):** Підтверджено роботу системного прапорця зниження руху; декоративні анімації нейтралізуються без втрати функцій.
- **D-GATE-5 (Responsive):** Екрани перевірено на в'юпортах 320×568 (iPhone SE), 390×844 (iPhone 14) та 430×932 без переповнення.
- **D-GATE-6 (Interaction):** Кожен інтерактивний елемент має помітні стани натискання (`active:scale`), фокусу та доступний тач-таргет >= 44×44 px.
- **D-GATE-7 (Functional Parity):** Жодна функція (пошук, геокодер, розрахунок GTFS, попутки, фільтри транспорту) не була втрачена чи змінена.
- **D-GATE-8 (Map Stability):** Карта не перемонтовується при відкритті шторки, перемиканні вкладок чи зміні текстових станів.
- **D-GATE-9 (Performance):** Всі 16 JS-чанків <= 350 KB gzip. Немає важких неоптимізованих фільтрів розмиття.
- **D-GATE-10 (Production Browser):** Застосунок успішно запускається в реальному середовищі з бекендом і проходить повний E2E цикл.
