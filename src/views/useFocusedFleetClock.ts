import { useEffect, useState } from 'react';
import { focusedFleetNextExpiry } from '../map/transportVisualZones';
import type { Coordinate } from '../../shared/navigation/contracts';

/** Wake exactly when a currently visible GPS fix expires, even if polling stalls. */
export function useFocusedFleetClock(vehicles: readonly { emphasized: boolean; updatedAt: string; coordinates: Coordinate }[] | undefined): number {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { setClock(Date.now()); }, [vehicles]);
  useEffect(() => {
    const now = Date.now();
    const expiry = focusedFleetNextExpiry(vehicles ?? [], now);
    if (expiry === null) return;
    const timer = window.setTimeout(() => setClock(Date.now()), Math.max(1, expiry - now));
    return () => window.clearTimeout(timer);
  }, [vehicles, clock]);
  return clock;
}
