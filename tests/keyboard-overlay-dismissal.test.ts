import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

test('MapPointPicker closes on Escape and uses canonical dark-theme surfaces', () => {
  const picker = source('src/components/MapPointPicker.tsx');
  assert.match(picker, /event\.key === 'Escape'\) onClose\(\)/);
  assert.match(picker, /dark:bg-\[var\(--mg-canvas\)\]/);
  assert.match(picker, /dark:bg-\[var\(--mg-surface-primary\)\]/);
  assert.match(picker, /text-\[var\(--mg-ink-primary\)\]/);
});

test('journey route map closes on Escape through its supplied back action', () => {
  const routeMap = source('src/views/JourneyRouteMapScreen.tsx');
  assert.match(routeMap, /event\.key === 'Escape'\) onBack\(\)/);
  assert.match(routeMap, /window\.addEventListener\('keydown', handleKeyDown\)/);
  assert.match(routeMap, /window\.removeEventListener\('keydown', handleKeyDown\)/);
});
