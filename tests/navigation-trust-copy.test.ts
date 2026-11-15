import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const source = readFileSync(join(process.cwd(), 'src/views/ProductionNavigation.tsx'), 'utf8');

test('unknown GPS speed renders as no-data, never as a standing 0 km/h', () => {
  assert.match(source, /liveSpeed === null \? '—'/);
  assert.doesNotMatch(source, /liveSpeed === null \? '0'/);
});

test('paused navigation never claims the vehicle is safely stopped', () => {
  assert.doesNotMatch(source, /Безпечно зупинено/);
  assert.match(source, /'Навігація на паузі'/);
});

test('navigation sheet grabber keeps the 44px touch-target floor', () => {
  assert.match(source, /className="mx-auto mb-1 flex h-11 w-24 touch-none items-center justify-center"/);
});