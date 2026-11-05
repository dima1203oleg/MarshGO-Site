import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ProductionApiError, productionApi } from '../src/services/productionApi';

// The refresh cookie is httpOnly, so a cold start cannot read whether a session
// exists. These tests pin the local marker that decides whether asking the
// server is justified: no marker = no request, 401 = marker dropped, network
// failure = marker kept (a flaky link must not sign the passenger out).

type Call = { url: string; method: string };
const storage = new Map<string, string>();
let calls: Call[] = [];
let replies: Array<() => Response> = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const qaUser = { id: 'u1', display_name: 'Тест', phone_e164: '+380500000000', roles: ['passenger'], is_verified: true };

beforeEach(() => {
  storage.clear();
  calls = [];
  replies = [];
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    location: { href: 'https://example.test/' },
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET' });
    const reply = replies.shift();
    if (!reply) throw new Error(`unexpected request ${url}`);
    return reply();
  };
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { fetch?: unknown }).fetch;
});

describe('cold-start session restore', () => {
  it('does not ask the server for a session this browser never had', async () => {
    assert.equal(await productionApi.restoreSession(), null);
    assert.deepEqual(calls, []);
  });

  it('restores a session when the marker exists and drops the marker on a 401', async () => {
    storage.set('mg_session_hint', '1');
    replies.push(() => jsonResponse({ data: { user: qaUser, accessToken: 'token-1' } }));
    const restored = await productionApi.restoreSession();
    assert.equal(restored?.id, 'u1');
    assert.equal(storage.get('mg_session_hint'), '1');
    assert.match(calls[0].url, /\/api\/v1\/auth\/refresh$/);
    assert.equal(calls[0].method, 'POST');

    storage.set('mg_session_hint', '1');
    replies.push(() => jsonResponse({ error: { code: 'unauthorized', message: 'No session' } }, 401));
    await assert.rejects(
      () => productionApi.restoreSession(),
      (error: unknown) => error instanceof ProductionApiError && error.status === 401,
    );
    assert.equal(storage.has('mg_session_hint'), false, 'an expired cookie must not keep the marker alive');
  });

  it('keeps the marker when the server is unreachable', async () => {
    storage.set('mg_session_hint', '1');
    replies.push(() => { throw new TypeError('Failed to fetch'); });
    await assert.rejects(
      () => productionApi.restoreSession(),
      (error: unknown) => error instanceof ProductionApiError,
    );
    assert.equal(storage.get('mg_session_hint'), '1', 'a network failure is not a signed-out state');
  });
});
