export type PlaceBias = { latitude: number; longitude: number };

/**
 * Biases place search by the viewer's own locality. Reads only a fix the browser is already
 * willing to share — it must never trigger a permission prompt while someone types a place name.
 */
export async function currentPlaceBias(): Promise<PlaceBias | undefined> {
  if (typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions) return undefined;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    if (status.state !== 'granted') return undefined;
  } catch { return undefined; }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 2_000 },
    );
  });
}
