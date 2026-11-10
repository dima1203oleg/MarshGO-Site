import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { allTransportLayerIds, isLayerSelectable, layerUnavailableNote, unavailableLayerIds } from '../src/map/transportLayerConfig';

/** The server's `/transport/layers` answer for the acceptance stack: public transit yes, private modes no. */
const kyivLike = {
  PUBLIC_TRANSPORT: true, BUS: true, MINIBUS: true, TROLLEYBUS: true, TRAM: true, METRO: true, TRAIN: true,
  CITY_TRAIN: false, FUNICULAR: false, STOPS: true, CARPOOL: false, TAXI: false, TRANSFER: false,
  BICYCLE: false, SCOOTER: false, CARSHARING: false, RENTAL_POINTS: false,
};

describe('layer availability gating', () => {
  it('covers every layer id the map controls address, so no control falls outside the probe', () => {
    assert.deepEqual([...allTransportLayerIds].sort(), Object.keys(kyivLike).sort());
  });

  it('keeps a control usable until the server confirms it cannot serve it', () => {
    assert.equal(isLayerSelectable(null, 'BICYCLE'), true);
    assert.equal(isLayerSelectable(kyivLike, 'METRO'), true);
    assert.equal(isLayerSelectable(kyivLike, 'BICYCLE'), false);
  });

  it('does not expose transport modes as map switches when no overlay renderer exists', () => {
    const allAvailable = Object.fromEntries(allTransportLayerIds.map((id) => [id, true]));
    assert.equal(isLayerSelectable(null, 'BUS'), true);
    assert.equal(isLayerSelectable(allAvailable, 'CARPOOL'), false);
    assert.equal(isLayerSelectable(allAvailable, 'TAXI'), false);
    assert.equal(isLayerSelectable(allAvailable, 'TRANSFER'), false);
    assert.deepEqual(unavailableLayerIds(allAvailable).sort(), ['CARPOOL', 'TAXI', 'TRANSFER']);
  });

  it('reports exactly the layers that must be switched off and shown as no data', () => {
    assert.deepEqual(unavailableLayerIds(kyivLike).sort(), ['BICYCLE', 'CARPOOL', 'CARSHARING', 'CITY_TRAIN', 'FUNICULAR', 'RENTAL_POINTS', 'SCOOTER', 'TAXI', 'TRANSFER'].sort());
  });

  it('does not claim missing data when the availability probe itself failed', () => {
    assert.equal(layerUnavailableNote(false), 'немає даних');
    assert.equal(layerUnavailableNote(true), 'перевірка не вдалася');
  });

  it('has both the quick chips and the layers sheet read the one shared availability store', () => {
    const chips = readFileSync('src/views/TransportMapView.tsx', 'utf8');
    const sheet = readFileSync('src/components/MapLayersControl.tsx', 'utf8');
    assert.match(chips, /from '\.\.\/map\/layerAvailability'/);
    assert.match(sheet, /from '\.\.\/map\/layerAvailability'/);
    assert.match(chips, /isLayerSelectable\(layerState\.availability, id\)/);
    assert.doesNotMatch(sheet, /productionApi\.transportLayerAvailability/, 'the sheet must not probe availability on its own');
  });
});
