import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coordinateMapPlace, createReverseLookupGate, geolocationFailureMessage, getBrowserPosition, placeSearchFailureMessage, resolvePlaceAtCoordinates } from '../src/domain/mapPointSelection';

test('map selection remains a valid coordinate when reverse geocoding is unavailable', () => {
  assert.deepEqual(coordinateMapPlace(49.8419, 24.0315), {
    label: 'Точка на мапі (49.8419, 24.0315)',
    latitude: 49.8419,
    longitude: 24.0315,
    providerId: 'map-pin',
  });
});

test('GPS search keeps the real coordinate when reverse geocoding is unavailable', async () => {
  const result = await resolvePlaceAtCoordinates(49.8419, 24.0315, async () => { throw new Error('geocoder unavailable'); });
  assert.equal(result.addressResolved, false);
  assert.deepEqual(result.place, coordinateMapPlace(49.8419, 24.0315));
});

test('GPS reverse geocoding keeps the device coordinate rather than snapping the search point', async () => {
  const result = await resolvePlaceAtCoordinates(49.8419, 24.0315, async () => ({
    label: 'Площа Ринок', latitude: 49.8420, longitude: 24.0316, providerId: 'photon:place-1',
  }));
  assert.equal(result.addressResolved, true);
  assert.deepEqual(result.place, { label: 'Площа Ринок', latitude: 49.8419, longitude: 24.0315, providerId: 'photon:place-1' });
});

test('GPS errors distinguish denied access, unavailable position, timeout, and unknown failure', () => {
  assert.match(geolocationFailureMessage(1), /відхилили доступ/);
  assert.match(geolocationFailureMessage(2), /системну геолокацію або оберіть точку на мапі/);
  assert.match(geolocationFailureMessage(3), /вчасно.*оберіть точку на мапі/);
  assert.match(geolocationFailureMessage(), /системну геолокацію або оберіть точку на мапі/);
});

test('browser location retries with a coarse cached fix after high-accuracy timeout', async () => {
  const options: PositionOptions[] = [];
  const position = { coords: { latitude: 49.8419, longitude: 24.0315, accuracy: 800 }, timestamp: Date.now() } as GeolocationPosition;
  const geolocation: Pick<Geolocation, 'getCurrentPosition'> = {
    getCurrentPosition(success, error, requestOptions) {
      options.push(requestOptions ?? {});
      if (options.length === 1) error?.({ code: 3, message: 'timeout' } as GeolocationPositionError);
      else success(position);
    },
  };

  assert.equal(await getBrowserPosition(geolocation), position);
  assert.deepEqual(options, [
    { enableHighAccuracy: true, maximumAge: 0, timeout: 8_000 },
    { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
  ]);
});

test('map picker reverse geocodes a settled point once, even when moveend repeats', () => {
  const gate = createReverseLookupGate();
  assert.equal(gate.shouldLookup(49.8397, 24.0297), true);
  assert.equal(gate.shouldLookup(49.8397, 24.0297), false, 'a resize-induced moveend must not repeat the rate-limited lookup');
  assert.equal(gate.shouldLookup(49.83970, 24.02970), false, 'map jitter under ~11 m is the same point');
  assert.equal(gate.shouldLookup(49.8400, 24.0297), true, 'a visible pan is a new point');
  assert.equal(gate.shouldLookup(49.8397, 24.0297), true, 'returning to a point after another one is a new lookup');
});

test('map picker tap re-runs a failed reverse geocode for the same point', () => {
  const gate = createReverseLookupGate();
  assert.equal(gate.shouldLookup(49.8397, 24.0297), true);
  gate.forget();
  assert.equal(gate.shouldLookup(49.8397, 24.0297), true);
});

test('reverse lookup gate keys coordinates on both sides of zero distinctly', () => {
  const gate = createReverseLookupGate();
  assert.equal(gate.shouldLookup(-0.0001, 24.0297), true);
  assert.equal(gate.shouldLookup(0.0001, 24.0297), true);
  assert.equal(gate.shouldLookup(-0.0001, 24.0297), true);
});

test('place search turns expired sessions and unavailable geocoders into actionable Ukrainian messages', () => {
  assert.match(placeSearchFailureMessage(new Error('Authentication required')), /Увійдіть у MARSHGO/);
  assert.match(placeSearchFailureMessage(new Error('Geocoder request failed')), /Пошук адрес зараз недоступний/);
  assert.match(placeSearchFailureMessage(new Error('Пошук не спрацював')), /Пошук не спрацював/);
});
