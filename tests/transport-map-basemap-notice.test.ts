import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { mapStatusDetail } from '../src/map/mapStatusCopy';

const view = () => readFileSync('src/views/TransportMapView.tsx', 'utf8');

describe('live map basemap states', () => {
  it('explains an unconfigured basemap instead of leaving a blank canvas', () => {
    assert.match(view(), /status === 'unconfigured'/);
    assert.match(view(), /mapStatusDetail\(status, 'transport'\)/,
      'the notice must read the shared copy module, not a string baked into this view');
    // Passenger copy, not build vocabulary: say what is missing and where the data still lives.
    assert.match(mapStatusDetail('unconfigured', 'transport'), /Мапа тимчасово без вулиць і будинків/);
    assert.doesNotMatch(`${view()}${mapStatusDetail('unconfigured', 'transport')}`, /тайл|manifest|налаштован/i);
  });

  it('keeps a missing basemap separate from a network failure and points at the list', () => {
    const notice = view().split(/\n/).find((line) => line.includes("status === 'unconfigured'"));
    assert.ok(notice, 'the transport map must render an unconfigured notice');
    assert.doesNotMatch(notice, /Перевірте мережу/, 'a misconfigured build is not the passenger\'s network');
    assert.doesNotMatch(mapStatusDetail('unconfigured', 'transport'), /мереж/i);
    assert.match(mapStatusDetail('unconfigured', 'transport'), /списку нижче/);
    assert.match(mapStatusDetail('degraded', 'transport'), /частково/);
  });
});
