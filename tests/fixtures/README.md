# Site E2E map fixture

`map-tile-server.mjs` is a test-only, loopback HTTP server. It returns a
synthetic map manifest, four MapLibre styles, and generated schematic PNG tiles;
the content is deliberately not real geography and makes no transport or
provider claims. Its behavior is copied into the Site-owned test suite from
the MARSHGO orchestration fixture at `MarshGO/tests/fixtures/map-tile-server.mjs`
so this repository's browser checks do not depend on the orchestration checkout.

`npm run test:e2e` builds a temporary Site bundle with the fixture manifest,
starts the fixture only as a Playwright `webServer`, runs the browser tests,
then removes only the temporary bundle it created. Playwright shuts down the
fixture and preview child processes when the run ends. External `E2E_BASE_URL`
runs do not start local web servers or the synthetic map fixture.

The fixture is never referenced by production builds or release manifests.
Its tiles cannot establish licensed basemap coverage, real-world visual
acceptance, or production map performance.
