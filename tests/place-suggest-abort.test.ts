import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { productionApi } from '../src/services/productionApi';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('place suggestions forward the current input cancellation signal to fetch', async () => {
  const controller = new AbortController();
  let sentSignal: AbortSignal | null | undefined;
  globalThis.fetch = (async (_input: string | URL | Request, init: RequestInit = {}) => {
    sentSignal = init.signal;
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response;
  }) as typeof globalThis.fetch;

  await productionApi.suggestPlaces('Львів', undefined, controller.signal);

  assert.equal(sentSignal, controller.signal);
});

test('aborted place suggestions reject as cancellation instead of becoming a provider error', async () => {
  const controller = new AbortController();
  globalThis.fetch = (async (_input: string | URL | Request, init: RequestInit = {}) => new Promise<Response>((_resolve, reject) => {
    if (init.signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true });
  })) as typeof globalThis.fetch;

  const request = productionApi.suggestPlaces('Львів', undefined, controller.signal);
  controller.abort('superseded');

  await assert.rejects(request, (error: unknown) => error instanceof DOMException && error.name === 'AbortError');
});
