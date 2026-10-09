import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { microTypesFor, transportLayerList } from '../src/map/transportLayerConfig';

describe('map transport layers', () => {
  it('shows carsharing separately and requests its live assets', () => {
    assert.ok(transportLayerList.some((layer) => layer.id === 'CARSHARING' && layer.label === 'Каршерінг'));
    assert.deepEqual(microTypesFor(new Set(['CARSHARING'])), ['carsharing']);
  });

  it('requests selected micromobility and carsharing types together', () => {
    assert.deepEqual(microTypesFor(new Set(['BICYCLE', 'SCOOTER', 'CARSHARING'])), ['bike', 'scooter', 'carsharing']);
  });
});
