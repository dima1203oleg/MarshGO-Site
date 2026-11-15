/**
 * MARSHGO Sensory 6.0 — SensoryOrchestrator (ТЗ §3, §15, §21).
 *
 * The one place that turns a confirmed semantic action into at most one sound and
 * one haptic. Components call `sensory.emit(event)` and nothing else: the central
 * policy decides gating, the throttle history prevents acoustic avalanches, and
 * the adapters do the platform work. `emit` never throws and never blocks — with
 * sound and haptics off the product behaves exactly the same.
 */
import { interactionPreferences } from './InteractionPreferences';
import { DOMINO_PHYSICS } from '../components/magneticDomino';
import { sonicEngine } from './SonicFeedbackEngine';
import { hapticAdapter } from './HapticFeedbackAdapter';
import {
  createThrottleHistory, recordPlay, resolveSensoryOutput, throttleReason, eventKey, DEDUP_WINDOW_MS,
  type ThrottleHistory, type ThrottleReason,
} from './sensoryPolicy';
import type { SensoryEvent, SensoryMode } from './sensoryEvents';

export interface SensoryDiagnostics {
  mode: SensoryMode;
  emitted: number;
  soundsPlayed: number;
  hapticsFired: number;
  throttled: Record<Exclude<ThrottleReason, null>, number>;
  activeVoices: number;
  audioUnlocked: boolean;
  hapticsSupported: boolean;
  hapticsNative: boolean;
  reducedMotion: boolean;
}

const PRUNE_AGE_MS = 2000;

class SensoryOrchestrator {
  private mode: SensoryMode = 'interactive';
  private history: ThrottleHistory = createThrottleHistory();
  private counters = {
    emitted: 0,
    soundsPlayed: 0,
    hapticsFired: 0,
    throttled: { dedup: 0, 'rate-limit': 0, concurrency: 0 } as Record<Exclude<ThrottleReason, null>, number>,
  };

  readonly preferences = interactionPreferences;

  /** Call once on app mount; safe to call repeatedly. */
  init(): void {
    sonicEngine.attach();
  }

  /** Resume audio inside a permitted user gesture. */
  unlock(): void {
    sonicEngine.attach();
    sonicEngine.unlock();
  }

  setMode(mode: SensoryMode): void {
    this.mode = mode;
    if (mode === 'driver-safe' || mode === 'silent') sonicEngine.stopAll();
  }

  getMode(): SensoryMode {
    return this.mode;
  }

  stopAll(): void {
    sonicEngine.stopAll();
  }

  /** The single entry point: one confirmed action → one coherent feedback moment. */
  emit(event: SensoryEvent): void {
    try {
      this.counters.emitted += 1;
      const prefs = interactionPreferences.get();
      const reducedMotion = interactionPreferences.isReducedMotion();
      const output = resolveSensoryOutput(event, prefs, this.mode, reducedMotion);
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

      const key = eventKey(event);
      const lastEvent = this.history.lastEventAt.get(key);
      if (lastEvent !== undefined && now - lastEvent < DEDUP_WINDOW_MS) {
        this.counters.throttled.dedup += 1;
        return;
      }
      if (event.type === 'DOMINO_DETENT') {
        const lastDetent = this.history.lastEventAt.get('DOMINO_RATE');
        if (lastDetent !== undefined && now - lastDetent < DOMINO_PHYSICS.feedbackIntervalMs) {
          this.counters.throttled['rate-limit'] += 1;
          return;
        }
        this.history.lastEventAt.set('DOMINO_RATE', now);
      }
      const reason = output.sound
        ? throttleReason(event, output.sound.id, now, this.history, sonicEngine.activeVoices)
        : null;
      this.history.lastEventAt.set(key, now);

      if (output.haptic && hapticAdapter.fire(output.haptic)) this.counters.hapticsFired += 1;
      if (output.sound) {
        if (reason) {
          this.counters.throttled[reason] += 1;
        } else if (sonicEngine.play(output.sound)) {
          this.counters.soundsPlayed += 1;
          recordPlay(event, output.sound.id, now, this.history);
        }
      }
      this.prune(now);
    } catch {
      // Feedback is decorative: a failure here must never break the action.
    }
  }

  private prune(now: number): void {
    if (this.history.lastEventAt.size > 64) {
      for (const [key, at] of this.history.lastEventAt) if (now - at > PRUNE_AGE_MS) this.history.lastEventAt.delete(key);
    }
    if (this.history.lastSoundAt.size > 64) {
      for (const [key, at] of this.history.lastSoundAt) if (now - at > PRUNE_AGE_MS) this.history.lastSoundAt.delete(key);
    }
  }

  diagnostics(): SensoryDiagnostics {
    return {
      mode: this.mode,
      emitted: this.counters.emitted,
      soundsPlayed: this.counters.soundsPlayed,
      hapticsFired: this.counters.hapticsFired,
      throttled: { ...this.counters.throttled },
      activeVoices: sonicEngine.activeVoices,
      audioUnlocked: sonicEngine.isUnlocked,
      hapticsSupported: hapticAdapter.isSupported(),
      hapticsNative: hapticAdapter.isNative(),
      reducedMotion: interactionPreferences.isReducedMotion(),
    };
  }

  /** Test/diagnostics helper: clear throttle history and counters. */
  resetDiagnostics(): void {
    this.history = createThrottleHistory();
    this.counters = { emitted: 0, soundsPlayed: 0, hapticsFired: 0, throttled: { dedup: 0, 'rate-limit': 0, concurrency: 0 } };
  }
}

export const sensory = new SensoryOrchestrator();