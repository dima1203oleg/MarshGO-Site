/** Canonical user-facing transport taxonomy. Internal feed subtypes are mapped in transportPreferences. */
export type TransportGroup = 'Громадський транспорт' | 'Спільні поїздки' | 'Залізниця' | 'Мікромобільність';
export type TransportModeId =
  | 'bus' | 'marshrutka' | 'trolleybus' | 'tram' | 'metro' | 'carpool'
  | 'taxi' | 'train' | 'bike' | 'scooter' | 'carsharing' | 'transfer';

export interface TransportMode { id: TransportModeId; label: string; group: TransportGroup }

/** Order is part of the product contract; do not alphabetize or add legacy feed types here. */
export const transportModes: TransportMode[] = [
  { id: 'bus', label: 'Автобуси', group: 'Громадський транспорт' },
  { id: 'marshrutka', label: 'Маршрутки', group: 'Громадський транспорт' },
  { id: 'trolleybus', label: 'Тролейбуси', group: 'Громадський транспорт' },
  { id: 'tram', label: 'Трамваї', group: 'Громадський транспорт' },
  { id: 'metro', label: 'Метро', group: 'Громадський транспорт' },
  { id: 'carpool', label: 'Попутки', group: 'Спільні поїздки' },
  { id: 'taxi', label: 'Таксі', group: 'Спільні поїздки' },
  { id: 'train', label: 'Поїзди', group: 'Залізниця' },
  { id: 'bike', label: 'Велосипеди', group: 'Мікромобільність' },
  { id: 'scooter', label: 'Самокати', group: 'Мікромобільність' },
  { id: 'carsharing', label: 'Каршеринг', group: 'Спільні поїздки' },
  { id: 'transfer', label: 'Трансфери', group: 'Спільні поїздки' },
];

export const transportGroups: TransportGroup[] = ['Громадський транспорт', 'Спільні поїздки', 'Залізниця', 'Мікромобільність'];

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1).replace('.', ',')} км`;
}
