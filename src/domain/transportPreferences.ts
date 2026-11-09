import type { ApiTransportProviders } from '../services/productionApi';
import { transportModes, type TransportGroup, type TransportModeId } from './transportCatalog';

/** Public categories stay canonical; internal GTFS subtypes are translated only at the API boundary. */
export type TransportTypeId = TransportModeId;
export interface TransportTypeInfo { id: TransportTypeId; label: string; group: TransportGroup }
export const transportTypes: TransportTypeInfo[] = transportModes.map(({ id, label, group }) => ({ id, label, group }));

/**
 * The planner composes MARSHGO carpool offers, open GTFS schedules, and
 * provider-scoped micromobility estimates. A map layer alone is not enough:
 * bikes require a confirmed return network, scooters require GBFS coverage.
 */
export const supportedJourneySearchTypes: readonly TransportTypeId[] = [
  'bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'carpool',
  'taxi', 'train', 'bike', 'scooter', 'carsharing', 'transfer',
];
const supportedTypeSet = new Set<TransportTypeId>(supportedJourneySearchTypes);
export const isJourneySearchSupported = (type: TransportTypeId): boolean => supportedTypeSet.has(type);

/** Legacy server/feed subtypes which belong to each of the twelve approved UI categories. */
export const journeyTypesForCategory: Readonly<Record<TransportTypeId, readonly string[]>> = {
  bus: ['bus', 'intercity_bus'],
  marshrutka: ['marshrutka'],
  trolleybus: ['trolleybus'],
  tram: ['tram'],
  metro: ['metro'],
  carpool: ['carpool'],
  taxi: ['taxi'],
  train: ['train', 'suburban_train', 'city_train'],
  bike: ['bike'],
  scooter: ['scooter'],
  carsharing: ['carsharing'],
  transfer: ['transfer'],
};

const legacyCategory = new Map<string, TransportTypeId>([
  ['intercity_bus', 'bus'], ['suburban_train', 'train'], ['city_train', 'train'],
  ...transportModes.map(({ id }) => [id, id] as const),
]);

/** Per-category provider choice. `all` means every routable provider; choices survive switching a category off. */
export interface ProviderChoice { all: boolean; ids: string[] }
export interface TransportSelection { active: TransportTypeId[]; providers: Partial<Record<TransportTypeId, ProviderChoice>> }
export const defaultSelection: TransportSelection = { active: [...supportedJourneySearchTypes], providers: {} };
const KEY = 'transport_selection';

function normalizePersistedSelection(value: Partial<TransportSelection> | null): TransportSelection | null {
  if (!value || !Array.isArray(value.active) || typeof value.providers !== 'object' || value.providers === null) return null;
  const active = [...new Set(value.active.flatMap((id) => {
    if (typeof id !== 'string') return [];
    const category = legacyCategory.get(id);
    return category && supportedTypeSet.has(category) ? [category] : [];
  }))];
  const providers: TransportSelection['providers'] = {};
  for (const [legacyId, rawChoice] of Object.entries(value.providers)) {
    const category = legacyCategory.get(legacyId);
    if (!category || !supportedTypeSet.has(category) || !rawChoice || typeof rawChoice !== 'object') continue;
    const choice = rawChoice as ProviderChoice;
    if (typeof choice.all !== 'boolean' || !Array.isArray(choice.ids) || !choice.ids.every((id) => typeof id === 'string')) continue;
    const previous = providers[category];
    const ids = [...new Set([...(previous?.ids ?? []), ...choice.ids])];
    providers[category] = { all: ids.length === 0 && (previous?.all ?? choice.all), ids };
  }
  return { active, providers };
}

export function loadSelection(): TransportSelection {
  try { return normalizePersistedSelection(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<TransportSelection> | null) ?? defaultSelection; }
  catch { return defaultSelection; }
}
export function saveSelection(selection: TransportSelection) { try { localStorage.setItem(KEY, JSON.stringify(selection)); } catch { /* keep the in-memory choice if storage is unavailable */ } }

export const isAllActive = (selection: TransportSelection) => supportedJourneySearchTypes.every((id) => selection.active.includes(id))
  && selection.active.every(isJourneySearchSupported);
export function selectAll(selection: TransportSelection): TransportSelection { return { ...selection, active: [...supportedJourneySearchTypes] }; }
export function allAvailableTypesSelected(selection: TransportSelection, availableTypes: readonly TransportTypeId[]): boolean {
  return availableTypes.length > 0 && availableTypes.every((type) => selection.active.includes(type));
}
export function toggleAvailableTypes(selection: TransportSelection, availableTypes: readonly TransportTypeId[]): TransportSelection {
  return { ...selection, active: allAvailableTypesSelected(selection, availableTypes) ? [] : [...availableTypes] };
}
export function toggleType(selection: TransportSelection, type: TransportTypeId): TransportSelection {
  if (!isJourneySearchSupported(type)) return selection;
  const active = selection.active.includes(type) ? selection.active.filter((id) => id !== type) : [...selection.active, type];
  return { ...selection, active };
}

