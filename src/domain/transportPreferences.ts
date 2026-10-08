import type { ApiTransportProviders } from '../services/productionApi';
import { transportModes, type TransportGroup } from './transportCatalog';

/** The 19 transport tiles of "Види транспорту". All stay visible; selection (blue) is independent of provider availability. */
export type TransportTypeId = 'carpool' | 'taxi' | 'carsharing' | 'car_rental' | 'transfer' | 'bus' | 'marshrutka' | 'trolleybus' | 'tram' | 'metro'
  | 'train' | 'suburban_train' | 'intercity_bus' | 'bike' | 'scooter' | 'moped' | 'plane' | 'ferry' | 'walk';
export interface TransportTypeInfo { id: TransportTypeId; label: string; group: TransportGroup }
export const transportTypes: TransportTypeInfo[] = transportModes.map((mode) => ({ id: mode.id as TransportTypeId, label: mode.label, group: mode.group }));
const allTypeIds = transportTypes.map((type) => type.id);

/** Per-type provider choice. `all` = every connected provider of the type; otherwise only `ids`. Kept when the type is switched off. */
export interface ProviderChoice { all: boolean; ids: string[] }
export interface TransportSelection { active: TransportTypeId[]; providers: Partial<Record<TransportTypeId, ProviderChoice>> }
export const defaultSelection: TransportSelection = { active: [...allTypeIds], providers: {} };
const KEY = 'transport_selection';

export function loadSelection(): TransportSelection {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<TransportSelection> | null;
    if (parsed && Array.isArray(parsed.active) && typeof parsed.providers === 'object' && parsed.providers !== null) {
      return { active: parsed.active.filter((id): id is TransportTypeId => allTypeIds.includes(id as TransportTypeId)), providers: parsed.providers };
    }
  } catch { /* corrupted storage falls back to the default */ }
  return defaultSelection;
}
export function saveSelection(selection: TransportSelection) { try { localStorage.setItem(KEY, JSON.stringify(selection)); } catch { /* selection still applies in memory */ } }

export const isAllActive = (selection: TransportSelection) => allTypeIds.every((id) => selection.active.includes(id));

/** "Усі": switches every type on (the user can then switch individual types off). */
export function selectAll(selection: TransportSelection): TransportSelection { return { ...selection, active: [...allTypeIds] }; }

/** Plain toggle: after "Усі" the user switches individual types off. An empty selection is allowed (nothing chosen yet). */
export function toggleType(selection: TransportSelection, type: TransportTypeId): TransportSelection {
  const active = selection.active.includes(type) ? selection.active.filter((id) => id !== type) : [...selection.active, type];
  return { ...selection, active };
}

export function choiceFor(selection: TransportSelection, type: TransportTypeId): ProviderChoice { return selection.providers[type] ?? { all: true, ids: [] }; }

/** "Усі провайдери" on → every connected provider; picking a specific one switches "all" off; clearing the last one returns to "all". */
export function toggleProvider(selection: TransportSelection, type: TransportTypeId, providerId: string | 'all'): TransportSelection {
  const current = choiceFor(selection, type);
  let next: ProviderChoice;
  if (providerId === 'all') next = { all: true, ids: [] };
  else {
    const ids = current.ids.includes(providerId) ? current.ids.filter((id) => id !== providerId) : [...current.ids, providerId];
    next = ids.length === 0 ? { all: true, ids: [] } : { all: false, ids };
  }
  return { ...selection, providers: { ...selection.providers, [type]: next } };
}

/** Providers to use for a type in the search: the connected ones, limited to the explicit choice. */
/** A search with nothing selected behaves like "Усі". */
export function activeTypesForSearch(selection: TransportSelection): TransportTypeId[] { return selection.active.length === 0 ? [...allTypeIds] : selection.active; }

export function effectiveProviders(selection: TransportSelection, type: TransportTypeId, groups: ApiTransportProviders[] | null): string[] {
  const available = groups?.find((group) => group.transportType === type)?.providers.filter((provider) => provider.available) ?? [];
  const choice = choiceFor(selection, type);
  return available.filter((provider) => choice.all || choice.ids.includes(provider.id)).map((provider) => provider.id);
}

/** Maps the selection onto the existing Journey Engine flags. Walking inside a combined route is always allowed, so no flag exists for it. */
export function toJourneyPreferences(selection: TransportSelection, groups: ApiTransportProviders[] | null): Record<string, boolean> {
  const active = activeTypesForSearch(selection);
  const has = (...types: TransportTypeId[]) => types.some((type) => active.includes(type) && (type === 'carpool' || effectiveProviders(selection, type, groups).length > 0));
  const publicTransport = has('bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'train', 'suburban_train', 'intercity_bus');
  return {
    allowCommunity: has('carpool'), allowTaxi: has('taxi'), allowCarsharing: has('carsharing'),
    allowBus: has('bus', 'intercity_bus'), allowMinibus: has('marshrutka'), allowRail: has('train', 'suburban_train'), allowPublicTransport: publicTransport,
  };
}
