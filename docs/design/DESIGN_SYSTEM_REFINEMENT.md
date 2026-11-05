# MARSHGO 9.0 — DESIGN SYSTEM REFINEMENT (WAVE D1)

**Дата:** 04.11.2026  
**Концепція:** Premium Graphite × Intelligent Blue × Spatial Clarity  
**Стандарт доступності:** WCAG 2.2 AA (контраст 4.5:1 для тексту, 3:1 для контролів, тач-таргети >= 44×44 px)  

---

## 1. КОЛЬОРОВА СИСТЕМА ТА ТОКЕНИ ПОВЕРХОНЬ

```css
:root {
  /* Canvas & Surfacing */
  --mg-canvas: #091322;
  --mg-surface-primary: #0F1C31;
  --mg-surface-secondary: #162640;
  --mg-surface-elevated: #1D3050;
  --mg-glass-overlay: rgba(15, 28, 49, 0.88);

  /* Typography / Inks */
  --mg-ink-primary: #F8FAFC;
  --mg-ink-secondary: #94A3B8;
  --mg-ink-muted: #64748B;

  /* Actions & Accents */
  --mg-action: #0B63D6;
  --mg-action-hover: #1687FF;
  --mg-action-active: #084EB0;
  --mg-action-subtle: rgba(22, 135, 255, 0.12);

  /* Borders & Dividers */
  --mg-border-subtle: rgba(148, 163, 184, 0.14);
  --mg-border-medium: rgba(148, 163, 184, 0.24);

  /* Radii */
  --mg-radius-sm: 8px;
  --mg-radius-md: 12px;
  --mg-radius-lg: 16px;
  --mg-radius-xl: 20px;
  --mg-radius-2xl: 24px;
  --mg-radius-3xl: 32px;
  --mg-radius-full: 9999px;
}
```

---

## 2. ТИПОГРАФІЧНА ШКАЛА ТА ТАБУЛЯРНІ ЧИСЛА

- **Підлога розміру шрифту:** Жоден елемент інтерфейсу не може бути меншим за **12px** (`.text-xs` має strictly `min-height / font-size >= 12px`).
- **Tabular Numerals (`font-variant-numeric: tabular-nums`):**
  - Застосовується для часу у дорозі, ETA, вартості, залишку місць та відстані для запобігання мікро-тремтінню макета при динамічних оновленнях.
- **Ієрархія заголовків:**
  - Hero Numbers / Duration: `28–32px font-extrabold tracking-tight tabular-nums`
  - Screen Titles: `20–24px font-extrabold`
  - Section Headings: `16–18px font-bold`
  - Body Text: `14–15px font-medium leading-relaxed`
  - Microcopy / Badges: `12–13px font-bold uppercase tracking-wider`

---

## 3. ВІЗУАЛЬНА СИСТЕМА 12 ВИДІВ ТРАНСПОРТУ

Кожен із 12 видів транспорту має закріплену кольорову роль та піктограму, формуючи єдиний впізнаваний гарнітур:

1. **Попутка (Carpool):** Іконка `CarFront`, колір `#3B82F6` (Indigo Blue)
2. **Маршрутка (Minibus):** Іконка `Bus`, колір `#F59E0B` (Amber)
3. **Автобус (Bus):** Іконка `BusFront`, колір `#10B981` (Emerald Green)
4. **Таксі (Taxi):** Іконка `Car`, колір `#EAB308` (Yellow)
5. **Трамвай (Tram):** Іконка `TrainTrack`, колір `#EC4899` (Pink)
6. **Тролейбус (Trolleybus):** Іконка `Zap`, колір `#06B6D4` (Cyan)
7. **Метро (Subway):** Іконка `TrainFront`, колір `#8B5CF6` (Purple)
8. **Поїзд (Train):** Іконка `Train`, колір `#6366F1` (Indigo)
9. **Велосипед (Bike):** Іконка `Bike`, колір `#14B8A6` (Teal)
10. **Самокат (Scooter):** Іконка `Footprints`, колір `#F97316` (Orange)
11. **Каршеринг (Carsharing):** Іконка `KeyRound`, колір `#0284C7` (Sky Blue)
12. **Трансфер (Transfer):** Іконка `PlaneTakeoff`, колір `#64748B` (Slate)
