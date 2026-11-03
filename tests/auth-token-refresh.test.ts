import assert from 'node:assert/strict';
import test from 'node:test';
import { productionApi } from '../src/services/productionApi';

// The 401 branch of requestEnvelope is the only place the client decides to spend a
// refresh and to replay a request. Until now nothing executed it: every other test
// imports this module for its types only.

const OFFERS_PATH = '/api/v1/offers?origin=%D0%9B%D1%8C%D0%B2%D1%96%D0%B2&destination=%D0%92%D0%BE%D0%BA%D0%B7%D0%B0%D0%BB&date=2026-11-04&seats=1';
const REFRESH_PATH = '/api/v1/auth/refresh';
const LOGIN_PATH = '/api/v1/auth/login';
const route = { origin: 'Львів', destination: 'Вокзал', date: '2026-11-04', seats: 1 };

const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), {
  status,
  headers: { 'content-type': 'application/json' },
});
const session = (accessToken: string) => json({ user: { id: 'user-1', displayName: 'Рідер' }, accessToken });

/** Installs a fetch stub that records every call and lets a test decide the reply. */
function installFetch(respond: (path: string, auth: string | null, calls: Call[]) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = String(input);
    const auth = new Headers(init.headers).get('authorization');
    const call = { path, auth };
    calls.push(call);
    return respond(path, auth, calls);
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

type Call = { path: string; auth: string | null };

const signIn = (email = 'rider@example.test') => productionApi.login(email, 'secret');
const loadOffers = () => productionApi.offers(route);
const offersCalls = (calls: Call[]) => calls.filter((call) => call.path === OFFERS_PATH);

test('a 401 spends exactly one refresh and replays the original request once', async () => {
  const stub = installFetch((path, auth) => {
    if (path === LOGIN_PATH) return session('token-1');
    if (path === REFRESH_PATH) return session('token-2');
    return auth === 'Bearer token-1' ? json({ message: 'expired' }, 401) : json([]);
  });
  try {
    await signIn();
    assert.deepEqual(await loadOffers(), []);
    assert.deepEqual(stub.calls.map((call) => call.path), [LOGIN_PATH, OFFERS_PATH, REFRESH_PATH, OFFERS_PATH]);
    assert.equal(offersCalls(stub.calls).length, 2, 'one rejection, one replay — never a third attempt');
    assert.equal(stub.calls.at(-1)?.auth, 'Bearer token-2');
  } finally {
    stub.restore();
  }
});

test('a refresh that also answers 401 fails once instead of looping', async () => {
  const stub = installFetch((path) => (path === LOGIN_PATH ? session('token-1') : json({ message: 'session expired' }, 401)));
  try {
    await signIn();
    const error = await loadOffers().then(() => null, (reason) => reason);
    assert.equal(error?.name, 'ProductionApiError');
    assert.equal(error?.status, 401);
    assert.deepEqual(stub.calls.map((call) => call.path), [LOGIN_PATH, OFFERS_PATH, REFRESH_PATH]);
    assert.equal(offersCalls(stub.calls).length, 1, 'a refresh that failed must not replay the request');
  } finally {
    stub.restore();
  }
});

test('auth endpoints themselves never trigger a refresh', async () => {
  const stub = installFetch(() => json({ message: 'bad password' }, 401));
  try {
    const error = await signIn().then(() => null, (reason) => reason);
    assert.equal(error?.status, 401);
    assert.deepEqual(stub.calls.map((call) => call.path), [LOGIN_PATH]);
  } finally {
    stub.restore();
  }
});

test('parallel 401s share one refresh instead of stampeding the auth endpoint', async () => {
  const stub = installFetch((path, auth) => {
    if (path === LOGIN_PATH) return session('token-1');
    if (path === REFRESH_PATH) return session('token-2');
    return auth === 'Bearer token-1' ? json({ message: 'expired' }, 401) : json([]);
  });
  try {
    await signIn();
    assert.deepEqual(await Promise.all([loadOffers(), loadOffers(), loadOffers()]), [[], [], []]);
    assert.equal(stub.calls.filter((call) => call.path === REFRESH_PATH).length, 1, 'three callers, one refresh');
    assert.equal(offersCalls(stub.calls).length, 6, 'three rejections plus three replays');
    assert.deepEqual(offersCalls(stub.calls).slice(3).map((call) => call.auth), ['Bearer token-2', 'Bearer token-2', 'Bearer token-2']);
  } finally {
    stub.restore();
  }
});

test('a token that changed while the refresh was in flight wins over the refresh result', async () => {
  let resolveRefreshGate: (reply: Response) => void = () => {};
  const refreshGate = new Promise<Response>((resolve) => { resolveRefreshGate = resolve; });
  let signalRefreshStarted: () => void = () => {};
  const refreshStarted = new Promise<void>((resolve) => { signalRefreshStarted = resolve; });

  let logins = 0;
  const stub = installFetch((path, auth, calls) => {
    if (path === LOGIN_PATH) {
      logins += 1;
      // numbered by call, not by the incoming header: the module token survives between tests
      return session(logins === 1 ? 'token-1' : 'token-3');
    }
    if (path === REFRESH_PATH) {
      signalRefreshStarted();
      return refreshGate;
    }
    // only the very first offer attempt is rejected, so the failure below is about the
    // token the replay chose, not about the replay succeeding at all
    return calls.filter((call) => call.path === OFFERS_PATH).length === 1 ? json({ message: 'expired' }, 401) : json([]);
  });
  try {
    await signIn(); // seeds token-1
    const inFlight = loadOffers();
    await refreshStarted;
    await signIn('someone-else@example.test'); // the rider signs in again while the refresh is pending
    resolveRefreshGate(session('token-2')); // the previous session answers late
    assert.deepEqual(await inFlight, [], 'the request still resolves');
    const replay = offersCalls(stub.calls).at(-1);
    assert.equal(replay?.auth, 'Bearer token-3', 'a stale refresh must not overwrite the newest login token');
  } finally {
    stub.restore();
  }
});
