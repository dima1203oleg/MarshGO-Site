import assert from 'node:assert/strict';
import test from 'node:test';
import { savedJourneySearchPlaces } from '../src/routing/savedJourneySearch';

test('restores the first origin and final destination as selected coordinate places', () => {
  const places = savedJourneySearchPlaces([
    {
      origin: { name: '  Львів  ', coordinates: [24.03, 49.84] },
      destination: { name: 'Проміжна зупинка', coordinates: [24.04, 49.85] },
    },
    {
      origin: { name: 'Проміжна зупинка', coordinates: [24.04, 49.85] },
      destination: { name: 'Стрий', coordinates: [23.86, 49.26] },
    },
  ]);

  assert.deepEqual(places, {
    origin: { label: 'Львів', latitude: 49.84, longitude: 24.03, providerId: 'saved-route-coordinate' },
    destination: { label: 'Стрий', latitude: 49.26, longitude: 23.86, providerId: 'saved-route-coordinate' },
  });
});

test('rejects missing endpoints, blank names, and out-of-range coordinates', () => {
  assert.equal(savedJourneySearchPlaces([]), null);
  assert.equal(savedJourneySearchPlaces([{
    origin: { name: ' ', coordinates: [24.03, 49.84] },
    destination: { name: 'Стрий', coordinates: [23.86, 49.26] },
  }]), null);
  assert.equal(savedJourneySearchPlaces([{
    origin: { name: 'Львів', coordinates: [24.03, 91] },
    destination: { name: 'Стрий', coordinates: [23.86, 49.26] },
  }]), null);
});
