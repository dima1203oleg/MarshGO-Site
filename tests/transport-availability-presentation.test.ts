import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { staticBikeAvailabilityMessage, transportUnavailableMessage } from '../src/domain/transportAvailabilityPresentation';
import type { ApiTransportProviders } from '../src/services/productionApi';

const bikeNetwork: ApiTransportProviders[] = [{
  transportType: 'bike',
  providers: [{ id: 'bike:static', name: 'Static network', available: true, cities: ['Львів'], sources: ['static-bike-network-estimate'], services: ['bike'] }],
}];

describe('transport availability presentation', () => {
  it('distinguishes missing local coverage for a mode', () => {
    assert.match(transportUnavailableMessage('taxi', []) ?? '', /Немає підключеного провайдера/);
    assert.match(transportUnavailableMessage('bus', []) ?? '', /Немає підключеного провайдера/);
  });

  it('does not present static bike stations as live available bicycles', () => {
    assert.match(staticBikeAvailabilityMessage(bikeNetwork[0].providers[0].sources) ?? '', /наявність вільних велосипедів не підтверджена/);
    assert.equal(staticBikeAvailabilityMessage(['gbfs']), undefined);
  });
});
