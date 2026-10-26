import assert from 'node:assert/strict';
import test from 'node:test';
import { mapLayerBadgeColor } from '../src/map/mapLayerPalette';

test('map layer badges use the approved category colors without changing route colors', () => {
  const expected = {
    BUS: '#1687FF', MINIBUS: '#F5B51B', TROLLEYBUS: '#16A34A', TRAIN: '#F43F5E',
    TRAM: '#F97316', BICYCLE: '#06A6D8', METRO: '#8B20F8', SCOOTER: '#16A34A',
    CARPOOL: '#4B5563', CARSHARING: '#F97316', TAXI: '#7C3AED', TRANSFER: '#172434',
  } as const;
  for (const [id, color] of Object.entries(expected)) {
    assert.equal(mapLayerBadgeColor(id as keyof typeof expected, '#000000'), color, id);
  }
});

test('non-transport and future layers keep their supplied semantic fallback', () => {
  assert.equal(mapLayerBadgeColor('STOPS', '#2563EB'), '#2563EB');
});
