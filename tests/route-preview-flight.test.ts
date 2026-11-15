import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { MapAdapter } from '../src/map/MapAdapter';
import { createRoutePreviewFlight, type PreviewFlightLeg, type PreviewFlightScheduler } from '../src/map/routePreviewFlight';
import { buildFlightPath } from '../src/map/hyperFlightEngine';
import type { Coordinate } from '../shared/navigation/contracts';

function createFakeScheduler() {
  let now = 0;
  let nextHandle = 1;
  const frames = new Map<number, (now: number) => void>();
  const timers = new Map<number, { callback: () => void; at: number }>();
  const scheduler: PreviewFlightScheduler = {
    now: () => now,
    requestFrame(callback) { const handle = nextHandle++; frames.set(handle, callback); return handle; },
    cancelFrame(handle) { frames.delete(handle); },
    setTimer(callback, ms) { const handle = nextHandle++; timers.set(handle, { callback, at: now + ms }); return handle; },
    clearTimer(handle) { timers.delete(handle); },
  };
  return {
    scheduler,
    advance(ms: number) { now += ms; },
    runFrames() {
      const due = [...frames.values()];
      frames.clear();
      due.forEach(callback => callback(now));
      return due.length;
    },
    runTimers() {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= now);
      due.forEach(([handle, timer]) => { timers.delete(handle); timer.callback(); });
      return due.length;
    },
    pending() { return frames.size + timers.size; },
  };
}

interface RecordedFrame { center: Coordinate; zoom: number; bearing: number; pitch: number }

function createFakeAdapter() {
  const calls: string[] = [];
  const cameraFrames: RecordedFrame[] = [];
  const revealFractions: number[] = [];
  const dockPings: Coordinate[] = [];
  const playingChanges: boolean[] = [];
  const adapter: MapAdapter = {
    setRoute() { calls.push('setRoute'); },
    onRouteSegmentSelect() { calls.push('onRouteSegmentSelect'); },
    onCameraModeChange() { calls.push('onCameraModeChange'); },
    setWaypoints() { calls.push('setWaypoints'); },
    fitRoute() { calls.push('fitRoute'); },
    recenter() { calls.push('recenter'); },
    setCameraMode(mode) { calls.push(`setCameraMode:${mode}`); },
    setTheme() { calls.push('setTheme'); },
    setLayer() { calls.push('setLayer'); },
    setPerspective() { calls.push('setPerspective'); },
    setTransportLayers() { calls.push('setTransportLayers'); },
    setTransportDisplayPreferences() { calls.push('setTransportDisplayPreferences'); },
    focus() { calls.push('focus'); },
    onTransportHint() { calls.push('onTransportHint'); },
    retry() { calls.push('retry'); },
    destroy() { calls.push('destroy'); },
    getStatus: () => 'available',
    setActiveRouteSegment(id) { calls.push(`setActiveRouteSegment:${id}`); },
    setCinematicFlightActive(active) { calls.push(`setCinematicFlightActive:${active}`); },
    setCinematicCamera(frame) { calls.push('setCinematicCamera'); cameraFrames.push(frame); },
    getCameraZoom: () => 14,
    revealSegmentProgress(_coordinates, _color, progress = 1) { calls.push('revealSegmentProgress'); revealFractions.push(progress); },
    fadeSegmentReveal() { calls.push('fadeSegmentReveal'); },
    clearSegmentReveal() { calls.push('clearSegmentReveal'); },
    setRouteFlow() { calls.push('setRouteFlow'); },
    pingDock(coordinate) { calls.push('pingDock'); dockPings.push(coordinate); },
  };
  return { adapter, calls, cameraFrames, revealFractions, dockPings, playingChanges };
}

const legCoordinates: Coordinate[] = [[24.0163, 49.8660], [24.0210, 49.8620], [24.0270, 49.8570], [24.0330, 49.8520]];
const nextCoordinates: Coordinate[] = [[24.0330, 49.8520], [24.0400, 49.8480], [24.0470, 49.8430]];

const leg: PreviewFlightLeg = { id: 'leg-1', label: 'Перегляд · Трамвай 1', kind: 'transit', color: '#2563EB', coordinates: legCoordinates };
const nextLeg: PreviewFlightLeg = { id: 'leg-2', label: 'Перегляд · Пішки', kind: 'walk', color: '#8E9CB3', coordinates: nextCoordinates };

function flyToCompletion(clock: ReturnType<typeof createFakeScheduler>) {
  for (let step = 0; step < 200 && clock.pending() > 0; step += 1) {
    clock.advance(120);
    clock.runTimers();
    clock.runFrames();
  }
}

