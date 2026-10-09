import type { ApiTransportProviders } from '../services/productionApi';
import { transportModes, type TransportGroup } from './transportCatalog';

/** Every catalogue mode stays visible, while only Journey Engine modes can be selected for route search. */
export type TransportTypeId = 'carpool' | 'taxi' | 'carsharing' | 'car_rental' | 'transfer' | 'bus' | 'marshrutka' | 'trolleybus' | 'tram' | 'metro' | 'city_train' | 'funicular'
  | 'train' | 'suburban_train' | 'intercity_bus' | 'bike' | 'scooter' | 'moped' | 'plane' | 'ferry' | 'walk';
export interface TransportTypeInfo { id: TransportTypeId; label: string; group: TransportGroup }
export const transportTypes: TransportTypeInfo[] = transportModes.map((mode) => ({ id: mode.id as TransportTypeId, label: mode.label, group: mode.group }));

/** Modes the current journey search can actually route. Walk is an automatic access leg, not a selectable route. */
export const supportedJourneySearchTypes: readonly TransportTypeId[] = [
  'carpool', 'bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'city_train', 'funicular',
  'train', 'suburban_train', 'intercity_bus', 'ferry',
];
const supportedTypeSet = new Set<TransportTypeId>(supportedJourneySearchTypes);
export const isJourneySearchSupported = (type: TransportTypeId): boolean => supportedTypeSet.has(type);

/** Per-type provider choice. `all` = every connected provider of the type; otherwise only `ids`. Kept when the type is switched off. */
export interface ProviderChoice { all: boolean; ids: string[] }
export interface TransportSelection { active: TransportTypeId[]; providers: Partial<Record<TransportTypeId, ProviderChoice>> }
export const defaultSelection: TransportSelection = { active: [...supportedJourneySearchTypes], providers: {} };
const KEY = 'transport_selection';

export function loadSelection(): TransportSelection {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<TransportSelection> | null;
    if (parsed && Array.isArray(parsed.active) && typeof parsed.providers === 'object' && parsed.providers !== null) {
      return { active: [...new Set(parsed.active.filter((id): id is TransportTypeId => typeof id === 'string' && supportedTypeSet.has(id as TransportTypeId)))], providers: parsed.providers };
    }
  } catch { /* corrupted storage falls back to the default */ }
  return defaultSelection;
}
export function saveSelection(selection: TransportSelection) { try { localStorage.setItem(KEY, JSON.stringify(selection)); } catch { /* selection still applies in memory */ } }

export const isAllActive = (selection: TransportSelection) => supportedJourneySearchTypes.every((id) => selection.active.includes(id))
  && selection.active.every(isJourneySearchSupported);

/** "Усі": selects every mode currently implemented by the route engine. */
export function selectAll(selection: TransportSelection): TransportSelection { return { ...selection, active: [...supportedJourneySearchTypes] }; }

/** Unsupported catalogue tiles are never added to route search. An empty selection means no modes selected. */
export function toggleType(selection: TransportSelection, type: TransportTypeId): TransportSelection {
  if (!isJourneySearchSupported(type)) return selection;
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
/** Empty means no modes; persisted legacy selections are restricted to implemented route types. */
export function activeTypesForSearch(selection: TransportSelection): TransportTypeId[] { return selection.active.filter(isJourneySearchSupported); }

function providerCanRoute(type: TransportTypeId, provider: ApiTransportProviders['providers'][number]): boolean {
  // The journey endpoint currently reads GTFS timetables; RT positions, JSON and map layers are not route schedules.
  return type === 'carpool' || provider.sources.includes('gtfs');
}

export function hasJourneySearchProvider(type: TransportTypeId, groups: ApiTransportProviders[] | null): boolean {
  if (!isJourneySearchSupported(type)) return false;
  if (type === 'carpool') return true;
  return groups?.find((group) => group.transportType === type)?.providers.some((provider) => provider.available && providerCanRoute(type, provider)) ?? false;
}

export function providersForJourneySearch(type: TransportTypeId, groups: ApiTransportProviders[] | null): ApiTransportProviders['providers'] {
  if (!isJourneySearchSupported(type)) return [];
  return groups?.find((group) => group.transportType === type)?.providers.filter((provider) => provider.available && providerCanRoute(type, provider)) ?? [];
}

export function effectiveProviders(selection: TransportSelection, type: TransportTypeId, groups: ApiTransportProviders[] | null): string[] {
  const available = providersForJourneySearch(type, groups);
  const choice = choiceFor(selection, type);
  return available.filter((provider) => choice.all || choice.ids.includes(provider.id)).map((provider) => provider.id);
}

/** Maps the selection onto the existing Journey Engine flags. Walking inside a combined route is always allowed, so no flag exists for it. */
export function toJourneyPreferences(selection: TransportSelection, groups: ApiTransportProviders[] | null): Record<string, boolean | string[]> {
  const active = activeTypesForSearch(selection);
  // Provider lookup may fail temporarily. Let the API search every selected
  // mode in that case; the server will use its live provider registry and
  // report unavailable categories instead of silently stripping preferences.
  const has = (...types: TransportTypeId[]) => types.some((type) => isJourneySearchSupported(type) && active.includes(type)
    && (type === 'carpool' || groups === null || effectiveProviders(selection, type, groups).length > 0));
  const transitTypes = supportedJourneySearchTypes.filter((type) => type !== 'carpool');
  const transitTypeSet = new Set<TransportTypeId>(transitTypes);
  const publicTransport = has(...transitTypes);
  const allowedTransportTypes = active.filter((type) => type === 'carpool' || groups === null || effectiveProviders(selection, type, groups).length > 0);
  const allowedTransitProviders = [...new Set(active.filter((type) => transitTypeSet.has(type))
    .flatMap((type) => effectiveProviders(selection, type, groups).map((id) => id.split(':').slice(1).join(':'))))];
  return {
    allowCommunity: has('carpool'), allowTaxi: has('taxi'), allowCarsharing: has('carsharing'),
    allowBus: has('bus', 'intercity_bus'), allowMinibus: has('marshrutka'), allowRail: has('train', 'suburban_train'), allowPublicTransport: publicTransport,
    allowedTransportTypes,
    allowedTransitProviders,
  };
}
