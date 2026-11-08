import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { productionApi } from '../src/services/productionApi';
import { JOURNEY_SEARCH_DEADLINE_MS, journeySearchAbortMessage } from '../src/views/journeyResultPresentation';

const searchInput = {
  origin: { name: 'Львів', coordinates: [24.0155, 49.8347] as [number, number] },
  destination: { name: 'Стрий', coordinates: [23.856, 49.258] as [number, number] },
  departureAt: '2026-11-04T08:00:00+02:00',
  passengers: 1,
  strategy: 'BALANCED' as const,
};

type Sent = { body: Record<string, unknown>; signal?: AbortSignal };

let sent: Sent[] = [];
let respond: (index: number, init: RequestInit) => Promise<Response> = async () => jsonResponse(200, { data: { journeys: [] } });

function jsonResponse(status: number, payload: unknown): Response {
  return { status, ok: status < 400, json: async () => payload } as unknown as Response;
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  sent = [];
  respond = async () => jsonResponse(200, { data: { journeys: [] } });
  globalThis.fetch = (async (_url: string | URL, init: RequestInit = {}) => {
    sent.push({ body: JSON.parse(String(init.body ?? '{}')), signal: init.signal ?? undefined });
    return respond(sent.length - 1, init);
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('bounded journey search', () => {
  it('hands its abort signal to the provider request', async () => {
    const controller = new AbortController();
    await productionApi.searchJourneys({ ...searchInput, signal: controller.signal });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.signal, controller.signal);
  });

  it('never puts the signal in the request body', async () => {
    const controller = new AbortController();
    await productionApi.searchJourneys({ ...searchInput, signal: controller.signal });
    assert.equal('signal' in (sent[0]?.body ?? {}), false);
  });

  it('stops without a retry when the passenger aborts, even with provider preferences set', async () => {
    const controller = new AbortController();
    const abortError = () => new DOMException('The operation was aborted.', 'AbortError');
    respond = async (_index, init) => {
      if (init.signal?.aborted) throw abortError();
      await new Promise<void>((resolve) => { init.signal?.addEventListener('abort', resolve, { once: true }); });
      throw abortError();
    };
    const search = productionApi.searchJourneys({
      ...searchInput,
      preferences: { allowedTransportTypes: ['bus', 'tram'] },
      signal: controller.signal,
    });
    controller.abort('cancelled');
    // A signal that never reaches `fetch` would leave this test hanging instead of failing, so the
    // watchdog is the assertion: an unbounded search is the defect this file exists to prevent.
    const outcome = await Promise.race([
      search.then(() => 'resolved' as const, (error: unknown) => ({ error })),
      new Promise<'stuck'>((resolveWatchdog) => { setTimeout(() => resolveWatchdog('stuck'), 500); }),
    ]);
    assert.notEqual(outcome, 'stuck', 'скасування не дійшло до запиту — пошук лишився без межі');
    assert.notEqual(outcome, 'resolved');
    const error = (outcome as { error?: unknown }).error;
    assert.ok(error instanceof DOMException && error.name === 'AbortError');
    assert.equal(sent.length, 1);
  });

  it('never retries a rejected search after silently removing passenger constraints', async () => {
    respond = async () => jsonResponse(400, { error: { code: 'bad_request', message: 'unknown field' } });
    const preferences = {
      allowedTransportTypes: ['carpool', 'bus'],
      allowedTransitProviders: ['lviv:operator-a'],
      maxPriceMinor: 45_000,
      maxTotalDurationSeconds: 3_600,
    };
    const error = await productionApi.searchJourneys({ ...searchInput, preferences }).then(() => null, (caught: unknown) => caught);
    assert.ok(error instanceof Error);
    assert.equal((error as { status?: number }).status, 400);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0]?.body.preferences, preferences);
  });

  it('gives up before the gateway stops answering, so the passenger learns why', () => {
    assert.ok(JOURNEY_SEARCH_DEADLINE_MS > 0 && JOURNEY_SEARCH_DEADLINE_MS < 60_000);
    assert.notEqual(journeySearchAbortMessage('timeout'), journeySearchAbortMessage('cancelled'));
    assert.match(journeySearchAbortMessage('timeout'), /45 с/);
    assert.equal(journeySearchAbortMessage('cancelled'), 'Пошук маршруту скасовано.');
  });
});
