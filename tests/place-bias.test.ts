import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

const { currentPlaceBias } = await import('../src/platform/placeBias');

function stubNavigator(permissionState: string, onRead?: () => void) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      permissions: { query: async () => ({ state: permissionState }) },
      geolocation: {
        getCurrentPosition: (success: (position: { coords: { latitude: number; longitude: number } }) => void) => {
          onRead?.();
          success({ coords: { latitude: 49.8397, longitude: 24.0297 } });
        },
      },
    },
  });
}

describe('Місцевість для підказок місць', () => {
  test('не читає геолокацію, доки дозвіл не надано', async () => {
    let read = false;
    stubNavigator('prompt', () => { read = true; });
    assert.equal(await currentPlaceBias(), undefined);
    assert.equal(read, false);
  });

  test('повертає координати перегляду, коли дозвіл надано', async () => {
    stubNavigator('granted');
    assert.deepEqual(await currentPlaceBias(), { latitude: 49.8397, longitude: 24.0297 });
  });

  test('мовчки поступається, коли браузер відмовляє у фіксії', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        permissions: { query: async () => ({ state: 'granted' }) },
        geolocation: { getCurrentPosition: (_ok: unknown, error: (reason: unknown) => void) => error({ code: 1 }) },
      },
    });
    assert.equal(await currentPlaceBias(), undefined);
  });
});
