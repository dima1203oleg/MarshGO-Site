# MARSHGO Site

Mobile-first React/Vite PWA and the shared UI embedded by the Capacitor iOS client. This repository owns `src/`, static assets, frontend dependencies and responsive layouts. It calls the separately deployed API; never put private provider credentials in `VITE_*` variables.

## Local development

```sh
npm ci
VITE_API_BASE_URL=http://localhost:3002 npm run dev
```

`VITE_API_BASE_URL` must identify a reachable MARSHGO Server. Local Vite proxies API calls to `http://127.0.0.1:3002` by default. Set `CAPACITOR_BUILD=true` only when building a relative-asset bundle for the native wrapper.

## Verification

```sh
npm run lint
npm run typecheck
npm run build
```

The full two-account booking, negotiation, persisted chat and provider-fixture route journey remains in the umbrella [`MarshGO`](https://github.com/dima1203oleg/MarshGO) repository's E2E suite.

## Release status

This is a PWA source repository, not a deployed website. An HTTPS site/API origin, map tile provider and attribution, SMS, geocoding/routing and object-storage provider setup remain required for the complete real-user journey.