test('invalid geometry creates no flight and touches no map state', () => {
  const fake = createFakeAdapter();
  const clock = createFakeScheduler();
  const flight = createRoutePreviewFlight({
    adapter: fake.adapter,
    leg: { ...leg, coordinates: [[24.01, 49.86]] },
    index: 0,
    reducedMotion: false,
    getPerspective: () => '2d',
    onPlayingChange: () => undefined,
    onBegin: () => undefined,
    onProgress: () => undefined,
    scheduler: clock.scheduler,
  });
  assert.equal(flight, null);
  assert.deepEqual(fake.calls, []);
  assert.equal(clock.pending(), 0);
});

test('autoplay flies the confirmed polyline, docks and schedules the next leg', () => {
  const fake = createFakeAdapter();
  const clock = createFakeScheduler();
  const progress: number[] = [];
  const advanced: number[] = [];
  let finished = 0;
  const flight = createRoutePreviewFlight({
    adapter: fake.adapter,
    leg,
    nextLeg,
    index: 0,
    reducedMotion: false,
    transitionMs: 0,
    getPerspective: () => '3d',
    onPlayingChange: playing => fake.playingChanges.push(playing),
    onBegin: () => undefined,
    onProgress: fraction => progress.push(fraction),
    onAdvance: index => advanced.push(index),
    onFinish: () => { finished += 1; },
    scheduler: clock.scheduler,
  });
  assert.ok(flight);
  assert.equal(fake.playingChanges.at(-1), true);
  flyToCompletion(clock);
  assert.ok(fake.cameraFrames.length > 5, 'the camera is driven per frame, not once');
  assert.ok(progress.at(-1)! >= 0.999, 'playback reaches the end of the leg');
  assert.equal(fake.dockPings.length, 1, 'docking pings the exact end of the flown geometry');
  const path = buildFlightPath(legCoordinates)!;
  const end = path.fractionPoint(1);
  assert.ok(Math.abs(fake.dockPings[0]![0] - end[0]) < 1e-9 && Math.abs(fake.dockPings[0]![1] - end[1]) < 1e-9);
  assert.equal(finished, 0);
  clock.advance(1000);
  clock.runTimers();
  assert.deepEqual(advanced, [1], 'the next leg is scheduled after the dock hold');
  assert.equal(fake.calls.filter(call => call === 'setCinematicFlightActive:false').length >= 1, true);
  // Every frame stays on the provider's own shape: revealed fractions never decrease.
  for (let index = 1; index < fake.revealFractions.length; index += 1) {
    assert.ok(fake.revealFractions[index]! >= fake.revealFractions[index - 1]! - 1e-9);
  }
  // The preview only drives cinematic map methods — no GPS, follow mode or route mutation.
  const forbidden = fake.calls.filter(call => /^(setRoute|setWaypoints|recenter|setCameraMode|focus|fitRoute)(:|$)/.test(call));
  assert.deepEqual(forbidden, []);
});

test('pause stops the loop and keeps the camera where the rider left it', () => {
  const fake = createFakeAdapter();
  const clock = createFakeScheduler();
  const flight = createRoutePreviewFlight({
    adapter: fake.adapter, leg, index: 0, reducedMotion: false, transitionMs: 0,
    getPerspective: () => '2d',
    onPlayingChange: playing => fake.playingChanges.push(playing),
    onBegin: () => undefined, onProgress: () => undefined,
    scheduler: clock.scheduler,
  })!;
  clock.advance(120); clock.runTimers(); clock.runFrames();
  const framesBeforePause = fake.cameraFrames.length;
  assert.equal(flight.playing, true, 'playing is readable synchronously, without React state');
  flight.pause();
  assert.equal(flight.playing, false);
  assert.equal(fake.playingChanges.at(-1), false);
  clock.advance(5000); clock.runTimers(); clock.runFrames();
  assert.equal(fake.cameraFrames.length, framesBeforePause, 'no camera writes after pause');
  flight.play();
  assert.equal(flight.playing, true);
  assert.equal(fake.playingChanges.at(-1), true);
  clock.advance(120); clock.runTimers(); clock.runFrames();
  assert.ok(fake.cameraFrames.length > framesBeforePause, 'resume continues the same flight');
  flight.cancel();
});

