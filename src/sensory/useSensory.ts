/**
 * MARSHGO Sensory 6.0 — React bindings.
 *
 * `useSensory` exposes the stable orchestrator for emitting events.
 * `useInteractionPreferences` subscribes to the persisted settings so the profile
 * UI re-renders on change (including OS reduced-motion changes).
 */
import { useEffect, useState } from 'react';
import { sensory } from './SensoryOrchestrator';
import { interactionPreferences, type InteractionPreferencesState } from './InteractionPreferences';
import { hapticAdapter } from './HapticFeedbackAdapter';

export function useSensory() {
  return sensory;
}

export interface InteractionPreferencesView {
  prefs: InteractionPreferencesState;
  reducedMotion: boolean;
  hapticsSupported: boolean;
  hapticsNative: boolean;
  setPreferences: (partial: Partial<InteractionPreferencesState>) => InteractionPreferencesState;
  resetPreferences: () => InteractionPreferencesState;
}

export function useInteractionPreferences(): InteractionPreferencesView {
  const [prefs, setPrefs] = useState<InteractionPreferencesState>(() => interactionPreferences.get());
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => interactionPreferences.isReducedMotion());
  useEffect(() => interactionPreferences.subscribe((next) => {
    setPrefs(next);
    setReducedMotion(interactionPreferences.isReducedMotion());
  }), []);
  return {
    prefs,
    reducedMotion,
    hapticsSupported: hapticAdapter.isSupported(),
    hapticsNative: hapticAdapter.isNative(),
    setPreferences: (partial) => interactionPreferences.set(partial),
    resetPreferences: () => interactionPreferences.reset(),
  };
}