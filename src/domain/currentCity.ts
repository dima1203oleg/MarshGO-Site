export type CurrentCitySource = 'manual' | 'gps' | 'unset';

export type CurrentCity = {
  name: string;
  source: CurrentCitySource;
  /** True only when the name came back from the approved place service or city registry. */
  verified: boolean;
};

export const EMPTY_CURRENT_CITY: CurrentCity = { name: '', source: 'unset', verified: false };
const CURRENT_CITY_KEY = 'marshgo.current-city.v1';
const RECENT_CITIES_KEY = 'marshgo.recent-cities.v1';
const STREET_OR_POINT = /^(вул|вулиц|просп|проспект|пр-кт|бульвар|бул|б-р|пров|провул|переулок|наб|набереж|площ|пл|шосе|шос|street|avenue|road|lane|square|station|аеропорт|вокзал|зупин|станц)/i;
const ADMIN_OR_COUNTRY = /(област|район|громада|Україн|ukraine|oblast|raion|hromada|району)/i;
const HOUSE_NUMBER = /^\d{1,4}\s*[a-zа-яіїєґ']{0,2}\.?$/i;

export function parseCurrentCity(raw: string | null | undefined): CurrentCity {
  if (!raw) return EMPTY_CURRENT_CITY;
  try {
    const value = JSON.parse(raw) as Partial<CurrentCity>;
    const name = typeof value.name === 'string' ? value.name.trim().slice(0, 80) : '';
    const source: CurrentCitySource = value.source === 'manual' || value.source === 'gps' ? value.source : 'unset';
    if (!name || source === 'unset') return EMPTY_CURRENT_CITY;
    return { name, source, verified: value.verified === true };
  } catch {
    return EMPTY_CURRENT_CITY;
  }
}

export function parseRecentCities(raw: string | null | undefined): CurrentCity[] {
  if (!raw) return [];
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    const unique = new Map<string, CurrentCity>();
    for (const value of values) {
      const serialized = JSON.stringify(value);
      if (typeof serialized !== 'string') continue;
      const city = parseCurrentCity(serialized);
      const key = city.name.toLocaleLowerCase('uk-UA');
      if (city.name && !unique.has(key)) unique.set(key, city);
      if (unique.size === 5) break;
    }
    return [...unique.values()];
  } catch {
    return [];
  }
}

/** Geocoder labels are specific-first; skip streets, house numbers and administrative regions. */
export function cityNameFromPlaceLabel(label: string | null | undefined): string {
  const parts = (label ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  const city = parts.find((part) => !STREET_OR_POINT.test(part) && !HOUSE_NUMBER.test(part) && !ADMIN_OR_COUNTRY.test(part));
  return (city ?? '').slice(0, 80);
}

export function canAutoDetectCity(city: CurrentCity, permission: PermissionState | 'unsupported'): boolean {
  return city.source !== 'manual' && permission === 'granted';
}

/** Ignore a GPS result when the user changed the city after that request began. */
export function isCurrentCityRequest(requestRevision: number, currentRevision: number): boolean {
  return requestRevision === currentRevision;
}

export function loadCurrentCity(): CurrentCity {
  if (typeof window === 'undefined') return EMPTY_CURRENT_CITY;
  try { return parseCurrentCity(window.localStorage.getItem(CURRENT_CITY_KEY)); } catch { return EMPTY_CURRENT_CITY; }
}

export function loadRecentCities(): CurrentCity[] {
  if (typeof window === 'undefined') return [];
  try { return parseRecentCities(window.localStorage.getItem(RECENT_CITIES_KEY)); } catch { return []; }
}

export function saveCurrentCity(city: CurrentCity): void {
  if (typeof window === 'undefined' || !city.name || city.source === 'unset') return;
  try {
    window.localStorage.setItem(CURRENT_CITY_KEY, JSON.stringify(city));
    const recent = loadRecentCities().filter((entry) => entry.name.toLocaleLowerCase('uk-UA') !== city.name.toLocaleLowerCase('uk-UA'));
    window.localStorage.setItem(RECENT_CITIES_KEY, JSON.stringify([city, ...recent].slice(0, 5)));
  } catch { /* Storage can be disabled; the in-memory city remains usable. */ }
}
