const transportTypeLabels: Record<string, string> = {
  bus: 'Автобус',
  intercity_bus: 'Міжміський автобус',
  marshrutka: 'Маршрутка',
  trolleybus: 'Тролейбус',
  tram: 'Трамвай',
  metro: 'Метро',
  city_train: 'Міська електричка',
  suburban_train: 'Електричка',
  train: 'Поїзд',
  funicular: 'Фунікулер',
  carpool: 'Попутка MARSHGO',
  taxi: 'Таксі',
  transfer: 'Трансфер',
  carsharing: 'Каршеринг',
  bike: 'Велосипед',
  scooter: 'Самокат',
  ferry: 'Пором',
  walk: 'Пішки',
};

const modeLabels: Record<string, string> = {
  WALK: 'Пішки', COMMUNITY: 'Попутка MARSHGO', COMMUNITY_DEMAND: 'Запит на попутку',
  BUS: 'Автобус', URBAN_BUS: 'Міський автобус', MINIBUS: 'Маршрутка', RAIL: 'Залізниця',
  TRAM: 'Трамвай', TROLLEYBUS: 'Тролейбус', METRO: 'Метро', TAXI: 'Таксі',
  TRANSFER: 'Трансфер', CARSHARING: 'Каршеринг', BIKE: 'Велосипед', SCOOTER: 'Самокат',
  FERRY: 'Пором', FUNICULAR: 'Фунікулер',
};

export function journeyLegLabel(mode: string, transportType?: string | null): string {
  const concreteType = transportType?.toLocaleLowerCase('en-US');
  return (concreteType && transportTypeLabels[concreteType]) || modeLabels[mode] || mode || 'Транспорт';
}
