/**
 * MARSHGO Sensory 6.0 — InteractionPreferences (ТЗ §20).
 *
 * The real, persisted feedback settings. Device-local like the rest of the app's
 * settings (the `mg_` localStorage family), observable so the profile UI and the
 * orchestrator stay in sync. Reduced motion is read from the OS, never stored.
 */
import type { SensoryStyle } from './sensoryEvents';

export interface InteractionPreferencesState {
  soundsEnabled: boolean;
  /** 0..1 master volume. */
  volume: number;
  hapticsEnabled: boolean;
  style: SensoryStyle;
  cinematicCamera: boolean;
  /** Separate control for navigation-mode sound (ТЗ §17/§20). */
  navigationSounds: boolean;
}

export const DEFAULT_INTERACTION_PREFERENCES: InteractionPreferencesState = {
  soundsEnabled: true,
  volume: 0.7,
  hapticsEnabled: true,
  style: 'balanced',
  cinematicCamera: true,
  navigationSounds: true,
};

const STORAGE_KEY = 'mg_sensory_prefs_v1';

type Listener = (state: InteractionPreferencesState) => void;

function clampVolume(value: unknown): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_INTERACTION_PREFERENCES.volume;
  return Math.min(1, Math.max(0, num));
}

function sanitize(raw: unknown): InteractionPreferencesState {
  const base = { ...DEFAULT_INTERACTION_PREFERENCES };
  if (!raw || typeof raw !== 'object') return base;
  const value = raw as Record<string, unknown>;
  return {
    soundsEnabled: typeof value.soundsEnabled === 'boolean' ? value.soundsEnabled : base.soundsEnabled,
    volume: clampVolume(value.volume),
    hapticsEnabled: typeof value.hapticsEnabled === 'boolean' ? value.hapticsEnabled : base.hapticsEnabled,
    style: value.style === 'expressive' || value.style === 'minimal' ? value.style : 'balanced',
    cinematicCamera: typeof value.cinematicCamera === 'boolean' ? value.cinematicCamera : base.cinematicCamera,
    navigationSounds: typeof value.navigationSounds === 'boolean' ? value.navigationSounds : base.navigationSounds,
  };
}

function readStorage(): InteractionPreferencesState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_INTERACTION_PREFERENCES };
  }
}

class InteractionPreferencesStore {
  private state: InteractionPreferencesState = readStorage();
  private listeners = new Set<Listener>();
  private media: MediaQueryList | null = null;
  private reducedMotion = false;

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.media = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = this.media.matches;
      const onChange = (event: MediaQueryListEvent) => {
        this.reducedMotion = event.matches;
        this.notify();
      };
      // addEventListener is the modern path; older Safari only has addListener.
      if (typeof this.media.addEventListener === 'function') this.media.addEventListener('change', onChange);
      else if (typeof this.media.addListener === 'function') this.media.addListener(onChange);
    }
  }

  get(): InteractionPreferencesState {
    return { ...this.state };
  }

  isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  set(partial: Partial<InteractionPreferencesState>): InteractionPreferencesState {
    this.state = sanitize({ ...this.state, ...partial });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Private mode / quota: keep the in-memory preference, never block the UI.
    }
    this.notify();
    return this.get();
  }

  reset(): InteractionPreferencesState {
    return this.set({ ...DEFAULT_INTERACTION_PREFERENCES });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    const snapshot = this.get();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export const interactionPreferences = new InteractionPreferencesStore();