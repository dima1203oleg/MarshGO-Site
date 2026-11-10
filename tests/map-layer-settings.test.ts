import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getTransportLayerVisibility, normalizeMapDisplayPreferences } from '../src/map/mapLayerPreferences';
import type { TransportLayerId } from '../src/map/transportLayerConfig';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('map display switches control the intended MapLibre layers independently', () => {
  const selected = new Set<TransportLayerId>(['STOPS']);
  const defaults = normalizeMapDisplayPreferences(null);
  assert.deepEqual(getTransportLayerVisibility(defaults, selected), {
    'mg-t-routes': true,
    'mg-t-route-label': true,
    'mg-t-stops': true,
    'mg-t-stop-label': true,
    'mg-t-vehicle-halo': true,
    'mg-t-vehicles': true,
    'mg-t-vehicle-label': true,
  });

  assert.deepEqual(getTransportLayerVisibility({ ...defaults, routeLines: false }, selected), {
    'mg-t-routes': false,
    'mg-t-route-label': false,
    'mg-t-stops': true,
    'mg-t-stop-label': true,
    'mg-t-vehicle-halo': true,
    'mg-t-vehicles': true,
    'mg-t-vehicle-label': true,
  });
  assert.deepEqual(getTransportLayerVisibility({ ...defaults, routeNumbers: false }, selected), {
    'mg-t-routes': true,
    'mg-t-route-label': false,
    'mg-t-stops': true,
    'mg-t-stop-label': true,
    'mg-t-vehicle-halo': true,
    'mg-t-vehicles': true,
    'mg-t-vehicle-label': false,
  });
  assert.deepEqual(getTransportLayerVisibility({ ...defaults, liveVehicles: false }, new Set<TransportLayerId>()), {
    'mg-t-routes': true,
    'mg-t-route-label': true,
    'mg-t-stops': false,
    'mg-t-stop-label': false,
    'mg-t-vehicle-halo': false,
    'mg-t-vehicles': false,
    'mg-t-vehicle-label': false,
  });
});

test('the layers sheet keeps unknown providers selectable and does not fake unavailable features as switches', () => {
  const sheet = read('src/components/MapLayersControl.tsx');
  const unavailableRow = sheet.split('function UnavailableRow')[1]?.split('/** Mobile-first')[0] ?? '';
  const availability = read('src/map/layerAvailability.ts');
  const layerConfig = read('src/map/transportLayerConfig.ts');
  assert.match(sheet, /ids\.filter\(\(id\) => isLayerSelectable\(available, id\)\)/);
  assert.match(unavailableRow, /Недоступно/);
  assert.doesNotMatch(unavailableRow, /role="switch"|h-5 w-9/, 'unavailable capabilities must not look like clickable switches');
  assert.match(sheet, /return hasMapLayerRenderer\(item\.id\)[\s\S]*?<UnavailableRow key=\{item\.id\}[^>]*status="У маршрутах"/);
  assert.match(layerConfig, /isLayerSelectable = \(availability: Readonly<Record<string, boolean>> \| null, id: TransportLayerId\): boolean =>\s*hasMapLayerRenderer\(id\) && \(availability === null \|\| availability\[id\] === true\)/);
  assert.match(availability, /probeFailed = true;\s*\/\/ A failed check is not proof that every provider is unavailable\.[\s\S]*?availability = null;/);
  assert.doesNotMatch(availability.split('.catch(() => {')[1] ?? '', /setTransportLayers\(/, 'a failed check must not erase user selections');
});

test('display switches are applied to MapLibre and live-vehicle polling follows its switch', () => {
  const controller = read('src/map/transportLayers.ts');
  assert.match(controller, /getTransportLayerVisibility\(this\.display, this\.enabled\)/);
  assert.match(controller, /this\.map\.setLayoutProperty\(id, 'visibility', enabled \? 'visible' : 'none'\)/);
  assert.match(controller, /this\.pollTimer = this\.display\.liveVehicles && lineTypesFor\(this\.enabled\)\.length \? setInterval/);
  assert.match(controller, /if \(!this\.display\.liveVehicles \|\| !lines\.length[\s\S]{0,180}return;/);
});
