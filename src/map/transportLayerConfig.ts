/** Map layer catalogue and request mapping, kept independent of MapLibre and the API client for easy testing. */
import { getTransportModeVisual } from '../design-system/transport/transportModeRegistry';

export type TransportLayerId = 'PUBLIC_TRANSPORT' | 'METRO' | 'BUS' | 'MINIBUS' | 'TRAM' | 'TROLLEYBUS' | 'CITY_TRAIN' | 'TRAIN' | 'FUNICULAR' | 'STOPS' | 'CARPOOL' | 'TAXI' | 'BICYCLE' | 'SCOOTER' | 'CARSHARING' | 'TRANSFER' | 'RENTAL_POINTS';
export type TransportLayerGroup = 'Громадський транспорт' | 'Спільні поїздки' | 'Мікромобільність';

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

/** Every layer the map can switch on, including the group and overlay ids the quick chips address. */
export const allTransportLayerIds: TransportLayerId[] = [...transportLayerList.map((item) => item.id), 'PUBLIC_TRANSPORT', 'CITY_TRAIN', 'FUNICULAR', 'STOPS', 'RENTAL_POINTS'];

/**
 * Only a confirmed `true` retires a control. `null` means the availability probe has not answered, and
 * greying out a layer that would have worked is its own kind of false statement.
 */
export const isLayerSelectable = (availability: Readonly<Record<string, boolean>> | null, id: TransportLayerId): boolean =>
  availability === null || availability[id] === true;

/** Layers the server confirmed it cannot serve; leaving one switched on paints an empty map with no reason. */
export const unavailableLayerIds = (availability: Readonly<Record<string, boolean>>): TransportLayerId[] =>
  allTransportLayerIds.filter((id) => availability[id] !== true);

/** A failed probe only proves we could not check, so the wording must not claim the data is missing. */
export const layerUnavailableNote = (probeFailed: boolean): string => probeFailed ? 'перевірка не вдалася' : 'немає даних';
