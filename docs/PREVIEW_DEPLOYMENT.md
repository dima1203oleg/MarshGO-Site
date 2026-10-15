# Preview and deployment

## Local Design Studio

The real React/Vite application is served from this repository. Use a local API only; the Site Vite proxy defaults to `http://127.0.0.1:3002`.

Local browser preview:

```sh
API_PROXY_TARGET=http://127.0.0.1:3012 npm run dev -- --host 127.0.0.1 --port 3011 --strictPort
```

Open `/` for the app or `/?studio=1` for the dev-only device/theme/build panel. Port `3012` is deliberately an unused loopback target when no local Server is running. The Studio reports API unavailable; it does not supply fake data.

For a phone on the same trusted Wi-Fi/LAN, bind Vite to `0.0.0.0` and allow only the current interface host:

```sh
MARSHGO_PREVIEW_HOST="$(ipconfig getifaddr en0)" \
API_PROXY_TARGET=http://127.0.0.1:3012 \
npm run dev -- --host 0.0.0.0 --port 3011 --strictPort
```

Open `http://<Mac-LAN-IP>:3011/?studio=1` on the phone. This is a private-network HTTP developer preview, not HTTPS hosting; do not enter personal credentials. Browser geolocation requires a secure context and is not validated by this preview. Stop only the Vite process started for this preview when it is no longer needed.

## PR build and production

`.github/workflows/site-ci.yml` runs on relevant pull request changes and `main` changes. It uses the pinned Node runtime, npm cache, dependency audit, lint, typecheck, tests, production build, bundle gate, and uploads a SHA-named build artifact retained for seven days. Superseded checks for the same PR/branch are cancelled. The artifact is not a hosted app URL and does not provide an automatically updating phone preview.

Do not use the existing public ChatGPT Site as a staging target. A production build is produced by `npm run build`; that alone is not a deployment. The existing public Sites URL is production, and no Sites deployment or production infrastructure was changed.

Before any future hosting, verify a private staging target, HTTPS, SPA fallback, API proxy/CORS, access control, fixture or staging data, and rollback. Admin and Partner previews must remain private and must not include real credentials or data.
