import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ProductionApiError, productionApi } from '../src/services/productionApi';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('proposal acceptance sends the revision shown to the passenger', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ data: { id: 'booking-1' } }), {
      status: 201, headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  await productionApi.acceptProposal('proposal-1', 7);

  assert.match(requestUrl, /\/api\/v1\/proposals\/proposal-1\/accept$/);
  assert.equal(requestInit?.method, 'POST');
  assert.deepEqual(JSON.parse(String(requestInit?.body)), { expectedRevision: 7 });
});

test('stale proposal revision remains a conflict and is never retried by the API client', async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ error: { code: 'proposal_revision_changed', message: 'refresh terms' } }), {
      status: 409, headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  await assert.rejects(
    productionApi.acceptProposal('proposal-1', 6),
    (error: unknown) => error instanceof ProductionApiError
      && error.status === 409 && error.code === 'proposal_revision_changed',
  );
  assert.equal(calls, 1);
});
