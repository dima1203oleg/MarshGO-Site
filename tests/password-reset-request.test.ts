import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ProductionApiError, productionApi } from '../src/services/productionApi';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('password reset calls the public request endpoint and surfaces unavailable delivery', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      error: { code: 'password_reset_unavailable', message: 'internal detail' },
    }), { status: 503, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  await assert.rejects(
    productionApi.requestPasswordReset('rider@example.test'),
    (error: unknown) => error instanceof ProductionApiError
      && error.status === 503
      && error.code === 'password_reset_unavailable'
      && error.message === 'Відновлення пароля тимчасово недоступне. Спробуйте пізніше.',
  );
  assert.match(requestUrl, /\/api\/v1\/auth\/password-reset\/request$/);
  assert.equal(requestInit?.method, 'POST');
  assert.deepEqual(JSON.parse(String(requestInit?.body)), { email: 'rider@example.test' });
});
