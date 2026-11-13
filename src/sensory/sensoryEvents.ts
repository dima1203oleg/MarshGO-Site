/**
 * MARSHGO Sensory 6.0 — the single semantic vocabulary of confirmed user actions.
 *
 * One confirmed action produces ONE event here; the orchestrator turns it into at
 * most one sound and one haptic. Components never decide how many times a sound
 * plays — they only name what happened. Business logic must not depend on any of
 * this: with sound and haptics off the app behaves identically.
 */

/** Semantic sound palette (ТЗ §14.1). Textures are synthesised, not sampled. */
export type SoundId =
  | 'marshgo.domino.detent'
  | 'click.precision'
  | 'click.detent'
  | 'click.deep'
  | 'switch.on'
  | 'switch.off'
  | 'sheet.settle'
  | 'panel.unfold'
  | 'panel.fold'
  | 'map.glide'
  | 'map.arrival'
  | 'route.select'
  | 'booking.success'
  | 'offer.received'
  | 'price.counteroffer'
  | 'error.soft'
  | 'pass.reveal';

/** Semantic haptic kinds (ТЗ §16). The adapter maps them to platform primitives. */
export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'transient';

/** Subtle timbre families for the twelve transport categories (ТЗ §13). */
export type TransportTimbreGroup = 'auto' | 'rail' | 'urban-electric' | 'individual';

/** The four sheet detents, ordered from smallest to largest. */
export type SheetDetent = 'peek' | 'compact' | 'half' | 'expanded';

/** Interaction safety modes (ТЗ §17). */
export type SensoryMode = 'interactive' | 'navigation' | 'driver-safe' | 'silent';

/** Feedback style presets (ТЗ §20). */
export type SensoryStyle = 'balanced' | 'expressive' | 'minimal';

export type SensoryEvent =
  | { type: 'DOMINO_DETENT'; ribbonId: string; index: number }
  | { type: 'TRANSPORT_SELECTED'; transport: string; selected: boolean }
  | { type: 'SORT_CHANGED'; strategy: string }
  | { type: 'RESULT_SELECTED'; journeyId: string }
  | { type: 'FAVORITE_TOGGLED'; saved: boolean }
  | { type: 'SEGMENT_SELECTED'; segmentId: string }
  | { type: 'STOP_SELECTED'; stopId: string }
  | { type: 'SHEET_SNAPPED'; detent: SheetDetent }
  | { type: 'STOPS_EXPANDED' }
  | { type: 'STOPS_COLLAPSED' }
  | { type: 'CAMERA_FLIGHT_STARTED'; effort?: number }
  | { type: 'CAMERA_FLIGHT_ARRIVED' }
  | { type: 'NAV_TAB_CHANGED'; tab: string }
  | { type: 'ACTION_DRAWER_OPENED' }
  | { type: 'CARPOOL_TOGGLE_CHANGED'; enabled: boolean }
  | { type: 'PRICE_OFFER_SENT' }
  | { type: 'COUNTEROFFER_RECEIVED' }
  | { type: 'BOOKING_CONFIRMED' }
  | { type: 'MARSH_PASS_OPENED' }
  | { type: 'ERROR_SOFT' };

export type SensoryEventType = SensoryEvent['type'];

/**
 * `essential` feedback survives driver-safe mode (a confirmed booking, an error,
 * an incoming offer); everything else is decorative and is muted while driving.
 * `decorative` camera/ambient cues are also the first to go in minimal style.
 */
export interface SensoryRecipe {
  sound: SoundId;
  haptic: HapticKind | null;
  /** 0..1 base loudness before preference/style/mode scaling. */
  gain: number;
  priority: number;
  essential: boolean;
  /** Long cinematic / ambient cue: suppressed by reduced motion + minimal style. */
  ambient?: boolean;
}

const TIMBRE_BY_TRANSPORT: Record<string, TransportTimbreGroup> = {
  carpool: 'auto', taxi: 'auto', carsharing: 'auto', transfer: 'auto',
  train: 'rail', metro: 'rail', tram: 'rail',
  bus: 'urban-electric', marshrutka: 'urban-electric', trolleybus: 'urban-electric',
  bike: 'individual', scooter: 'individual',
};

export function transportTimbreGroup(transport: string): TransportTimbreGroup {
  return TIMBRE_BY_TRANSPORT[transport] ?? 'urban-electric';
}

/** Sheet detent → fixation strength (ТЗ §9.2): light, medium, deeper settle. */
const SHEET_RECIPE: Record<SheetDetent, { sound: SoundId; haptic: HapticKind; gain: number }> = {
  peek: { sound: 'sheet.settle', haptic: 'light', gain: 0.5 },
  compact: { sound: 'sheet.settle', haptic: 'light', gain: 0.62 },
  half: { sound: 'sheet.settle', haptic: 'medium', gain: 0.78 },
  expanded: { sound: 'click.deep', haptic: 'medium', gain: 0.9 },
};

