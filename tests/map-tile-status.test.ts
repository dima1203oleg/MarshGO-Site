import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { initialMapTileHealth, mapTileKey, reduceMapTileHealth } from '../src/services/mapTileStatus';

describe('map tile health status', () => {
  it('distinguishes a missing provider from a configured provider loading tiles', () => {
    assert.equal(initialMapTileHealth(false).status, 'unconfigured');
    assert.equal(initialMapTileHealth(true).status, 'loading');
  });

  it('does not mark the map available while any visible tile failed', () => {
    const first = mapTileKey({ z: 8, x: 133, y: 91 });
    const second = mapTileKey({ z: 8, x: 134, y: 91 });
    let health = initialMapTileHealth(true);
    health = reduceMapTileHealth(health, 'tileload', first);
    health = reduceMapTileHealth(health, 'tileerror', second);
    assert.equal(health.status, 'degraded');
    assert.deepEqual([...health.loaded], [first]);
    assert.deepEqual([...health.failed], [second]);

    health = reduceMapTileHealth(health, 'tileload', second);
    assert.equal(health.status, 'available');
    assert.equal(health.failed.size, 0);
  });

  it('removes old viewport tiles when the renderer unloads them during zoom', () => {
    let health = initialMapTileHealth(true);
    health = reduceMapTileHealth(health, 'tileerror', '8/133/91');
    assert.equal(health.status, 'failed');
    health = reduceMapTileHealth(health, 'tileunload', '8/133/91');
    assert.equal(health.status, 'loading');
    health = reduceMapTileHealth(health, 'tileload', '9/266/182');
    assert.equal(health.status, 'available');
  });
});
