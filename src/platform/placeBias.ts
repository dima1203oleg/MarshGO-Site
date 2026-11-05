export type PlaceBias = { latitude: number; longitude: number; accuracyMeters?: number; capturedAt?: string };

/**
 * Biases place search by the viewer's own locality. Reads only a fix the browser is already
 * willing to share — it must never trigger a permission prompt while someone types a place name.
 *
 * The browser's own accuracy and timestamp travel with the position. That matters beyond search:
 * navigation may fall back to this fix, and a fallback has to carry the precision it really has
 * instead of a number someone typed in.
 */
export async function currentPlaceBias(): Promise<PlaceBias | undefined> {
  if (typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions) return undefined;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    if (status.state !== 'granted') return undefined;
  } catch { return undefined; }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        ...(Number.isFinite(position.coords.accuracy) ? { accuracyMeters: position.coords.accuracy } : {}),
        ...(Number.isFinite(position.timestamp) ? { capturedAt: new Date(position.timestamp).toISOString() } : {}),
      }),
      () => resolve(undefined),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 2_000 },
    );
  });
}
