import type { Coordinate } from '../../shared/navigation/contracts';
import type { MapAdapter, RouteFitPadding } from './MapAdapter';
import {
  buildFlightPath,
  cinematicCameraFrame,
  createFlightPlayback,
  dockCameraFrame,
  flightDurationMs,
  lerpBearing,
  type FlightKind,
} from './hyperFlightEngine';

/**
 * GPS-independent route preview: one requestAnimationFrame loop flies the
 * camera along a leg's confirmed polyline. The module never reads geolocation,
 * never writes journey progress and never calls the API — its only inputs are
 * verified geometry and an injected scheduler, so tests can drive every frame.
 */
export interface PreviewFlightLeg {
  id: string;
  label: string;
  kind: FlightKind;
  color: string;
  coordinates: Coordinate[];
}

export interface PreviewFlightScheduler {
  now(): number;
  requestFrame(callback: (now: number) => void): number;
  cancelFrame(handle: number): void;
  setTimer(callback: () => void, ms: number): number;
  clearTimer(handle: number): void;
}

export interface RoutePreviewFlightOptions {
  adapter: MapAdapter;
  leg: PreviewFlightLeg;
  index: number;
  nextLeg?: PreviewFlightLeg | null;
  initialFraction?: number;
  autoplay?: boolean;
  reducedMotion: boolean;
  padding?: RouteFitPadding;
  getPerspective(): '2d' | '3d';
  responseMs?: number;
  transitionMs?: number;
  dockHoldMs?: number;
  onPlayingChange(playing: boolean): void;
  onBegin(totalMeters: number, label: string): void;
  onProgress(fraction: number): void;
  onAdvance?(nextIndex: number): void;
  onFinish?(): void;
  scheduler?: PreviewFlightScheduler;
}

export interface RoutePreviewFlight {
  readonly cancelled: boolean;
  readonly playing: boolean;
  pause(): void;
  play(): void;
  seek(fraction: number): void;
  cancel(): void;
}

const defaultScheduler: PreviewFlightScheduler = {
  now: () => performance.now(),
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: handle => cancelAnimationFrame(handle),
  setTimer: (callback, ms) => window.setTimeout(callback, ms),
  clearTimer: handle => window.clearTimeout(handle),
};

export function createRoutePreviewFlight(options: RoutePreviewFlightOptions): RoutePreviewFlight | null {
  const path = buildFlightPath(options.leg.coordinates);
  if (!path) return null;
  const {
    adapter, leg, index, nextLeg = null,
    initialFraction = 0, autoplay = true, reducedMotion,
    padding, getPerspective,
    responseMs = 180, transitionMs = 420, dockHoldMs = 900,
    onPlayingChange, onBegin, onProgress, onAdvance, onFinish,
    scheduler = defaultScheduler,
  } = options;
  const clock = createFlightPlayback(flightDurationMs(path.totalMeters, leg.kind), initialFraction);
  const nextPath = nextLeg ? buildFlightPath(nextLeg.coordinates) : null;
  const startZoom = adapter.getCameraZoom?.();
  const points = [...path.points];
  let cancelled = false;
  let playing = false;
  let raf = 0;
  const timers: number[] = [];
  let lastBearing: number | null = null;
  let lastFrameAt = scheduler.now();

  const clearTimers = () => {
    timers.forEach(timer => scheduler.clearTimer(timer));
    timers.length = 0;
  };
  const render = (now: number, transition = 0) => {
    const sample = clock.sample(now);
    const frame = cinematicCameraFrame(path, sample.fraction, { kind: leg.kind, startZoom, perspective: getPerspective() });
    if (!transition && lastBearing !== null) {
      const delta = ((frame.bearing - lastBearing + 540) % 360) - 180;
      const response = Math.min(1 - Math.exp(-(now - lastFrameAt) / responseMs), Math.abs(delta) > 0 ? 60 * (now - lastFrameAt) / 1000 / Math.abs(delta) : 1);
      frame.bearing = lerpBearing(lastBearing, frame.bearing, response);
    }
    lastBearing = frame.bearing;
    lastFrameAt = now;
    adapter.setCinematicCamera?.(frame, padding, transition);
    adapter.revealSegmentProgress?.(points, leg.color, sample.fraction);
    onProgress(sample.fraction);
    return sample;
  };
  const pause = () => {
    playing = false;
    clock.pause(scheduler.now());
    scheduler.cancelFrame(raf);
    clearTimers();
    adapter.setCinematicFlightActive?.(false);
    onPlayingChange(false);
  };
  const tick = (now: number) => {
    if (cancelled || !playing) return;
    const sample = render(now);
    if (!sample.complete) { raf = scheduler.requestFrame(tick); return; }
    pause();
    const dock = dockCameraFrame(path, nextPath, leg.kind, getPerspective());
    adapter.setCinematicCamera?.(dock, padding, transitionMs);
    adapter.pingDock?.(dock.marker, leg.color);
    adapter.fadeSegmentReveal?.();
    if (nextLeg && onAdvance) {
      timers.push(scheduler.setTimer(() => { if (!cancelled) onAdvance(index + 1); }, dockHoldMs));
    } else {
      onFinish?.();
    }
  };
  const play = () => {
    if (cancelled || playing || reducedMotion) return;
    clearTimers();
    if (clock.sample(scheduler.now()).complete) clock.seek(0, scheduler.now());
    adapter.setCinematicFlightActive?.(true);
    render(scheduler.now(), transitionMs);
    playing = true;
    onPlayingChange(true);
    timers.push(scheduler.setTimer(() => {
      if (cancelled || !playing) return;
      lastFrameAt = scheduler.now();
      clock.play(lastFrameAt);
      raf = scheduler.requestFrame(tick);
    }, transitionMs));
  };
  const flight: RoutePreviewFlight = {
    get cancelled() { return cancelled; },
    get playing() { return playing; },
    pause,
    play,
    seek(value: number) {
      pause();
      adapter.setCinematicFlightActive?.(true);
      clock.seek(value, scheduler.now());
      render(scheduler.now(), transitionMs);
    },
    cancel() {
      cancelled = true;
      playing = false;
      scheduler.cancelFrame(raf);
      clearTimers();
      adapter.setCinematicFlightActive?.(false);
      onPlayingChange(false);
    },
  };
  adapter.setActiveRouteSegment?.(leg.id);
  adapter.setCinematicFlightActive?.(true);
  adapter.clearSegmentReveal?.();
  adapter.setRouteFlow?.(null);
  onBegin(path.totalMeters, leg.label);
  onProgress(initialFraction);
  if (autoplay) play();
  else flight.seek(initialFraction);
  return flight;
}