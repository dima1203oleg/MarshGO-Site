// MARSHGO Geolocation & Proximity Service
// Resolves GPS coordinates to Ukrainian cities and regions with fallback

export interface DetectedLocation {
  city: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

// Major Ukrainian reference coordinates for fast offline fallback and nearest-city mapping
const UKRAINIAN_CITIES = [
  { name: 'Київ', lat: 50.4501, lng: 30.5234, address: 'Київ (Центр / Метро)' },
  { name: 'Одеса', lat: 46.4825, lng: 30.7233, address: 'Одеса (Центральний автовокзал)' },
  { name: 'Львів', lat: 49.8397, lng: 24.0297, address: 'Львів (Залізничний вокзал / Стрийська)' },
  { name: 'Стрий', lat: 49.2562, lng: 23.8514, address: 'Стрий (Центр / Траса М-06)' },
  { name: 'Дніпро', lat: 48.4647, lng: 35.0462, address: 'Дніпро (Центр)' },
  { name: 'Харків', lat: 49.9935, lng: 36.2304, address: 'Харків (Холодна гора)' },
  { name: 'Вінниця', lat: 49.2331, lng: 28.4682, address: 'Вінниця (Західний автовокзал)' },
  { name: 'Івано-Франківськ', lat: 48.9226, lng: 24.7111, address: 'Івано-Франківськ (Вокзал)' },
  { name: 'Чернівці', lat: 48.2917, lng: 25.9354, address: 'Чернівці (Головний автовокзал)' },
  { name: 'Умань', lat: 48.7484, lng: 30.2218, address: 'Умань (Траса М-05 / Софіївка)' },
  { name: 'Біла Церква', lat: 49.7989, lng: 30.1153, address: 'Біла Церква (Траса М-05)' },
  { name: 'Житомир', lat: 50.2547, lng: 28.6587, address: 'Житомир (Київське шосе)' },
  { name: 'Рівне', lat: 50.6199, lng: 26.2516, address: 'Рівне (Автовокзал Чайка)' },
  { name: 'Тернопіль', lat: 49.5535, lng: 25.5948, address: 'Тернопіль (Центральний автовокзал)' },
  { name: 'Полтава', lat: 49.5883, lng: 34.5514, address: 'Полтава (Київський вокзал)' },
  { name: 'Черкаси', lat: 49.4444, lng: 32.0598, address: 'Черкаси (Центр)' },
  { name: 'Миколаїв', lat: 46.975, lng: 31.9946, address: 'Миколаїв (Центральний проспект)' },
  { name: 'Запоріжжя', lat: 47.8388, lng: 35.1396, address: 'Запоріжжя (Соборний проспект)' }
];

// Great circle distance in kilometers
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findNearestUkrainianCity(lat: number, lng: number): DetectedLocation {
  let closest = UKRAINIAN_CITIES[0];
  let minDistance = calculateDistanceKm(lat, lng, closest.lat, closest.lng);

  for (const city of UKRAINIAN_CITIES) {
    const dist = calculateDistanceKm(lat, lng, city.lat, city.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = city;
    }
  }

  return {
    city: closest.name,
    formattedAddress: minDistance < 15 ? closest.address : `${closest.name} (поруч)`,
    latitude: lat,
    longitude: lng,
    accuracyMeters: Math.round(minDistance * 1000)
  };
}

export interface GeolocationResult {
  success: boolean;
  location?: DetectedLocation;
  error?: string;
  isPermissionDenied?: boolean;
}

export async function detectCurrentLocation(): Promise<GeolocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      success: false,
      error: 'Геолокація не підтримується вашим браузером.'
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const nearest = findNearestUkrainianCity(latitude, longitude);
        resolve({
          success: true,
          location: {
            ...nearest,
            accuracyMeters: Math.round(accuracy)
          }
        });
      },
      (err) => {
        let msg = 'Не вдалося визначити місцезнаходження.';
        let isDenied = false;

        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Доступ до геолокації відхилено у налаштуваннях браузера.';
          isDenied = true;
        } else if (err.code === err.TIMEOUT) {
          msg = 'Час очікування GPS-сигналу вичерпано.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Дані про геолокацію наразі недоступні.';
        }

        resolve({
          success: false,
          error: msg,
          isPermissionDenied: isDenied
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}
