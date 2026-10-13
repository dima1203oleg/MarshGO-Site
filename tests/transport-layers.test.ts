import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cityTransportLayerIds, lineTypesFor, microTypesFor, transportLayerList } from '../src/map/transportLayerConfig';

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
});
