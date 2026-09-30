# Site and iOS release synchronization

`MarshGO-Site` is the web source consumed by `MarshGO-iOS`. Development CI may build Site `main`; a version-tagged iOS build must use immutable input commits.

Set the following repository variables before pushing an iOS `v*` tag:

- `MARSHGO_SITE_SHA`: full 40-character Site commit SHA.
- `MARSHGO_SERVER_SHA`: full 40-character Server commit SHA.
- `MARSHGO_API_CONTRACT_VERSION`: API contract identifier, normally `v1`.
- `MARSHGO_DATABASE_MIGRATION_VERSION`: latest schema migration included by that Server SHA.
- `MARSHGO_API_BASE_URL`: reachable API origin used by the client.

The workflow rejects a tagged build if the Site/Server refs are not full commit SHAs or if the contract/migration version is missing. The Site build emits an embedded `release-manifest.json` with the selected iOS, Site, and Server revisions and version metadata. The manifest is diagnostic metadata; it is not proof that external services or production acceptance have passed.

Local checkout can pin Site with `SITE_REF=<full-sha> npm run site:checkout`. With no `SITE_REF`, the checkout helper uses `main` for development. It refuses to replace an existing `web/` directory.

Current release constraints remain: the workflow compiles an unsigned simulator build. Signing, TestFlight, staging, production providers, and physical-device acceptance require separate credentials and acceptance work.
