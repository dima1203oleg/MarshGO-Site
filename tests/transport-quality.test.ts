import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  LIVE_POSITION_MAX_AGE_MS, getVehicleQuality, publishVehicleQuality, subscribeVehicleQuality,
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
    assert.match(layers, /if \(key === 'vehicles'\) publishVehicleQuality\(null\)/, 'a removed vehicles layer must remove the badge');
    assert.match(layers, /private teardown\(\) \{[\s\S]*?publishVehicleQuality\(null\);/, 'destroying the map must remove the badge');
    assert.match(layers, /detail\.textContent = \[vehicleQualityWord\(properties\)/, 'the popup must repeat the same level');
    assert.match(view, /<StatusBadge status=\{quality\.status\} label=\{quality\.label\}/, 'the map shows the badge');
  });
});
