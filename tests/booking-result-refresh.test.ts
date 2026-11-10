import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { refreshCommittedActionData } from '../src/views/committedActionRefresh';

describe('committed action follow-up refresh', () => {
  it('reports stale trip data without rejecting a successful server action', async () => {
    let refreshCalls = 0;
    const refreshed = await refreshCommittedActionData([
      async () => { refreshCalls += 1; throw new Error('bookings unavailable'); },
      async () => { refreshCalls += 1; },
    ]);

    assert.equal(refreshed, false);
    assert.equal(refreshCalls, 2);
  });

  it('captures synchronous refresh failures after an action has committed', async () => {
    const refreshed = await refreshCommittedActionData([
      () => { throw new Error('refresh failed'); },
      async () => 'updated',
    ]);

    assert.equal(refreshed, false);
  });
});
