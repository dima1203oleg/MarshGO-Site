import type { ApiPlace } from '../services/productionApi';

/** A map-selected coordinate remains usable when reverse geocoding is offline. */
export function coordinateMapPlace(latitude: number, longitude: number): ApiPlace {
  return {
    label: `Точка на мапі (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
    latitude,
    longitude,
    providerId: 'map-pin',
  };
}

/** Do not misreport device/signal failures as a denied browser permission. */
export function geolocationFailureMessage(code?: number): string {
  if (code === 1) return 'Браузер або налаштування пристрою відхилили доступ до геолокації.';
  if (code === 2) return 'Пристрій не повернув координати. Перевірте системну геолокацію або оберіть точку на мапі.';
  if (code === 3) return 'Служба геолокації не повернула координати вчасно. Перевірте геолокацію пристрою або оберіть точку на мапі.';
  return 'Не вдалося отримати координати. Перевірте доступ сайту й системну геолокацію або оберіть точку на мапі.';
}

/** Try a precise browser fix, then retry with cached/coarse location when GPS times out. */
export function getBrowserPosition(geolocation: Pick<Geolocation, 'getCurrentPosition'>): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, (error) => {
      if (error.code === 1) {
        reject(error);
        return;
      }
      geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 15_000,
      });
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 8_000 });
  });
}

/** Turn expected place-service failures into an actionable Ukrainian message. */
export function placeSearchFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/authentication required|unauthorized|\b401\b/i.test(message)) {
    return 'Увійдіть у MARSHGO, щоб отримувати підказки адрес.';
  }
  if (/geocoder|геокодер|place search|пошук місця недоступний/i.test(message)) {
    return 'Пошук адрес зараз недоступний. Спробуйте пізніше або оберіть точку на мапі.';
  }
  return message || 'Не вдалося знайти адресу. Спробуйте ще раз або оберіть точку на мапі.';
}
