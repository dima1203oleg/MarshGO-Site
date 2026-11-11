import type { Coordinate } from '../../shared/navigation/contracts';
import type { ApiJourney } from '../services/productionApi';

export type JourneyLeg = ApiJourney['legs'][number];

export interface CinematicCallout {
  id: string;
  type: 'BOARDING' | 'STOPS_COUNT' | 'ALIGHTING' | 'TRANSFER' | 'NEXT_ACTION';
  coordinates: [number, number]; // [lng, lat]
  title: string;
  subtitle: string;
  time?: string;
  badge?: string;
  accentColor: string;
  iconType: 'bus' | 'tram' | 'trolleybus' | 'train' | 'walk' | 'transfer' | 'pin';
  stage: 'enter' | 'hold' | 'exit';
  screenPos?: { x: number; y: number };
}

export interface SmartStepSummary {
  headline: string;
  narrative: string;
  stopsCountLabel?: string;
  transitBadge?: string;
}

/** Computes great-circle distance between two coordinates in metres. */
export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const lat1 = a[1] * rad;
  const lat2 = b[1] * rad;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Prepare segment lengths once for a cancellable route reveal. */
export function prepareLineProgress(input: readonly Coordinate[]): (progress: number) => Coordinate[] {
  const coordinates = input.map(point => [point[0], point[1]] as Coordinate);
  const segmentDistances = coordinates.slice(1).map((point, index) => distanceMeters(coordinates[index]!, point));
  const totalLength = segmentDistances.reduce((sum, length) => sum + length, 0);
  return (progress: number): Coordinate[] => {
    if (coordinates.length === 0) return [];
    if (coordinates.length === 1 || progress <= 0) return [coordinates[0]!];
    if (progress >= 1) return [...coordinates];

    if (totalLength === 0) return [...coordinates];

    const targetDistance = totalLength * Math.max(0, Math.min(1, progress));
    const result: Coordinate[] = [coordinates[0]!];
    let accumulated = 0;

    for (let i = 0; i < segmentDistances.length; i++) {
      const segDist = segmentDistances[i]!;
      if (accumulated + segDist >= targetDistance) {
        const remaining = targetDistance - accumulated;
        const ratio = segDist > 0 ? remaining / segDist : 0;
        const p1 = coordinates[i]!;
        const p2 = coordinates[i + 1]!;
        const interpolated: Coordinate = [
          p1[0] + (p2[0] - p1[0]) * ratio,
          p1[1] + (p2[1] - p1[1]) * ratio,
        ];
        result.push(interpolated);
        break;
      }
      accumulated += segDist;
      result.push(coordinates[i + 1]!);
    }

    return result;
  };
}

/** Interpolates coordinates along a polyline by travelled distance. */
export function interpolateLineProgress(coordinates: readonly Coordinate[], progress: number): Coordinate[] {
  return prepareLineProgress(coordinates)(progress);
}

/** Extract icon type from leg mode. */
export function calloutIconType(leg: JourneyLeg): 'bus' | 'tram' | 'trolleybus' | 'train' | 'walk' | 'transfer' | 'pin' {
  if (leg.mode === 'WALK') return 'walk';
  const transport = (leg.transportType || '').toLowerCase();
  if (transport.includes('tram')) return 'tram';
  if (transport.includes('trolley')) return 'trolleybus';
  if (transport.includes('train')) return 'train';
  return 'bus';
}

/** Strips database stop codes like (64), (117) or technical suffixes to produce clean human-grade stop names. */
export function cleanStopName(name?: string): string {
  if (!name) return '';
  return name
    .replace(/\s*\(\d+\)$/, '')
    .replace(/\s*\(зупинка\)$/i, '')
    .split(',')[0]
    .trim();
}

/** Generates smart narrative explanation for selected route stage. */
export function generateSmartStepSummary(currentLeg: JourneyLeg, nextLeg?: JourneyLeg): SmartStepSummary {
  const isWalk = currentLeg.mode === 'WALK';
  const name = currentLeg.routeName || currentLeg.headsign || 'Маршрут';
  const stopCount = (currentLeg.stops?.length ?? 0);

  if (isWalk) {
    const distM = currentLeg.distanceMeters ?? (currentLeg.coordinates?.length ? Math.round(distanceMeters(currentLeg.coordinates[0]!, currentLeg.coordinates.at(-1)!)) : 100);
    const durationMin = Math.max(1, Math.round(currentLeg.durationSeconds / 60));
    const destName = cleanStopName(currentLeg.destination?.name) || 'зупинки';

    if (nextLeg && nextLeg.mode !== 'WALK') {
      const nextName = nextLeg.routeName || nextLeg.headsign || 'транспорт';
      return {
        headline: 'Піший перехід до посадки',
        narrative: `Пройдіть ${distM} м (${durationMin} хв) до «${destName}». Там сідайте на ${nextName}.`,
        transitBadge: 'Пішки',
      };
    }

    return {
      headline: 'Піший перехід',
      narrative: `Пройдіть ${distM} м (${durationMin} хв) до кінцевої точки «${destName}».`,
      transitBadge: 'Пішки',
    };
  }

  const originStop = cleanStopName(currentLeg.origin?.name) || 'зупинки';
  const destStop = cleanStopName(currentLeg.destination?.name) || 'пункту висадки';
  const stopsText = stopCount > 1 ? `${stopCount} зупинок` : stopCount === 1 ? '1 зупинка' : 'без проміжних зупинок';
  const durationMin = Math.max(1, Math.round(currentLeg.durationSeconds / 60));

  let connectionNarrative = '';
  if (nextLeg) {
    if (nextLeg.mode === 'WALK') {
      const nextDist = nextLeg.distanceMeters ?? 100;
      connectionNarrative = ` Після висадки — пішки ${nextDist} м.`;
    } else {
      const nextName = nextLeg.routeName || nextLeg.headsign || 'інший транспорт';
      connectionNarrative = ` Далі пересадка на ${nextName}.`;
    }
  }

  return {
    headline: `Поїздка: ${name}`,
    narrative: `Посадка на «${originStop}». Проїдьте ${stopsText} (${durationMin} хв) до «${destStop}».${connectionNarrative}`,
    stopsCountLabel: `${stopCount} зупинок до висадки`,
    transitBadge: name,
  };
}

/** Callout positioning helper to prevent occlusion by headers or bottom sheet. */
export function calculateCalloutAnchor(
  screenX: number,
  screenY: number,
  viewWidth: number,
  viewHeight: number,
  sheetHeight: number,
  topHudHeight = 84,
  calloutWidth = 180,
  calloutHeight = 60
): { left: number; top: number; pointerDirection: 'down' | 'up' | 'left' | 'right' } {
  const margin = 12;
  const availableTop = topHudHeight + margin;
  const availableBottom = viewHeight - sheetHeight - margin;

  // Default: show above the anchor point
  let top = screenY - calloutHeight - 12;
  let pointerDirection: 'down' | 'up' | 'left' | 'right' = 'down';

  if (top < availableTop) {
    // If overflowing top header, flip below anchor
    top = screenY + 16;
    pointerDirection = 'up';
  }

  // Ensure within vertical corridor
  top = Math.max(availableTop, Math.min(availableBottom - calloutHeight, top));

  // Horizontal centering around screenX
  let left = screenX - calloutWidth / 2;
  left = Math.max(margin, Math.min(viewWidth - calloutWidth - margin, left));

  return { left, top, pointerDirection };
}
