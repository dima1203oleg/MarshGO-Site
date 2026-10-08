/** All transport modes shown in the catalogue, grouped as in the product design. `rental` modes are backed by GBFS providers. */
export type TransportGroup = 'Спільні поїздки' | 'Міський транспорт' | 'Міжміський транспорт' | 'Легкий транспорт' | 'Інше';
export interface TransportMode { id: string; label: string; group: TransportGroup; rental?: 'bike' | 'scooter' | 'moped' | 'carsharing'; native?: boolean }

export const transportModes: TransportMode[] = [
  { id: 'carpool', label: 'Попутка', group: 'Спільні поїздки', native: true },
  { id: 'taxi', label: 'Таксі', group: 'Спільні поїздки' },
  { id: 'carsharing', label: 'Каршерінг', group: 'Спільні поїздки', rental: 'carsharing' },
  { id: 'car_rental', label: 'Оренда авто', group: 'Спільні поїздки' },
  { id: 'transfer', label: 'Трансфер', group: 'Спільні поїздки' },
  { id: 'bus', label: 'Автобус', group: 'Міський транспорт' },
  { id: 'marshrutka', label: 'Маршрутка', group: 'Міський транспорт' },
  { id: 'trolleybus', label: 'Тролейбус', group: 'Міський транспорт' },
  { id: 'tram', label: 'Трамвай', group: 'Міський транспорт' },
  { id: 'metro', label: 'Метро', group: 'Міський транспорт' },
  { id: 'city_train', label: 'Міська електричка', group: 'Міський транспорт' },
  { id: 'funicular', label: 'Фунікулер', group: 'Міський транспорт' },
  { id: 'train', label: 'Поїзд', group: 'Міжміський транспорт' },
  { id: 'suburban_train', label: 'Електричка', group: 'Міжміський транспорт' },
  { id: 'intercity_bus', label: 'Міжміський автобус', group: 'Міжміський транспорт' },
  { id: 'bike', label: 'Велосипед', group: 'Легкий транспорт', rental: 'bike' },
  { id: 'scooter', label: 'Самокат', group: 'Легкий транспорт', rental: 'scooter' },
  { id: 'moped', label: 'Мотоцикл, мопед', group: 'Легкий транспорт', rental: 'moped' },
  { id: 'plane', label: 'Літак', group: 'Інше' },
  { id: 'ferry', label: 'Пором', group: 'Інше' },
  { id: 'walk', label: 'Пішки', group: 'Інше' },
];
export const transportGroups: TransportGroup[] = ['Спільні поїздки', 'Міський транспорт', 'Міжміський транспорт', 'Легкий транспорт', 'Інше'];

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1).replace('.', ',')} км`;
}
