import type { ApiJourney } from '../services/productionApi';
import { journeyLegLabel } from './journeyLegLabel';
import { journeyModeColor } from '../map/journeyRouteModel';
import { formatMoneyMinor as formatMoney } from '../domain/money';

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

function formatMoneyMinor(amountMinor: number, currency: string): string {
  return formatMoney(amountMinor, currency);
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

export function formatJourneyLegPrice(leg: ApiJourney['legs'][number], currency = 'UAH'): string {
  if (leg.mode === 'WALK') return '0 ₴';
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

export function formatJourneyDuration(seconds: number): string {
  if (seconds > 0 && seconds < 60) return 'менше хвилини';
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} год ${minutes % 60} хв` : `${minutes} хв`;
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
  const approximate = measured.some(leg => /estimate|straight-line/i.test(leg.source));
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
