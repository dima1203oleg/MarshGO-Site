import test from 'node:test';
import assert from 'node:assert/strict';
import { selectHomeMarshPasses } from '../src/domain/marshPass';

test('Home only selects confirmed private-ride passenger bookings for MarshPass', () => {
  const selected = selectHomeMarshPasses([
    { id: 'journey', kind: 'journey' as const, status: 'ACTIVE' },
    { id: 'driver-booking', kind: 'booking' as const, currentUserIsDriver: true, status: 'confirmed' },
    { id: 'pending', kind: 'booking' as const, status: 'pending' },
    { id: 'cancelled', kind: 'booking' as const, status: 'cancelled' },
    { id: 'passenger-booking', kind: 'booking' as const, status: 'confirmed' },
  ]);
  assert.deepEqual(selected.map((item) => item.id), ['passenger-booking']);
});

test('boarding and in-progress passenger bookings remain active MarshPasses', () => {
  const selected = selectHomeMarshPasses([
    { id: 'boarding', kind: 'booking' as const, status: 'boarding' },
    { id: 'in-progress', kind: 'booking' as const, status: 'in_progress' },
  ]);
  assert.deepEqual(selected.map((item) => item.id), ['boarding', 'in-progress']);
});
