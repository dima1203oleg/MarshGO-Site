/**
 * Refresh cookies are shared by every tab on an origin, while JS access tokens
 * and `refreshInFlight` are per tab. Serialize rotation across tabs so two cold
 * starts cannot submit the same single-use cookie and trigger reuse revocation.
 */
export type AuthRefreshLockManager = Pick<LockManager, 'request'>;

export function withAuthRefreshLock<T>(
  operation: () => Promise<T>,
  lockManager: AuthRefreshLockManager | undefined =
    typeof navigator === 'undefined' ? undefined : navigator.locks,
): Promise<T> {
  if (!lockManager) return operation();
  return lockManager.request('marshgo:auth-refresh', { mode: 'exclusive' }, operation);
}
