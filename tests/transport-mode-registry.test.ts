import assert from 'node:assert/strict';
import test from 'node:test';
import { transportModes } from '../src/domain/transportCatalog';
import { getTransportModeVisual, normalizeTransportMode, transportModeRegistry } from '../src/design-system/transport/transportModeRegistry';

test('visual registry covers exactly the twelve canonical user-facing transport modes', () => {
  assert.deepEqual(Object.keys(transportModeRegistry).sort(), transportModes.map(({ id }) => id).sort());
  assert.deepEqual(transportModes.map(({ label }) => label), [
    'Попутка', 'Маршрутка', 'Автобус', 'Таксі', 'Трамвай', 'Тролейбус',
    'Метро', 'Поїзд', 'Велосипед', 'Самокат', 'Каршеринг', 'Трансфер',
  ]);
  for (const mode of transportModes) {
    const visual = getTransportModeVisual(mode.id);
    assert.equal(visual.group, mode.group, `${mode.id} group`);
    assert.ok(visual.label, `${mode.id} label`);
    assert.ok(visual.englishLabel, `${mode.id} English label`);
    assert.equal(visual.colorToken, `--mode-${mode.id}`);
    assert.match(visual.color, /^#[\da-f]{6}$/i);
    assert.equal(visual.mapLineStyle.cap, 'round');
    assert.equal(visual.accessibilityLabel, visual.label);
  }
});

test('normalizes journey API/feed aliases to the same canonical visual mode', () => {
  const aliases: Array<[string, string | undefined, string]> = [
    ['BUS', 'urban_bus', 'bus'], ['MINIBUS', 'marshrutka', 'marshrutka'],
    ['TROLLEYBUS', 'trolleybus', 'trolleybus'], ['TRAM', 'tram', 'tram'],
    ['METRO', 'metro', 'metro'], ['RAIL', 'suburban_train', 'train'],
    ['COMMUNITY_DEMAND', 'carpool', 'carpool'], ['TAXI', 'taxi', 'taxi'],
    ['BIKE', 'bicycle', 'bike'], ['SCOOTER', 'e-scooter', 'scooter'],
    ['CARSHARING', 'car_rental', 'carsharing'], ['TRANSFER', 'shuttle', 'transfer'],
    ['WALK', 'walk', 'WALK'], ['WAIT', undefined, 'WAIT'],
  ];
  for (const [mode, type, expected] of aliases) {
    assert.equal(normalizeTransportMode(mode, type), expected, `${mode}/${type}`);
  }
});

test('concrete API transport type wins over broad journey mode for color and icon metadata', () => {
  assert.equal(getTransportModeVisual('BUS', 'marshrutka').id, 'marshrutka');
  assert.equal(getTransportModeVisual('BUS', 'marshrutka').color, transportModeRegistry.marshrutka.color);
  assert.equal(getTransportModeVisual('RAIL', 'suburban_train').id, 'train');
  assert.equal(getTransportModeVisual('UNKNOWN').color, '#91A6BB');
});
