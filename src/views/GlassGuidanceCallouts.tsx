import { Bus, Footprints, MapPin, Shuffle, Train, TramFront } from 'lucide-react';
import {
  CALLOUT_SIZE,
  layoutCallouts,
  type CalloutViewport,
  type CinematicCallout,
} from '../map/cinematicRouteEngine';

export function GlassGuidanceCallouts({
  callouts,
  viewport,
  onDismiss,
}: {
  callouts: CinematicCallout[];
  viewport: CalloutViewport;
  onDismiss?: (id: string) => void;
}) {
  const placements = layoutCallouts(callouts, viewport);
  if (placements.length === 0) return null;

  return (
    <div
      aria-label="Підказки огляду маршруту"
      className="pointer-events-none absolute inset-0 z-[var(--mg-z-map-control)] overflow-hidden"
    >
      {placements.map(({ callout, left, top, pointerDirection }, index) => {
        const isExiting = callout.stage === 'exit';

        return (
          <div
            key={callout.id}
            style={{
              position: 'absolute',
              left: `${left + CALLOUT_SIZE.width / 2}px`,
              top: `${top}px`,
              width: `${CALLOUT_SIZE.width}px`,
            }}
            className="-translate-x-1/2"
          >
            <div
              data-testid={`glass-callout-${callout.type.toLowerCase()}`}
              onClick={() => onDismiss?.(callout.id)}
              style={{ ['--mg-stagger-i' as string]: String(index) }}
              className={`mg-callout pointer-events-auto rounded-xl border p-2 shadow-lg backdrop-blur-xl transition-opacity duration-[var(--mg-dur-base)] ease-[var(--mg-ease-exit)] motion-reduce:transition-none ${
                isExiting ? 'pointer-events-none opacity-0' : 'opacity-100'
              } border-white/20 bg-slate-900/85 text-white shadow-black/40 dark:border-white/15 dark:bg-[#0A1628]/90 dark:text-white`}
            >
            <div className="flex items-center justify-between gap-1.5">
              <span
                style={{ backgroundColor: `${callout.accentColor}25`, color: callout.accentColor }}
                className="inline-flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs font-black uppercase leading-none tracking-[.06em]"
              >
                {callout.iconType === 'walk' ? (
                  <Footprints size={10} className="shrink-0" />
                ) : callout.iconType === 'tram' ? (
                  <TramFront size={10} className="shrink-0" />
                ) : callout.iconType === 'train' ? (
                  <Train size={10} className="shrink-0" />
                ) : callout.iconType === 'transfer' ? (
                  <Shuffle size={10} className="shrink-0" />
                ) : callout.iconType === 'pin' ? (
                  <MapPin size={10} className="shrink-0" />
                ) : (
                  <Bus size={10} className="shrink-0" />
                )}
                <span className="truncate">{callout.title}</span>
              </span>
              {callout.time && (
                <span className="shrink-0 text-xs font-bold tabular-nums leading-none text-slate-300 dark:text-slate-400">
                  {callout.time}
                </span>
              )}
            </div>

            <p className="mt-1 line-clamp-1 text-xs font-bold leading-tight text-white dark:text-slate-100">
              {callout.subtitle}
            </p>

            <div
              className={`absolute left-1/2 h-0 w-0 -translate-x-1/2 border-l-[6px] border-r-[6px] border-l-transparent border-r-transparent ${
                pointerDirection === 'up'
                  ? '-top-1.5 border-b-[6px] border-b-slate-900/85 dark:border-b-[#0A1628]/90'
                  : '-bottom-1.5 border-t-[6px] border-t-slate-900/85 dark:border-t-[#0A1628]/90'
              }`}
              aria-hidden="true"
            />
            </div>
          </div>
        );
      })}
    </div>
  );
}
