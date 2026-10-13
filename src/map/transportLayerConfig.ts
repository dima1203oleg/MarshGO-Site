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
