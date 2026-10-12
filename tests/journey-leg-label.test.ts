import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { journeyLegCaveat, journeyLegLabel } from '../src/views/journeyLegLabel';

describe('journey leg labels', () => {
  it('prefers the concrete transport type from the API', () => {
    assert.equal(journeyLegLabel('BUS', 'marshrutka'), 'Маршрутка');
    assert.equal(journeyLegLabel('RAIL', 'suburban_train'), 'Електричка');
    assert.equal(journeyLegLabel('BUS', 'intercity_bus'), 'Міжміський автобус');
  });

  it('labels all server journey modes and falls back to the broad mode', () => {
    for (const mode of [
      'WALK', 'COMMUNITY', 'COMMUNITY_DEMAND', 'TAXI', 'TRANSFER', 'BUS', 'MINIBUS', 'RAIL',
      'TRAM', 'TROLLEYBUS', 'METRO', 'URBAN_BUS', 'CARSHARING', 'FERRY', 'FUNICULAR', 'BIKE', 'SCOOTER',
    ]) assert.notEqual(journeyLegLabel(mode), 'Транспорт', mode);
    assert.equal(journeyLegLabel('RAIL'), 'Залізниця');
    assert.equal(journeyLegLabel('NEW_MODE'), 'NEW_MODE');
  });

  it('marks estimated straight-line walking without confusing other modes', () => {
    assert.match(journeyLegCaveat('WALK', 'walking-estimate') ?? '', /оцінено по прямій/);
    assert.equal(journeyLegCaveat('WALK', 'pedestrian-router'), null);
    assert.equal(journeyLegCaveat('BUS', 'walking-estimate'), null);
  });
});
