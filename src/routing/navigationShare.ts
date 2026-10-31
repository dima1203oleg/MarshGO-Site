export type SharedNavigationDestination = { providerId: 'shared-navigation'; label: string; latitude: number; longitude: number };

export function parseSharedNavigationDestination(search: string): SharedNavigationDestination | null {
  const params = new URLSearchParams(search);
  const latitude = Number(params.get('lat'));
  const longitude = Number(params.get('lon'));
  if (!params.has('lat') || !params.has('lon') || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const label = (params.get('destination') ?? '').trim().slice(0, 120) || 'Спільна точка призначення';
  return { providerId: 'shared-navigation', label, latitude, longitude };
}

export function createNavigationShareUrl(destination: Pick<SharedNavigationDestination, 'label' | 'latitude' | 'longitude'>, origin: string): string {
  if (!Number.isFinite(destination.latitude) || destination.latitude < -90 || destination.latitude > 90
    || !Number.isFinite(destination.longitude) || destination.longitude < -180 || destination.longitude > 180) {
    throw new Error('NAVIGATION_SHARE_INVALID_COORDINATES');
  }
  const url = new URL('/navigate', origin);
  url.searchParams.set('lat', String(destination.latitude));
  url.searchParams.set('lon', String(destination.longitude));
  url.searchParams.set('destination', destination.label.trim().slice(0, 120));
  return url.toString();
}
