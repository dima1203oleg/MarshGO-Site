import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  ActiveJourneyNavigationStore,
  activeJourneyNavigationKey,
  isOpenJourneyState,
  maximumActiveJourneyAgeMs,
} from '../src/navigation/ActiveJourneyNavigationStore';
import { productionRouteForPath, resumesActiveJourneyFrom } from '../src/routing/productionRoutes';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) { return this.values.get(key) ?? null; }

  setItem(key: string, value: string) { this.values.set(key, value); }

  removeItem(key: string) { this.values.delete(key); }

  get size() { return this.values.size; }

  raw() { return this.values.get(activeJourneyNavigationKey) ?? null; }
}

const journeyId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const otherJourneyId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const userId = '11111111-1111-4111-8111-111111111111';
const strangerId = '22222222-2222-4222-8222-222222222222';
/** The clock the store writes against, so a savedAt is always fresh here. */
const nowMs = Date.now();
const freshSavedAt = new Date(nowMs).toISOString();

function storeWithRecord(storage = new MemoryStorage()) {
  const store = new ActiveJourneyNavigationStore(storage);
  store.write({ journeyId, legIndex: 0, ownerUserId: userId });
  return { storage, store };
}

test('CP2: the record is one small pointer and nothing else', () => {
  const { storage, store } = storeWithRecord();
  assert.equal(storage.size, 1);
  assert.equal(activeJourneyNavigationKey, 'marshgo.active-journey-navigation.v1');
  const keys = Object.keys(JSON.parse(storage.raw()!)).sort();
  // Any field beyond these four would be a token, a coordinate or a price
  // snapshot the server can answer better and more honestly than the device.
  assert.deepEqual(keys, ['journeyId', 'legIndex', 'ownerUserId', 'savedAt']);
  assert.equal(store.read(nowMs)?.journeyId, journeyId);
});

test('CP2: a stored record cannot carry credentials, coordinates or GPS history', () => {
  const storage = new MemoryStorage();
  const store = new ActiveJourneyNavigationStore(storage);
  const accepted = store.write({
    journeyId,
    legIndex: 2,
    ownerUserId: userId,
    ...{ token: 'secret', latitude: 49.8419, longitude: 24.0315, gpsHistory: [[49.84, 24.03]] },
  } as never);
  assert.equal(accepted, true);
  const stored = JSON.parse(storage.raw()!) as Record<string, unknown>;
  assert.deepEqual(Object.keys(stored).sort(), ['journeyId', 'legIndex', 'ownerUserId', 'savedAt']);
  assert.equal(JSON.stringify(stored).includes('secret'), false);
  assert.equal(JSON.stringify(stored).includes('49.8419'), false);
});

test('CP2: only the account that started the journey may resume it', () => {
  const { storage, store } = storeWithRecord();
  assert.equal(store.readForUser(userId, nowMs)?.journeyId, journeyId);
  assert.equal(store.readForUser(strangerId, nowMs), null);
  // The stranger also removes it: an account switch must not leave a trail.
  assert.equal(storage.raw(), null);
  assert.equal(store.readForUser('', nowMs), null);
});

test('CP2: a journey older than the freshness window is dropped, not resumed', () => {
  const { storage, store } = storeWithRecord();
  const elevenHours = nowMs + maximumActiveJourneyAgeMs - 60 * 60 * 1000;
  assert.equal(store.read(elevenHours)?.journeyId, journeyId);
  assert.equal(store.read(nowMs + maximumActiveJourneyAgeMs + 1000), null);
  assert.equal(storage.raw(), null);
});

test('CP2: a broken or foreign record is removed instead of being trusted', () => {
  const storage = new MemoryStorage();
  const store = new ActiveJourneyNavigationStore(storage);
  storage.setItem(activeJourneyNavigationKey, 'not json');
  assert.equal(store.read(nowMs), null);
  assert.equal(storage.raw(), null);

  storage.setItem(activeJourneyNavigationKey, JSON.stringify({ journeyId, ownerUserId: userId, savedAt: freshSavedAt }));
  assert.equal(store.read(nowMs), null);

  storage.setItem(activeJourneyNavigationKey, JSON.stringify({ journeyId, legIndex: 1.5, ownerUserId: userId, savedAt: freshSavedAt }));
  assert.equal(store.read(nowMs), null);

  // An id that is not the router's allow-list could never be fetched safely.
  assert.equal(store.write({ journeyId: '../../admin', legIndex: 0, ownerUserId: userId }), false);
  assert.equal(store.write({ journeyId, legIndex: -1, ownerUserId: userId }), false);
  assert.equal(store.write({ journeyId, legIndex: 0, ownerUserId: 'a'.repeat(200) }), false);
  assert.equal(storage.raw(), null);
});

