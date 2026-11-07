import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { cityTransportLayerIds, lineTypesFor, microTypesFor, transportLayerList } from '../src/map/transportLayerConfig';
import { getTransportLayers, hasStoredLayerChoice, setTransportLayers } from '../src/map/transportLayers';

describe('map transport layers', () => {
  it('shows carsharing separately and requests its live assets', () => {
    assert.ok(transportLayerList.some((layer) => layer.id === 'CARSHARING' && layer.label === 'Каршеринг'));
    assert.deepEqual(microTypesFor(new Set(['CARSHARING'])), ['carsharing']);
  });

  it('requests selected micromobility and carsharing types together', () => {
    assert.deepEqual(microTypesFor(new Set(['BICYCLE', 'SCOOTER', 'CARSHARING'])), ['bike', 'scooter', 'carsharing']);
  });

  it('exposes the twelve canonical categories and separates bus from minibus feeds', () => {
    assert.deepEqual(transportLayerList.map((layer) => layer.id), [
      'BUS', 'MINIBUS', 'TROLLEYBUS', 'TRAM', 'METRO', 'TRAIN', 'CARPOOL', 'TAXI', 'TRANSFER', 'BICYCLE', 'SCOOTER', 'CARSHARING',
    ]);
    assert.deepEqual(lineTypesFor(new Set(['BUS'])), ['bus']);
    assert.deepEqual(lineTypesFor(new Set(['MINIBUS'])), ['marshrutka']);
    assert.deepEqual(lineTypesFor(new Set(['TRAIN'])), ['train', 'suburban', 'city_train']);
  });

  it('city preset selects only available public transport and stops', () => {
    assert.deepEqual(cityTransportLayerIds(null), []);
    assert.deepEqual(cityTransportLayerIds({ BUS: true, METRO: true, BICYCLE: true, SCOOTER: true, TAXI: true, STOPS: true }), ['BUS', 'METRO', 'STOPS']);
  });

  it('separates "never chosen" from "chosen: nothing", and keeps either choice', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key) as string : null),
      setItem: (key: string, value: string) => { store.set(key, value); },
    };
    try {
      // The transport map seeds its layers only while this is false; a stored empty list must stay quiet.
      assert.equal(hasStoredLayerChoice(), false);
      setTransportLayers(['BUS', 'STOPS'], true);
      assert.equal(hasStoredLayerChoice(), true);
      assert.deepEqual([...getTransportLayers()].sort(), ['BUS', 'STOPS']);
      setTransportLayers(['BUS', 'STOPS'], false);
      assert.equal(store.get('marshgo.map.transport-layers.v1'), '[]');
      assert.equal(hasStoredLayerChoice(), true, 'switching everything off is a choice, not an untouched default');
      assert.equal(getTransportLayers().size, 0);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it('does not store a choice that changed nothing, so the first visit stays seedable', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key) as string : null),
      setItem: (key: string, value: string) => { store.set(key, value); },
    };
    try {
      // layerAvailability calls this with everything the feeds cannot serve; on a first visit nothing is on,
      // so this is a no-op — and writing it would look like "the visitor chose an empty map".
      setTransportLayers(['METRO', 'TRAIN', 'TAXI', 'BICYCLE'], false);
      assert.equal(store.has('marshgo.map.transport-layers.v1'), false, 'a no-op switch-off must not persist a choice');
      assert.equal(hasStoredLayerChoice(), false);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it('seeds the city transport on first arrival at /map and keeps the choice after leaving', () => {
    const view = readFileSync('src/views/TransportMapView.tsx', 'utf8');
    assert.match(view, /hasStoredLayerChoice/, 'the view must tell "never chosen" apart from "chose nothing"');
    assert.match(view, /cityTransportLayerIds\(layerState\.availability\)/, 'seed exactly the public transport this city can serve');
    assert.match(view, /if \(seeded\.current \|\| hasStoredLayerChoice\(\)\) return;/, 'seed once, and never over an explicit choice');
    assert.match(view, /setTransportLayers\(ids, true\)/);
    assert.doesNotMatch(view, /clearTransportLayers/, 'leaving /map must not store an empty selection and blank the next visit');
    assert.match(view, /const arrivalZoom = minZoom\.vehicles \+ 0\.2;/, 'arrival zoom must stay above the vehicle gate, or live movement is invisible');
    assert.equal([...view.matchAll(/, arrivalZoom\)/g)].length, 1, 'only the selected registry city focuses the map');
    assert.doesNotMatch(view, /navigator\.geolocation|getCurrentPosition|setCityId\('kyiv'\)/, 'the map must not prompt for GPS or silently fall back to Kyiv');
    assert.match(view, /normalizedCity\(city\.name\) === normalizedCity\(cityName\)/, 'the map follows the global header city when it has a verified registry entry');
    assert.match(view, /setCityRegistryHint\(cityName && !match \?/);
    assert.match(view, /setCityRegistryHint\([^\n]*: null\)/, 'a verified city clears the old missing-catalog notice');
  });
});
