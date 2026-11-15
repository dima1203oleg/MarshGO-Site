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

test('journey route map Escape dismisses the topmost layer before leaving the screen', () => {
  const routeMap = source('src/views/JourneyRouteMapScreen.tsx');
  assert.match(routeMap, /if \(event\.key !== 'Escape'\) return;/);
  assert.match(routeMap, /if \(mapSegmentChoices\) \{ setMapSegmentChoices\(null\); return; \}/);
  assert.match(routeMap, /if \(previewLegIndex !== null\) \{ cancelPreview\(\); return; \}/);
  assert.match(routeMap, /onBack\(\);/);
  assert.match(routeMap, /window\.addEventListener\('keydown', handleKeyDown\)/);
  assert.match(routeMap, /window\.removeEventListener\('keydown', handleKeyDown\)/);
});
