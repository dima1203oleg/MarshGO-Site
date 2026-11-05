import type { ApiJourney } from '../services/productionApi';
import { journeyLegLabel } from './journeyLegLabel';
import { shortPlace } from './journeyStageNavigation';

type JourneyLeg = ApiJourney['legs'][number];
type JourneyStop = NonNullable<JourneyLeg['stops']>[number];

const SCHEDULED_MODES = ['BUS', 'MINIBUS', 'TROLLEYBUS', 'TRAM', 'METRO', 'RAIL', 'FERRY', 'FUNICULAR'];
const SCHEDULED_TYPES = ['bus', 'marshrutka', 'intercity_bus', 'train', 'suburban_train', 'city_train', 'tram', 'trolleybus', 'metro'];

/** Only legs backed by a real timetable have a stop list worth asking a carrier for. */
export function isScheduledRouteLeg(leg: JourneyLeg) {
  return SCHEDULED_MODES.includes(leg.mode) || SCHEDULED_TYPES.includes(leg.transportType ?? '');
}

export function formatStopClock(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  const minute = new Date(value);
  minute.setSeconds(0, 0);
  return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(minute);
}

export function stopTime(stop: JourneyStop, index: number) {
  return formatStopClock(index === 0 ? stop.departureAt : stop.arrivalAt);
}

/**
 * Every stop of the confirmed ride, in travel direction, with boarding and alighting marked.
 * Shared by the route sheet and the navigation sheet so a passenger gets the same list in both.
 */
export function JourneyLegStops({ leg, color }: { leg: JourneyLeg; color: string }) {
  const stops = leg.stops ?? [];
  if (!stops.length) return <p className="text-xs text-[var(--route-muted)]">Перевізник не надав список зупинок для цього рейсу.</p>;
  const label = leg.routeName ?? journeyLegLabel(leg.mode, leg.transportType);
  return <ol aria-label={`Зупинки сегмента ${label}`} className="ml-1 border-l-2 pl-3">
    {stops.map((stop, index) => {
      const endpoint = index === 0 || index === stops.length - 1;
      return <li key={`${stop.id}:${index}`} className="relative grid min-h-7 grid-cols-[44px_minmax(0,1fr)] gap-2 py-1 text-xs">
        <span className="absolute -left-[1.05rem] top-[.55rem] h-2.5 w-2.5 rounded-full border-2 border-[var(--route-card)]" style={{ backgroundColor: color }}/>
        <time className="tabular-nums text-[var(--route-subtle)]">{stopTime(stop, index)}</time>
        <span className={endpoint ? 'font-extrabold text-[var(--route-ink)]' : stop.skipped ? 'text-[var(--route-subtle)] line-through decoration-rose-500/70' : 'text-[var(--route-muted)]'}>{shortPlace(stop.name)}{stop.skipped ? <strong className="ml-1 text-rose-600 no-underline dark:text-rose-300">· ПРОПУСКАЄТЬСЯ</strong> : index === 0 ? <strong className="ml-1 text-[var(--mg-blue-ink)]">· ПОСАДКА</strong> : index === stops.length - 1 ? <strong className="ml-1 text-[var(--mg-blue-ink)]">· ВИСАДКА</strong> : null}</span>
      </li>;
    })}
  </ol>;
}
