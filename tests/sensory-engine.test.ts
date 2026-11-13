import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import {
  sensoryRecipe, transportTimbreGroup, SENSORY_EVENT_TYPES,
  type SensoryEvent, type SensoryEventType,
} from '../src/sensory/sensoryEvents';
import {
  resolveSensoryOutput, throttleReason, recordPlay, createThrottleHistory, eventKey,
  MAX_GAIN, MAX_CONCURRENT_VOICES, DEDUP_WINDOW_MS, MIN_INTERVAL_MS,
} from '../src/sensory/sensoryPolicy';
import { interactionPreferences, DEFAULT_INTERACTION_PREFERENCES } from '../src/sensory/InteractionPreferences';

import { sensory } from '../src/sensory/SensoryOrchestrator';
import { sonicEngine } from '../src/sensory/SonicFeedbackEngine';
import { hapticAdapter } from '../src/sensory/HapticFeedbackAdapter';

const prefs = { ...DEFAULT_INTERACTION_PREFERENCES };

function nativeAdapter(plugin: Record<string, unknown> | undefined, vibrate?: (pattern: number[]) => boolean) {
  const source = readFileSync(new URL('../src/sensory/HapticFeedbackAdapter.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: { hapticAdapter?: typeof hapticAdapter } = {};
  runInNewContext(code, { exports, window: { Capacitor: { Plugins: { Haptics: plugin } } }, navigator: { vibrate }, Promise });
  return exports.hapticAdapter!;
}

for (const [kind, method] of [['selection', 'selection'], ['light', 'impact'], ['transient', 'impact'], ['medium', 'impact'], ['success', 'notification'], ['warning', 'notification'], ['selection', 'vibrate']] as const) {
  test(`native ${kind}/${method} consumes asynchronous rejection without blocking the action`, async () => {
    let observed = false;
    const failure = { then: (_resolve: unknown, reject: (error: Error) => void) => { observed = true; reject(new Error('native bridge unavailable')); } };
    const adapter = nativeAdapter({ [method]: () => failure });
    assert.equal(adapter.fire(kind), true, 'return value confirms dispatch, not physical vibration');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(observed, true, 'the asynchronous native result must be observed');
  });
}

test('empty native registration is not reported as supported; web fallback remains independent', () => {
  const empty = nativeAdapter({});
  assert.equal(empty.isNative(), false);
  assert.equal(empty.isSupported(), false);
  assert.equal(empty.fire('selection'), false);
  let calls = 0;
  const web = nativeAdapter({}, () => { calls += 1; return true; });
  assert.equal(web.isNative(), false);
  assert.equal(web.isSupported(), true);
  assert.equal(web.fire('light'), true);
  assert.equal(calls, 1);
});

test('synchronous native failures cannot escape or claim successful dispatch', () => {
  const adapter = nativeAdapter({ impact: () => { throw new Error('unavailable'); } });
  assert.equal(adapter.fire('light'), false);
});

test('orchestrator deduplicates both channels, including haptics with audio off', (t) => {
  const previous = interactionPreferences.get();
  const play = t.mock.method(sonicEngine, 'play', () => true);
  const vibrate = t.mock.method(hapticAdapter, 'fire', () => true);
  const unlock = t.mock.method(sonicEngine, 'unlock', () => undefined);
  try {
    for (const soundsEnabled of [true, false]) {
      sensory.resetDiagnostics();
      interactionPreferences.set({ ...DEFAULT_INTERACTION_PREFERENCES, soundsEnabled });
      play.mock.resetCalls();
      vibrate.mock.resetCalls();
      const event = { type: 'RESULT_SELECTED', journeyId: 'dedup-test' } as const;
      sensory.emit(event);
      sensory.emit(event);
      assert.equal(play.mock.callCount(), soundsEnabled ? 1 : 0);
      assert.equal(vibrate.mock.callCount(), 1);
      assert.equal(sensory.diagnostics().throttled.dedup, 1);
    }
    assert.equal(unlock.mock.callCount(), 0, 'async semantic events cannot unlock audio');
  } finally {
    interactionPreferences.set(previous);
    sensory.resetDiagnostics();
  }
});

test('feedback adapter failures never escape the business action', (t) => {
  const previous = interactionPreferences.get();
  t.mock.method(sonicEngine, 'play', () => { throw new Error('audio unavailable'); });
  t.mock.method(hapticAdapter, 'fire', () => false);
  try {
    interactionPreferences.set(DEFAULT_INTERACTION_PREFERENCES);
    sensory.resetDiagnostics();
    assert.doesNotThrow(() => sensory.emit({ type: 'BOOKING_CONFIRMED' }));
    assert.equal(sensory.diagnostics().soundsPlayed, 0);
  } finally {
    interactionPreferences.set(previous);
    sensory.resetDiagnostics();
  }
});

/** One representative event per type, so exhaustiveness is provable. */
const SAMPLE: Record<SensoryEventType, SensoryEvent> = {
  DOMINO_DETENT: { type: 'DOMINO_DETENT', ribbonId: 'ribbon-1', index: 2 },
  TRANSPORT_SELECTED: { type: 'TRANSPORT_SELECTED', transport: 'bus', selected: true },
  SORT_CHANGED: { type: 'SORT_CHANGED', strategy: 'FASTEST' },
  RESULT_SELECTED: { type: 'RESULT_SELECTED', journeyId: 'j1' },
  FAVORITE_TOGGLED: { type: 'FAVORITE_TOGGLED', saved: true },
  SEGMENT_SELECTED: { type: 'SEGMENT_SELECTED', segmentId: 's1' },
  STOP_SELECTED: { type: 'STOP_SELECTED', stopId: 'st1' },
  SHEET_SNAPPED: { type: 'SHEET_SNAPPED', detent: 'half' },
  STOPS_EXPANDED: { type: 'STOPS_EXPANDED' },
  STOPS_COLLAPSED: { type: 'STOPS_COLLAPSED' },
  CAMERA_FLIGHT_STARTED: { type: 'CAMERA_FLIGHT_STARTED', effort: 1 },
  CAMERA_FLIGHT_ARRIVED: { type: 'CAMERA_FLIGHT_ARRIVED' },
  NAV_TAB_CHANGED: { type: 'NAV_TAB_CHANGED', tab: 'trips' },
  ACTION_DRAWER_OPENED: { type: 'ACTION_DRAWER_OPENED' },
  CARPOOL_TOGGLE_CHANGED: { type: 'CARPOOL_TOGGLE_CHANGED', enabled: true },
  PRICE_OFFER_SENT: { type: 'PRICE_OFFER_SENT' },
  COUNTEROFFER_RECEIVED: { type: 'COUNTEROFFER_RECEIVED' },
  BOOKING_CONFIRMED: { type: 'BOOKING_CONFIRMED' },
  MARSH_PASS_OPENED: { type: 'MARSH_PASS_OPENED' },
  ERROR_SOFT: { type: 'ERROR_SOFT' },
};

test('every semantic event maps to a known sound and a valid haptic kind', () => {
  const sounds = new Set(Object.keys(MIN_INTERVAL_MS));
  const haptics = new Set(['selection', 'light', 'medium', 'success', 'warning', 'transient']);
  for (const type of SENSORY_EVENT_TYPES) {
    const recipe = sensoryRecipe(SAMPLE[type]);
    assert.ok(sounds.has(recipe.sound), `${type} sound ${recipe.sound} must be in the palette`);
    assert.ok(recipe.haptic === null || haptics.has(recipe.haptic), `${type} haptic`);
    assert.ok(recipe.gain > 0 && recipe.gain <= 1, `${type} base gain in range`);
  }
  assert.equal(SENSORY_EVENT_TYPES.length, Object.keys(SAMPLE).length);
});

test('one event resolves to at most one sound and one haptic', () => {
  const out = resolveSensoryOutput(SAMPLE.BOOKING_CONFIRMED, prefs, 'interactive', false);
  assert.equal(out.sound?.id, 'booking.success');
  assert.equal(out.haptic, 'success');
});

test('sounds off silences audio but keeps haptics; haptics off does the reverse', () => {
  const noSound = resolveSensoryOutput(SAMPLE.SORT_CHANGED, { ...prefs, soundsEnabled: false }, 'interactive', false);
  assert.equal(noSound.sound, null);
  assert.equal(noSound.haptic, 'selection');
  const noHaptic = resolveSensoryOutput(SAMPLE.SORT_CHANGED, { ...prefs, hapticsEnabled: false }, 'interactive', false);
  assert.equal(noHaptic.sound?.id, 'click.detent');
  assert.equal(noHaptic.haptic, null);
});

test('silent mode removes both sound and haptics', () => {
  const out = resolveSensoryOutput(SAMPLE.RESULT_SELECTED, prefs, 'silent', false);
  assert.equal(out.sound, null);
  assert.equal(out.haptic, null);
});

test('driver-safe keeps essential feedback and mutes decorative cues', () => {
  const booking = resolveSensoryOutput(SAMPLE.BOOKING_CONFIRMED, prefs, 'driver-safe', false);
  assert.equal(booking.sound?.id, 'booking.success');
  assert.equal(booking.haptic, 'success');
  const error = resolveSensoryOutput(SAMPLE.ERROR_SOFT, prefs, 'driver-safe', false);
  assert.equal(error.sound?.id, 'error.soft');
  const decorative = resolveSensoryOutput(SAMPLE.NAV_TAB_CHANGED, prefs, 'driver-safe', false);
  assert.equal(decorative.sound, null);
  assert.equal(decorative.haptic, null);
  const camera = resolveSensoryOutput(SAMPLE.CAMERA_FLIGHT_ARRIVED, prefs, 'driver-safe', false);
  assert.equal(camera.sound, null);
});

test('navigation mode restrains ambient camera sound and honours navigationSounds', () => {
  const glide = resolveSensoryOutput(SAMPLE.CAMERA_FLIGHT_STARTED, prefs, 'navigation', false);
  assert.equal(glide.sound, null, 'no long cinematic sweep while navigating');
  const click = resolveSensoryOutput(SAMPLE.SORT_CHANGED, prefs, 'navigation', false);
  assert.ok(click.sound && click.sound.gain < resolveSensoryOutput(SAMPLE.SORT_CHANGED, prefs, 'interactive', false).sound!.gain);
  const off = resolveSensoryOutput(SAMPLE.SORT_CHANGED, { ...prefs, navigationSounds: false }, 'navigation', false);
  assert.equal(off.sound, null);
});

test('cinematic camera off removes map glide and arrival sound', () => {
  const off = { ...prefs, cinematicCamera: false };
  assert.equal(resolveSensoryOutput(SAMPLE.CAMERA_FLIGHT_STARTED, off, 'interactive', false).sound, null);
  assert.equal(resolveSensoryOutput(SAMPLE.CAMERA_FLIGHT_ARRIVED, off, 'interactive', false).sound, null);
});

test('reduced motion removes the long sweep but keeps the short arrival tick', () => {
  assert.equal(resolveSensoryOutput(SAMPLE.CAMERA_FLIGHT_STARTED, prefs, 'interactive', true).sound, null);
  assert.equal(resolveSensoryOutput(SAMPLE.CAMERA_FLIGHT_ARRIVED, prefs, 'interactive', true).sound?.id, 'map.arrival');
});

test('minimal style drops decorative ambient cues, keeps selections', () => {
  const minimal = { ...prefs, style: 'minimal' as const };
  assert.equal(resolveSensoryOutput(SAMPLE.CAMERA_FLIGHT_ARRIVED, minimal, 'interactive', false).sound, null);
  assert.equal(resolveSensoryOutput(SAMPLE.SORT_CHANGED, minimal, 'interactive', false).sound?.id, 'click.detent');
});

test('volume scales gain and the hard ceiling is never exceeded', () => {
  const quiet = resolveSensoryOutput(SAMPLE.BOOKING_CONFIRMED, { ...prefs, volume: 0.2 }, 'interactive', false);
  const loud = resolveSensoryOutput(SAMPLE.BOOKING_CONFIRMED, { ...prefs, volume: 1, style: 'expressive' }, 'interactive', false);
  assert.ok(quiet.sound!.gain < loud.sound!.gain);
  assert.ok(loud.sound!.gain <= MAX_GAIN);
  const zero = resolveSensoryOutput(SAMPLE.BOOKING_CONFIRMED, { ...prefs, volume: 0 }, 'interactive', false);
  assert.equal(zero.sound!.gain, 0);
});

test('transport selection carries its timbre family; deselect does not', () => {
  assert.equal(transportTimbreGroup('train'), 'rail');
  assert.equal(transportTimbreGroup('carpool'), 'auto');
  assert.equal(transportTimbreGroup('scooter'), 'individual');
  assert.equal(transportTimbreGroup('bus'), 'urban-electric');
  const on = resolveSensoryOutput({ type: 'TRANSPORT_SELECTED', transport: 'train', selected: true }, prefs, 'interactive', false);
  assert.equal(on.sound?.timbre, 'rail');
  const off = resolveSensoryOutput({ type: 'TRANSPORT_SELECTED', transport: 'train', selected: false }, prefs, 'interactive', false);
  assert.equal(off.sound?.timbre, undefined);
  assert.equal(off.sound?.id, 'switch.off');
});

test('sheet detents escalate fixation strength', () => {
  const peek = resolveSensoryOutput({ type: 'SHEET_SNAPPED', detent: 'peek' }, prefs, 'interactive', false);
  const expanded = resolveSensoryOutput({ type: 'SHEET_SNAPPED', detent: 'expanded' }, prefs, 'interactive', false);
  assert.equal(peek.sound?.id, 'sheet.settle');
  assert.equal(expanded.sound?.id, 'click.deep');
  assert.ok(expanded.sound!.gain > peek.sound!.gain);
  assert.equal(expanded.haptic, 'medium');
});

test('identical confirmed actions inside the dedup window are throttled once', () => {
  const history = createThrottleHistory();
  const event = SAMPLE.SORT_CHANGED;
  assert.equal(throttleReason(event, 'click.detent', 1000, history, 0), null);
  recordPlay(event, 'click.detent', 1000, history);
  assert.equal(throttleReason(event, 'click.detent', 1000 + DEDUP_WINDOW_MS - 1, history, 0), 'dedup');
  assert.equal(throttleReason(event, 'click.detent', 1000 + DEDUP_WINDOW_MS + MIN_INTERVAL_MS['click.detent'], history, 0), null);
});

test('different actions sharing a texture are rate-limited, not deduped', () => {
  const history = createThrottleHistory();
  const a = { type: 'TRANSPORT_SELECTED', transport: 'bus', selected: true } as const;
  const b = { type: 'TRANSPORT_SELECTED', transport: 'tram', selected: true } as const;
  recordPlay(a, 'click.precision', 1000, history);
  // Same texture, different key, inside the min interval → rate-limit (the fast-swipe cap).
  assert.equal(throttleReason(b, 'click.precision', 1010, history, 0), 'rate-limit');
  assert.equal(throttleReason(b, 'click.precision', 1000 + MIN_INTERVAL_MS['click.precision'], history, 0), null);
});

test('concurrency cap drops new voices once the engine is full', () => {
  const history = createThrottleHistory();
  assert.equal(throttleReason(SAMPLE.BOOKING_CONFIRMED, 'booking.success', 5000, history, MAX_CONCURRENT_VOICES), 'concurrency');
  assert.equal(throttleReason(SAMPLE.BOOKING_CONFIRMED, 'booking.success', 5000, history, MAX_CONCURRENT_VOICES - 1), null);
});

test('event keys distinguish entities so dedup never merges two real choices', () => {
  assert.notEqual(eventKey({ type: 'RESULT_SELECTED', journeyId: 'a' }), eventKey({ type: 'RESULT_SELECTED', journeyId: 'b' }));
  assert.notEqual(eventKey({ type: 'SHEET_SNAPPED', detent: 'half' }), eventKey({ type: 'SHEET_SNAPPED', detent: 'expanded' }));
  assert.equal(eventKey({ type: 'STOPS_EXPANDED' }), eventKey({ type: 'STOPS_EXPANDED' }));
});

test('preferences sanitise invalid persisted values and clamp volume', () => {
  const saved = interactionPreferences.set({ volume: 5, style: 'nonsense' as never, soundsEnabled: 'yes' as never });
  assert.equal(saved.volume, 1);
  assert.equal(saved.style, 'balanced');
  assert.equal(saved.soundsEnabled, DEFAULT_INTERACTION_PREFERENCES.soundsEnabled);
  const low = interactionPreferences.set({ volume: -3 });
  assert.equal(low.volume, 0);
  interactionPreferences.reset();
  assert.deepEqual(interactionPreferences.get(), DEFAULT_INTERACTION_PREFERENCES);
});