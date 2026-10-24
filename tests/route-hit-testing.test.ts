import assert from 'node:assert/strict';
import test from 'node:test';
import { nearestRouteHitIds } from '../src/map/routeHitTesting';

const project = ([x, y]: [number, number]) => ({ x, y });

test('route hit testing chooses the nearest rendered geometry, not feature order', () => {
  const hits = nearestRouteHitIds({ x: 8, y: 2 }, [
    { id: 'far', coordinates: [[0, 10], [10, 10]] },
    { id: 'near', coordinates: [[0, 0], [10, 0]] },
  ], project);

  assert.deepEqual(hits, ['near']);
});

test('route hit testing returns an explicit choice for nearly overlapping candidates', () => {
  const hits = nearestRouteHitIds({ x: 8, y: 4 }, [
    { id: 'upper', coordinates: [[0, 0], [10, 0]] },
    { id: 'lower', coordinates: [[0, 10], [10, 10]] },
  ], project);

  assert.deepEqual(hits, ['upper', 'lower']);
});

test('route hit testing measures distance to the full polyline', () => {
  const hits = nearestRouteHitIds({ x: 5, y: 5 }, [
    { id: 'bent', coordinates: [[0, 0], [5, 5], [10, 0]] },
    { id: 'straight', coordinates: [[0, 10], [10, 10]] },
  ], project);

  assert.deepEqual(hits, ['bent']);
});
