import type { ApiJourneyLive } from '../services/productionApi';

type LiveSegment = ApiJourneyLive['segments'][number];

function formatEta(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  return `${Math.max(1, Math.ceil(seconds / 60))} хв`;
}

function formatFreshness(value: string | undefined, now: number): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60_000));
  return minutes < 1 ? 'щойно оновлено' : `оновлено ${minutes} хв тому`;
}

function formatScheduledTime(value: string): string {
  if (!Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
  }).format(new Date(value));
}

/** User-facing arrival status from the server's verified live observation/prediction. */
export function journeyLiveArrivalMessage(segment: LiveSegment, now = Date.now()): string {
  const vehicles = segment.vehicles ?? [];
  const approaching = vehicles.find(vehicle => vehicle.emphasized && vehicle.approachingBoarding);
  const eta = formatEta(approaching?.etaSeconds);
  const freshness = formatFreshness(approaching?.updatedAt ?? segment.boardingStopArrival?.realtimeUpdatedAt, now);
  if (approaching && eta) {
    return `Машина до посадки · ${eta}${approaching.remainingStops == null ? '' : ` · ${approaching.remainingStops} зуп.`}${freshness ? ` · ${freshness}` : ''}`;
  }

  const prediction = segment.boardingStopArrival?.status === 'PREDICTED'
    ? segment.boardingStopArrival.predictedAt : undefined;
  const predictedEta = prediction && Number.isFinite(Date.parse(prediction))
    ? formatEta(Math.max(0, (Date.parse(prediction) - now) / 1000)) : null;
  if (predictedEta) return `Прогноз прибуття на зупинку · ${predictedEta}${freshness ? ` · ${freshness}` : ''}`;

  if (segment.boardingStopArrival?.status === 'SCHEDULED' && segment.boardingStopArrival.scheduledAt) {
    return `За розкладом · ${formatScheduledTime(segment.boardingStopArrival.scheduledAt)}`;
  }
  if (vehicles.length > 0) return `${vehicles.length} свіжих машин на лінії; під’їзд до посадки не підтверджено`;
  return 'Немає свіжої позиції або підтвердженого прогнозу прибуття';
}
