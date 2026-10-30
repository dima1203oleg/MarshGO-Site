import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { refreshCommittedBookingData } from '../src/views/bookingResultRefresh';

describe('committed booking follow-up refresh', () => {
  it('reports stale trip data without rejecting a successful booking', async () => {
    let refreshCalls = 0;
    const refreshed = await refreshCommittedBookingData([
      async () => { refreshCalls += 1; throw new Error('bookings unavailable'); },
      async () => { refreshCalls += 1; },
    ]);

    assert.equal(refreshed, false);
    assert.equal(refreshCalls, 2);
  });
});
