import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { availableModes, defaultSelection, effectiveModes, toggleMode, toJourneyPreferences } from '../src/domain/transportPreferences';

const availability = {
  modes: [{ mode: 'bike', available: true, cities: ['Wrocław'] }, { mode: 'scooter', available: true, cities: ['Київ'] }, { mode: 'moped', available: false, cities: [] }, { mode: 'carsharing', available: false, cities: [] }],
  transit: { bus: { available: true, cities: ['Львів'] }, tram: { available: true, cities: ['Львів'] }, trolleybus: { available: false, cities: [] }, metro: { available: false, cities: [] }, train: { available: false, cities: [] } },
} as const;

describe('transport preferences', () => {
  it('only offers modes that have real data', () => {
    const available = availableModes(availability as never);
    assert.deepEqual([...available].sort(), ['bike', 'carpool', 'ebike', 'scooter', 'transit']);
    assert.deepEqual([...availableModes(null)], ['carpool']);
  });

  it('"Усі" is the default and expands to every available mode', () => {
    const available = availableModes(availability as never);
    assert.equal(defaultSelection.all, true);
    assert.deepEqual([...effectiveModes(defaultSelection, available)].sort(), [...available].sort());
  });

  it('selection is multi-valued and never exceeds what is available', () => {
    const available = availableModes(availability as never);
    let selection = toggleMode(defaultSelection, 'carpool');
    selection = toggleMode(selection, 'transit');
    selection = toggleMode(selection, 'taxi');
    assert.deepEqual(selection, { all: false, modes: ['carpool', 'transit', 'taxi'] });
    assert.deepEqual([...effectiveModes(selection, available)].sort(), ['carpool', 'transit']);
    assert.deepEqual(toggleMode({ all: false, modes: ['carpool'] }, 'carpool'), defaultSelection);
  });

  it('maps modes onto Journey Engine flags without enabling forbidden types', () => {
    assert.deepEqual(toJourneyPreferences(new Set(['carpool'])), { allowCommunity: true, allowTaxi: false, allowCarsharing: false, allowBus: false, allowMinibus: false, allowRail: false, allowPublicTransport: false });
    const transitOnly = toJourneyPreferences(new Set(['transit']));
    assert.equal(transitOnly.allowCommunity, false);
    assert.equal(transitOnly.allowPublicTransport && transitOnly.allowBus && transitOnly.allowRail, true);
  });
});
