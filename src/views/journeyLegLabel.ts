import { getTransportModeVisual, normalizeTransportMode } from '../design-system/transport/transportModeRegistry';

const transportTypeLabels: Record<string, string> = {
  intercity_bus: 'Міжміський автобус',
  train: 'Поїзд',
  city_train: 'Міська електричка',
  suburban_train: 'Електричка',
  funicular: 'Фунікулер',
  ferry: 'Пором',
};

const modeLabels: Record<string, string> = {
  COMMUNITY_DEMAND: 'Запит на попутку',
  URBAN_BUS: 'Міський автобус',
  RAIL: 'Залізниця',
};

export function journeyLegLabel(mode: string, transportType?: string | null): string {
  const concreteType = transportType?.toLocaleLowerCase('en-US');
  const specialLabel = (concreteType && transportTypeLabels[concreteType]) || modeLabels[mode];
  if (specialLabel) return specialLabel;
  const normalized = normalizeTransportMode(mode, transportType);
  if (normalized) return getTransportModeVisual(mode, transportType).label;
  return mode || 'Транспорт';
}

export function journeyLegCaveat(
  mode: string,
  source?: string | null,
  scheduleSemantics?: 'published_departures' | 'frequency_estimate' | null,
  fareSource?: 'gtfs-v1' | 'city-tariff-registry' | null,
): string | null {
  const caveats: string[] = [];
  const normalizedMode = normalizeTransportMode(mode);
  if (scheduleSemantics === 'frequency_estimate') caveats.push('Час поїзда оцінений за оприлюдненим інтервалом; live-даних немає.');
  if (fareSource === 'city-tariff-registry') caveats.push('Ціна розрахована за оприлюдненим міським тарифом; спосіб оплати може змінити суму.');
  const estimatedGeometry = /estimate|straight-line/i.test(source ?? '');
  if (normalizedMode === 'WALK' && (estimatedGeometry || source === 'walking-estimate')) {
    caveats.push('Пішохідну відстань оцінено по прямій; реальний шлях може бути довшим.');
  }
  if (normalizedMode === 'bike' && estimatedGeometry) {
    caveats.push('Відрізок між точками провайдера орієнтовний; дорожня велотраєкторія, наявність велосипеда та бронювання не підтверджені.');
  }
  if (normalizedMode === 'scooter' && estimatedGeometry) {
    caveats.push('Траєкторія між зонами провайдера орієнтовна; наявність самоката й тариф не підтверджені.');
  }
  return caveats.length ? caveats.join(' ') : null;
}
