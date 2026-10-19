# Browser acceptance

`npm run test:e2e` runs Playwright against the production build served by Vite Preview. It covers the public release entry, the first onboarding step, navigation to phone sign-in, deep-link fallback, uncaught browser errors, and horizontal overflow at 320, 390, 430, 768, 1280, and 1440 CSS pixels. The journey smoke uses an explicit API fixture to exercise OTP sign-in, a carpool → walk → scheduled bus result, unknown fare rendering, segment focus, and scheduled stops. CI runs these checks in Chromium, Firefox, and WebKit.

Run locally after `npm run build`:

```sh
npx playwright install chromium firefox webkit
npm run test:e2e
```

To target an already running isolated test deployment, set `E2E_BASE_URL`; the test runner will not start or mutate that server. These smoke checks do not authenticate a real account or prove backend, live-provider, map-tile, staging, production, or physical-device behavior. The journey fixture verifies frontend behavior only; it is not evidence that the API, bus feed, schedule, fare, or route is live. Those require separate integration and acceptance evidence.
