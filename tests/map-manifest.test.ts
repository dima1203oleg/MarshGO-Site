import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMapAssetManifest } from '../src/map/style/manifest';
import { buildFallbackStyle } from '../src/map/style/buildStyle';

const manifest = {
  schemaVersion: 1, mapDataVersion: '2026-09-30', styleVersion: '1.0.0', mapDataUrl: 'https://maps.example/maps/ukraine/2026-09-30/ukraine.pmtiles',
  styles: {
    MARSHGO_LIGHT: 'https://maps.example/styles/simple-light/v1.0.0/style.json',
    MARSHGO_DARK: 'https://maps.example/styles/simple-dark/v1.0.0/style.json',
    MARSHGO_3D_LIGHT: 'https://maps.example/styles/3d-light/v1.0.0/style.json',
    MARSHGO_3D_DARK: 'https://maps.example/styles/3d-dark/v1.0.0/style.json',
  },
};

test('map asset manifest accepts immutable versioned data and style URLs', () => {
  assert.equal(parseMapAssetManifest(manifest).mapDataVersion, '2026-09-30');
});

test('map asset manifest rejects mutable URLs and incompatible versions', () => {
  assert.throws(() => parseMapAssetManifest({ ...manifest, mapDataUrl: 'https://maps.example/maps/current.pmtiles' }), /immutable and versioned/);
  assert.throws(() => parseMapAssetManifest({ ...manifest, styles: { ...manifest.styles, MARSHGO_3D_LIGHT: 'https://maps.example/styles/current.json' } }), /immutable and versioned/);
  assert.throws(() => parseMapAssetManifest({ ...manifest, styles: { MARSHGO_LIGHT: manifest.styles.MARSHGO_LIGHT } }), /Invalid input/);
  assert.throws(() => parseMapAssetManifest({ ...manifest, schemaVersion: 2 }), /Invalid input/);
});

test('fallback basemap uses the requested light or dark canvas palette', () => {
  const background = (theme: 'MARSHGO_LIGHT' | 'MARSHGO_DARK') => {
    const layer = buildFallbackStyle(theme).layers.find(candidate => candidate.id === 'marshgo-background');
    assert.ok(layer && layer.type === 'background');
    return layer.paint?.['background-color'];
  };

  assert.equal(background('MARSHGO_LIGHT'), '#EEF3F8');
  assert.equal(background('MARSHGO_DARK'), '#111827');
});
