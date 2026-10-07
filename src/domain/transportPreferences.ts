import type { ApiMobilityAvailability } from '../services/productionApi';

/** Filter chips of "Як хочете їхати?". Selection is multi-valued; "all" means every mode that is actually available. */
export type FilterModeId = 'carpool' | 'taxi' | 'transit' | 'bike' | 'ebike' | 'scooter' | 'moped' | 'carsharing' | 'walk';
export interface FilterMode { id: FilterModeId; label: string }
export const filterModes: FilterMode[] = [
  { id: 'carpool', label: 'Попутка' }, { id: 'taxi', label: 'Таксі' }, { id: 'transit', label: 'Громадський' },
  { id: 'bike', label: 'Bike' }, { id: 'ebike', label: 'E-bike' }, { id: 'scooter', label: 'Scooter' },
  { id: 'moped', label: 'Moped' }, { id: 'carsharing', label: 'Carsharing' }, { id: 'walk', label: 'Пішки' },
];

export interface TransportSelection { all: boolean; modes: FilterModeId[] }
export const defaultSelection: TransportSelection = { all: true, modes: [] };
const KEY = 'transport_preferences';

export function loadSelection(): TransportSelection {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<TransportSelection> | null;
    if (parsed && typeof parsed.all === 'boolean' && Array.isArray(parsed.modes)) {
      const valid = parsed.modes.filter((mode): mode is FilterModeId => filterModes.some((item) => item.id === mode));
      return { all: parsed.all, modes: valid };
    }
  } catch { /* corrupted storage falls back to the default */ }
  return defaultSelection;
}
export function saveSelection(selection: TransportSelection) { try { localStorage.setItem(KEY, JSON.stringify(selection)); } catch { /* selection still applies in memory */ } }

/** Which filter modes can really be used right now: carpool always (own system), the rest need a healthy provider. */
export function availableModes(availability: ApiMobilityAvailability | null): Set<FilterModeId> {
  const available = new Set<FilterModeId>(['carpool']);
  if (!availability) return available;
  for (const mode of availability.modes) {
    if (!mode.available) continue;
    if (mode.mode === 'bike') { available.add('bike'); available.add('ebike'); } else available.add(mode.mode as FilterModeId);
  }
  if (Object.values(availability.transit).some((entry) => entry.available)) available.add('transit');
  return available;
}

/** Effective set of modes the search may use: all available ones for "Усі", otherwise the explicit choice limited to available modes. */
export function effectiveModes(selection: TransportSelection, available: Set<FilterModeId>): Set<FilterModeId> {
  if (selection.all) return new Set(available);
  return new Set(selection.modes.filter((mode) => available.has(mode)));
}

export function toggleMode(selection: TransportSelection, mode: FilterModeId): TransportSelection {
  const modes = selection.all ? [] : selection.modes;
  const next = modes.includes(mode) ? modes.filter((item) => item !== mode) : [...modes, mode];
  return next.length === 0 ? defaultSelection : { all: false, modes: next };
}

/** Maps the effective selection onto the Journey Engine preference flags (allowCommunity, allowTaxi, ...). */
export function toJourneyPreferences(modes: Set<FilterModeId>): Record<string, boolean> {
  const transit = modes.has('transit');
  return {
    allowCommunity: modes.has('carpool'), allowTaxi: modes.has('taxi'), allowCarsharing: modes.has('carsharing'),
    allowBus: transit, allowMinibus: transit, allowRail: transit, allowPublicTransport: transit,
  };
}
