import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coordinateMapPlace, geolocationFailureMessage, getBrowserPosition, placeSearchFailureMessage } from '../src/domain/mapPointSelection';

test('map selection remains a valid coordinate when reverse geocoding is unavailable', () => {
  assert.deepEqual(coordinateMapPlace(49.8419, 24.0315), {
    label: 'Точка на мапі (49.8419, 24.0315)',
    latitude: 49.8419,
    longitude: 24.0315,
    providerId: 'map-pin',
  });
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

test('place search turns expired sessions and unavailable geocoders into actionable Ukrainian messages', () => {
  assert.match(placeSearchFailureMessage(new Error('Authentication required')), /Увійдіть у MARSHGO/);
  assert.match(placeSearchFailureMessage(new Error('Geocoder request failed')), /Пошук адрес зараз недоступний/);
  assert.match(placeSearchFailureMessage(new Error('Пошук не спрацював')), /Пошук не спрацював/);
});
