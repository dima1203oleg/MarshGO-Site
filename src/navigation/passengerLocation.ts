import { isDuplicateLocationFix, validateLocationFix, type LocationPipelineResult } from '../platform/LocationProvider';
import type { LocationFix } from '../../shared/navigation/contracts';

export type PassengerLocationStartResult =
  | { readonly accepted: true; readonly fix: LocationFix }
  | { readonly accepted: false; readonly code: 'GPS_PERMISSION_DENIED' | 'GPS_LOW_ACCURACY' | 'GPS_STALE' | 'GPS_INVALID_FIX' | 'GPS_TELEPORT_DETECTED' };

/** Passenger navigation must start from a fresh browser GPS fix, never a replay or guessed coordinate. */
export function validatePassengerStartFix(fix: LocationFix, nowMs: number): PassengerLocationStartResult {
  if (fix.source !== 'gps') return { accepted: false, code: 'GPS_INVALID_FIX' };
  const result: LocationPipelineResult = validateLocationFix(fix, nowMs);
  return result.accepted ? result : { accepted: false, code: result.code };
}

export function passengerLocationStartMessage(code: string): string {
  if (code === 'GPS_PERMISSION_DENIED') return 'Дозвольте доступ до місцезнаходження, щоб розпочати навігацію.';
  if (code === 'GPS_LOW_ACCURACY') return 'Не вдалося точно визначити місце. Спробуйте ще раз надворі.';
  if (code === 'GPS_STALE') return 'Місцезнаходження застаріло. Спробуйте ще раз.';
  return 'Не вдалося визначити ваше місце. Перевірте геолокацію та спробуйте ще раз.';
}

export type PassengerLocationUpdateResult = PassengerLocationStartResult | { readonly accepted: false; readonly duplicate: true };

export function validatePassengerLocationUpdate(fix: LocationFix, nowMs: number, previous?: LocationFix): PassengerLocationUpdateResult {
  if (fix.source !== 'gps') return { accepted: false, code: 'GPS_INVALID_FIX' };
  if (isDuplicateLocationFix(fix, previous)) return { accepted: false, duplicate: true };
  const result = validateLocationFix(fix, nowMs, previous);
  return result.accepted ? result : { accepted: false, code: result.code };
}
