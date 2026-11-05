import { Bus, Footprints, MapPin, Shuffle, Train, TramFront } from 'lucide-react';
import type { CinematicCallout } from '../map/cinematicRouteEngine';

export function GlassGuidanceCallouts({
  callouts,
  onDismiss,
}: {
  callouts: CinematicCallout[];
  onDismiss?: (id: string) => void;
}) {
  if (callouts.length === 0) return null;

  return (
    <div
      aria-label="Підказки огляду маршруту"
      className="pointer-events-none absolute inset-0 z-[var(--mg-z-map-control)] overflow-hidden"
    >
      {callouts.map((callout) => {
        const pos = callout.screenPos;
        if (!pos) return null;

        const isExiting = callout.stage === 'exit';

        return (
          <div
            key={callout.id}
            data-testid={`glass-callout-${callout.type.toLowerCase()}`}
            onClick={() => onDismiss?.(callout.id)}
            style={{
              position: 'absolute',
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              transform: 'translate(-50%, -100%) translateY(-14px)',
            }}
            className={`pointer-events-auto flex max-w-[240px] min-w-[150px] flex-col rounded-2xl border p-2.5 shadow-2xl backdrop-blur-2xl transition-all duration-[var(--mg-dur-base)] motion-reduce:transition-none ${
              isExiting
                ? 'scale-90 opacity-0'
                : 'scale-100 opacity-100'
            } border-white/20 bg-slate-900/85 text-white shadow-black/40 dark:border-white/15 dark:bg-[#0A1628]/90 dark:text-white`}
          >
            {/* Header row: badge + icon */}
            <div className="flex items-center justify-between gap-2">
              <span
                style={{ backgroundColor: `${callout.accentColor}25`, color: callout.accentColor }}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-black uppercase tracking-wider"
              >
                {callout.iconType === 'walk' ? (
                  <Footprints size={11} className="shrink-0" />
                ) : callout.iconType === 'tram' ? (
                  <TramFront size={11} className="shrink-0" />
                ) : callout.iconType === 'train' ? (
                  <Train size={11} className="shrink-0" />
                ) : callout.iconType === 'transfer' ? (
                  <Shuffle size={11} className="shrink-0" />
                ) : callout.iconType === 'pin' ? (
                  <MapPin size={11} className="shrink-0" />
                ) : (
                  <Bus size={11} className="shrink-0" />
                )}
                {callout.title}
              </span>
              {callout.time && (
                <span className="text-xs font-bold tabular-nums text-slate-300 dark:text-slate-400">
                  {callout.time}
                </span>
              )}
            </div>

            {/* Subtitle / main hint */}
            <p className="mt-1 line-clamp-2 text-xs font-bold leading-tight text-white dark:text-slate-100">
              {callout.subtitle}
            </p>

            {/* Pointer notch pointing down to coordinates */}
            <div
              className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-slate-900/85 dark:border-t-[#0A1628]/90"
              aria-hidden="true"
            />
          </div>
        );
      })}
    </div>
  );
}
