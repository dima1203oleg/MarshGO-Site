import type { ApiVehicle } from '../services/productionApi';

/** A vehicle is usable after plate + photo evidence, or when an older API reports it verified. */
export function vehicleUsable(vehicle: Pick<ApiVehicle, 'trust_level' | 'verification_status'>): boolean {
  return (vehicle.trust_level ?? 0) >= 1 || vehicle.verification_status === 'verified';
}
