export type MapDisplayPreferenceId = 'routeLines' | 'liveVehicles' | 'routeNumbers';
export type MapDisplayPreferences = Record<MapDisplayPreferenceId, boolean>;

const STORAGE_KEY = 'marshgo.map.display.v1';
const defaults: MapDisplayPreferences = { routeLines: true, liveVehicles: true, routeNumbers: true };
const listeners = new Set<(preferences: MapDisplayPreferences) => void>();

export function normalizeMapDisplayPreferences(value: unknown): MapDisplayPreferences {
  if (!value || typeof value !== 'object') return { ...defaults };
  const candidate = value as Partial<Record<MapDisplayPreferenceId, unknown>>;
  return {
    routeLines: typeof candidate.routeLines === 'boolean' ? candidate.routeLines : defaults.routeLines,
    liveVehicles: typeof candidate.liveVehicles === 'boolean' ? candidate.liveVehicles : defaults.liveVehicles,
    routeNumbers: typeof candidate.routeNumbers === 'boolean' ? candidate.routeNumbers : defaults.routeNumbers,
  };
}

export function getMapDisplayPreferences(): MapDisplayPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeMapDisplayPreferences(JSON.parse(stored)) : { ...defaults };
  } catch { return { ...defaults }; }
}

export function setMapDisplayPreference(id: MapDisplayPreferenceId, enabled: boolean) {
  const next = { ...getMapDisplayPreferences(), [id]: enabled };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Keep the in-memory preference for this session. */ }
  listeners.forEach((listener) => listener(next));
}

export function subscribeMapDisplayPreferences(listener: (preferences: MapDisplayPreferences) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
