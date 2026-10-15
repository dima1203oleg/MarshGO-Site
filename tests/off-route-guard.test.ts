import test from 'node:test';
import assert from 'node:assert/strict';
import { OffRouteGuard } from '../src/navigation/OffRouteGuard';

test('requires consecutive deviations, clears on-route noise and cools down reroutes', () => {
  const guard = new OffRouteGuard(2, 30_000);
  assert.deepEqual(guard.observe(false, 0), { confirmedOffRoute: false, requestReroute: false });
  assert.deepEqual(guard.observe(true, 5_000), { confirmedOffRoute: false, requestReroute: false });
  assert.deepEqual(guard.observe(false, 10_000), { confirmedOffRoute: false, requestReroute: false });
  assert.deepEqual(guard.observe(false, 20_000), { confirmedOffRoute: true, requestReroute: true });
  assert.deepEqual(guard.observe(false, 25_000), { confirmedOffRoute: true, requestReroute: false });
  assert.deepEqual(guard.observe(false, 51_000), { confirmedOffRoute: true, requestReroute: true });
});
