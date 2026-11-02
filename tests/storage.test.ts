import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
const { MarshgoRepository } = await import('../src/services/storage');

describe('MarshgoRepository demo invariants', () => {
  beforeEach(() => localStorage.clear());

  test('booking and cancelling seats restores capacity only once', () => {
    const repository = new MarshgoRepository();
    const offer = repository.getOfferById('off_camry_odesa_kyiv');
    assert.ok(offer);
    const availableBefore = offer.availableSeats;

    const booking = repository.bookOffer(offer.id, 2);
    assert.equal(offer.availableSeats, availableBefore - 2);

    repository.cancelBooking(booking.id);
    assert.equal(offer.availableSeats, availableBefore);
    repository.cancelBooking(booking.id);
    assert.equal(offer.availableSeats, availableBefore);
  });

  test('rejects zero, negative, fractional, and over-capacity seat requests', () => {
    const repository = new MarshgoRepository();
    const offer = repository.getOfferById('off_camry_odesa_kyiv');
    assert.ok(offer);

    assert.throws(() => repository.bookOffer(offer.id, 0), /кількість місць/);
    assert.throws(() => repository.bookOffer(offer.id, -1), /кількість місць/);
    assert.throws(() => repository.bookOffer(offer.id, 1.5), /кількість місць/);
    assert.throws(() => repository.bookOffer(offer.id, offer.availableSeats + 1), /Недостатньо/);
  });

  test('accepts one proposal for a demand exactly once', () => {
    const repository = new MarshgoRepository();
    const bookingsBefore = repository.getBookings().length;

    const booking = repository.acceptProposal('prop_01');
    assert.equal(booking.proposalId, 'prop_01');
    assert.equal(repository.getBookings().length, bookingsBefore + 1);
    assert.throws(() => repository.acceptProposal('prop_01'), /вже підтверджено/);
    assert.equal(repository.getBookings().length, bookingsBefore + 1);
  });

  test('navigation candidate requires opt-in and cannot create a duplicate booking', () => {
    const repository = new MarshgoRepository();
    const session = repository.startNavigationSession();
    const bookingsBefore = repository.getBookings().length;

    repository.acceptNavigationMatch('cand_duliby_01');
    assert.equal(repository.getBookings().length, bookingsBefore);

    repository.setMatchmakingOptIn(true);
    repository.acceptNavigationMatch('cand_duliby_01');
    assert.equal(repository.getBookings().length, bookingsBefore + 1);
    repository.acceptNavigationMatch('cand_duliby_01');
    assert.equal(repository.getBookings().length, bookingsBefore + 1);
    assert.equal(session.candidates[0].status, 'accepted');
  });
});
