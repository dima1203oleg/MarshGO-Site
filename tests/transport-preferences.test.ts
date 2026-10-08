import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { transportTypes, activeTypesForSearch, choiceFor, defaultSelection, effectiveProviders, isAllActive, selectAll, toggleProvider, toggleType, toJourneyPreferences } from '../src/domain/transportPreferences';

const groups = [
  { transportType: 'carpool', providers: [{ id: 'carpool:MARSHGO', name: 'MARSHGO Community', available: true, cities: [], sources: [], services: [] }] },
  { transportType: 'taxi', providers: [{ id: 'taxi:Uklon', name: 'Uklon', available: true, cities: [], sources: [], services: [] }, { id: 'taxi:Bolt', name: 'Bolt', available: true, cities: [], sources: [], services: [] }] },
  { transportType: 'scooter', providers: [{ id: 'scooter:Bolt', name: 'Bolt', available: true, cities: [], sources: [], services: [] }] },
  { transportType: 'bike', providers: [] },
  { transportType: 'bus', providers: [{ id: 'bus:Львівавтодор', name: 'Львівавтодор', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['bus', 'tram'] }] },
];

describe('transport types and providers', () => {
  it('exposes all 19 tiles in five groups', () => {
    assert.equal(transportTypes.length, 19);
    assert.equal(new Set(transportTypes.map((type) => type.group)).size, 5);
  });

  it('starts with "Усі" and lets the user switch individual types off', () => {
    assert.equal(isAllActive(defaultSelection), true);
    const narrowed = toggleType(toggleType(defaultSelection, 'bike'), 'walk');
    assert.equal(isAllActive(narrowed), false);
    assert.equal(narrowed.active.includes('bike'), false);
    assert.equal(narrowed.active.includes('taxi'), true);
    assert.equal(isAllActive(selectAll(narrowed)), true);
  });

  it('allows an empty selection and treats an empty search as "Усі"', () => {
    let selection = defaultSelection;
    for (const type of defaultSelection.active) selection = toggleType(selection, type);
    assert.deepEqual(selection.active, []);
    assert.equal(activeTypesForSearch(selection).length, defaultSelection.active.length);
  });

  it('keeps separate provider choices per type (Uklon for taxi, Bolt for scooters)', () => {
    let selection = toggleProvider(defaultSelection, 'taxi', 'taxi:Uklon');
    selection = toggleProvider(selection, 'scooter', 'scooter:Bolt');
    assert.deepEqual(effectiveProviders(selection, 'taxi', groups), ['taxi:Uklon']);
    assert.deepEqual(effectiveProviders(selection, 'scooter', groups), ['scooter:Bolt']);
    assert.deepEqual(effectiveProviders(selection, 'bike', groups), []);
  });

  it('"Усі провайдери" uses every connected provider and returns when the last specific one is cleared', () => {
    assert.deepEqual(effectiveProviders(defaultSelection, 'taxi', groups).sort(), ['taxi:Bolt', 'taxi:Uklon']);
    const one = toggleProvider(defaultSelection, 'taxi', 'taxi:Bolt');
    assert.equal(choiceFor(one, 'taxi').all, false);
    assert.equal(choiceFor(toggleProvider(one, 'taxi', 'taxi:Bolt'), 'taxi').all, true);
  });

  it('remembers the provider choice while a type is switched off', () => {
    let selection = toggleProvider(defaultSelection, 'taxi', 'taxi:Uklon');
    selection = toggleType(selection, 'taxi');
    selection = toggleType(selection, 'taxi');
    assert.deepEqual(choiceFor(selection, 'taxi'), { all: false, ids: ['taxi:Uklon'] });
  });

  it('maps the selection onto Journey Engine flags only for types that have providers', () => {
    const carpoolOnly = { ...defaultSelection, active: ['carpool' as const] };
    assert.equal(toJourneyPreferences(carpoolOnly, groups).allowCommunity, true);
    assert.equal(toJourneyPreferences(carpoolOnly, groups).allowTaxi, false);
    const taxiOnly = { ...defaultSelection, active: ['taxi' as const] };
    assert.equal(toJourneyPreferences(taxiOnly, groups).allowTaxi, true);
    assert.equal(toJourneyPreferences(taxiOnly, groups).allowCommunity, false);
    const noTaxiProviders = toJourneyPreferences({ ...defaultSelection, active: ['taxi' as const] }, [{ transportType: 'taxi', providers: [] }]);
    assert.equal(noTaxiProviders.allowTaxi, false);
    const busOnly = toJourneyPreferences({ ...defaultSelection, active: ['bus' as const] }, groups);
    assert.equal(busOnly.allowBus && busOnly.allowPublicTransport, true);
    assert.equal(busOnly.allowRail || busOnly.allowMinibus || busOnly.allowCommunity, false);
  });
});
