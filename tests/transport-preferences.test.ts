import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { transportTypes, supportedJourneySearchTypes, activeTypesForSearch, choiceFor, defaultSelection, effectiveProviders, isAllActive, selectAll, toggleProvider, toggleType, toJourneyPreferences, type TransportSelection } from '../src/domain/transportPreferences';

const groups = [
  { transportType: 'carpool', providers: [{ id: 'carpool:MARSHGO', name: 'MARSHGO Community', available: true, cities: [], sources: [], services: [] }] },
  { transportType: 'taxi', providers: [{ id: 'taxi:Uklon', name: 'Uklon', available: true, cities: [], sources: [], services: [] }, { id: 'taxi:Bolt', name: 'Bolt', available: true, cities: [], sources: [], services: [] }] },
  { transportType: 'scooter', providers: [{ id: 'scooter:Bolt', name: 'Bolt', available: true, cities: [], sources: [], services: [] }] },
  { transportType: 'bike', providers: [] },
  { transportType: 'bus', providers: [{ id: 'bus:Львівавтодор', name: 'Львівавтодор', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['bus', 'tram'] }] },
  { transportType: 'trolleybus', providers: [{ id: 'trolleybus:Львівавтодор', name: 'Львівавтодор', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['trolleybus'] }, { id: 'trolleybus:Test trolley', name: 'Test trolley', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['trolleybus'] }] },
  { transportType: 'train', providers: [{ id: 'train:Укрзалізниця', name: 'Укрзалізниця', available: true, cities: ['Україна'], sources: ['gtfs'], services: ['train'] }, { id: 'train:Test rail', name: 'Test rail', available: true, cities: ['Україна'], sources: ['gtfs'], services: ['train'] }] },
  { transportType: 'tram', providers: [{ id: 'tram:Realtime only', name: 'Realtime only', available: true, cities: ['Львів'], sources: ['gtfs_rt'], services: ['tram'] }] },
];

describe('transport types and providers', () => {
  it('keeps all 21 catalogue tiles visible while only exposing implemented route modes to search', () => {
    assert.equal(transportTypes.length, 21);
    assert.equal(new Set(transportTypes.map((type) => type.group)).size, 5);
    assert.equal(supportedJourneySearchTypes.length, 12);
    assert.equal(supportedJourneySearchTypes.includes('bike'), false);
    assert.equal(supportedJourneySearchTypes.includes('carsharing'), false);
    assert.equal(supportedJourneySearchTypes.includes('walk'), false);
  });

  it('starts with implemented route types selected and ignores attempts to select unsupported tiles', () => {
    assert.equal(isAllActive(defaultSelection), true);
    const narrowed = toggleType(toggleType(defaultSelection, 'bike'), 'carpool');
    assert.equal(isAllActive(narrowed), false);
    assert.equal(narrowed.active.includes('bike'), false);
    assert.equal(narrowed.active.includes('taxi'), false);
    assert.equal(narrowed.active.includes('carpool'), false);
    assert.equal(isAllActive(selectAll(narrowed)), true);
  });

  it('allows an empty selection and searches no modes when nothing is selected', () => {
    let selection = defaultSelection;
    for (const type of defaultSelection.active) selection = toggleType(selection, type);
    assert.deepEqual(selection.active, []);
    assert.deepEqual(activeTypesForSearch(selection), []);
  });

  it('keeps separate provider choices per supported type and excludes map-only or unsupported sources', () => {
    let selection = toggleProvider(defaultSelection, 'bus', 'bus:Львівавтодор');
    selection = toggleProvider(selection, 'train', 'train:Test rail');
    assert.deepEqual(effectiveProviders(selection, 'bus', groups), ['bus:Львівавтодор']);
    assert.deepEqual(effectiveProviders(selection, 'train', groups), ['train:Test rail']);
    assert.deepEqual(effectiveProviders(selection, 'scooter', groups), []);
    assert.deepEqual(effectiveProviders(selection, 'tram', groups), []);
    assert.deepEqual(effectiveProviders(selection, 'bike', groups), []);
  });

  it('sends provider choices separately for each transport type', () => {
    let selection: TransportSelection = { ...defaultSelection, active: ['bus', 'trolleybus'] };
    selection = toggleProvider(selection, 'bus', 'bus:Львівавтодор');
    selection = toggleProvider(selection, 'trolleybus', 'trolleybus:Test trolley');
    const preferences = toJourneyPreferences(selection, groups);
    assert.deepEqual(preferences.allowedTransitProvidersByType, {
      bus: ['Львівавтодор'], trolleybus: ['Test trolley'],
    });
  });

  it('"Усі провайдери" uses every connected provider and returns when the last specific one is cleared', () => {
    assert.deepEqual(effectiveProviders(defaultSelection, 'train', groups).sort(), ['train:Test rail', 'train:Укрзалізниця']);
    const one = toggleProvider(defaultSelection, 'train', 'train:Test rail');
    assert.equal(choiceFor(one, 'train').all, false);
    assert.equal(choiceFor(toggleProvider(one, 'train', 'train:Test rail'), 'train').all, true);
  });

  it('remembers the provider choice while a type is switched off', () => {
    let selection = toggleProvider(defaultSelection, 'train', 'train:Укрзалізниця');
    selection = toggleType(selection, 'train');
    selection = toggleType(selection, 'train');
    assert.deepEqual(choiceFor(selection, 'train'), { all: false, ids: ['train:Укрзалізниця'] });
  });

  it('maps only route-engine modes onto Journey Engine flags and filters unavailable providers', () => {
    const carpoolOnly = { ...defaultSelection, active: ['carpool' as const] };
    assert.equal(toJourneyPreferences(carpoolOnly, groups).allowCommunity, true);
    assert.equal(toJourneyPreferences(carpoolOnly, groups).allowTaxi, false);
    const taxiOnly = { ...defaultSelection, active: ['taxi' as const] };
    assert.equal(toJourneyPreferences(taxiOnly, groups).allowTaxi, false);
    assert.equal(toJourneyPreferences(taxiOnly, groups).allowCommunity, false);
    assert.deepEqual(toJourneyPreferences(taxiOnly, groups).allowedTransportTypes, []);
    const bikeOnly = toJourneyPreferences({ ...defaultSelection, active: ['bike' as const] }, groups);
    assert.deepEqual(bikeOnly.allowedTransportTypes, []);
    assert.equal(bikeOnly.allowPublicTransport, false);
    const busOnly = toJourneyPreferences({ ...defaultSelection, active: ['bus' as const] }, groups);
    assert.equal(busOnly.allowBus && busOnly.allowPublicTransport, true);
    assert.equal(busOnly.allowRail || busOnly.allowMinibus || busOnly.allowCommunity, false);
    assert.deepEqual(busOnly.allowedTransportTypes, ['bus']);
  });

  it('preserves supported route modes while provider availability is loading', () => {
    const selectedBus = { ...defaultSelection, active: ['bus' as const] };
    const preferences = toJourneyPreferences(selectedBus, null);
    assert.equal(preferences.allowBus, true);
    assert.equal(preferences.allowPublicTransport, true);
    assert.deepEqual(preferences.allowedTransportTypes, ['bus']);
    assert.deepEqual(preferences.allowedTransitProviders, []);
    assert.deepEqual(preferences.allowedTransitProvidersByType, {});
  });

  it('does not treat realtime-only vehicle positions as a routable GTFS schedule', () => {
    const preferences = toJourneyPreferences({ ...defaultSelection, active: ['tram'] }, groups);
    assert.equal(preferences.allowPublicTransport, false);
    assert.deepEqual(preferences.allowedTransportTypes, []);
  });
});
