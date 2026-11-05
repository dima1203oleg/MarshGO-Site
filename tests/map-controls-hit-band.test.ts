import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routeMap = readFileSync(new URL('../src/views/JourneyRouteMapScreen.tsx', import.meta.url), 'utf8');

/**
 * Measured on a real 390×844 viewport: the floating control column occupies y 152–196 for
 * the satellite button, while the sheet grabber is a full-width band at y 173–217 as soon
 * as the sheet is raised — and raising it is exactly what tapping a stop list does. Every
 * tap in that band dragged the sheet instead of reaching a control, so the affordance lied.
 */
test('the raised sheet cannot silently steal a tap from the map controls', () => {
  const column = routeMap.slice(routeMap.indexOf('{/* Floating map controls'));
  assert.ok(column.length > 0, 'floating controls column not found');
  assert.match(column.slice(0, 900), /inert=\{sheetSnap === 'expanded'\}/,
    'the control column must be inert while the expanded sheet overlaps it');
  assert.match(column.slice(0, 900), /opacity-45/,
    'an unavailable control must also look unavailable');
});

test('the grabber band that caused the collision is still the full-width sheet handle', () => {
  assert.match(routeMap, /route-sheet-grabber\s+flex\s+w-full/,
    'if the grabber stops being full width, revisit whether the column can stay live');
});
