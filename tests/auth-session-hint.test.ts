import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ProductionApiError, productionApi } from '../src/services/productionApi';

// The refresh cookie is httpOnly, so a cold start cannot read whether a session
// exists. Always ask the server: valid cookies restore, 401 means anonymous, and
// network failure is surfaced without pretending the user signed out.

type Call = { url: string; method: string; authorization: string | null };
let calls: Call[] = [];
let replies: Array<() => Response> = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const qaUser = { id: 'u1', display_name: 'Тест', phone_e164: '+380500000000', roles: ['passenger'], is_verified: true };

beforeEach(() => {
  calls = [];
  replies = [];
  (globalThis as unknown as { window: unknown }).window = {
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    location: { href: 'https://example.test/' },
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', authorization: new Headers(init?.headers).get('authorization') });
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
  it('checks the server even without a local session marker and treats 401 as anonymous', async () => {
    replies.push(() => jsonResponse({ error: { code: 'unauthorized', message: 'No session' } }, 401));
    assert.equal(await productionApi.restoreSession(), null);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/api\/v1\/auth\/refresh$/);
    assert.equal(calls[0].method, 'POST');
  });

  it('restores a valid cookie without consulting local storage', async () => {
    replies.push(() => jsonResponse({ data: { user: qaUser, accessToken: 'token-1' } }));
    const restored = await productionApi.restoreSession();
    assert.equal(restored?.id, 'u1');
    assert.match(calls[0].url, /\/api\/v1\/auth\/refresh$/);
    assert.equal(calls[0].method, 'POST');
  });

  it('clears the in-memory access token on 401', async () => {
    replies.push(() => jsonResponse({ data: { user: qaUser, accessToken: 'token-1' } }));
    await productionApi.restoreSession();
    replies.push(() => jsonResponse({ error: { code: 'unauthorized', message: 'No session' } }, 401));
    assert.equal(await productionApi.restoreSession(), null);
    replies.push(() => jsonResponse({ error: { code: 'unauthorized', message: 'No session' } }, 401));
    await assert.rejects(() => productionApi.me(), (error: unknown) => error instanceof ProductionApiError && error.status === 401);
    assert.equal(calls[2]?.authorization, null);
  });

  it('surfaces a network failure without treating it as an anonymous session', async () => {
    replies.push(() => { throw new TypeError('Failed to fetch'); });
    await assert.rejects(
      () => productionApi.restoreSession(),
      (error: unknown) => error instanceof ProductionApiError,
    );
  });
});
