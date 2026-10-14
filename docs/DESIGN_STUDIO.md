# MARSHGO Design Studio

The Design Studio is a development-only wrapper around the real `ProductionMarketplace` application. It is enabled with `?studio=1` only when Vite's `import.meta.env.DEV` is true. The production build tree-shakes the Studio entry; it is not a second application or a production screen.

## Start and use

```sh
npm ci
API_PROXY_TARGET=http://127.0.0.1:3012 npm run dev -- --host 127.0.0.1 --port 3011 --strictPort
```

Open `http://127.0.0.1:3011/?studio=1`. The Studio lets you choose iPhone (390×844), compact phone (375×667), tablet (820×1080), or desktop (1280×900); set light, dark, or system theme; and open the real home, search, map, navigation, trips, and profile routes inside the preview.

Use **Обрати елемент** and click an element inside the app to capture its tag, selector, and visible text for a Codex design request. The selector describes the rendered element; it does not edit source code. Continue the actual change in this repository and review the Git diff.

## Version and data indicators

The panel displays the Git HEAD SHA, branch, whether the working tree is dirty, and the Vite start time. When files are uncommitted, the SHA identifies only the base commit; the preview also contains the dirty working tree. Restart Vite after changing branches or committing if the displayed metadata needs to refresh.

The panel checks `/healthz` through the local Vite proxy. A failed health check means live API data is unavailable. The current Site does not have a deterministic fixture API for the production entry, so the Studio does not label its login/empty UI as fixture or stage data and does not invent routes, fares, ETA, or GPS state. Authenticated states require an authorized non-production Server environment.

## Current limits

- The wrapper provides viewport sizing, themes, navigation, DOM picking, and build identity. It does not provide a visual-regression approval flow or state-fixture editor.
- `docs/design/canonical/` contains existing design references. This change does not create or approve new visual baselines.
- Browser viewport emulation is not a physical iPhone, Capacitor, background GPS, or TestFlight test.
