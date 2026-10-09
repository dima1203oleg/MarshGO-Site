/** Map layer catalogue and request mapping, kept independent of MapLibre and the API client for easy testing. */
export type TransportLayerId = 'PUBLIC_TRANSPORT' | 'METRO' | 'BUS' | 'TRAM' | 'TROLLEYBUS' | 'CITY_TRAIN' | 'FUNICULAR' | 'STOPS' | 'BICYCLE' | 'SCOOTER' | 'CARSHARING' | 'RENTAL_POINTS';
export type TransportLayerGroup = 'Транспорт' | 'Мікромобільність' | 'Спільні авто';

export const transportLayerList: Array<{ id: TransportLayerId; label: string; group: TransportLayerGroup }> = [
  { id: 'PUBLIC_TRANSPORT', label: 'Громадський транспорт', group: 'Транспорт' },
  { id: 'METRO', label: 'Метро', group: 'Транспорт' },
  { id: 'TRAM', label: 'Трамваї', group: 'Транспорт' },
  { id: 'TROLLEYBUS', label: 'Тролейбуси', group: 'Транспорт' },
  { id: 'BUS', label: 'Автобуси', group: 'Транспорт' },
  { id: 'CITY_TRAIN', label: 'Міська електричка', group: 'Транспорт' },
  { id: 'FUNICULAR', label: 'Фунікулер', group: 'Транспорт' },
  { id: 'STOPS', label: 'Зупинки', group: 'Транспорт' },
  { id: 'BICYCLE', label: 'Велосипеди', group: 'Мікромобільність' },
  { id: 'SCOOTER', label: 'Електросамокати', group: 'Мікромобільність' },
  { id: 'CARSHARING', label: 'Каршерінг', group: 'Спільні авто' },
  { id: 'RENTAL_POINTS', label: 'Пункти прокату', group: 'Мікромобільність' },
];

export function microTypesFor(layers: ReadonlySet<TransportLayerId>): string[] {
  return [layers.has('BICYCLE') ? 'bike' : '', layers.has('SCOOTER') ? 'scooter' : '', layers.has('CARSHARING') ? 'carsharing' : '', layers.has('RENTAL_POINTS') ? 'stations' : ''].filter(Boolean);
}
