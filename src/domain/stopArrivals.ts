import type { ApiTransitStopArrival, ApiTransitStopArrivalsMeta } from '../services/productionApi';

function normalizeHeadsign(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('uk-UA');
}

export function matchingStopArrivals(arrivals: ApiTransitStopArrival[], routeId: string, headsign?: string) {
  const expectedHeadsign = headsign ? normalizeHeadsign(headsign) : '';
  return arrivals
    .filter(arrival => arrival.routeId === routeId && (!expectedHeadsign || normalizeHeadsign(arrival.headsign) === expectedHeadsign))
    .sort((a, b) => a.etaSeconds - b.etaSeconds)
    .slice(0, 3);
}

export function stopArrivalEtaLabel(etaSeconds: number) {
  if (!Number.isFinite(etaSeconds) || etaSeconds <= 0) return 'Зараз';
  return `${Math.ceil(etaSeconds / 60)} хв`;
}

export type StopArrivalFreshnessNotice = { tone: 'live' | 'warning' | 'muted'; label: string };

function formatSourceTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return undefined;
  return new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
  }).format(new Date(value));
}

export function stopArrivalFreshnessNotice(meta?: Partial<ApiTransitStopArrivalsMeta>): StopArrivalFreshnessNotice {
  if (meta?.availability === 'SCHEDULE_UNSUPPORTED') {
    return { tone: 'muted', label: 'Провайдер не підтримує розклад для цієї зупинки.' };
  }
  if (meta?.availability === 'STOP_NOT_IN_FEED') {
    return { tone: 'warning', label: 'Цю зупинку не знайдено у транспортному фіді.' };
  }
  switch (meta?.realtimeStatus) {
    case 'AVAILABLE': {
      const time = formatSourceTime(meta.realtimeUpdatedAt);
      return { tone: 'live', label: time ? `Онлайн-дані оновлено о ${time}.` : 'Онлайн-дані доступні.' };
    }
    case 'STALE': {
      const time = formatSourceTime(meta.realtimeFeedTimestamp);
      return { tone: 'warning', label: time
        ? `Онлайн-дані застаріли (станом на ${time}). Показано розклад.`
        : 'Онлайн-дані застаріли. Показано розклад.' };
    }
    case 'UNAVAILABLE':
    case 'TEMPORARILY_UNAVAILABLE':
      return { tone: 'warning', label: 'Онлайн-дані тимчасово недоступні. Показано розклад.' };
    case 'NOT_CONFIGURED':
      return { tone: 'muted', label: 'Онлайн-оновлення не підключені. Показано розклад.' };
    default:
      return { tone: 'muted', label: 'Стан онлайн-даних невідомий. ETA показано за розкладом.' };
  }
}
