import { productionApi } from '../services/productionApi';
import { setTransportLayers } from './transportLayers';
import { unavailableLayerIds } from './transportLayerConfig';

export type LayerAvailability = Readonly<Record<string, boolean>>;
export type LayerAvailabilityState = { availability: LayerAvailability | null; probeFailed: boolean };

/**
 * Which layers the connected feeds can actually serve. The answer is global, so one probe serves every
 * control on the map instead of each panel asking for itself.
 */
let availability: LayerAvailability | null = null;
let probeFailed = false;
let inFlight: Promise<LayerAvailability | null> | null = null;
const listeners = new Set<(state: LayerAvailabilityState) => void>();

const snapshot = (): LayerAvailabilityState => ({ availability, probeFailed });
const publish = () => { const state = snapshot(); listeners.forEach((listener) => listener(state)); };

export const getLayerAvailability = (): LayerAvailability | null => availability;
export const getLayerAvailabilityState = (): LayerAvailabilityState => snapshot();

export function subscribeLayerAvailability(listener: (state: LayerAvailabilityState) => void) {
  listeners.add(listener);
  listener(snapshot());
  return () => { listeners.delete(listener); };
}

export function loadLayerAvailability(): Promise<LayerAvailability | null> {
  if (availability) return Promise.resolve(availability);
  if (!inFlight) {
    inFlight = productionApi.transportLayerAvailability()
      .then((items) => {
        inFlight = null;
        probeFailed = false;
        availability = Object.fromEntries(items.map((item) => [item.id, item.available]));
        // A layer the server cannot serve must not stay switched on: the map would show nothing and say nothing.
        setTransportLayers(unavailableLayerIds(availability), false);
        publish();
        return availability;
      })
      .catch(() => {
        inFlight = null;
        probeFailed = true;
        // A failed check is not proof that every provider is unavailable. Keep the
        // state unknown so the map controls remain selectable and can show the
        // real layer request result instead of silently disabling everything.
        availability = null;
        publish();
        return null;
      });
  }
  return inFlight;
}

/** Retry after a failed probe: the layers sheet owns the wording, this owns the state. */
export function retryLayerAvailability(): Promise<LayerAvailability | null> {
  availability = null;
  probeFailed = false;
  publish();
  return loadLayerAvailability();
}
