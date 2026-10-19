import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { freshLiveTransitPositions, liveTransitFeatureCollection } from '../src/map/liveTransitFeatures';
import type { LiveTransitPosition } from '../src/map/MapAdapter';

const position = (overrides: Partial<LiveTransitPosition> = {}): LiveTransitPosition => ({
  id: 'leg-bus', coordinates: [24.03, 49.83], color: '#1687FF', label: 'Автобус A56',
  updatedAt: '2026-10-14T09:00:00.000Z', selected: false, ...overrides,
});

describe('MapLibre live transit feature batching', () => {
  it('keeps several fresh authorized journey positions in one stable GeoJSON collection', () => {
    const positions = [position(), position({ id: 'leg-tram', label: 'Трамвай T09', selected: true })];
    assert.deepEqual(liveTransitFeatureCollection(positions), {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'leg-bus', properties: { id: 'leg-bus', color: '#1687FF', label: 'Автобус A56', updatedAt: '2026-10-14T09:00:00.000Z', selected: false }, geometry: { type: 'Point', coordinates: [24.03, 49.83] } },
        { type: 'Feature', id: 'leg-tram', properties: { id: 'leg-tram', color: '#1687FF', label: 'Трамвай T09', updatedAt: '2026-10-14T09:00:00.000Z', selected: true }, geometry: { type: 'Point', coordinates: [24.03, 49.83] } },
      ],
    });
  });

  it('drops stale, future-skewed, invalid and unidentified positions', () => {
    const now = Date.parse('2026-10-14T09:00:00.000Z');
    const accepted = freshLiveTransitPositions([
      position(),
      position({ id: '' }),
      position({ coordinates: [200, 49.83] }),
      position({ updatedAt: '2026-10-14T08:58:29.999Z' }),
      position({ updatedAt: '2026-10-14T09:00:30.001Z' }),
    ], now);
    assert.deepEqual(accepted.map(value => value.id), ['leg-bus']);
  });
});
