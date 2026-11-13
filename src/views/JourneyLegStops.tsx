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
export function JourneyLegStops({
  leg,
  color,
  activeStopId,
  onStopSelect,
}: {
  leg: JourneyLeg;
  color: string;
  activeStopId?: string | null;
  onStopSelect?: (stop: JourneyStop, coordinate?: [number, number]) => void;
}) {
  const stops = leg.stops ?? [];
  if (!stops.length) return <p className="text-xs text-[var(--route-muted)]">Перевізник не надав список зупинок для цього рейсу.</p>;
  const label = leg.routeName ?? journeyLegLabel(leg.mode, leg.transportType);
  return <ol aria-label={`Зупинки сегмента ${label}`} className="min-w-0">
    {stops.map((stop, index) => {
      const endpoint = index === 0 || index === stops.length - 1;
      const isSelected = activeStopId === stop.id;
      const hasCoords = Boolean(stop.coordinates && stop.coordinates.length === 2);
      const content = <>
        <time className="tabular-nums text-[var(--route-subtle)]">{stopTime(stop, index)}</time>
        <span className="mg-journey-stop-axis" data-first={index === 0} data-last={index === stops.length - 1} aria-hidden="true">
          <span className={`mg-journey-stop-dot${isSelected ? ' ring-2 ring-[var(--mg-blue)]' : ''}`} style={{ backgroundColor: color }}/>
        </span>
        <span className={`mg-route-stop-copy ${endpoint ? 'font-extrabold text-[var(--route-ink)]' : stop.skipped ? 'text-[var(--route-subtle)] line-through decoration-rose-500/70' : 'text-[var(--route-muted)]'}`}>
          <span className="mg-route-stop-name" title={shortPlace(stop.name)}>{shortPlace(stop.name)}</span>
          {stop.skipped ? <strong className="mg-route-stop-badge mg-route-stop-badge--skipped">Пропускається</strong> : index === 0 ? <strong className="mg-route-stop-badge">Посадка</strong> : index === stops.length - 1 ? <strong className="mg-route-stop-badge">Висадка</strong> : null}
        </span>
      </>;

      return <li key={`${stop.id}:${index}`} className="relative mg-rise mg-stagger" style={{ ['--mg-stagger-i' as string]: Math.min(index, 6) }}>
        {onStopSelect && hasCoords ? (
          <button
            type="button"
            onClick={() => onStopSelect(stop, stop.coordinates)}
            aria-pressed={isSelected}
            aria-label={`Зупинка: ${shortPlace(stop.name)}, час ${stopTime(stop, index)}`}
            className={`mg-journey-stop-row relative w-full rounded-lg px-1 text-left text-xs hover:bg-[var(--route-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)] ${isSelected ? 'bg-[var(--route-hover)] ring-1 ring-[var(--mg-blue)]' : ''}`}
          >
            {content}
          </button>
        ) : (
          <div className="mg-journey-stop-row relative text-xs">
            {content}
          </div>
        )}
      </li>;
    })}
  </ol>;
}
