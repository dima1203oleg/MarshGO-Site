import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  LIVE_POSITION_MAX_AGE_MS, getVehicleQuality, layerProvenanceNotice, publishVehicleQuality, subscribeVehicleQuality,
  summarizeVehicleQuality, vehiclePositionAgeMs, vehicleQualityLevel, vehicleQualityWord,
} from '../src/map/transportQuality';
import type { GeoJsonCollection } from '../src/services/productionApi';

const NOW = Date.parse('2026-10-31T12:00:00.000Z');
const collection = (...properties: Array<Record<string, unknown>>): GeoJsonCollection => ({
  type: 'FeatureCollection',
  features: properties.map((item) => ({ type: 'Feature', properties: item, geometry: { type: 'Point', coordinates: [24.03, 49.8] } })),
});

describe('vehicle data quality on the live map', () => {
  it('trusts the level the server stamped on the feature', () => {
    assert.equal(vehicleQualityLevel({ dataQuality: 'STALE', positionAgeMs: 0 }, NOW).status, 'stale');
    assert.equal(vehicleQualityLevel({ dataQuality: 'LIVE', positionAgeMs: 120_000 }, NOW).status, 'live');
    assert.equal(vehicleQualityLevel({ dataQuality: 'SCHEDULED' }, NOW).status, 'scheduled');
  });

  it('derives the level from the provider timestamp when an older server sends none', () => {
    const stamp = (ageMs: number) => new Date(NOW - ageMs).toISOString();
    assert.equal(vehicleQualityLevel({ updatedAt: stamp(5_000) }, NOW).status, 'live');
    assert.equal(vehicleQualityLevel({ updatedAt: stamp(LIVE_POSITION_MAX_AGE_MS + 1_000) }, NOW).status, 'stale');
    assert.equal(vehicleQualityLevel({ updatedAt: 'not a date' }, NOW).status, 'estimated');
    assert.equal(vehicleQualityLevel({}, NOW).status, 'estimated');
  });

  it('prefers the reported age and never lets a future clock read as negative', () => {
    assert.equal(vehiclePositionAgeMs({ positionAgeMs: 4_321, updatedAt: new Date(NOW).toISOString() }, NOW), 4_321);
    assert.equal(vehiclePositionAgeMs({ updatedAt: new Date(NOW + 60_000).toISOString() }, NOW), 0);
    assert.equal(vehiclePositionAgeMs({ positionAgeMs: -5 }, NOW), null);
  });

  it('describes a mixed viewport by its least fresh marker', () => {
    const summary = summarizeVehicleQuality(collection(
      { dataQuality: 'LIVE', positionAgeMs: 3_000 },
      { dataQuality: 'STALE', positionAgeMs: 40_000 },
    ), NOW);
    assert.equal(summary.status, 'stale');
    assert.equal(summary.vehicleCount, 2);
    assert.equal(summary.oldestAgeMs, 40_000);
    assert.match(summary.label, /застаріли/i);
  });

  it('says there is no vehicle instead of inventing a live badge', () => {
    const summary = summarizeVehicleQuality(collection(), NOW);
    assert.equal(summary.status, 'unavailable');
    assert.equal(summary.vehicleCount, 0);
    assert.equal(summary.oldestAgeMs, null);
  });

  it('uses one vocabulary in the badge and in the marker popup', () => {
    assert.equal(vehicleQualityWord({ dataQuality: 'LIVE' }, NOW), 'жива позиція');
    assert.equal(vehicleQualityWord({ dataQuality: 'ESTIMATED' }, NOW), 'позиція без мітки часу');
  });

  it('keeps the badge store in sync with the vehicles layer', () => {
    const seen: Array<string | null> = [];
    const unsubscribe = subscribeVehicleQuality((quality) => { seen.push(quality?.status ?? null); });
    assert.equal(getVehicleQuality(), null);
    assert.deepEqual(seen, [null]);
    publishVehicleQuality(summarizeVehicleQuality(collection({ dataQuality: 'LIVE', positionAgeMs: 1 }), NOW));
    assert.equal(getVehicleQuality()?.status, 'live');
    publishVehicleQuality(null);
    assert.deepEqual(seen, [null, 'live', null]);
    unsubscribe();
    publishVehicleQuality(summarizeVehicleQuality(collection({ dataQuality: 'STALE', positionAgeMs: 1 }), NOW));
    assert.equal(seen.length, 3);
    publishVehicleQuality(null);
  });

  it('is wired to the vehicles layer and rendered on the transport map', () => {
    const layers = readFileSync(new URL('../src/map/transportLayers.ts', import.meta.url), 'utf8');
    const view = readFileSync(new URL('../src/views/TransportMapView.tsx', import.meta.url), 'utf8');
    assert.match(layers, /if \(key === 'vehicles'\) publishVehicleQuality\(summarizeVehicleQuality\(collection\)\)/, 'a loaded vehicles layer must publish its quality');
    assert.match(layers, /if \(key === 'vehicles'\) \{[^{}]*publishVehicleQuality\(null\)/, 'a removed vehicles layer must remove the badge');
    assert.match(layers, /private teardown\(\) \{[\s\S]*?publishVehicleQuality\(null\);/, 'destroying the map must remove the badge');
    assert.match(layers, /detail\.textContent = \[vehicleQualityWord\(properties\)/, 'the popup must repeat the same level');
    assert.match(view, /<StatusBadge status=\{quality\.status\} label=\{quality\.label\}/, 'the map shows the badge');
  });

  it('gives the trust halo a radius MapLibre accepts', () => {
    const layers = readFileSync(new URL('../src/map/transportLayers.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(layers, /'circle-radius': \['\+', \['interpolate'/, 'MapLibre drops a layer whose radius nests a zoom expression in + and reports nothing');
    assert.match(layers, /id: 'mg-t-vehicle-halo'[\s\S]*?'circle-radius': vehicleHaloRadius/, 'the halo must grade wider than the dot it wraps');
  });

  it('replays only geometry that does not move when a layer is switched back on', () => {
    const layers = readFileSync(new URL('../src/map/transportLayers.ts', import.meta.url), 'utf8');
    assert.match(layers, /cacheable = new Set<keyof typeof SOURCES>\(\['routes', 'stops'\]\)/, 'route and stop positions are static enough to survive a toggle');
    assert.doesNotMatch(layers, /cacheable[\s\S]{0,120}(vehicles|micro|zones)/, 'live vehicles, scooters and geofences must never be replayed from memory');
    assert.match(layers, /Date\.now\(\) - fresh\.at < STATIC_CACHE_TTL_MS/, 'a cached viewport must expire');
    assert.match(layers, /destroy\(\) \{ this\.teardown\(\); this\.cache\.clear\(\); \}/, 'leaving the map must free the cached geometry');
  });
});

// The server tells the client how much of a layer it could not serve, but only if the layer request
// keeps `meta`. Without it a passenger who switched a layer on and sees nothing cannot tell a feed
// outage from an area that genuinely has no stops, so the map now says which one the server reported.
describe('static layer provenance notices', () => {
  it('names the outage instead of leaving a switched-on layer silent', () => {
    const notice = layerProvenanceNotice('stops', { featureCount: 0, failedProviderCount: 2, truncated: false });
    assert.match(notice ?? '', /не відповів жоден провайдер \(2\)/);
    assert.match(notice ?? '', /зупинки/);
  });

  it('stays quiet for a viewport that is simply empty — absence of data is not an outage', () => {
    assert.equal(layerProvenanceNotice('stops', { featureCount: 0, failedProviderCount: 0, truncated: false }), null);
    assert.equal(layerProvenanceNotice('routes', { featureCount: 42, failedProviderCount: 0, truncated: false }), null);
  });

  it('admits a partially served layer and a capped one instead of implying completeness', () => {
    assert.match(layerProvenanceNotice('micro', { featureCount: 9, failedProviderCount: 1, truncated: false }) ?? '', /показано не всі дані/);
    assert.match(layerProvenanceNotice('routes', { featureCount: 600, failedProviderCount: 0, truncated: true }) ?? '', /показано не всі об'єкти/);
  });

  it('keeps the server account in the API contract', () => {
    const api = readFileSync(new URL('../src/services/productionApi.ts', import.meta.url), 'utf8');
    assert.match(api, /return \{ data: \(body as ApiEnvelope<T>\)\.data, meta: body\?\.meta \?\? null \};/, 'the envelope must survive unwrapping');
    assert.match(api, /transportStops\(bbox: string, types: string\[\], signal\?: AbortSignal\) \{ return requestLayer\(/, 'a layer must be fetched with its meta');
    assert.match(api, /transportMicromobilityGeofences\(bbox: string, signal\?: AbortSignal\) \{ return requestLayer\(/, 'geofences are a layer too');
  });

  it('records the notice when a layer is painted and publishes one banner', () => {
    const layers = readFileSync(new URL('../src/map/transportLayers.ts', import.meta.url), 'utf8');
    assert.match(layers, /layerProvenanceNotice\(key, \{ featureCount: collection\.features\.length, failedProviderCount: response\.failedProviderCount, truncated: response\.truncated \}\)/, 'the notice reads the server account, not the geometry alone');
    assert.match(layers, /this\.publish\(key, fresh\.response\)/, 'a cached replay must restate the same notice');
    assert.match(layers, /this\.notices\.set\(key, 'Не вдалося завантажити частину шарів\. Спробуйте ще раз\.'\)/, 'a failed request joins the same banner instead of being overwritten');
    assert.match(layers, /await Promise\.all\(tasks\);\s*this\.publishHint\(hints\);/, 'the banner is composed after every layer answered');
    assert.match(layers, /private clear\(key: keyof typeof SOURCES\) \{[\s\S]*?this\.notices\.delete\(key\)/, 'a layer the user switched off stops complaining');
    assert.match(layers, /this\.notices\.clear\(\);[\s\S]*?publishVehicleQuality\(null\);/, 'tearing the map down clears the banner');
  });
});
