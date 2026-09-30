export type MapTileStatus = 'unconfigured' | 'loading' | 'available' | 'degraded' | 'failed';

export type MapTileEvent = 'tileload' | 'tileerror' | 'tileunload';

export type MapTileHealth = {
  status: MapTileStatus;
  loaded: ReadonlySet<string>;
  failed: ReadonlySet<string>;
};

export function initialMapTileHealth(configured: boolean): MapTileHealth {
  return {
    status: configured ? 'loading' : 'unconfigured',
    loaded: new Set(),
    failed: new Set(),
  };
}

export function reduceMapTileHealth(
  health: MapTileHealth,
  event: MapTileEvent,
  tileKey: string,
): MapTileHealth {
  if (!tileKey) return health;

  const loaded = new Set(health.loaded);
  const failed = new Set(health.failed);
  if (event === 'tileload') {
    loaded.add(tileKey);
    failed.delete(tileKey);
  } else if (event === 'tileerror') {
    loaded.delete(tileKey);
    failed.add(tileKey);
  } else {
    loaded.delete(tileKey);
    failed.delete(tileKey);
  }

  let status: MapTileStatus;
  if (failed.size > 0) status = loaded.size > 0 ? 'degraded' : 'failed';
  else if (loaded.size > 0) status = 'available';
  else status = health.status === 'unconfigured' ? 'unconfigured' : 'loading';

  return { status, loaded, failed };
}

export function mapTileKey(coords: { z: number; x: number; y: number }): string {
  return `${coords.z}/${coords.x}/${coords.y}`;
}
