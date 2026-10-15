import {
  Bike, BusFront, Car, CarFront, CarTaxiFront, Clock3, createLucideIcon,
  PersonStanding, TrainFront, TrainTrack, TramFront, Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { TransportGroup, TransportModeId } from '../../domain/transportCatalog';

export interface TransportModeVisual {
  id: string;
  label: string;
  pluralLabel: string;
  englishLabel: string;
  group?: TransportGroup;
  icon: LucideIcon;
  color: string;
  colorToken: string;
  mapLineStyle: { width: number; dash?: readonly [number, number]; cap: 'round' | 'butt' };
  badgeStyle: { color: string; backgroundColor: string };
  accessibilityLabel: string;
}

type CanonicalVisual = Omit<TransportModeVisual, 'badgeStyle' | 'accessibilityLabel'>;

const Scooter = createLucideIcon('Scooter', [
  ['circle', { cx: '6', cy: '19', r: '2' }],
  ['circle', { cx: '18', cy: '19', r: '2' }],
  ['path', { d: 'M8 19h6l2-11h4' }],
  ['path', { d: 'M16 8l-1-4h-2' }],
]);

function visual(
  id: string,
  label: string,
  pluralLabel: string,
  englishLabel: string,
  icon: LucideIcon,
  color: string,
  group?: TransportGroup,
): CanonicalVisual {
  return {
    id, label, pluralLabel, englishLabel, icon, color, group,
    colorToken: `--mode-${id}`,
    mapLineStyle: { width: 6, cap: 'round' },
  };
}

/**
 * Single visual source for MARSHGO transport modes. The twelve public categories
 * keep the order from transportCatalog; walking/waiting and legacy feed modes
 * exist only so journey segments render consistently.
 */
export const transportModeRegistry: Record<TransportModeId, CanonicalVisual> = {
  bus: visual('bus', 'Автобус', 'Автобуси', 'Bus', BusFront, '#1687FF', 'Громадський транспорт'),
  marshrutka: visual('marshrutka', 'Маршрутка', 'Маршрутки', 'Minibus', BusFront, '#F02F79', 'Громадський транспорт'),
  trolleybus: visual('trolleybus', 'Тролейбус', 'Тролейбуси', 'Trolleybus', BusFront, '#00C2A0', 'Громадський транспорт'),
  tram: visual('tram', 'Трамвай', 'Трамваї', 'Tram', TramFront, '#F43F7B', 'Громадський транспорт'),
  metro: visual('metro', 'Метро', 'Метро', 'Metro', TrainTrack, '#E43F86', 'Громадський транспорт'),
  carpool: visual('carpool', 'Попутка', 'Попутки', 'Carpool', CarFront, '#A855F7', 'Спільні поїздки'),
  taxi: visual('taxi', 'Таксі', 'Таксі', 'Taxi', CarTaxiFront, '#F5B51B', 'Спільні поїздки'),
  train: visual('train', 'Поїзд', 'Поїзди', 'Train', TrainFront, '#914BF4', 'Залізниця'),
  bike: visual('bike', 'Велосипед', 'Велосипеди', 'Bicycle', Bike, '#20B86A', 'Мікромобільність'),
  scooter: visual('scooter', 'Самокат', 'Самокати', 'Scooter', Scooter, '#8B5CF6', 'Мікромобільність'),
  carsharing: visual('carsharing', 'Каршеринг', 'Каршеринг', 'Car sharing', Car, '#00A8D6', 'Спільні поїздки'),
  transfer: visual('transfer', 'Трансфер', 'Трансфери', 'Transfer', BusFront, '#16B6A5', 'Спільні поїздки'),
};

const specialVisuals: Record<string, CanonicalVisual> = {
  WALK: visual('walk', 'Пішки', 'Пішки', 'Walking', PersonStanding, '#91A6BB'),
  WAIT: visual('wait', 'Очікування', 'Очікування', 'Waiting', Clock3, '#91A6BB'),
  FERRY: visual('ferry', 'Пором', 'Пороми', 'Ferry', Waypoints, '#0891B2'),
  FUNICULAR: visual('funicular', 'Фунікулер', 'Фунікулери', 'Funicular', TrainFront, '#64748B'),
};

const aliases: Record<string, TransportModeId | keyof typeof specialVisuals> = {
  BUS: 'bus', URBAN_BUS: 'bus', CITY_BUS: 'bus', INTERCITY_BUS: 'bus',
  MINIBUS: 'marshrutka', MARSHRUTKA: 'marshrutka',
  TROLLEYBUS: 'trolleybus', TRAM: 'tram', METRO: 'metro',
  RAIL: 'train', TRAIN: 'train', CITY_TRAIN: 'train', SUBURBAN_TRAIN: 'train',
  COMMUNITY: 'carpool', COMMUNITY_DEMAND: 'carpool', CARPOOL: 'carpool', CARPOOL_OFFER: 'carpool',
  TAXI: 'taxi', BIKE: 'bike', BICYCLE: 'bike', SCOOTER: 'scooter', E_SCOOTER: 'scooter',
  CARSHARING: 'carsharing', CAR_SHARE: 'carsharing', CAR_RENTAL: 'carsharing',
  TRANSFER: 'transfer', SHUTTLE: 'transfer', WALK: 'WALK', WAIT: 'WAIT',
  FERRY: 'FERRY', FUNICULAR: 'FUNICULAR',
};

const fallbackVisual: CanonicalVisual = visual('unknown', 'Транспорт', 'Транспорт', 'Transport', Waypoints, '#91A6BB');

export function normalizeTransportMode(mode: string, transportType?: string | null): string | null {
  for (const raw of [transportType, mode]) {
    const normalized = raw?.trim().toLocaleUpperCase('en-US').replace(/[\s-]+/g, '_');
    const id = normalized ? aliases[normalized] : undefined;
    if (id) return id;
  }
  return null;
}

export function getTransportModeVisual(mode: string, transportType?: string | null): TransportModeVisual {
  const normalized = normalizeTransportMode(mode, transportType);
  const item = normalized && normalized in specialVisuals
    ? specialVisuals[normalized]
    : normalized && normalized in transportModeRegistry
      ? transportModeRegistry[normalized as TransportModeId]
      : fallbackVisual;
  return {
    ...item,
    badgeStyle: {
      color: `var(${item.colorToken})`,
      backgroundColor: `color-mix(in srgb, var(${item.colorToken}) 14%, transparent)`,
    },
    accessibilityLabel: item.label,
  };
}
