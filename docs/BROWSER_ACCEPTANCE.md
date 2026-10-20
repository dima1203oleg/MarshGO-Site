# Browser acceptance

The release entry wraps production UI in `ProductionErrorBoundary`. If a React render or lazy screen import fails (including a stale/missing JavaScript chunk), the app shows a Ukrainian recovery screen with an explicit reload button. It does not automatically reload or clear storage/cache. A browser regression aborts the lazy navigation chunk and verifies the recovery screen in Chromium, Firefox, and WebKit. This exercises controlled UI recovery only; it does not reproduce the historical physical-Safari white-screen incident or test a real service-worker update. The Site currently ships a web app manifest but no service worker.

`npm run test:e2e` runs Playwright against the production build served by Vite Preview. It covers the public release entry, the first onboarding step, navigation to phone sign-in, deep-link fallback, uncaught browser errors, and horizontal overflow at 320, 390, 430, 768, 1280, and 1440 CSS pixels. The journey smoke uses an explicit API fixture to exercise OTP sign-in, a carpool → walk → scheduled bus result, unknown fare rendering, segment focus, and scheduled stops in Chromium, Firefox, and WebKit. On selecting a journey leg, the map shows only that leg; the itinerary remains intact in the route sheet. In Chromium, selecting A20 also receives two directional line geometries and four fresh vehicle positions in the separate selected-line overlay; the browser check verifies both directions and all four bus markers reach the map, with three vehicles emphasized as approaching the boarding stop. Firefox and WebKit verify selected-leg focus and journey UI; live overlay fixture rendering is asserted in Chromium.

Run locally after `npm run build`:

```sh
npx playwright install chromium firefox webkit
npm run test:e2e
```

To target an already running isolated test deployment, set `E2E_BASE_URL`; the test runner will not start or mutate that server. These smoke checks do not authenticate a real account or prove backend, live-provider, map-tile, staging, production, or physical-device behavior. The Chromium journey fixture verifies frontend rendering and the live-overlay contract only; it is not evidence that the API, bus feed, schedule, vehicle positions, fare, or route is live. Those require separate integration and acceptance evidence.
