import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const view = () => readFileSync('src/views/TransportMapView.tsx', 'utf8');

describe('live map basemap states', () => {
  it('explains an unconfigured basemap instead of leaving a blank canvas', () => {
    assert.match(view(), /status === 'unconfigured'/);
    assert.match(view(), /Не налаштовано базову карту/);
  });

  it('keeps a missing basemap separate from a network failure and promises nothing it cannot show', () => {
    const notice = view().split(/\n/).find((line) => line.includes("status === 'unconfigured'"));
    assert.ok(notice, 'the transport map must render an unconfigured notice');
    assert.doesNotMatch(notice, /Перевірте мережу/, 'a misconfigured build is not the passenger\'s network');
    assert.doesNotMatch(notice, /видно|доступн/, 'the notice must not claim overlays survive the missing basemap');
  });
});
