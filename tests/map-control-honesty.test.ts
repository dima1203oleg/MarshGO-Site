import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const css = () => readFileSync('src/index.css', 'utf8');
const mode = () => readFileSync('src/map/mapMode.ts', 'utf8');
const explore = () => readFileSync('src/views/TransportMapView.tsx', 'utf8');
const route = () => readFileSync('src/views/JourneyRouteMapScreen.tsx', 'utf8');
const mapControls = () => readFileSync('src/components/MapInteractionControls.tsx', 'utf8');
const marketplace = () => readFileSync('src/views/ProductionMarketplace.tsx', 'utf8');
const photo = () => readFileSync('src/components/DriverPhotoCard.tsx', 'utf8');

describe('a control must not claim a capability the build does not have', () => {
  it('exposes one satellite readiness flag and one honest reason', () => {
    assert.match(mode(), /export const satelliteBasemapAvailable = Boolean\(satelliteTiles && satelliteAttribution\)/);
    assert.match(mode(), /export const SATELLITE_UNAVAILABLE_NOTE = 'Супутникові знімки не підключені\.'/);
  });

  it('refuses a stored satellite choice the deployment cannot serve', () => {
    assert.match(mode(), /function honorLayerAvailability\(layer: MapLayer\): MapLayer \{\s*return layer === 'satellite' && !satelliteBasemapAvailable \? 'simple' : layer;/);
    assert.match(mode(), /const next = honorLayerAvailability\(layer\);/, 'a click cannot persist a basemap the build cannot fetch');
    assert.match(mode(), /honorLayerAvailability\(saved\)/, 'a stored preference is re-checked on every read');
    assert.match(mode(), /if \(resolved !== saved\) \{ try \{ localStorage\.setItem\(LAYER_KEY, resolved\)/, 'the refused choice is written back so a later read cannot disagree');
  });

  it('gates every satellite control on that flag instead of toggling a look', () => {
    const component = mapControls().split('export function MapBasemapControl()')[1];
    assert.ok(component, 'all map views must reuse one basemap control');
    assert.match(component, /satelliteBasemapAvailable[\s\S]{0,500}aria-label=\{label\}/, 'the shared globe chip needs an honest accessible name');
    assert.match(component, /aria-pressed=\{satelliteBasemapAvailable && layer === 'satellite'\}/, 'aria-pressed must never be true without imagery');
    assert.match(component, /aria-disabled=\{!satelliteBasemapAvailable\}/, 'the chip must announce itself disabled');
    assert.match(component, /disabled=\{!satelliteBasemapAvailable\}/, 'a real disabled attribute keeps keyboard and screen-reader users out');
    assert.match(component, /if \(satelliteBasemapAvailable\) setMapLayer\(next\)/, 'the handler must refuse unavailable imagery');
    assert.doesNotMatch(route(), /satelliteBasemapAvailable/);
    assert.doesNotMatch(explore(), /satelliteBasemapAvailable/);
  });

  it('lets a control that cannot work look like it cannot work', () => {
    assert.match(css(), /\.route-map-control\[aria-disabled="true"\][^}]*cursor: not-allowed;/s);
  });
});

describe('pressed state is owned by the theme, not by a utility class that loses the cascade', () => {
  it('keys the on-state to aria-pressed, which an unlayered rule can actually win', () => {
    const active = css().match(/\.route-map-control\[aria-pressed="true"\]\s*\{[^}]*\}/s)?.[0];
    assert.ok(active, 'the route map controls need an unlayered pressed rule');
    assert.match(active, /background: var\(--route-control-active-bg\);/);
    assert.match(active, /color: var\(--route-control-active-ink\);/);
    for (const token of ['--route-control-active-bg', '--route-control-active-ink']) {
      assert.equal((css().match(new RegExp(`\\s${token}:`, 'g')) ?? []).length, 2, `${token} must be defined in the light and the dark route block`);
    }
  });

  it('drops the dead Tailwind active classes from the route-screen chips', () => {
    const controls = mapControls();
    assert.match(route(), /<MapPerspectiveControl\s*\/>/);
    assert.match(route(), /<MapBasemapControl\s*\/>/);
    assert.doesNotMatch(controls, /bg-\[var\(--mg-action\)\]/, 'the shared pressed style is owned by the unlayered map-control rule');
    assert.match(css(), /\.map-interaction-control\[aria-pressed="true"\]\s*\{[^}]*background: var\(--mg-action\);[^}]*color: #fff;/s);
  });
});

describe('everyday controls keep the touch and ink floors', () => {
  it('gives every «Оновити» button the 44 px floor', () => {
    const buttons = marketplace().split('\n').flatMap((line) => [...line.matchAll(/<button[^>]*>[^<]*Оновити/g)].map((m) => m[0]));
    assert.ok(buttons.length >= 5, `expected the refresh buttons across the trips, offers and admin screens, found ${buttons.length}`);
    for (const b of buttons) assert.match(b, /min-h-11/, 'a 32 px pill is not a touch target');
  });

  it('uses the small-text blue for the 12 px photo action', () => {
    const label = photo().split('\n').find((line) => line.includes('Додати фото обличчя'));
    assert.ok(label, 'the driver photo action must stay');
    assert.match(label, /text-\[var\(--mg-blue-ink\)\]/);
    assert.doesNotMatch(label, /text-\[var\(--mg-blue\)\]/, '--mg-blue is for strokes and large text; it does not clear AA at 12 px');
  });
});
