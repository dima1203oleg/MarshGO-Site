import { z } from 'zod';
import { routeResultSchema } from '../../shared/navigation/contracts';
import type { NavigationState } from './NavigationCore';

const keyPrefix = 'marshgo.navigation.offline.v1.';
const offlineSnapshotSchema = z.object({
  sessionId: z.string().min(1),
  route: routeResultSchema,
  session: z.object({
    id: z.string().min(1), state: z.enum(['active', 'paused']), destination_name: z.string(),
    route_distance_m: z.number().nonnegative(), route_duration_s: z.number().nonnegative(), route_version: z.number().int().positive(),
    opt_in: z.boolean(), matching_vehicle_available: z.boolean(), vehicle_seat_count: z.number().nullable(),
    started_at: z.string(), route: z.array(z.tuple([z.number(), z.number()])),
  }),
  savedAt: z.string().datetime({ offset: true }),
});

/** Stores only the active route/session snapshot; never raw GPS history. */
export class OfflineNavigationStore {
  save(state: NavigationState, session: {
    id: string; state: string; destination_name: string; route_distance_m: number; route_duration_s: number;
    route_version: number; opt_in: boolean; matching_vehicle_available: boolean; vehicle_seat_count: number | null; started_at: string; route: [number, number][];
  } | null) {
    if (!state.sessionId || !state.route || typeof localStorage === 'undefined') return;
    if (!session || session.id !== state.sessionId || !['active', 'paused'].includes(session.state)) return;
    const snapshot = offlineSnapshotSchema.parse({ sessionId: state.sessionId, route: state.route, session: { ...session, state: session.state === 'paused' ? 'paused' : 'active', opt_in: false }, savedAt: new Date().toISOString() });
    localStorage.setItem(`${keyPrefix}${state.sessionId}`, JSON.stringify(snapshot));
  }

  read(sessionId: string) {
    if (typeof localStorage === 'undefined') return null;
    const value = localStorage.getItem(`${keyPrefix}${sessionId}`);
    if (!value) return null;
    try { return offlineSnapshotSchema.parse(JSON.parse(value)); }
    catch { localStorage.removeItem(`${keyPrefix}${sessionId}`); return null; }
  }

  readLatest() {
    if (typeof localStorage === 'undefined') return null;
    const snapshots = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(keyPrefix)) continue;
      const value = localStorage.getItem(key);
      if (!value) continue;
      try { snapshots.push(offlineSnapshotSchema.parse(JSON.parse(value))); }
      catch { localStorage.removeItem(key); index -= 1; }
    }
    const fresh = snapshots.filter((snapshot) => Date.now() - Date.parse(snapshot.savedAt) <= 24 * 60 * 60 * 1000);
    const freshIds = new Set(fresh.map((snapshot) => snapshot.sessionId));
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(keyPrefix) && !freshIds.has(key.slice(keyPrefix.length))) localStorage.removeItem(key);
    }
    return fresh
      .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0] ?? null;
  }

  clear(sessionId?: string | null) {
    if (typeof localStorage === 'undefined') return;
    if (sessionId) { localStorage.removeItem(`${keyPrefix}${sessionId}`); return; }
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(keyPrefix)) localStorage.removeItem(key);
    }
  }
}
