/**
 * MARSHGO Sensory 6.0 — public surface of the unified interaction engine.
 *
 * Import `sensory` to emit a confirmed action; import the hooks for settings UI.
 * Everything else is internal machinery.
 */
export { sensory, type SensoryDiagnostics } from './SensoryOrchestrator';
export { interactionPreferences, DEFAULT_INTERACTION_PREFERENCES, type InteractionPreferencesState } from './InteractionPreferences';
export { useSensory, useInteractionPreferences, type InteractionPreferencesView } from './useSensory';
export { sonicEngine } from './SonicFeedbackEngine';
export { hapticAdapter } from './HapticFeedbackAdapter';
export {
  sensoryRecipe, transportTimbreGroup, SENSORY_EVENT_TYPES,
  type SensoryEvent, type SensoryEventType, type SensoryMode, type SensoryStyle,
  type SoundId, type HapticKind, type SheetDetent, type TransportTimbreGroup,
} from './sensoryEvents';
export {
  resolveSensoryOutput, throttleReason, recordPlay, createThrottleHistory, eventKey,
  MAX_GAIN, MAX_CONCURRENT_VOICES, DEDUP_WINDOW_MS, MIN_INTERVAL_MS,
  type SensoryOutput, type ResolvedSound, type ThrottleHistory, type ThrottleReason,
} from './sensoryPolicy';