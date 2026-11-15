import assert from 'node:assert/strict';
import test from 'node:test';
import { placeGuidanceCallout } from '../src/views/calloutPlacement';

const bounds = { left: 16, top: 128, right: 248, bottom: 490 };

test('moves guidance above a boarding label when the default position collides', () => {
  const label = { left: 86, top: 272, right: 206, bottom: 310 };
  const placed = placeGuidanceCallout({ x: 146, y: 310 }, { width: 220, height: 82 }, bounds, [label]);
  const card = { left: placed.x - 110, right: placed.x + 110, top: placed.y - 96, bottom: placed.y - 14 };
  assert.ok(card.bottom <= label.top || card.top >= label.bottom || card.right <= label.left || card.left >= label.right);
  assert.ok(card.top >= bounds.top);
});

test('preserves the preferred anchor when it is unobstructed', () => {
  const preferred = { x: 146, y: 350 };
  assert.deepEqual(placeGuidanceCallout(preferred, { width: 180, height: 64 }, bounds, []), preferred);
});
