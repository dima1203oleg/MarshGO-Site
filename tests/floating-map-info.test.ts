import assert from 'node:assert/strict';
import test from 'node:test';
import { floatingInfoForLeg, floatingInfoForStop, floatingInfoForTransfer } from '../src/map/floatingMapInfo';
import type { ApiJourney } from '../src/services/productionApi';

function leg(overrides: Record<string, unknown> = {}): ApiJourney['legs'][number] {
  return {
    id: 'bus-53', mode: 'BUS', transportType: 'bus', routeName: '53',
    durationSeconds: 1_980, distanceMeters: 7_400,
    origin: { name: 'Початок', coordinates: [24, 49] },
    destination: { name: 'Кінець', coordinates: [24.02, 49.01] },
    routeGeometry: [[24, 49], [24.005, 49.002], [24.01, 49.005], [24.02, 49.01]],
    ...overrides,
  } as unknown as ApiJourney['legs'][number];
}

test('stage info uses a provider route vertex and only confirmed duration and distance', () => {
  assert.deepEqual(floatingInfoForLeg(leg()), {
    id: 'stage:bus-53', kind: 'stage', coordinates: [24.005, 49.002], title: 'Автобус 53', detail: '33 хв · 7,4 км',
  });
  assert.deepEqual(floatingInfoForLeg(leg({ routeGeometry: null, distanceMeters: null })), {
    id: 'stage:bus-53', kind: 'stage', coordinates: [24, 49], title: 'Автобус 53', detail: '33 хв',
  });
  assert.equal(floatingInfoForLeg(leg({ origin: { name: 'Невідома точка', coordinates: [181, 49] }, routeGeometry: null })), null);
});

test('boarding, alighting and transfer cards require real map coordinates', () => {
  assert.deepEqual(floatingInfoForStop('stop-1', 'Посадка', 'Наукова', [24, 49]), {
    id: 'stop:stop-1', kind: 'boarding', coordinates: [24, 49], title: 'Посадка', detail: 'Наукова',
  });
  assert.deepEqual(floatingInfoForStop('stop-2', 'Висадка', 'Підвальна', [24.01, 49]), {
    id: 'stop:stop-2', kind: 'alighting', coordinates: [24.01, 49], title: 'Висадка', detail: 'Підвальна',
  });
  assert.equal(floatingInfoForStop('stop-3', 'Зупинка', ' ', [24, 49]), null);
  assert.deepEqual(floatingInfoForTransfer('tram-bus', [24.02, 49.01], 180), {
    id: 'transfer:tram-bus', kind: 'transfer', coordinates: [24.02, 49.01], title: 'Пересадка', detail: '3 хв очікування',
  });
  assert.equal(floatingInfoForTransfer('bad', [24, 91], 180), null);
});
