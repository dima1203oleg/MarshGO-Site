import assert from 'node:assert/strict';
import test from 'node:test';
import { RouteCameraController, shouldShowRecenterButton, type RouteCameraState } from '../src/map/routeCameraController';
import type { MapAdapter } from '../src/map/MapAdapter';
import { claimCameraForUserGesture } from '../src/map/cameraMotion';

const routePoints: [number, number][] = [[24.03, 49.83], [24.06, 49.84], [24.09, 49.86]];

/** Records every camera move the controller asks for, so a refit cannot hide inside a mock. */
function fakeAdapter() {
  const calls: string[] = [];
  const adapter = {
    focusCoordinates(points: [number, number][]) { calls.push(`focusCoordinates:${points.length}`); },
    fitRoute() { calls.push('fitRoute'); },
    focus(_point: [number, number], zoom?: number) { calls.push(`focus:${zoom ?? ''}`); },
    setActiveRouteSegment(id: string | null) { calls.push(`activeSegment:${id}`); },
  } as unknown as MapAdapter;
  return { adapter, calls };
}

test('a rider gesture hands ownership to the screen and the sheet then leaves the camera alone', () => {
  const { adapter, calls } = fakeAdapter();
  let mode: RouteCameraState['mode'] = 'ROUTE_OVERVIEW';
  const controller = new RouteCameraController({ adapter, onStateChange: state => { mode = state.mode; } });

  controller.syncOnSnapSettled({ routePoints });
  assert.deepEqual(calls, ['focusCoordinates:3'], 'an automatic mode refits when the sheet settles');

  calls.length = 0;
  // The adapter's own wiring: real input publishes ownership, a programmatic animation does not.
  claimCameraForUserGesture({ type: 'touchmove' }, () => controller.onUserMapInteraction());
  assert.equal(mode, 'MANUAL_CAMERA');

  calls.length = 0;
  controller.syncOnSnapSettled({ routePoints });
  controller.syncOnSnapSettled({ routePoints });
  assert.deepEqual(calls, [], 'the camera must not be yanked back while the rider is driving it');
  assert.equal(shouldShowRecenterButton(controller.getState()), true);
});

test('programmatic camera animations never claim rider ownership', () => {
  const { adapter } = fakeAdapter();
  let notified = 0;
  const controller = new RouteCameraController({ adapter, onStateChange: () => { notified++; } });
  claimCameraForUserGesture(undefined, () => controller.onUserMapInteraction());
  claimCameraForUserGesture(null, () => controller.onUserMapInteraction());
  assert.equal(notified, 0);
  assert.equal(controller.getState().mode, 'ROUTE_OVERVIEW');
});

test('the explicit recenter returns the camera to the whole route and ends manual mode', () => {
  const { adapter, calls } = fakeAdapter();
  const controller = new RouteCameraController({ adapter });
  controller.onUserMapInteraction();
  calls.length = 0;

  controller.showOverview(routePoints);

  assert.equal(controller.getState().mode, 'ROUTE_OVERVIEW');
  assert.deepEqual(calls, ['activeSegment:null', 'focusCoordinates:3']);
  assert.equal(shouldShowRecenterButton(controller.getState()), false);
});

test('choosing a stage from manual mode focuses it instead of staying put', () => {
  const { adapter, calls } = fakeAdapter();
  const controller = new RouteCameraController({ adapter });
  controller.onUserMapInteraction();
  calls.length = 0;

  controller.focusSegment('leg-BUS-1', { points: [[24.05, 49.84], [24.07, 49.85]] as [number, number][], bearing: 0, key: 'k' });

  assert.equal(controller.getState().mode, 'SEGMENT_FOCUS');
  assert.deepEqual(calls, ['activeSegment:leg-BUS-1', 'focusCoordinates:2']);
});
