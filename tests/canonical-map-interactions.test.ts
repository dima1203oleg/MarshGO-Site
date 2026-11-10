import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const primaryMapViews = [
  'src/views/JourneyRouteMapScreen.tsx',
  'src/views/JourneyActiveNavigation.tsx',
  'src/views/TransportMapView.tsx',
  'src/views/ProductionNavigation.tsx',
];

test('all primary interactive maps share the same vertical zoom and sound controls', () => {
  for (const path of primaryMapViews) {
    const source = read(path);
    assert.match(source, /<MapControlRail\b/, `${path} is missing the shared vertical control rail`);
    assert.match(source, /<MapZoomControls\b/, `${path} is missing the shared vertical zoom buttons`);
    assert.match(source, /<MapVoiceControl\b/, `${path} is missing the shared voice preference control`);
    assert.match(source, /<MapPerspectiveControl\s*\/>/, `${path} is missing the shared 2D/3D camera control`);
    assert.match(source, /<MapBasemapControl\s*\/>/, `${path} is missing the shared basemap control`);
  }

  const controls = read('src/components/MapInteractionControls.tsx');
  assert.match(controls, /h-12 w-12/, 'map controls keep the canonical 48px touch target');
  assert.match(controls, /flex flex-col items-center gap-2/, 'the shared rail stacks controls vertically');
  assert.match(controls, /<ZoomButton direction=\{1\}/);
  assert.match(controls, /<ZoomButton direction=\{-1\}/);
  assert.match(controls, /aria-pressed=\{voiceOn\}/);
});

test('active navigation uses the shared globe for basemaps without a second square switch', () => {
  const navigation = read('src/views/ProductionNavigation.tsx');
  assert.match(navigation, /<MapBasemapControl\s*\/>/);
  assert.doesNotMatch(navigation, /NavigationBasemapPreview|navigation-basemap-preview|previewTileUrl/);
});

test('MapLibre explicitly keeps one-finger pan and pinch zoom enabled', () => {
  const adapter = read('src/map/MapLibreAdapter.ts');
  assert.match(adapter, /dragPan:\s*true/);
  assert.match(adapter, /touchZoomRotate:\s*true/);
  assert.match(adapter, /cooperativeGestures:\s*false/);
});

test('voice preference is persisted and shared between map screens and turn-by-turn navigation', () => {
  const preference = read('src/services/voiceGuidancePreference.ts');
  const navigation = read('src/views/ProductionNavigation.tsx');
  assert.match(preference, /marshgo\.navigation\.voice/);
  assert.match(preference, /localStorage\.setItem/);
  assert.match(preference, /VOICE_GUIDANCE_EVENT/);
  assert.match(navigation, /useVoiceGuidancePreference/);
  assert.match(navigation, /setVoiceGuidancePreference\(next\)/);
});
