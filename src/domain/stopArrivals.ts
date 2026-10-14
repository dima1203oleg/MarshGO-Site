import type { ApiTransitStopArrival } from '../services/productionApi';

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
