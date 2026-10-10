import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { passengersLabel } from '../src/domain/plural';
import { mapLayers, styleForLayer } from '../src/map/mapMode';

describe('passenger plural forms', () => {
  it('uses the correct Ukrainian form', () => {
    const cases: Array<[number, string]> = [[1, '1 пасажир'], [2, '2 пасажири'], [4, '4 пасажири'], [5, '5 пасажирів'], [11, '11 пасажирів'], [12, '12 пасажирів'], [21, '21 пасажир'], [22, '22 пасажири'], [111, '111 пасажирів']];
    for (const [count, expected] of cases) assert.equal(passengersLabel(count), expected);
  });
});

describe('base map modes', () => {
  it('exposes only simple 2D, 3D, and satellite; transport stays an overlay', () => {
    assert.deepEqual(Object.keys(mapLayers), ['simple', 'threeD', 'satellite']);
    assert.deepEqual(Object.values(mapLayers).map((mode) => mode.label), ['Простий 2D', '3D', 'Супутник']);
    assert.equal(styleForLayer('simple', 'https://maps.example/style.json'), 'https://maps.example/style.json');
    assert.equal(styleForLayer('threeD', 'https://maps.example/style.json'), 'https://maps.example/style.json');
    assert.equal(styleForLayer('satellite', 'https://maps.example/style.json'), 'https://maps.example/style.json');
  });
});
