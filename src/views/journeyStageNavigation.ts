import type { ApiJourney } from '../services/productionApi';
import { journeyLegLabel } from './journeyLegLabel';
import { formatJourneyDistance, formatJourneyDuration } from './journeyResultPresentation';
import { formatStopCount, isTransitLeg } from './routeMapAnnotations';

export type ActiveLeg = ApiJourney['legs'][number];
export type LegPhase = 'upcoming' | 'underway' | 'past';
export type ActiveLegStatus = 'LIVE' | 'PREDICTED' | 'FREQUENCY' | 'SCHEDULED' | 'UNAVAILABLE' | 'UNCONFIRMED' | null;

export const ACTIVE_LEG_STATUS_LABEL: Record<Exclude<ActiveLegStatus, null>, string> = {
  LIVE: 'GPS ОНЛАЙН',
  PREDICTED: 'ПРОГНОЗ',
  FREQUENCY: 'ІНТЕРВАЛ',
  SCHEDULED: 'ЗА РОЗКЛАДОМ',
  UNAVAILABLE: 'НЕДОСТУПНО',
  UNCONFIRMED: 'ОРІЄНТОВНО',
};

const timeFormat = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });

export function activeTime(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  const minute = new Date(value);
  minute.setSeconds(0, 0);
  return timeFormat.format(minute);
}

/** A city feed names a stop "вул. Соборна, 12, Львів" or "Під Голоском (668)"; navigation needs the clean human name. */
export function shortPlace(name: string): string {
  const base = name.split(',')[0]?.trim() || name;
  return base.replace(/\s*\(\d+\)$/, '').replace(/\s*\(код:?\s*\d+\)$/i, '').trim();
}

export function activeLegStatus(leg: ActiveLeg, liveStatus?: string | null): ActiveLegStatus {
  if (leg.mode === 'WALK') return null;
  const status = liveStatus ?? leg.liveStatus ?? null;
  // A planner's stored LIVE label can become stale before navigation opens.
  // Only a status from the current live endpoint is evidence of a live vehicle.
  if (status === 'LIVE' && liveStatus === 'LIVE') return 'LIVE';
  if (status === 'PREDICTED' || status === 'UNAVAILABLE') return status;
  if (status === 'SCHEDULED') return leg.scheduleSemantics === 'frequency_estimate' ? 'FREQUENCY' : 'SCHEDULED';
  return isTransitLeg(leg) ? 'UNCONFIRMED' : null;
}

export function activeLegPhase(leg: ActiveLeg, nowMs: number): LegPhase {
  const departure = Date.parse(leg.departureAt);
  const arrival = Date.parse(leg.arrivalAt);
  if (!Number.isFinite(departure) || !Number.isFinite(arrival)) return 'upcoming';
  if (nowMs >= arrival) return 'past';
  if (nowMs >= departure) return 'underway';
  return 'upcoming';
}

/**
 * Opening navigation on a plan that already started should not replay the
 * walk the passenger has finished: the first leg still ahead is the current one.
 * Every value comes from the itinerary's own timestamps, never from a guess.
 */
export function activeNavigationStartIndex(legs: readonly ActiveLeg[], nowMs: number): number {
  const index = legs.findIndex(leg => {
    const arrival = Date.parse(leg.arrivalAt);
    return !Number.isFinite(arrival) || arrival > nowMs;
  });
  return index === -1 ? Math.max(0, legs.length - 1) : index;
}

export function activeLegTitle(leg: ActiveLeg): string {
  if (leg.mode === 'WALK') return 'Пішки';
  if (leg.mode === 'COMMUNITY') return 'Попутка';
  return `${journeyLegLabel(leg.mode, leg.transportType)}${leg.routeName ? ` ${leg.routeName}` : ''}`;
}

export function activeLegTimes(leg: ActiveLeg): string {
  const departure = activeTime(leg.departureAt);
  const arrival = activeTime(leg.arrivalAt);
  return departure === arrival ? departure : `${departure} → ${arrival}`;
}

export function activeLegMeta(leg: ActiveLeg): string {
  const parts = [activeLegTimes(leg), formatJourneyDuration(leg.durationSeconds)];
  if (leg.mode === 'WALK' && typeof leg.distanceMeters === 'number' && Number.isFinite(leg.distanceMeters)) {
    parts.push(formatJourneyDistance(leg.distanceMeters));
  }
  return parts.join(' · ');
}

export function rideStopCount(leg: ActiveLeg): number {
  const stops = leg.stops?.length ?? 0;
  return stops >= 2 ? stops - 1 : 0;
}

/** Passengers count stages, not graph segments. */
export function formatStageCount(value: number): string {
  const count = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const category = new Intl.PluralRules('uk-UA').select(count);
  const noun = category === 'one' ? 'етап' : category === 'few' ? 'етапи' : 'етапів';
  return `${count} ${noun}`;
}

/** One action line for the stage the passenger is on right now. */
export function activeLegInstruction(leg: ActiveLeg, nowMs: number): string {
  const destination = shortPlace(leg.destination.name);
  const phase = activeLegPhase(leg, nowMs);
  if (phase === 'past') return 'Етап завершено';
  if (leg.mode === 'WALK') return `Прямуйте до «${destination}»`;
  if (leg.mode === 'COMMUNITY') return `Сідайте в авто біля «${shortPlace(leg.origin.name)}»`;
  if (phase === 'upcoming') return `Сідайте на зупинці «${shortPlace(leg.origin.name)}»`;
  const ride = rideStopCount(leg);
  return ride > 0
    ? `Ви в дорозі · виходьте через ${formatStopCount(ride)} на «${destination}»`
    : `Ви в дорозі · виходьте на «${destination}»`;
}

/** What follows the current stage, so the passenger never has to open the plan. */
export function activeLegNextHint(nextLeg: ActiveLeg | undefined): string | null {
  if (!nextLeg) return null;
  if (nextLeg.mode === 'WALK') return `Далі: ${formatJourneyDuration(nextLeg.durationSeconds)} пішки`;
  if (nextLeg.mode === 'COMMUNITY') return `Далі: попутка о ${activeTime(nextLeg.departureAt)}`;
  return `Далі: ${activeLegTitle(nextLeg)} о ${activeTime(nextLeg.departureAt)}`;
}

/** Destination of the whole plan, used by the header. */
export function activeNavigationDestination(legs: readonly ActiveLeg[]): string {
  return shortPlace(legs.at(-1)?.destination.name ?? '');
}
