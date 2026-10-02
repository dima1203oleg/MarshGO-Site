/** Requires consecutive server-confirmed deviations and rate-limits route recalculation. */
export class OffRouteGuard {
  private consecutiveMisses = 0;
  private lastRerouteAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly confirmations = 2, private readonly cooldownMs = 30_000) {}

  observe(onRoute: boolean, nowMs: number): { confirmedOffRoute: boolean; requestReroute: boolean } {
    if (onRoute) {
      this.consecutiveMisses = 0;
      return { confirmedOffRoute: false, requestReroute: false };
    }
    this.consecutiveMisses += 1;
    const confirmedOffRoute = this.consecutiveMisses >= this.confirmations;
    const requestReroute = confirmedOffRoute && nowMs - this.lastRerouteAt >= this.cooldownMs;
    if (requestReroute) this.lastRerouteAt = nowMs;
    return { confirmedOffRoute, requestReroute };
  }

  reset() {
    this.consecutiveMisses = 0;
    this.lastRerouteAt = Number.NEGATIVE_INFINITY;
  }
}
