import type { ApiTransportProviders } from '../services/productionApi';
import { transportModes, type TransportGroup, type TransportModeId } from './transportCatalog';

/** Public categories stay canonical; internal GTFS subtypes are translated only at the API boundary. */
export type TransportTypeId = TransportModeId;
export interface TransportTypeInfo { id: TransportTypeId; label: string; group: TransportGroup }
export const transportTypes: TransportTypeInfo[] = transportModes.map(({ id, label, group }) => ({ id, label, group }));

/**
 * The planner currently composes MARSHGO carpool offers and open GTFS schedules.
 * The remaining categories stay visible, but cannot be selected until their
 * real routing adapters are available. Static map layers and vehicle feeds are
 * deliberately not mistaken for an itinerary provider.
 */
export const supportedJourneySearchTypes: readonly TransportTypeId[] = [
  'bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'carpool', 'train',
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
export function toggleType(selection: TransportSelection, type: TransportTypeId): TransportSelection {
  if (!isJourneySearchSupported(type)) return selection;
  const active = selection.active.includes(type) ? selection.active.filter((id) => id !== type) : [...selection.active, type];
  return { ...selection, active };
}

export function choiceFor(selection: TransportSelection, type: TransportTypeId): ProviderChoice { return selection.providers[type] ?? { all: true, ids: [] }; }
export function activeTypesForSearch(selection: TransportSelection): TransportTypeId[] { return selection.active.filter(isJourneySearchSupported); }
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

function groupsForCategory(type: TransportTypeId, groups: ApiTransportProviders[] | null) {
  if (!groups) return [];
  const names = journeyTypesForCategory[type];
  return groups.filter((group) => names.includes(group.transportType));
}
function providerCanRoute(type: TransportTypeId, provider: ApiTransportProviders['providers'][number]): boolean {
  return type === 'carpool' ? provider.sources.includes('marshgo') : provider.sources.includes('gtfs');
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
export function effectiveProviders(selection: TransportSelection, type: TransportTypeId, groups: ApiTransportProviders[] | null): string[] {
  const available = providersForJourneySearch(type, groups);
  const choice = choiceFor(selection, type);
  return available.filter((provider) => choice.all || choice.ids.includes(provider.id)).map((provider) => provider.id);
}

/** Convert approved categories to the current Journey API's legacy feed-specific mode values. */
export function toJourneyPreferences(selection: TransportSelection, groups: ApiTransportProviders[] | null): Record<string, boolean | string[] | Record<string, string[]>> {
  const active = supportedJourneySearchTypes.filter((type) => selection.active.includes(type));
  const categoryHasProviders = (type: TransportTypeId) => type === 'carpool' || groups === null || effectiveProviders(selection, type, groups).length > 0;
  const withProviders = active.filter(categoryHasProviders);
  const allowedTransportTypes = withProviders.flatMap((category) => journeyTypesForCategory[category]);
  const transit = withProviders.filter((type) => type !== 'carpool');
  const allowedTransitProvidersByType: Record<string, string[]> = {};
  const selectedTransitProviders: string[] = [];
  if (groups !== null) for (const category of transit) {
    const selectedIds = new Set(effectiveProviders(selection, category, groups));
    for (const group of groupsForCategory(category, groups)) {
      const ids = group.providers.filter((provider) => provider.available && providerCanRoute(category, provider) && selectedIds.has(provider.id))
        .map((provider) => provider.id.slice(provider.id.indexOf(':') + 1));
      if (ids.length) {
        allowedTransitProvidersByType[group.transportType] = [...new Set([...(allowedTransitProvidersByType[group.transportType] ?? []), ...ids])];
        selectedTransitProviders.push(...ids);
      }
    }
  }
  return {
    allowCommunity: withProviders.includes('carpool'),
    allowTaxi: false,
    allowCarsharing: false,
    allowTransfer: false,
    allowBus: withProviders.some((type) => type === 'bus' || type === 'trolleybus' || type === 'tram' || type === 'metro'),
    allowMinibus: withProviders.includes('marshrutka'),
    allowRail: withProviders.includes('train'),
    allowPublicTransport: transit.length > 0,
    allowedTransportTypes,
    allowedTransitProviders: [...new Set(selectedTransitProviders)],
    allowedTransitProvidersByType,
  };
}