test('seek renders one frame at the requested fraction without playing', () => {
  const fake = createFakeAdapter();
  const clock = createFakeScheduler();
  const progress: number[] = [];
  const flight = createRoutePreviewFlight({
    adapter: fake.adapter, leg, index: 0, autoplay: false, initialFraction: 0.5, reducedMotion: false, transitionMs: 0,
    getPerspective: () => '2d',
    onPlayingChange: playing => fake.playingChanges.push(playing),
    onBegin: () => undefined, onProgress: fraction => progress.push(fraction),
    scheduler: clock.scheduler,
  })!;
  assert.equal(fake.playingChanges.at(-1), false);
  assert.ok(Math.abs(progress.at(-1)! - 0.5) < 0.01);
  const framesAfterSeek = fake.cameraFrames.length;
  clock.advance(5000); clock.runTimers(); clock.runFrames();
  assert.equal(fake.cameraFrames.length, framesAfterSeek, 'seek does not start playback');
  flight.seek(0.9);
  assert.ok(Math.abs(progress.at(-1)! - 0.9) < 0.01);
  flight.cancel();
});

test('reduced motion never auto-plays but scrubbing still works', () => {
  const fake = createFakeAdapter();
  const clock = createFakeScheduler();
  const flight = createRoutePreviewFlight({
    adapter: fake.adapter, leg, index: 0, reducedMotion: true, transitionMs: 0,
    getPerspective: () => '2d',
    onPlayingChange: playing => fake.playingChanges.push(playing),
    onBegin: () => undefined, onProgress: () => undefined,
    scheduler: clock.scheduler,
  })!;
  assert.equal(fake.playingChanges.includes(true), false);
  clock.advance(5000); clock.runTimers(); clock.runFrames();
  assert.equal(fake.cameraFrames.length, 0, 'reduced motion renders no autoplay frame');
  flight.seek(0.75);
  assert.equal(fake.cameraFrames.length, 1, 'scrubbing still renders a single static frame');
  flight.cancel();
});

test('the last leg finishes without scheduling a next leg', () => {
  const fake = createFakeAdapter();
  const clock = createFakeScheduler();
  let finished = 0;
  const advanced: number[] = [];
  createRoutePreviewFlight({
    adapter: fake.adapter, leg, index: 2, nextLeg: null, reducedMotion: false, transitionMs: 0,
    getPerspective: () => '2d',
    onPlayingChange: () => undefined, onBegin: () => undefined, onProgress: () => undefined,
    onAdvance: index => advanced.push(index),
    onFinish: () => { finished += 1; },
    scheduler: clock.scheduler,
  });
  flyToCompletion(clock);
  clock.advance(5000); clock.runTimers();
  assert.equal(finished, 1);
  assert.deepEqual(advanced, []);
});

test('cancel clears every pending frame and timer', () => {
  const fake = createFakeAdapter();
  const clock = createFakeScheduler();
  const flight = createRoutePreviewFlight({
    adapter: fake.adapter, leg, nextLeg, index: 0, reducedMotion: false, transitionMs: 0,
    getPerspective: () => '2d',
    onPlayingChange: playing => fake.playingChanges.push(playing),
    onBegin: () => undefined, onProgress: () => undefined,
    scheduler: clock.scheduler,
  })!;
  clock.advance(120); clock.runTimers(); clock.runFrames();
  flight.cancel();
  assert.equal(flight.cancelled, true);
  assert.equal(fake.playingChanges.at(-1), false);
  const framesAfterCancel = fake.cameraFrames.length;
  clock.advance(60_000); clock.runTimers(); clock.runFrames();
  assert.equal(fake.cameraFrames.length, framesAfterCancel);
  assert.equal(clock.pending(), 0);
  assert.equal(fake.calls.at(-1), 'setCinematicFlightActive:false');
});

test('the route screen wires preview without GPS, API or journey-progress side effects', () => {
  const source = readFileSync(join(process.cwd(), 'src/views/JourneyRouteMapScreen.tsx'), 'utf8');
  const previewBlock = source.slice(source.indexOf('const stopPreviewFlight'), source.indexOf('const routeLinePoints'));
  assert.ok(previewBlock.length > 0);
  assert.doesNotMatch(previewBlock, /geolocation|getCurrentPosition|watchPosition|productionApi\.|activatePassengerJourney|localStorage/);
  assert.match(source, /adapter\.onCinematicInterrupt = pausePreview/);
  assert.match(source, /<FlightTelemetry/);
  assert.equal((source.match(/<FlightTelemetry[\s>]/g) ?? []).length, 1, 'exactly one preview HUD');
  assert.match(source, /data-testid="route-preview-start"/);
  assert.match(source, /Переглянути маршрут/);
  assert.match(source, /не GPS/);
  assert.match(source, /cancelPreview\(\);\s*return \(\) => cancelPreview\(\);/);
});