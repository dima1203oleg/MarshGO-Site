import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { budgetLabel, journeySearchBounds } from '../src/domain/journeySearchBounds';
import { areAllProvidersSelected, countSelectedProviders, toggleProvider, useAllProviders, type TransportSelection } from '../src/domain/transportPreferences';

const groups = [
  { transportType: 'bus', providers: [{ id: 'bus:Львівавтодор', name: 'Львівавтодор', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['bus'] }] },
  { transportType: 'trolleybus', providers: [
    { id: 'trolleybus:Львівавтодор', name: 'Львівавтодор', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['trolleybus'] },
    { id: 'trolleybus:Електротранс', name: 'Електротранс', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['trolleybus'] },
  ] },
  { transportType: 'tram', providers: [{ id: 'tram:ghost', name: 'Ghost', available: false, cities: ['Львів'], sources: ['gtfs'], services: ['tram'] }] },
];

describe('journey search bounds from the «З»/«По»/budget controls', () => {
  it('turns «По» into a duration cap because the engine anchors on departure', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', '2026-05-15T09:30', null), { maxTotalDurationSeconds: 5400 });
  });

  it('sends nothing when the passenger leaves both bounds open', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, null), {});
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, 0), {});
  });

  it('converts the budget into minor units and keeps unknown fares unrestrained', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, 200), { maxPriceMinor: 20000 });
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, -50), {});
  });

  it('never invents a bound from an impossible or unparseable clock time', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T09:00', '2026-05-15T08:00', null), {});
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', '2026-05-15T08:00', null), {});
    // One minute is the shortest window the engine accepts, so it is sent as-is.
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', '2026-05-15T08:01', null), { maxTotalDurationSeconds: 60 });
    // Europe/Kyiv springs forward past 03:00 on 2026-03-29; that wall time does not exist.
    assert.deepEqual(journeySearchBounds('2026-03-29T03:00', '2026-03-29T04:30', null), {});
    assert.deepEqual(journeySearchBounds('not a datetime', '2026-05-15T09:00', 200), { maxPriceMinor: 20000 });
  });

  it('caps the window at the widest range the planner accepts', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', '2026-05-25T08:00', null), { maxTotalDurationSeconds: 604800 });
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', '2026-05-15T09:00', 1_000_000), { maxTotalDurationSeconds: 3600, maxPriceMinor: 100_000_000 });
  });

  it('labels an open budget as no limit rather than as free', () => {
    assert.equal(budgetLabel(null), 'Без обмеження');
    assert.equal(budgetLabel(0), 'Без обмеження');
    assert.equal(budgetLabel(300), 'До 300 грн');
  });
});

describe('provider choice summary', () => {
  const selection: TransportSelection = { active: ['bus', 'trolleybus', 'tram'], providers: {} };

  it('counts every connected provider while the choice is still open', () => {
    assert.equal(countSelectedProviders(selection, ['bus', 'trolleybus', 'tram'], groups), 3);
    assert.equal(areAllProvidersSelected(selection, ['bus', 'trolleybus', 'tram']), true);
  });

  it('counts only the picked providers that are actually connected', () => {
    const picked = toggleProvider(toggleProvider(selection, 'trolleybus', 'trolleybus:Електротранс'), 'tram', 'tram:ghost');
    // bus still takes everything (1), trolleybus keeps its single pick, and the offline tram feed adds nothing.
    assert.equal(countSelectedProviders(picked, ['bus', 'trolleybus', 'tram'], groups), 2);
    assert.equal(areAllProvidersSelected(picked, ['bus', 'trolleybus', 'tram']), false);
  });

  it('«Вибрати всі» reopens every listed category without touching the rest', () => {
    const picked = toggleProvider(selection, 'bus', 'bus:Львівавтодор');
    const reopened = useAllProviders(picked, ['trolleybus']);
    assert.deepEqual(reopened.providers.bus, { all: false, ids: ['bus:Львівавтодор'] });
    assert.equal(areAllProvidersSelected(reopened, ['bus']), false);
    assert.equal(countSelectedProviders(reopened, ['bus', 'trolleybus'], groups), 3);
  });

  it('reports none selected when the coverage probe has not answered yet', () => {
    assert.equal(countSelectedProviders(selection, ['bus', 'trolleybus'], null), 0);
  });
});
