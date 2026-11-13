import type { ApiJourney } from '../services/productionApi';
import { journeyLegLabel } from './journeyLegLabel';
import { journeyModeColor } from '../map/journeyRouteModel';

export type JourneyResultSegment = {
  id: string;
  kind: 'LEG' | 'WAIT';
  mode: string;
  label: string;
  color: string;
  durationSeconds: number;
  departureAt: string;
  arrivalAt: string;
  leg?: ApiJourney['legs'][number];
};

const validTime = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

/** Use the itinerary's requested start when its total duration includes pre-departure waiting. */
export function journeySummaryDepartureAt(journey: ApiJourney): string | null {
  const requestedDepartureAt = journey.requestedDepartureAt;
  if (validTime(requestedDepartureAt) !== null && requestedDepartureAt) return requestedDepartureAt;
  const firstLegDepartureAt = journey.legs[0]?.departureAt;
  return validTime(firstLegDepartureAt) !== null && firstLegDepartureAt ? firstLegDepartureAt : null;
}

export function formatMoneyMinor(amountMinor: number, currency: string): string {
  if (currency.toUpperCase() === 'UAH') {
    return `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(amountMinor / 100)}\u00a0₴`;
  }
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

/** Keep transfer waits visible in both the time ribbon and the compact leg list. */
export function buildJourneyResultSegments(journey: ApiJourney): JourneyResultSegment[] {
  const segments: JourneyResultSegment[] = [];
  let cursor = validTime(journey.requestedDepartureAt) ?? validTime(journey.legs[0]?.departureAt) ?? 0;

  journey.legs.forEach((leg, index) => {
    const departure = validTime(leg.departureAt);
    const arrival = validTime(leg.arrivalAt);
    if (departure !== null && cursor > 0 && departure > cursor) {
      const waitSeconds = Math.round((departure - cursor) / 1000);
      if (waitSeconds > 0) {
        segments.push({
          id: `wait:${leg.id}`,
          kind: 'WAIT',
          mode: 'WAIT',
          label: 'Очікування',
          color: journeyModeColor('WAIT'),
          durationSeconds: waitSeconds,
          departureAt: new Date(cursor).toISOString(),
          arrivalAt: new Date(departure).toISOString(),
        });
      }
    }

    const durationSeconds = departure !== null && arrival !== null && arrival > departure
      ? Math.round((arrival - departure) / 1000)
      : Math.max(0, Math.round(leg.durationSeconds));
    if (durationSeconds > 0) {
      const modeLabel = leg.mode === 'COMMUNITY' ? 'Попутка' : journeyLegLabel(leg.mode, leg.transportType);
      segments.push({
        id: `leg:${leg.id}`,
        kind: 'LEG',
        mode: leg.mode,
        label: modeLabel,
        color: journeyModeColor(leg.mode, leg.transportType),
        durationSeconds,
        departureAt: leg.departureAt,
        arrivalAt: leg.arrivalAt,
        leg,
      });
    }
    if (arrival !== null) cursor = arrival;
    else if (departure !== null) cursor = departure + durationSeconds * 1000;
    else cursor += durationSeconds * 1000;

    // Preserve the provider's full journey duration when its leg timestamps omit a final wait.
    if (index === journey.legs.length - 1 && journey.requestedDepartureAt) {
      const requested = validTime(journey.requestedDepartureAt);
      const journeyEnd = requested === null ? null : requested + Math.max(0, journey.totalDurationSeconds) * 1000;
      if (journeyEnd !== null && cursor > 0 && journeyEnd > cursor + 30_000) {
        const waitSeconds = Math.round((journeyEnd - cursor) / 1000);
        segments.push({
          id: `wait:arrival:${leg.id}`,
          kind: 'WAIT',
          mode: 'WAIT',
          label: 'Час маршруту',
          color: journeyModeColor('WAIT'),
          durationSeconds: waitSeconds,
          departureAt: new Date(cursor).toISOString(),
          arrivalAt: new Date(journeyEnd).toISOString(),
        });
      }
    }
  });

  return segments;
}

/**
 * The server sends one `routeName` built as route_short_name || route_long_name || route_id, so a
 * long name or an internal id can arrive where a number is expected. Only a short token without
 * spaces takes the № prefix; anything else keeps its own wording instead of being dressed up as a
 * route number.
 */
export function journeyRouteBadge(routeName?: string | null): string | null {
  const name = routeName?.trim();
  if (!name) return null;
  return name.length <= 5 && !/\s/.test(name) && /\d/.test(name) ? `№${name}` : name;
}

export function formatJourneyLegPrice(leg: ApiJourney['legs'][number], currency = 'UAH'): string {
  if (leg.mode === 'WALK' || leg.mode === 'BICYCLE' || leg.mode === 'SCOOTER') return '0 ₴';
  if (leg.fareIncludedByPreviousSegment) return 'у квитку';
  if (leg.priceMinor === null || !Number.isFinite(leg.priceMinor)) return '—';
  const price = formatMoneyMinor(leg.priceMinor, leg.currency ?? currency);
  return leg.priceStatus === 'LOCKED' ? price : `≈ ${price}`;
}

export function formatJourneySegmentPrice(segment: JourneyResultSegment, currency = 'UAH'): string {
  if (segment.kind === 'WAIT') return '0 ₴';
  return segment.leg ? formatJourneyLegPrice(segment.leg, currency) : '—';
}

export function formatJourneyTotalPrice(journey: ApiJourney): string {
  const hasUnknownFare = journey.legs.some(leg => leg.mode !== 'WALK'
    && !leg.fareIncludedByPreviousSegment && leg.priceMinor === null);
  const total = journey.confirmedPriceMinor ?? journey.totalPriceMinor;
  if (total === null || hasUnknownFare) return '—';
  const label = formatMoneyMinor(total, journey.currency ?? 'UAH');
  return journey.confirmedPriceMinor !== null || journey.priceStatus === 'LOCKED' ? label : `≈ ${label}`;
}

const strategyLabels: Record<string, string> = {
  BALANCED: 'Оптимальний',
  FASTEST: 'Найшвидший',
  CHEAPEST: 'Найдешевший',
  PREMIUM: 'Преміум',
  RELIABLE: 'Надійний',
  CUSTOM: 'Свій набір',
};

/** The planner stores strategies as internal codes; every surface speaks Ukrainian. */
export function journeyStrategyLabel(strategy: string): string {
  return strategyLabels[strategy] ?? 'Маршрут';
}

export function formatJourneyDuration(seconds: number): string {
  if (seconds > 0 && seconds < 60) return 'менше хвилини';
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} год ${minutes % 60} хв` : `${minutes} хв`;
}

/** A segment tile is ~110 px wide; the spoken form stays in its accessibility label. */
export function formatJourneyDurationTile(seconds: number): string {
  return seconds > 0 && seconds < 60 ? '< 1 хв' : formatJourneyDuration(seconds);
}

export function formatJourneyDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters) || meters < 0) return 'відстань невідома';
  if (meters > 0 && meters < 1) return '<1 м';
  return meters >= 1000
    ? `${(meters / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км`
    : `${Math.round(meters)} м`;
}

export function formatJourneyDistanceSummary(legs: ApiJourney['legs']): string {
  const measured = legs.filter(leg => typeof leg.distanceMeters === 'number'
    && Number.isFinite(leg.distanceMeters) && leg.distanceMeters >= 0);
  if (measured.length === 0) return 'Відстань не вказана';

  const meters = measured.reduce((sum, leg) => sum + leg.distanceMeters!, 0);
  const complete = legs.length > 0 && measured.length === legs.length;
  const approximate = measured.some(leg => /estimate|straight-line|^(walking|transfer-walk)$/i.test(leg.source));
  const label = formatJourneyDistance(meters);
  if (complete) return approximate ? `≈ ${label}` : label;
  return approximate ? `Частково ≈ ${label}` : `Відомо ${label}`;
}

export function formatJourneyClock(value: string): string {
  if (!Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
  }).format(new Date(value));
}

const kyivCalendarDay = (value: string): string | null => {
  if (!Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
};

/**
 * An arrival past midnight is a different promise than the same clock time today; the card only
 * shows HH:mm, so it has to name the calendar shift instead of leaving «00:48» ambiguous.
 */
export function journeyArrivalDayNote(arrivalAt: string, departureAt?: string): string {
  const arrivalDay = kyivCalendarDay(arrivalAt);
  const departureDay = departureAt ? kyivCalendarDay(departureAt) : null;
  if (!arrivalDay || !departureDay) return '';
  const days = Math.round((Date.parse(`${arrivalDay}T00:00:00Z`) - Date.parse(`${departureDay}T00:00:00Z`)) / 86_400_000);
  if (days === 1) return 'наступного дня';
  if (days <= 1) return '';
  const plural = new Intl.PluralRules('uk-UA').select(days);
  return `через ${days} ${plural === 'one' ? 'день' : plural === 'few' ? 'дні' : 'днів'}`;
}

/** Total ride, walking and wait stay separate facts; the card shows the total, the line the split. */
export function journeyTimeBreakdown(journey: ApiJourney): { walkingSeconds: number; ridingSeconds: number; waitingSeconds: number } {
  let walkingSeconds = 0;
  let ridingSeconds = 0;
  for (const leg of journey.legs) {
    const departure = validTime(leg.departureAt);
    const arrival = validTime(leg.arrivalAt);
    const seconds = departure !== null && arrival !== null && arrival > departure
      ? Math.round((arrival - departure) / 1000)
      : Math.max(0, Math.round(leg.durationSeconds));
    if (leg.mode === 'WALK') walkingSeconds += seconds;
    else ridingSeconds += seconds;
  }
  const reportedWait = typeof journey.waitingSeconds === 'number' && Number.isFinite(journey.waitingSeconds) && journey.waitingSeconds >= 0
    ? Math.round(journey.waitingSeconds)
    : Math.max(0, Math.round(journey.totalDurationSeconds - walkingSeconds - ridingSeconds));
  return { walkingSeconds, ridingSeconds, waitingSeconds: reportedWait };
}

/** The first vehicle actually boarded; walking links to it but is not what the passenger catches. */
function boardedLeg(journey: ApiJourney) {
  const leg = journey.legs.find(item => item.mode !== 'WALK');
  return leg && validTime(leg.departureAt) ? leg : null;
}

/**
 * Ordering key for journeys the planner rates equally: the soonest departure wins.
 * Unknown boarding sinks to the bottom instead of jumping the queue.
 */
export function journeyBoardingTime(journey: ApiJourney): number {
  const leg = boardedLeg(journey);
  return leg ? Date.parse(leg.departureAt!) : Number.MAX_SAFE_INTEGER;
}

/**
 * Alternatives that board the same long-distance vehicle share duration, price,
 * transfers and total waiting time, so their cards are indistinguishable unless
 * the clock of the first vehicle actually boarded is shown.
 */
export function journeyBoardingNote(journey: ApiJourney): string {
  const leg = boardedLeg(journey);
  if (!leg) return '';
  const label = leg.mode === 'COMMUNITY' ? 'Попутка' : journeyLegLabel(leg.mode, leg.transportType);
  return `${label} о ${formatJourneyClock(leg.departureAt)}`;
}

/**
 * Journey search really does take tens of seconds on multi-provider corridors, so the wait
 * reports measured elapsed time. No percentage and no ETA: neither would be true.
 */
export function searchPendingCopy(elapsedSeconds: number): { title: string; note: string | null } {
  const seconds = Math.max(0, Math.floor(elapsedSeconds));
  if (seconds >= 20) {
    return { title: `Шукаємо маршрути · ${seconds} с`, note: 'Відповіді перевізників затягуються. Результати зʼявляться, щойно надійдуть — вигаданих маршрутів ми не показуємо.' };
  }
  if (seconds >= 8) {
    return { title: `Шукаємо маршрути · ${seconds} с`, note: 'Паралельно перевіряємо розклади й позиції кількох перевізників.' };
  }
  return { title: seconds > 0 ? `Шукаємо маршрути · ${seconds} с` : 'Шукаємо маршрути…', note: null };
}

/**
 * The edge proxy answers a still-running search with 504 at ~60 s, and before that happened the
 * screen only counted up. Stopping our own request short of that cut keeps slow successes intact
 * while giving the passenger a message instead of an endless spinner.
 */
export const JOURNEY_SEARCH_DEADLINE_MS = 45_000;

export type JourneySearchAbortReason = 'cancelled' | 'timeout';

/** A cancel and a give-up are different facts; reporting one as the other is a lie about the product. */
export function journeySearchAbortMessage(reason: unknown): string {
  return reason === 'timeout'
    ? `Перевізники не відповідатимуть довше ${JOURNEY_SEARCH_DEADLINE_MS / 1000} с — пошук зупинено. Спробуйте ще раз або звузьте умови.`
    : 'Пошук маршруту скасовано.';
}

/** Provider explanations can describe a degraded success as well as an actual outage. */
function isProviderOutage(text: string): boolean {
  const line = text.toLocaleLowerCase('uk-UA');
  if (line.includes('використовується розклад')) return false;
  return line.includes('недоступн');
}

/** Keep each provider fact and its severity; a fallback to printed schedules is not a total outage. */
export function providerErrorNotices(providerErrors: readonly string[] = []): Array<{ tone: 'rose' | 'amber'; text: string }> {
  const notices: Array<{ tone: 'rose' | 'amber'; text: string }> = [];
  const seen = new Set<string>();
  for (const error of providerErrors) {
    const trimmed = error.trim().replace(/[.;]+$/, '');
    if (!trimmed) continue;
    const text = `${trimmed}.`;
    if (seen.has(text)) continue;
    seen.add(text);
    notices.push({ tone: isProviderOutage(trimmed) ? 'rose' : 'amber', text });
  }
  return notices;
}

const transportModeNames: Record<string, string> = {
  bus: 'Автобуси', tram: 'Трамваї', trolleybus: 'Тролейбуси', marshrutka: 'Маршрутки',
  metro: 'Метро', train: 'Потяги', taxi: 'Таксі', bike: 'Велопрокати', scooter: 'Самокати',
  carsharing: 'Каршеринг', car_rental: 'Оренда авто', moped: 'Мопеди', transfer: 'Зовнішні трансфери',
  walk: 'Пішохідні маршрути', plane: 'Авіарейси', community: 'Попутки',
};

/** Machine-readable reason → the sentence a passenger can act on. */
const transportBlockReasons: Record<string, string> = {
  'no-routed-provider-in-corridor': 'у цьому коридорі немає жодного підключеного розкладу',
  'not-in-route-engine': 'ще не входять до планувальника маршрутів',
  'no-provider-configured': 'немає жодного підключеного джерела',
  'feed_unavailable': 'розклад тимчасово недоступний',
};

export type UnavailableTransportNotice = { mode: string; text: string };

/** Only the per-category facts are needed here, so the block is typed structurally. */
type CompletenessLike = { modesUnavailable?: Array<{ mode: string; requested: boolean; reason: string }> } | undefined;

const completenessReasons: Record<string, string> = {
  no_routed_provider_in_corridor: 'у цьому коридорі немає жодного підключеного розкладу',
  no_source_declares_this_category: 'жодне підключене джерело не оголошує цей вид транспорту',
  transit_search_failed: 'розкладний пошук тимчасово не працював, тому наявність цього виду не вдалося перевірити',
};

/**
 * The server reports a mode as unsupported when the passenger asked for it but no adapter had data
 * in this corridor. `blockedProviders` lists every uncovered mode, including ones nobody chose, so
 * it is only a reason lookup here — otherwise a bus-only search would lecture about metro and taxis.
 * The completeness block already separates asked-for from never-declared categories, so when the
 * server sends it, it wins: an outage is then worded as unverified instead of as absent.
 */
export function unavailableTransportNotices(
  blockedProviders: readonly string[] = [],
  unsupportedPreferences: readonly string[] = [],
  completeness?: CompletenessLike,
): UnavailableTransportNotice[] {
  const reasons = new Map<string, string>();
  for (const token of blockedProviders) {
    const modeMatch = /^transportType:([a-z_]+):([a-z0-9_-]+)$/i.exec(token);
    if (modeMatch) reasons.set(modeMatch[1], modeMatch[2]);
  }

  const byMode = new Map<string, UnavailableTransportNotice>();
  for (const entry of completeness?.modesUnavailable ?? []) {
    if (!entry.requested || byMode.has(entry.mode)) continue;
    byMode.set(entry.mode, {
      mode: entry.mode,
      text: `${transportModeNames[entry.mode] ?? 'Цей вид транспорту'}: ${completenessReasons[entry.reason] ?? 'недоступно в цьому пошуку'}.`,
    });
  }
  for (const token of unsupportedPreferences) {
    const modeMatch = /^transportType:([a-z_]+):([a-z0-9_-]+)$/i.exec(token);
    if (!modeMatch || byMode.has(modeMatch[1])) continue;
    const [, mode, reason] = modeMatch;
    const effectiveReason = reasons.get(mode) ?? reason;
    byMode.set(mode, {
      mode,
      text: `${transportModeNames[mode] ?? 'Цей вид транспорту'}: ${transportBlockReasons[effectiveReason] ?? 'недоступно в цьому пошуку'}.`,
    });
  }
  return [...byMode.values()];
}
