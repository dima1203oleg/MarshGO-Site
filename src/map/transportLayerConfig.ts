/** Map layer catalogue and request mapping, kept independent of MapLibre and the API client for easy testing. */
import { getTransportModeVisual } from '../design-system/transport/transportModeRegistry';

export type TransportLayerId = 'PUBLIC_TRANSPORT' | 'METRO' | 'BUS' | 'MINIBUS' | 'TRAM' | 'TROLLEYBUS' | 'CITY_TRAIN' | 'TRAIN' | 'FUNICULAR' | 'STOPS' | 'CARPOOL' | 'TAXI' | 'BICYCLE' | 'SCOOTER' | 'CARSHARING' | 'TRANSFER' | 'RENTAL_POINTS';
export type TransportLayerGroup = 'Громадський транспорт' | 'Спільні поїздки' | 'Мікромобільність';

const transitModesByLayer: Partial<Record<TransportLayerId, readonly string[]>> = {
  PUBLIC_TRANSPORT: ['bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'train', 'suburban', 'city_train', 'funicular'],
  BUS: ['bus'], MINIBUS: ['marshrutka'], TROLLEYBUS: ['trolleybus'], TRAM: ['tram'], METRO: ['metro'],
  TRAIN: ['train', 'suburban', 'city_train'], CITY_TRAIN: ['city_train'], FUNICULAR: ['funicular'],
};

/** Restrict globally healthy feeds to the modes declared by the currently selected city's GTFS sources. */
export function layerAvailabilityForCity(
  availability: Readonly<Record<string, boolean>> | null,
  cityModes?: readonly string[],
): Record<string, boolean> | null {
  if (!availability || cityModes === undefined) return availability ? { ...availability } : null;
  const modes = new Set(cityModes);
  return Object.fromEntries(Object.entries(availability).map(([id, globallyAvailable]) => {
    const supportedModes = transitModesByLayer[id as TransportLayerId];
    return [id, globallyAvailable && (!supportedModes || supportedModes.some((mode) => modes.has(mode)))];
  }));
}

export function isTransitLayerAvailableInCity(layer: TransportLayerId, cityModes: readonly string[] | undefined): boolean {
  const supportedModes = transitModesByLayer[layer];
  return !supportedModes || cityModes === undefined || supportedModes.some((mode) => cityModes.includes(mode));
}

/** Exactly the twelve canonical map categories. Unavailable feeds stay disabled in the layer sheet. */
export const transportLayerList: Array<{ id: TransportLayerId; label: string; group: TransportLayerGroup }> = [
  { id: 'BUS', label: getTransportModeVisual('BUS').pluralLabel, group: 'Громадський транспорт' },
  { id: 'MINIBUS', label: getTransportModeVisual('MINIBUS').pluralLabel, group: 'Громадський транспорт' },
  { id: 'TROLLEYBUS', label: getTransportModeVisual('TROLLEYBUS').pluralLabel, group: 'Громадський транспорт' },
  { id: 'TRAM', label: getTransportModeVisual('TRAM').pluralLabel, group: 'Громадський транспорт' },
  { id: 'METRO', label: getTransportModeVisual('METRO').pluralLabel, group: 'Громадський транспорт' },
  { id: 'TRAIN', label: getTransportModeVisual('TRAIN').pluralLabel, group: 'Громадський транспорт' },
  { id: 'CARPOOL', label: getTransportModeVisual('CARPOOL').pluralLabel, group: 'Спільні поїздки' },
  { id: 'TAXI', label: getTransportModeVisual('TAXI').pluralLabel, group: 'Спільні поїздки' },
  { id: 'TRANSFER', label: getTransportModeVisual('TRANSFER').pluralLabel, group: 'Спільні поїздки' },
  { id: 'BICYCLE', label: getTransportModeVisual('BIKE').pluralLabel, group: 'Мікромобільність' },
  { id: 'SCOOTER', label: getTransportModeVisual('SCOOTER').pluralLabel, group: 'Мікромобільність' },
  { id: 'CARSHARING', label: getTransportModeVisual('CARSHARING').pluralLabel, group: 'Мікромобільність' },
];

/** Paired row order used by the two-column map layer sheet, matching the approved mobile mockup. */
export const mapLayerDisplayOrder: TransportLayerId[] = [
  'BUS', 'MINIBUS', 'TROLLEYBUS', 'TRAIN', 'TRAM', 'BICYCLE',
  'METRO', 'SCOOTER', 'CARPOOL', 'CARSHARING', 'TAXI', 'TRANSFER',
];

export function lineTypesFor(layers: ReadonlySet<TransportLayerId>): string[] {
  const types = new Set<string>();
  if (layers.has('PUBLIC_TRANSPORT')) ['bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'train', 'suburban', 'city_train', 'funicular'].forEach((type) => types.add(type));
  if (layers.has('BUS')) types.add('bus');
  if (layers.has('MINIBUS')) types.add('marshrutka');
  if (layers.has('TRAM')) types.add('tram');
  if (layers.has('TROLLEYBUS')) types.add('trolleybus');
  if (layers.has('METRO')) types.add('metro');
  if (layers.has('CITY_TRAIN')) types.add('city_train');
  if (layers.has('TRAIN')) ['train', 'suburban', 'city_train'].forEach((type) => types.add(type));
  if (layers.has('FUNICULAR')) types.add('funicular');
  return [...types];
}

export function microTypesFor(layers: ReadonlySet<TransportLayerId>): string[] {
  return [layers.has('BICYCLE') ? 'bike' : '', layers.has('SCOOTER') ? 'scooter' : '', layers.has('CARSHARING') ? 'carsharing' : '', layers.has('RENTAL_POINTS') ? 'stations' : ''].filter(Boolean);
}

/** A city preset enables only available public transport feeds, never private mobility or commercial modes. */
export function cityTransportLayerIds(availability: Readonly<Record<string, boolean>> | null): TransportLayerId[] {
  if (!availability) return [];
  const publicTransport = transportLayerList
    .filter((item) => item.group === 'Громадський транспорт' && availability[item.id] === true)
    .map((item) => item.id);
  return availability.STOPS === true ? [...publicTransport, 'STOPS'] : publicTransport;
}
