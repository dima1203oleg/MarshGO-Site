import assert from 'node:assert/strict';
import test from 'node:test';
import { withAuthRefreshLock, type AuthRefreshLockManager } from '../src/services/authRefreshLock';

function createLockManager(): AuthRefreshLockManager {
  const queues = new Map<string, Promise<void>>();
  return {
    request<T>(name: string, _options: LockOptions, callback: LockGrantedCallback<T>): Promise<T> {
      const previous = queues.get(name) ?? Promise.resolve();
      let release = () => {};
      const current = new Promise<void>((resolve) => { release = resolve; });
      queues.set(name, previous.then(() => current));
      return previous.then(async () => {
        try { return await callback(null); }
        finally { release(); }
      });
    },
  };
}

test('single-use refresh rotation is serialized across tabs sharing an origin', async () => {
  const locks = createLockManager();
  let cookie = 'refresh-0';
  let rotations = 0;
  const used = new Set<string>();
  const refresh = () => withAuthRefreshLock(async () => {
    const submitted = cookie;
    await Promise.resolve();
    if (used.has(submitted)) throw new Error('refresh token reuse revoked the session family');
    used.add(submitted);
    cookie = `refresh-${++rotations}`;
    return cookie;
  }, locks);

  const results = await Promise.all([refresh(), refresh()]);
  assert.deepEqual(results.sort(), ['refresh-1', 'refresh-2']);
  assert.equal(rotations, 2);
});

test('refresh proceeds normally where Web Locks are unavailable', async () => {
  let called = false;
  const result = await withAuthRefreshLock(async () => {
    called = true;
    return 'refreshed';
  }, undefined);
  assert.equal(called, true);
  assert.equal(result, 'refreshed');
});