/**
 * The central event → feedback map. Keeping it in one table is what guarantees
 * "one action = one coherent sound + one haptic" and makes the policy testable.
 */
export function sensoryRecipe(event: SensoryEvent): SensoryRecipe {
  switch (event.type) {
    case 'DOMINO_DETENT':
      return { sound: 'marshgo.domino.detent', haptic: 'selection', gain: 0.5, priority: 3, essential: false };
    case 'TRANSPORT_SELECTED':
      return event.selected
        ? { sound: 'click.precision', haptic: 'selection', gain: 0.7, priority: 5, essential: false }
        : { sound: 'switch.off', haptic: 'light', gain: 0.55, priority: 4, essential: false };
    case 'SORT_CHANGED':
      return { sound: 'click.detent', haptic: 'selection', gain: 0.72, priority: 5, essential: false };
    case 'RESULT_SELECTED':
      return { sound: 'click.precision', haptic: 'light', gain: 0.68, priority: 5, essential: false };
    case 'FAVORITE_TOGGLED':
      return event.saved
        ? { sound: 'switch.on', haptic: 'light', gain: 0.6, priority: 4, essential: false }
        : { sound: 'switch.off', haptic: 'light', gain: 0.5, priority: 4, essential: false };
    case 'SEGMENT_SELECTED':
      return { sound: 'route.select', haptic: 'selection', gain: 0.66, priority: 5, essential: false };
    case 'STOP_SELECTED':
      return { sound: 'click.precision', haptic: 'selection', gain: 0.62, priority: 5, essential: false };
    case 'SHEET_SNAPPED': {
      const detent = SHEET_RECIPE[event.detent];
      return { sound: detent.sound, haptic: detent.haptic, gain: detent.gain, priority: 5, essential: false };
    }
    case 'STOPS_EXPANDED':
      return { sound: 'panel.unfold', haptic: 'light', gain: 0.6, priority: 4, essential: false };
    case 'STOPS_COLLAPSED':
      return { sound: 'panel.fold', haptic: 'light', gain: 0.5, priority: 4, essential: false };
    case 'CAMERA_FLIGHT_STARTED':
      return { sound: 'map.glide', haptic: null, gain: 0.4, priority: 2, essential: false, ambient: true };
    case 'CAMERA_FLIGHT_ARRIVED':
      return { sound: 'map.arrival', haptic: 'transient', gain: 0.55, priority: 3, essential: false, ambient: true };
    case 'NAV_TAB_CHANGED':
      return { sound: 'click.precision', haptic: 'selection', gain: 0.5, priority: 3, essential: false };
    case 'ACTION_DRAWER_OPENED':
      return { sound: 'panel.unfold', haptic: 'medium', gain: 0.7, priority: 4, essential: false };
    case 'CARPOOL_TOGGLE_CHANGED':
      return event.enabled
        ? { sound: 'switch.on', haptic: 'selection', gain: 0.72, priority: 6, essential: true }
        : { sound: 'switch.off', haptic: 'light', gain: 0.6, priority: 6, essential: true };
    case 'PRICE_OFFER_SENT':
      return { sound: 'click.precision', haptic: 'light', gain: 0.6, priority: 5, essential: false };
    case 'COUNTEROFFER_RECEIVED':
      return { sound: 'price.counteroffer', haptic: 'light', gain: 0.62, priority: 7, essential: true };
    case 'BOOKING_CONFIRMED':
      return { sound: 'booking.success', haptic: 'success', gain: 0.8, priority: 9, essential: true };
    case 'MARSH_PASS_OPENED':
      return { sound: 'pass.reveal', haptic: 'light', gain: 0.6, priority: 4, essential: false };
    case 'ERROR_SOFT':
      return { sound: 'error.soft', haptic: 'warning', gain: 0.6, priority: 8, essential: true };
  }
}

/** Every event type, for exhaustiveness tests and diagnostics. */
export const SENSORY_EVENT_TYPES: readonly SensoryEventType[] = [
  'DOMINO_DETENT', 'TRANSPORT_SELECTED', 'SORT_CHANGED', 'RESULT_SELECTED', 'FAVORITE_TOGGLED',
  'SEGMENT_SELECTED', 'STOP_SELECTED', 'SHEET_SNAPPED', 'STOPS_EXPANDED', 'STOPS_COLLAPSED',
  'CAMERA_FLIGHT_STARTED', 'CAMERA_FLIGHT_ARRIVED', 'NAV_TAB_CHANGED', 'ACTION_DRAWER_OPENED',
  'CARPOOL_TOGGLE_CHANGED', 'PRICE_OFFER_SENT', 'COUNTEROFFER_RECEIVED', 'BOOKING_CONFIRMED',
  'MARSH_PASS_OPENED', 'ERROR_SOFT',
];