test('CP2: the stage follows the passenger and never resurrects a left journey', () => {
  const { store } = storeWithRecord();
  assert.equal(store.updateStage(journeyId, 3), true);
  assert.equal(store.read(nowMs)?.legIndex, 3);
  // A late callback for another journey — or after exit cleared the record —
  // must not put an old plan back on the screen.
  assert.equal(store.updateStage(otherJourneyId, 1), false);
  assert.equal(store.read(nowMs)?.legIndex, 3);
  store.clear();
  assert.equal(store.updateStage(journeyId, 4), false);
  assert.equal(store.read(nowMs), null);
});

test('CP2: a finished or cancelled plan is not an active journey', () => {
  assert.equal(isOpenJourneyState('PLANNED'), true);
  assert.equal(isOpenJourneyState('ACTIVE'), true);
  assert.equal(isOpenJourneyState('planned'), true);
  assert.equal(isOpenJourneyState('COMPLETED'), false);
  assert.equal(isOpenJourneyState('CANCELLED'), false);
  assert.equal(isOpenJourneyState('EXPIRED'), false);
  // An unknown state is treated as open: the server answer stays as it is and
  // the passenger is not silently thrown out of a journey they are riding.
  assert.equal(isOpenJourneyState(undefined), true);
  assert.equal(isOpenJourneyState('REPLANNING'), true);
});

test('CP2: without a browser storage the app degrades to no persistence', () => {
  const store = new ActiveJourneyNavigationStore(null);
  assert.equal(store.write({ journeyId, legIndex: 0, ownerUserId: userId }), false);
  assert.equal(store.read(nowMs), null);
  store.clear();
});

test('CP2: navigation is entered, exited and logged out through the store, not only through state', () => {
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/views/ProductionMarketplace.tsx'), 'utf8');
  assert.match(source, /onStartJourney=\{\(\) => startJourneyNavigation\(journey\)\}/);
  assert.match(source, /const exitJourneyNavigation = \(\) => \{\s*activeJourneyStore\.clear\(\);/);
  assert.match(source, /initialLegIndex=\{restoredNavigationStage\.current\}/);
  // Both logout paths drop the pointer; the next account on this device sees nothing.
  const logoutBodies = source.split('new OfflineNavigationStore().clear();').slice(1, 3);
  assert.equal(logoutBodies.length, 2);
  for (const body of logoutBodies) {
    assert.match(body.slice(0, 400), /exitJourneyNavigation\(\);/);
  }
  // Restoring is a server read: the record only names the journey.
  assert.match(source, /const journey = await productionApi\.journey\(entityId\);[\s\S]{0,200}resumeActiveNavigation\(journey\);/);
});

test('BOOT-ROUTE-HIJACK-1: only a reopen at the entry point may take over the screen', () => {
  assert.equal(resumesActiveJourneyFrom(productionRouteForPath('/')), true);
  // Tabs the passenger can ask for on purpose — a bookmark, a notification, a
  // shared link — must survive a pointer that is up to twelve hours old.
  for (const pathname of ['/map', '/navigate', '/trips', '/profile', '/journeys/search', '/demands', '/demands/mine', '/messages', '/admin/verification']) {
    assert.equal(resumesActiveJourneyFrom(productionRouteForPath(pathname)), false, pathname);
  }
  for (const pathname of [`/journeys/${journeyId}`, '/offers/offer-1', '/bookings/booking-1', '/messages/conversation-1']) {
    assert.equal(resumesActiveJourneyFrom(productionRouteForPath(pathname)), false, pathname);
  }
  assert.equal(resumesActiveJourneyFrom(null), false);
});

test('BOOT-ROUTE-HIJACK-1: the resume effect asks that rule instead of «any tab is overridable»', () => {
  const source = readFileSync(path.resolve(import.meta.dirname, '../src/views/ProductionMarketplace.tsx'), 'utf8');
  assert.match(source, /if \(!resumesActiveJourneyFrom\(route\)\) return;/);
  assert.doesNotMatch(source, /if \(route && route\.kind !== 'tab'\) return;/);
});
