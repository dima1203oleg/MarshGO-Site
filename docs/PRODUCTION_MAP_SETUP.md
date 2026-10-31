# MARSHGO production map assets

The client uses MapLibre GL JS. Map modes are exactly `simple` (2D), `threeD`,
and `satellite`; day/night is a separate appearance setting. Transit, stops,
vehicles, shared rides, and micromobility remain independent overlay layers.

## Required vector style manifest

Deploy an immutable JSON manifest and set `VITE_MAP_STYLE_MANIFEST_URL` at
build time. It must contain all four versioned styles so switching mode or
appearance never silently reuses an incomplete style:

```json
{
  "schemaVersion": 1,
  "mapDataVersion": "2026-10-10",
  "styleVersion": "1.0.0",
  "mapDataUrl": "https://maps.example/maps/ukraine/2026-10-10/ukraine.pmtiles",
  "styles": {
    "MARSHGO_LIGHT": "https://maps.example/styles/simple-light/v1.0.0/style.json",
    "MARSHGO_DARK": "https://maps.example/styles/simple-dark/v1.0.0/style.json",
    "MARSHGO_3D_LIGHT": "https://maps.example/styles/3d-light/v1.0.0/style.json",
    "MARSHGO_3D_DARK": "https://maps.example/styles/3d-dark/v1.0.0/style.json"
  }
}
```

The style and data paths must be immutable/versioned. The 3D styles should
contain vector building polygons with `height`/`render_height` and optional
`min_height`/`render_min_height` attributes. The client only extrudes those
existing simplified polygons at city zoom levels; it does not download model
meshes. Search overlays and the active route are restored after every style
change.

## Satellite source

Configure an imagery URL template with `VITE_MAP_SATELLITE_TILE_URL` and its
required provider attribution with `VITE_MAP_SATELLITE_ATTRIBUTION`. Set these
only after the provider contract, allowed caching, coverage, and attribution
requirements are reviewed. No vendor URL or API key is bundled by default. If
either value is absent, the app reports the satellite mode as unconfigured and
keeps the selected route and vector overlays; it does not present imagery as
loaded.

`VITE_MAP_STYLE_URL` and `VITE_MAP_TILE_URL` are compatibility inputs for
existing owned style/tile services. They do not replace the production manifest
requirement for four verified day/night vector styles.

## Release verification

Before enabling map assets in a release, verify all six combinations on the
deployed provider: Simple 2D day/night, 3D day/night, and satellite day/night.
Also verify attribution, route persistence during each switch, overlay
visibility, stale/error tile handling, offline behavior, and performance on a
physical lower-end phone. This repository currently has no production map
manifest or licensed satellite configuration, so these visual/provider checks
remain a deployment blocker rather than a passed production claim.