export function choiceFor(selection: TransportSelection, type: TransportTypeId): ProviderChoice { return selection.providers[type] ?? { all: true, ids: [] }; }
export function activeTypesForSearch(selection: TransportSelection): TransportTypeId[] { return selection.active.filter(isJourneySearchSupported); }
export function toggleProvider(selection: TransportSelection, type: TransportTypeId, providerId: string | 'all', availableIds: readonly string[] = []): TransportSelection {
  const current = choiceFor(selection, type);
  if (providerId === 'all') return { ...selection, providers: { ...selection.providers, [type]: { all: true, ids: [] } } };
  // `all` means every connected provider is in play, so a chip click there removes one —
  // treating it as an empty list would silently narrow the category to the single provider.
  const active = current.all ? [...availableIds] : current.ids;
  const next = active.includes(providerId) ? active.filter((id) => id !== providerId) : [...active, providerId];
  const coversEverything = availableIds.length > 0 && next.length === availableIds.length;
  return { ...selection, providers: { ...selection.providers, [type]: next.length === 0 || coversEverything ? { all: true, ids: [] } : { all: false, ids: next } } };
}
/** «Вибрати всі»: every one of the given categories routes with all of its connected providers. */
export function useAllProviders(selection: TransportSelection, types: readonly TransportTypeId[]): TransportSelection {
  return {
    ...selection,
    providers: { ...selection.providers, ...Object.fromEntries(types.map((type) => [type, { all: true, ids: [] } as ProviderChoice])) },
  };
}
/** How many providers the current choice actually hands to the planner; `all` counts every connected one. */
export function countSelectedProviders(selection: TransportSelection, types: readonly TransportTypeId[], groups: ApiTransportProviders[] | null): number {
  return types.reduce((total, type) => {
    const providers = providersForJourneySearch(type, groups);
    const choice = choiceFor(selection, type);
    return total + (choice.all ? providers.length : providers.filter((provider) => choice.ids.includes(provider.id)).length);
  }, 0);
}
export const areAllProvidersSelected = (selection: TransportSelection, types: readonly TransportTypeId[]): boolean =>
  types.every((type) => choiceFor(selection, type).all);

function groupsForCategory(type: TransportTypeId, groups: ApiTransportProviders[] | null) {
  if (!groups) return [];
  const names = journeyTypesForCategory[type];
  return groups.filter((group) => names.includes(group.transportType));
}
function providerCanRoute(type: TransportTypeId, provider: ApiTransportProviders['providers'][number]): boolean {
  if (type === 'carpool') return provider.sources.includes('marshgo');
  if (type === 'bike') return provider.sources.includes('static-bike-network-estimate');
  if (type === 'scooter') return provider.sources.includes('gbfs');
  if (type === 'metro') return provider.sources.includes('gtfs')
    || (provider.sources.includes('geojson') && provider.services.includes('metro'));
  if (type === 'marshrutka') return provider.sources.includes('gtfs')
    || provider.sources.includes('geojson') || provider.sources.includes('json');
  if (type === 'taxi') return provider.services.includes('taxi') || provider.sources.includes('taxi-ridehailing-api') || provider.sources.includes('rest');
  if (type === 'carsharing') return provider.services.includes('carsharing') || provider.sources.includes('carsharing-api') || provider.sources.includes('rest');
  if (type === 'transfer') return provider.services.includes('transfer') || provider.sources.includes('transfer-api') || provider.sources.includes('rest') || provider.sources.includes('tsv');
  return provider.sources.includes('gtfs');
}
export function hasJourneySearchProvider(type: TransportTypeId, groups: ApiTransportProviders[] | null): boolean {
  if (!isJourneySearchSupported(type)) return false;
  if (type === 'carpool') return true;
  return groupsForCategory(type, groups).some((group) => group.providers.some((provider) => provider.available && providerCanRoute(type, provider)));
}
export function providersForJourneySearch(type: TransportTypeId, groups: ApiTransportProviders[] | null): ApiTransportProviders['providers'] {
  if (!isJourneySearchSupported(type)) return [];
  return groupsForCategory(type, groups).flatMap((group) => group.providers.filter((provider) => provider.available && providerCanRoute(type, provider)));
}
/** Union endpoint-local provider coverage; an available provider at either end remains discoverable. */
export function mergeProviderGroups(responses: readonly ApiTransportProviders[][]): ApiTransportProviders[] {
  const merged = new Map<string, Map<string, ApiTransportProviders['providers'][number]>>();
  for (const groups of responses) for (const group of groups) {
    const providers = merged.get(group.transportType) ?? new Map<string, ApiTransportProviders['providers'][number]>();
    for (const provider of group.providers) {
      const existing = providers.get(provider.id);
      if (!existing) {
        providers.set(provider.id, provider);
        continue;
      }
      providers.set(provider.id, {
        ...existing,
        name: existing.name || provider.name,
        available: existing.available || provider.available,
        cities: [...new Set([...existing.cities, ...provider.cities])],
        sources: [...new Set([...existing.sources, ...provider.sources])],
        services: [...new Set([...existing.services, ...provider.services])],
      });
    }
    merged.set(group.transportType, providers);
  }
  return [...merged].map(([transportType, providers]) => ({ transportType, providers: [...providers.values()] }));
}
/** Keep successful endpoint discovery while exposing whether any endpoint failed. */
export function mergeSettledProviderGroups(
  results: readonly PromiseSettledResult<ApiTransportProviders[]>[],
): { groups: ApiTransportProviders[]; failedCount: number } | null {
  const fulfilled = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  if (fulfilled.length === 0) return null;
  return {
    groups: mergeProviderGroups(fulfilled),
    failedCount: results.length - fulfilled.length,
  };
}

