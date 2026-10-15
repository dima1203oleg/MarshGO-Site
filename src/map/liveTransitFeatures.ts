import type { Coordinate } from '../../shared/navigation/contracts';
import type { LiveTransitPosition } from './MapAdapter';

export type LiveTransitProperties = {
  id: string;
  color: string;
  label: string;
  updatedAt: string;
  selected: boolean;
};

export type LiveTransitFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    properties: LiveTransitProperties;
    geometry: { type: 'Point'; coordinates: Coordinate };
  }>;
};

/** Keep only provider snapshots that can still be represented as current. */
export function freshLiveTransitPositions(positions: readonly LiveTransitPosition[], now = Date.now()): LiveTransitPosition[] {
  return positions.filter(position => position.id.length > 0
    && position.coordinates.length === 2
    && position.coordinates.every(Number.isFinite)
    && Math.abs(position.coordinates[0]) <= 180
    && Math.abs(position.coordinates[1]) <= 90
    && Number.isFinite(Date.parse(position.updatedAt))
    && now - Date.parse(position.updatedAt) >= -30_000
    && now - Date.parse(position.updatedAt) <= 90_000);
}

/** One stable GeoJSON collection batches journey vehicle updates for MapLibre. */
export function liveTransitFeatureCollection(positions: readonly LiveTransitPosition[]): LiveTransitFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: positions.map(position => ({
      type: 'Feature',
      id: position.id,
      properties: {
        id: position.id,
        color: position.color,
        label: position.label,
        updatedAt: position.updatedAt,
        selected: position.selected === true,
      },
      geometry: { type: 'Point', coordinates: position.coordinates },
    })),
  };
}
