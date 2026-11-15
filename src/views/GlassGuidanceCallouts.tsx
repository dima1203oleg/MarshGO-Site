import { useLayoutEffect, useRef } from 'react';
import { Bus, Footprints, MapPin, Shuffle, Train, TramFront } from 'lucide-react';
import type { CinematicCallout } from '../map/cinematicRouteEngine';
import { placeGuidanceCallout } from './calloutPlacement';

export function GlassGuidanceCallouts({
  callouts,
  onDismiss,
  visibleRect,
}: {
  callouts: CinematicCallout[];
  onDismiss?: (id: string) => void;
  visibleRect?: { left: number; top: number; right: number; bottom: number };
}) {
  const elements = useRef(new Map<string, HTMLDivElement>());
  useLayoutEffect(() => {
    const position = () => {
      const bounds = visibleRect ?? { left: 16, top: 112, right: window.innerWidth - 16, bottom: window.innerHeight - 16 };
      for (const callout of callouts) {
        const element = elements.current.get(callout.id);
        if (!element || !callout.screenPos) continue;
        element.style.width = `${Math.min(240, Math.max(0, bounds.right - bounds.left))}px`;
        const { width, height } = element.getBoundingClientRect();
        const obstructionElements = document.querySelectorAll<HTMLElement>('.mg-map-label--boarding, .mg-map-label--alighting');
        const obstructions = Array.from(obstructionElements)
          .filter(label => label.getClientRects().length > 0)
          .map(label => label.getBoundingClientRect())
          .map(rect => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }));
        const position = placeGuidanceCallout(callout.screenPos, { width, height }, bounds, obstructions);
        element.style.left = `${position.x}px`;
        element.style.top = `${position.y}px`;
      }
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [callouts, visibleRect]);

  if (callouts.length === 0) return null;
  return <div aria-label="Підказки огляду маршруту" className="pointer-events-none absolute inset-0 z-[var(--mg-z-map-chip)] overflow-hidden">
    {callouts.map(callout => {
      const pos = callout.screenPos;
      if (!pos) return null;
      const Icon = callout.iconType === 'walk' ? Footprints
        : callout.iconType === 'tram' ? TramFront
        : callout.iconType === 'train' ? Train
        : callout.iconType === 'transfer' ? Shuffle
        : callout.iconType === 'pin' ? MapPin : Bus;
      return <div
        key={callout.id}
        ref={element => { if (element) elements.current.set(callout.id, element); else elements.current.delete(callout.id); }}
        data-testid={`glass-callout-${callout.type.toLowerCase()}`}
        data-stage={callout.stage}
        role={onDismiss ? 'button' : undefined}
        tabIndex={onDismiss ? 0 : undefined}
        aria-label={onDismiss ? `${callout.title}. ${callout.subtitle} Закрити підказку` : undefined}
        onClick={() => onDismiss?.(callout.id)}
        onKeyDown={event => { if (onDismiss && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onDismiss(callout.id); } }}
        style={{ position: 'absolute', left: `${pos.x}px`, top: `${pos.y}px`, transform: 'translate(-50%, -100%) translateY(-14px)' }}
        className={`mg-glass-callout pointer-events-auto flex flex-col rounded-2xl border border-[var(--mg-callout-border)] bg-[var(--mg-callout-bg)] p-3 text-[var(--mg-callout-ink)] shadow-[var(--mg-label-shadow)] focus-visible:outline-2 focus-visible:outline-[var(--mg-blue)] ${callout.stage === 'exit' ? 'is-exiting' : callout.stage === 'enter' ? 'is-entered' : ''}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span style={{ backgroundColor: `color-mix(in srgb, ${callout.accentColor} 15%, transparent)` }} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-extrabold">
            <Icon size={14} aria-hidden="true"/>{callout.title}
          </span>
          {callout.time && <span className="text-xs font-semibold tabular-nums text-[var(--route-muted)]">{callout.time}</span>}
        </div>
        <p className="mt-1 text-xs font-bold leading-4">{callout.subtitle}</p>
        <div className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-[var(--mg-callout-bg)]" aria-hidden="true"/>
      </div>;
    })}
  </div>;
}
