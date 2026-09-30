export type MapTileStatus = 'unconfigured' | 'loading' | 'available' | 'degraded' | 'failed';

export type MapTileEvent = 'tileload' | 'tileerror';

export function initialMapTileStatus(configured: boolean): MapTileStatus {
  return configured ? 'loading' : 'unconfigured';
}

export function reduceMapTileStatus(
  status: MapTileStatus,
  event: MapTileEvent,
): MapTileStatus {
  if (event === 'tileload') return 'available';
  return status === 'available' || status === 'degraded' ? 'degraded' : 'failed';
}