/** Discover provider coverage at both selected journey endpoints, with one unscoped request before either is set. */
export function providerCoveragePoints(
  origin: { latitude: number; longitude: number } | null,
  destination: { latitude: number; longitude: number } | null,
): Array<{ latitude: number; longitude: number } | undefined> {
  const points = [origin, destination]
    .filter((place): place is { latitude: number; longitude: number } => place !== null)
    .filter((place, index, all) => all.findIndex((candidate) => candidate.latitude === place.latitude
      && candidate.longitude === place.longitude) === index);
  return points.length ? points : [undefined];
}

export function effectiveProviders(selection: TransportSelection, type: TransportTypeId, groups: ApiTransportProviders[] | null): string[] {
  const available = providersForJourneySearch(type, groups);
  const choice = choiceFor(selection, type);
  return available.filter((provider) => choice.all || choice.ids.includes(provider.id)).map((provider) => provider.id);
}

/** Send approved user categories; feed-specific transport aliases stay an internal server concern. */
export function toJourneyPreferences(selection: TransportSelection, _groups: ApiTransportProviders[] | null): Record<string, boolean | string[] | Record<string, string[]>> {
  // Endpoint coverage is useful for the provider picker, but it is not a route
  // corridor. A feed can serve an intermediate city even when it covers neither
  // selected endpoint, so never silently remove a user-selected transport mode
  // or turn “all providers” into an endpoint-only provider allowlist.
  const active = activeTypesForSearch(selection);
  const allowedTransportTypes = [...active];
  const transitTypes = new Set<TransportTypeId>(['bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'train']);
  const transit = active.filter((type) => transitTypes.has(type));
  const rentalTypes = active.filter((type) => type === 'bike' || type === 'scooter');
  const explicitlySelectedProviderIds = (type: TransportTypeId) => {
    const choice = choiceFor(selection, type);
    if (choice.all) return [];
    return choice.ids.map((providerId) => {
      const separator = providerId.indexOf(':');
      return separator === -1 ? providerId : providerId.slice(separator + 1);
    });
  };
  const allowedProviderIdsByType: Record<string, string[]> = {};
  for (const type of rentalTypes) {
    if (!choiceFor(selection, type).all) allowedProviderIdsByType[type] = explicitlySelectedProviderIds(type);
  }
  const allowedTransitProvidersByType: Record<string, string[]> = {};
  for (const category of transit) {
    const choice = choiceFor(selection, category);
    if (!choice.all) allowedTransitProvidersByType[category] = explicitlySelectedProviderIds(category);
  }
  return {
    allowCommunity: active.includes('carpool'),
    allowTaxi: active.includes('taxi'),
    allowCarsharing: active.includes('carsharing'),
    allowTransfer: active.includes('transfer'),
    allowBicycle: active.includes('bike'),
    allowScooter: active.includes('scooter'),
    allowBus: active.some((type) => type === 'bus' || type === 'trolleybus' || type === 'tram' || type === 'metro'),
    allowMinibus: active.includes('marshrutka'),
    allowRail: active.includes('train'),
    allowPublicTransport: transit.length > 0,
    // The legacy flat filter spans both rental modes. Keep it empty and send
    // explicit provider choices by category so a scooter choice cannot filter bikes.
    allowedProviderIds: [],
    allowedProviderIdsByType,
    allowedTransportTypes,
    // Empty preserves the legacy field without imposing a cross-category filter.
    // Explicit provider choices are expressed only in the per-category map.
    allowedTransitProviders: [],
    allowedTransitProvidersByType,
  };
}
