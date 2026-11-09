import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it, test } from 'node:test';
import { productionApi } from '../src/services/productionApi';
import { activatePassengerJourney, completePassengerJourney, isRestorableJourneyState } from '../src/services/journeyLifecycle';

type Recorded = { url: string; method: string; body?: string };

const realFetch = globalThis.fetch;

/** Answer with a fixed status and body, recording every request the client makes. */
async function withFetch(reply: { status: number; json: unknown }, run: () => Promise<void>): Promise<Recorded[]> {
  const calls: Recorded[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    return new Response(JSON.stringify(reply.json), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = realFetch;
  }
  return calls;
}

test('activation posts the contract the server documents', async () => {
  const calls = await withFetch({
    status: 200,
    json: { data: { id: 'j1', state: 'ACTIVE', currentLegId: 'leg1', startedAt: '2026-11-03T06:00:00Z' } },
  }, async () => {
    const result = await productionApi.activateJourney('j1', 'leg1');
    assert.equal(result.state, 'ACTIVE');
    assert.equal(result.currentLegId, 'leg1');
  });
  assert.equal(calls[0].method, 'POST');
  assert.ok(calls[0].url.endsWith('/api/v1/journeys/j1/activate'), calls[0].url);
  assert.deepEqual(JSON.parse(calls[0].body ?? '{}'), { legId: 'leg1' });
});

test('activation without an anchor leg sends an empty object, not a null leg', async () => {
  const calls = await withFetch({
    status: 200,
    json: { data: { id: 'j1', state: 'ACTIVE', currentLegId: null, startedAt: '2026-11-03T06:00:00Z' }, replayed: true },
  }, async () => {
    const result = await productionApi.activateJourney('j1');
    assert.equal(result.currentLegId, null);
  });
  assert.deepEqual(JSON.parse(calls[0].body ?? ''), {});
});

test('completion ends the journey with the outcome the server accepts', async () => {
  const calls = await withFetch({
    status: 200,
    json: { data: { id: 'j1', state: 'COMPLETED' } },
  }, async () => {
    const result = await productionApi.endJourney('j1', 'COMPLETED');
    assert.equal(result.state, 'COMPLETED');
  });
  assert.ok(calls[0].url.endsWith('/api/v1/journeys/j1/end'), calls[0].url);
  assert.deepEqual(JSON.parse(calls[0].body ?? ''), { outcome: 'COMPLETED' });
});

test('the lifecycle helper echoes what the server confirmed', async () => {
  const outcome = await withFetch({
    status: 200,
    json: { data: { id: 'j1', state: 'ACTIVE', currentLegId: 'leg1', startedAt: '2026-11-03T06:00:00Z' } },
  }, async () => {
    const result = await activatePassengerJourney(productionApi, 'j1', 'leg1');
    assert.deepEqual(result, { confirmed: true, state: 'ACTIVE', currentLegId: 'leg1', message: null });
  });
  assert.equal(outcome.length, 1);
});

test('a refused activation never reports the journey as running', async () => {
  await withFetch({
    status: 409,
    json: { error: { code: 'journey_already_finished', message: 'A finished journey cannot be activated.' } },
  }, async () => {
    const result = await activatePassengerJourney(productionApi, 'j1', 'leg1');
    assert.equal(result.confirmed, false);
    assert.equal(result.state, null);
    assert.equal(result.currentLegId, null);
    assert.equal(result.message, 'Поїздку не позначено як активну.');
    assert.doesNotMatch(result.message ?? '', /journey_already_finished|cannot be activated/i);
  });
});

test('a failed completion keeps reporting the journey as unfinished', async () => {
  await withFetch({
    status: 409,
    json: { error: { code: 'booking_lifecycle_active', message: 'Cancel the active booking first.' } },
  }, async () => {
    const result = await completePassengerJourney(productionApi, 'j1');
    assert.equal(result.confirmed, false);
    assert.notEqual(result.state, 'COMPLETED');
    assert.equal(result.message, 'Поїздку не вдалося завершити.');
    assert.doesNotMatch(result.message ?? '', /booking_lifecycle_active|cancel the active booking/i);
  });
});

test('an unreachable server produces a message instead of a thrown page', async () => {
  globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  try {
    const result = await activatePassengerJourney(productionApi, 'j1', 'leg1');
    assert.equal(result.confirmed, false);
    assert.ok((result.message ?? '').length > 0, 'the passenger must see why the status was not saved');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('only running states reopen the stage screen after a reload', () => {
  assert.deepEqual(['ACTIVE', 'TRANSFER'].filter(isRestorableJourneyState), ['ACTIVE', 'TRANSFER']);
  for (const state of ['PLANNED', 'READY', 'PARTIALLY_RESERVED', 'REPLANNING', 'COMPLETED', 'CANCELLED', 'FAILED']) {
    assert.equal(isRestorableJourneyState(state), false, state);
  }
});

// The stage screen is immersive: ProductionMarketplace renders the shared status
// band only outside it, so a refused activation used to be recorded nowhere the
// passenger could see. The notice has to travel into the sheet itself.
const stageScreen = () => readFileSync('src/views/JourneyActiveNavigation.tsx', 'utf8');
const marketplace = () => readFileSync('src/views/ProductionMarketplace.tsx', 'utf8');

/** The JSX block that renders the lifecycle notice, from its guard to the closing tag. */
const noticeBlock = (): string => {
  const source = stageScreen();
  const start = source.indexOf('{notice &&');
  assert.notEqual(start, -1, 'the sheet must render the lifecycle notice');
  return source.slice(start, source.indexOf('{notice &&') + 900);
};

describe('a refused activation stays visible on the stage screen', () => {
  it('renders the server refusal inside the sheet as a status line', () => {
    const block = noticeBlock();
    assert.match(block, /role="status"/);
    assert.match(block, /active-nav-notice/);
    assert.match(block, /text-\[12px\]/, 'iPhone legibility floor is 12 px');
  });

  it('routes the refusal to the screen instead of the suppressed band', () => {
    const source = marketplace();
    assert.match(source, /if \(!outcome\.confirmed\) \{[\s\S]*?setJourneyNotice\(outcome\.message\)/);
    assert.match(source, /activeJourneyStore\.clear\(\)/, 'a refused activation must not be restored as active after reload');
    assert.match(source, /notice=\{journeyNotice\}/);
  });

  it('promises nothing the server did not confirm', () => {
    assert.doesNotMatch(noticeBlock(), /розпочато|активн/, 'a refusal must not claim the journey is running');
  });
});
