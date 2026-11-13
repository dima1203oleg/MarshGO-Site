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
test('floating map controls are omitted from the expanded reference composition', () => {
  assert.match(routeMap, /\{sheetSnap !== 'expanded' && \(\s*<MapControlRail/,
    'expanded details keep the map band clear; full controls return at smaller detents');
});

test('the grabber band that caused the collision is still the full-width sheet handle', () => {
  assert.match(routeMap, /route-sheet-grabber\s+flex\s+w-full/,
    'if the grabber stops being full width, revisit whether the column can stay live');
});
