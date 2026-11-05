import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { mapStatusDetail } from '../src/map/mapStatusCopy';

const view = () => readFileSync('src/views/TransportMapView.tsx', 'utf8');

describe('live map basemap states', () => {
  it('explains an unconfigured basemap instead of leaving a blank canvas', () => {
    assert.match(view(), /status === 'unconfigured'/);
    assert.match(view(), /mapStatusDetail\(status, 'transport'\)/, 'the wording lives in the shared copy module, not in one screen');
    assert.match(mapStatusDetail('unconfigured', 'transport'), /Підкладку з вулицями не налаштовано/);
  });

  it('keeps a missing basemap separate from a network failure', () => {
    assert.doesNotMatch(mapStatusDetail('unconfigured', 'transport'), /Перевірте мережу/, "a misconfigured build is not the passenger's network");
    assert.match(mapStatusDetail('failed', 'transport'), /перевірте мережу/i, 'a failed style really is a network problem');
  });

  /**
   * What each state is allowed to promise, and why the two differ:
   * - `unconfigured` — MapLibreAdapter still gets a `load` event from the blank fallback style and
   *   `installLayers()` runs before the status is published (MapLibreAdapter.ts:164), so lines,
   *   stops and vehicles really do paint over the empty field. Saying so is the useful half of the
   *   message: the journey is still readable.
   * - `failed` — the style request itself never resolves, so no `load`, no layers and an empty
   *   canvas. Proven in the browser: basemap-blocked-light.png / basemap-blocked-dark.png
   *   (2026-11-05) show 0 markers and nothing but chips. Promising «видно» there would be a lie.
   */
  it('promises visible overlays only where the code can deliver them', () => {
    assert.match(mapStatusDetail('unconfigured', 'transport'), /видно/, 'the layers are installed even without a basemap');
    for (const status of ['failed', 'loading'] as const) {
      assert.doesNotMatch(mapStatusDetail(status, 'transport'), /видно/, `${status} must not claim overlays survived`);
    }
  });

  it('says so when the basemap half-loaded', () => {
    assert.match(view(), /status === 'degraded'/, 'a partially loaded basemap is a defect the passenger should hear about');
    assert.match(mapStatusDetail('degraded', 'transport'), /частково/i);
  });
});
