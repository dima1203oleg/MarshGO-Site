import test from 'node:test';
import assert from 'node:assert/strict';
import { pathForProductionEntity, pathForProductionTab, productionRouteForPath, productionTabForPath } from '../src/routing/productionRoutes';

test('production tab routes are refresh-safe and normalize trailing slashes', () => {
  const tabs = ['home', 'search', 'trips', 'chat', 'profile', 'demand', 'requests', 'my-demands', 'offer-new', 'admin', 'navigation'] as const;
  for (const tab of tabs) {
    assert.equal(productionTabForPath(pathForProductionTab(tab)), tab);
    assert.equal(productionTabForPath(`${pathForProductionTab(tab)}/`), tab);
  }
  assert.equal(productionTabForPath('/unknown'), null);
  assert.equal(productionTabForPath('/navigation'), 'navigation');
  assert.equal(productionTabForPath('/navigation/'), 'navigation');
});

test('entity deep links resolve to the owning production view and reject unsafe IDs', () => {
  const cases = [
    ['offer', 'search', '/offers/offer_123'],
    ['booking', 'trips', '/bookings/booking_123'],
    ['demand', 'my-demands', '/demands/demand_123'],
    ['journey', 'trips', '/journeys/journey_123'],
    ['conversation', 'chat', '/messages/conversation_123'],
  ] as const;
  for (const [kind, tab, path] of cases) {
    const id = path.split('/').at(-1)!;
    assert.equal(pathForProductionEntity(kind, id), path);
    assert.deepEqual(productionRouteForPath(path), { kind, tab, entityId: id });
    assert.equal(productionTabForPath(`${path}/`), tab);
  }
  assert.equal(productionRouteForPath('/messages/%2Fprivate'), null);
  assert.equal(productionRouteForPath('/bookings/'), null);
  assert.deepEqual(productionRouteForPath('/offers/new'), { kind: 'tab', tab: 'offer-new', entityId: null });
});
