/**
 * MARSHGO Sensory 6.0 — the pure feedback policy (ТЗ §15, §17, §24).
 *
 * No Web Audio, no DOM: given an event, the preferences, the safety mode and the
 * reduced-motion flag, this decides whether ONE sound and ONE haptic may fire and
 * how loud. Keeping it pure is what lets node tests prove the gating rules and the
 * anti-avalanche throttling without a browser.
 */
import {
  sensoryRecipe, transportTimbreGroup,
  type HapticKind, type SensoryEvent, type SensoryMode, type SoundId, type TransportTimbreGroup,
} from './sensoryEvents';
import type { InteractionPreferencesState } from './InteractionPreferences';
import { DOMINO_PHYSICS } from '../components/magneticDomino';

export interface ResolvedSound {
  id: SoundId;
  /** Final 0..1 loudness after preference, style and mode scaling. */
  gain: number;
  timbre?: TransportTimbreGroup;
}

export interface SensoryOutput {
  sound: ResolvedSound | null;
  haptic: HapticKind | null;
}

/** Hard ceiling so no combination of settings can produce a loud strike. */
export const MAX_GAIN = 0.9;
export const MAX_CONCURRENT_VOICES = 8;
/** Identical confirmed actions inside this window are one action, not two. */
export const DEDUP_WINDOW_MS = 70;

/** Minimum gap between two plays of the same texture (anti-avalanche, ТЗ §15.2). */
export const MIN_INTERVAL_MS: Record<SoundId, number> = {
  'marshgo.domino.detent': DOMINO_PHYSICS.feedbackIntervalMs,
  'click.precision': 45,
  'click.detent': 45,
  'click.deep': 90,
  'switch.on': 60,
  'switch.off': 60,
  'sheet.settle': 120,
  'panel.unfold': 120,
  'panel.fold': 120,
  'map.glide': 300,
  'map.arrival': 120,
  'route.select': 50,
  'booking.success': 400,
  'offer.received': 250,
  'price.counteroffer': 250,
  'error.soft': 300,
  'pass.reveal': 200,
};

const STYLE_GAIN = { balanced: 0.9, expressive: 1, minimal: 0.78 } as const;

function styleMultiplier(style: InteractionPreferencesState['style']): number {
  return STYLE_GAIN[style] ?? STYLE_GAIN.balanced;
}

/**
 * Resolve one event into at most one sound + one haptic. Sound and haptic are
 * gated independently (a device may allow one and not the other) but both belong
 * to the same semantic moment.
 */
export function resolveSensoryOutput(
  event: SensoryEvent,
  prefs: InteractionPreferencesState,
  mode: SensoryMode,
  reducedMotion: boolean,
): SensoryOutput {
  const recipe = sensoryRecipe(event);

  // ---- haptic ----
  let haptic: HapticKind | null = recipe.haptic;
  if (!prefs.hapticsEnabled || mode === 'silent') haptic = null;
  else if (mode === 'driver-safe' && !recipe.essential) haptic = null;

  // ---- sound ----
  let sound: ResolvedSound | null = null;
  const soundAllowed =
    mode !== 'silent'
    && prefs.soundsEnabled
    && !(mode === 'driver-safe' && !recipe.essential)
    && !(mode === 'navigation' && !prefs.navigationSounds)
    && !(mode === 'navigation' && recipe.ambient)
    && !(!prefs.cinematicCamera && (recipe.sound === 'map.glide' || recipe.sound === 'map.arrival'))
    // Reduced motion removes the long cinematic sweep, keeps the short arrival tick.
    && !(reducedMotion && recipe.sound === 'map.glide')
    && !(prefs.style === 'minimal' && recipe.ambient && !recipe.essential);

  if (soundAllowed) {
    let gain = recipe.gain * prefs.volume * styleMultiplier(prefs.style);
    if (mode === 'navigation') gain *= 0.7;
    if (mode === 'driver-safe') gain *= 0.6;
    gain = Math.min(MAX_GAIN, Math.max(0, gain));
    sound = {
      id: recipe.sound,
      gain,
      ...(event.type === 'TRANSPORT_SELECTED' && event.selected
        ? { timbre: transportTimbreGroup(event.transport) }
        : {}),
    };
  }

  return { sound, haptic };
}

/** A stable key for dedup: the same confirmed action, not merely the same texture. */
export function eventKey(event: SensoryEvent): string {
  switch (event.type) {
    case 'DOMINO_DETENT': return `${event.type}:${event.ribbonId}:${event.index}`;
    case 'TRANSPORT_SELECTED': return `${event.type}:${event.transport}:${event.selected}`;
    case 'SORT_CHANGED': return `${event.type}:${event.strategy}`;
    case 'RESULT_SELECTED': return `${event.type}:${event.journeyId}`;
    case 'FAVORITE_TOGGLED': return `${event.type}:${event.saved}`;
    case 'SEGMENT_SELECTED': return `${event.type}:${event.segmentId}`;
    case 'STOP_SELECTED': return `${event.type}:${event.stopId}`;
    case 'SHEET_SNAPPED': return `${event.type}:${event.detent}`;
    case 'NAV_TAB_CHANGED': return `${event.type}:${event.tab}`;
    case 'CARPOOL_TOGGLE_CHANGED': return `${event.type}:${event.enabled}`;
    case 'CAMERA_FLIGHT_STARTED': return `${event.type}:${event.effort ?? 0}`;
    default: return event.type;
  }
}

export interface ThrottleHistory {
  /** soundId → last play timestamp (ms). */
  lastSoundAt: Map<SoundId, number>;
  /** eventKey → last emit timestamp (ms). */
  lastEventAt: Map<string, number>;
}

export function createThrottleHistory(): ThrottleHistory {
  return { lastSoundAt: new Map(), lastEventAt: new Map() };
}

export type ThrottleReason = 'dedup' | 'rate-limit' | 'concurrency' | null;

/**
 * Pure anti-avalanche guard. `activeVoices` is supplied by the audio engine; the
 * rest is timestamp history the orchestrator keeps. Returns the reason a sound
 * must be dropped, or null when it may play.
 */
export function throttleReason(
  event: SensoryEvent,
  soundId: SoundId,
  now: number,
  history: ThrottleHistory,
  activeVoices: number,
): ThrottleReason {
  const key = eventKey(event);
  const lastEvent = history.lastEventAt.get(key);
  if (lastEvent !== undefined && now - lastEvent < DEDUP_WINDOW_MS) return 'dedup';
  const lastSound = history.lastSoundAt.get(soundId);
  if (lastSound !== undefined && now - lastSound < MIN_INTERVAL_MS[soundId]) return 'rate-limit';
  if (activeVoices >= MAX_CONCURRENT_VOICES) return 'concurrency';
  return null;
}

/** Record a played sound so the next call can dedup / rate-limit against it. */
export function recordPlay(event: SensoryEvent, soundId: SoundId, now: number, history: ThrottleHistory): void {
  history.lastEventAt.set(eventKey(event), now);
  history.lastSoundAt.set(soundId, now);
}