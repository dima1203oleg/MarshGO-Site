import {
  ArrowLeftRight, Bike, BusFront, Car, Caravan, CarFront, CarTaxiFront, Clock3, createLucideIcon,
  PersonStanding, TrainFront, TramFront, Waypoints,
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
  ['circle', { cx: '6', cy: '19', r: '2', key: 'scooter-wheel-rear' }],
  ['circle', { cx: '18', cy: '19', r: '2', key: 'scooter-wheel-front' }],
  ['path', { d: 'M8 19h6l2-11h4', key: 'scooter-deck-and-stem' }],
  ['path', { d: 'M16 8l-1-4h-2', key: 'scooter-handlebar' }],
]);

/** Trolleybus must not share the bus silhouette: the body carries two current-collector poles. */
const Trolleybus = createLucideIcon('Trolleybus', [
  ['path', { d: 'M4 10h16v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', key: 'trolleybus-body' }],
  ['path', { d: 'M9 10 6.5 3.5M15 10l2.5-6.5', key: 'trolleybus-poles' }],
  ['circle', { cx: '8', cy: '19', r: '1.6', key: 'trolleybus-wheel-rear' }],
  ['circle', { cx: '16', cy: '19', r: '1.6', key: 'trolleybus-wheel-front' }],
]);

/** Diagonal rails read as a railway, not as a city metro — use the tunnel-arch M monogram. */
const Metro = createLucideIcon('Metro', [
  ['path', { d: 'M4 20v-8a8 8 0 0 1 16 0v8', key: 'metro-tunnel-arch' }],
  ['path', { d: 'M8.5 16.5v-4.5l3.5 3 3.5-3v4.5', key: 'metro-m' }],
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
  bus: visual('bus', 'Автобус', 'Автобуси', 'Bus', BusFront, '#327FC3', 'Громадський транспорт'),
  marshrutka: visual('marshrutka', 'Маршрутка', 'Маршрутки', 'Minibus', Caravan, '#327FC3', 'Громадський транспорт'),
  trolleybus: visual('trolleybus', 'Тролейбус', 'Тролейбуси', 'Trolleybus', Trolleybus, '#327FC3', 'Громадський транспорт'),
  tram: visual('tram', 'Трамвай', 'Трамваї', 'Tram', TramFront, '#327FC3', 'Громадський транспорт'),
  metro: visual('metro', 'Метро', 'Метро', 'Metro', Metro, '#327FC3', 'Громадський транспорт'),
  carpool: visual('carpool', 'Попутка', 'Попутки', 'Carpool', CarFront, '#327FC3', 'Спільні поїздки'),
  taxi: visual('taxi', 'Таксі', 'Таксі', 'Taxi', CarTaxiFront, '#327FC3', 'Спільні поїздки'),
  train: visual('train', 'Поїзд', 'Поїзди', 'Train', TrainFront, '#327FC3', 'Залізниця'),
  bike: visual('bike', 'Велосипед', 'Велосипеди', 'Bicycle', Bike, '#327FC3', 'Мікромобільність'),
  scooter: visual('scooter', 'Самокат', 'Самокати', 'Scooter', Scooter, '#327FC3', 'Мікромобільність'),
  carsharing: visual('carsharing', 'Каршеринг', 'Каршеринг', 'Car sharing', Car, '#327FC3', 'Спільні поїздки'),
  transfer: visual('transfer', 'Трансфер', 'Трансфери', 'Transfer', ArrowLeftRight, '#327FC3', 'Спільні поїздки'),
};

const specialVisuals: Record<string, CanonicalVisual> = {
  WALK: visual('walk', 'Пішки', 'Пішки', 'Walking', PersonStanding, '#91A6BB'),
  WAIT: visual('wait', 'Очікування', 'Очікування', 'Waiting', Clock3, '#91A6BB'),
  FERRY: visual('ferry', 'Пором', 'Пороми', 'Ferry', Waypoints, '#327FC3'),
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
