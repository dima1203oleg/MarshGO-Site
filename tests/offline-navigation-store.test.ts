import test from 'node:test';
import assert from 'node:assert/strict';
import { OfflineNavigationStore } from '../src/navigation/OfflineNavigationStore';
import { initialNavigationState } from '../src/navigation/NavigationCore';
import { encodePolyline6, boundsOf } from '../shared/navigation/geometry';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test('offline snapshot validates and persists route/session only, then clears it at session end', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  try {
    const points: [number, number][] = [[24, 49], [25, 50]];
    const route = {
      id: 's1', provider: 'osrm', geometry: { encoding: 'polyline6' as const, value: encodePolyline6(points) }, bounds: boundsOf(points),
      distanceMeters: 10000, durationSeconds: 900, trafficAware: false, legs: [], maneuvers: [], confidence: 'BASELINE' as const,
      calculatedAt: new Date().toISOString(), routeVersion: 1,
    };
    const state = { ...initialNavigationState(), sessionId: 's1', route, routeVersion: 1 };
    const session = {
      id: 's1', state: 'active' as const, destination_name: 'Lviv', route_distance_m: 10000, route_duration_s: 900, route_version: 1,
      opt_in: true, matching_vehicle_available: true, vehicle_seat_count: 4, started_at: new Date().toISOString(), route: points,
    };
    const store = new OfflineNavigationStore();
    store.save(state, session);
    const snapshot = store.readLatest();
    assert.equal(snapshot?.sessionId, 's1');
    assert.equal(snapshot?.session.opt_in, false);
    assert.equal(snapshot?.route.geometry.encoding, 'polyline6');
    const stored = localStorage.getItem('marshgo.navigation.offline.v1.s1') ?? '';
    assert.equal(stored.includes('current_location'), false);
    assert.equal(stored.includes('accuracyMeters'), false);
    store.clear('s1');
    assert.equal(store.readLatest(), null);
    store.save({ ...state, sessionId: 's1' }, { ...session, id: 's1' });
    store.save({ ...state, sessionId: 's2' }, { ...session, id: 's2' });
    store.clear();
    assert.equal(localStorage.length, 0, 'logout cleanup removes offline routes for every cached session');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
