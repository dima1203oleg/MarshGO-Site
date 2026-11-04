import { z } from 'zod';

/**
 * Passenger navigation across a reload or a cold PWA relaunch.
 *
 * The record is deliberately tiny: which journey, which stage of it, which
 * account started it, and when. It holds no token, no coordinate and no GPS
 * history — prices, live status, geometry and stops all come back from
 * `GET /journeys/:id`, which the server only answers for the owner. A record
 * that another account, a stale session or a finished plan leaves behind is
 * dropped instead of being shown.
 */
export const activeJourneyNavigationKey = 'marshgo.active-journey-navigation.v1';

/** An overnight plan is history, not a journey the passenger is still riding. */
export const maximumActiveJourneyAgeMs = 12 * 60 * 60 * 1000;

/** The allow-list the URL router uses, so a stored id can never smuggle a path. */
const identifierPattern = /^[A-Za-z0-9_-]{1,128}$/;

/** Journey states where resuming navigation would be wrong. */
const closedJourneyStates = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'ARCHIVED']);

export function isOpenJourneyState(state: string | null | undefined): boolean {
  return !closedJourneyStates.has((state ?? '').toUpperCase());
}

const recordSchema = z.object({
  journeyId: z.string().regex(identifierPattern),
  legIndex: z.number().int().min(0).max(99),
  ownerUserId: z.string().regex(identifierPattern),
  savedAt: z.string().datetime({ offset: true }),
});

export type ActiveJourneyNavigationRecord = z.infer<typeof recordSchema>;

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export class ActiveJourneyNavigationStore {
  private readonly source: KeyValueStore | null;

  /** `null` means "no storage at all", which is how a test or a WebView without
   *  localStorage opts out of persistence instead of falling back to a global. */
  constructor(storage?: KeyValueStore | null) {
    this.source = storage === undefined
      ? (typeof localStorage === 'undefined' ? null : localStorage)
      : storage;
  }

  /**
   * Returns null for every case that should not resume: no record, a record the
   * schema rejects, or a record older than the freshness window. Bad and expired
   * records are removed so a broken entry cannot survive the boot.
   */
  read(nowMs = Date.now()): ActiveJourneyNavigationRecord | null {
    if (!this.source) return null;
    const raw = this.source.getItem(activeJourneyNavigationKey);
    if (!raw) return null;
    const parsed = recordSchema.safeParse(safeJson(raw));
    if (!parsed.success) {
      this.source.removeItem(activeJourneyNavigationKey);
      return null;
    }
    const savedAtMs = Date.parse(parsed.data.savedAt);
    if (!Number.isFinite(savedAtMs) || nowMs - savedAtMs > maximumActiveJourneyAgeMs || savedAtMs - nowMs > maximumActiveJourneyAgeMs) {
      this.source.removeItem(activeJourneyNavigationKey);
      return null;
    }
    return parsed.data;
  }

  /** Only the account that started the journey may resume it. */
  readForUser(userId: string, nowMs = Date.now()): ActiveJourneyNavigationRecord | null {
    const record = this.read(nowMs);
    if (!record) return null;
    if (!userId || record.ownerUserId !== userId) {
      this.clear();
      return null;
    }
    return record;
  }

  write(input: { journeyId: string; legIndex: number; ownerUserId: string }): boolean {
    if (!this.source) return false;
    const parsed = recordSchema.safeParse({ ...input, savedAt: new Date().toISOString() });
    if (!parsed.success) return false;
    this.source.setItem(activeJourneyNavigationKey, JSON.stringify(parsed.data));
    return true;
  }

  /**
   * Keeps the stage pointer in step with the passenger. A stage change that
   * arrives after the journey was exited or replaced is ignored, so a late
   * callback can never resurrect a record the user already left.
   */
  updateStage(journeyId: string, legIndex: number): boolean {
    const record = this.read();
    if (!record || record.journeyId !== journeyId) return false;
    return this.write({ ...record, journeyId, legIndex });
  }

  clear(): void {
    this.source?.removeItem(activeJourneyNavigationKey);
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
