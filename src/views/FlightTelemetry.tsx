import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { FlightKind } from '../map/hyperFlightEngine';

/**
 * HyperFlight telemetry — a compact glass strip that floats over the map while
 * the cinematic preview flies. It counts down the REAL remaining distance to the
 * boarding/alighting point and drives a velocity-reactive progress bar, so the
 * rider always knows how far the transfer is and how fast the preview is moving.
 *
 * The flight's single requestAnimationFrame loop writes straight into these DOM
 * nodes (no per-frame React render), keeping the 8 GB device smooth.
 */
export interface FlightTelemetryHandle {
  begin(totalMeters: number, kind: FlightKind, targetLabel: string): void;
  update(fraction: number, velocity: number): void;
  end(): void;
}

function formatRemaining(meters: number): { value: string; unit: string } {
  const clamped = Math.max(0, meters);
  if (clamped >= 1000) return { value: (clamped / 1000).toFixed(1), unit: 'км' };
  return { value: String(Math.round(clamped)), unit: 'м' };
}

export const FlightTelemetry = forwardRef<FlightTelemetryHandle>(function FlightTelemetry(_props, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const valueRef = useRef<HTMLElement | null>(null);
  const unitRef = useRef<HTMLElement | null>(null);
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const headRef = useRef<HTMLSpanElement | null>(null);
  const totalRef = useRef(0);
  const lastValueRef = useRef('');

  useImperativeHandle(ref, () => ({
    begin(totalMeters, _kind, targetLabel) {
      totalRef.current = Math.max(0, totalMeters);
      lastValueRef.current = '';
      const root = rootRef.current;
      if (!root) return;
      if (labelRef.current) labelRef.current.textContent = targetLabel;
      const initial = formatRemaining(totalRef.current);
      if (valueRef.current) valueRef.current.textContent = initial.value;
      if (unitRef.current) unitRef.current.textContent = initial.unit;
      if (fillRef.current) fillRef.current.style.transform = 'scaleX(0)';
      if (headRef.current) headRef.current.style.left = '0%';
      root.style.setProperty('--flight-velocity', '0');
      root.classList.add('is-live');
    },
    update(fraction, velocity) {
      const root = rootRef.current;
      if (!root || !root.classList.contains('is-live')) return;
      const clamped = Math.max(0, Math.min(1, fraction));
      const remaining = formatRemaining(totalRef.current * (1 - clamped));
      if (remaining.value !== lastValueRef.current) {
        lastValueRef.current = remaining.value;
        if (valueRef.current) valueRef.current.textContent = remaining.value;
        if (unitRef.current) unitRef.current.textContent = remaining.unit;
      }
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${clamped})`;
      if (headRef.current) headRef.current.style.left = `${clamped * 100}%`;
      root.style.setProperty('--flight-velocity', String(Math.max(0, Math.min(1, velocity / 1.3))));
    },
    end() {
      rootRef.current?.classList.remove('is-live');
    },
  }), []);

  return (
    <div ref={rootRef} className="mg-flight-hud" aria-hidden="true" data-testid="flight-telemetry">
      <div className="mg-flight-hud__row">
        <span ref={labelRef} className="mg-flight-hud__label">Переліт</span>
        <span className="mg-flight-hud__value"><b ref={valueRef}>0</b><i ref={unitRef}>м</i></span>
      </div>
      <div className="mg-flight-hud__track">
        <span ref={fillRef} className="mg-flight-hud__fill"/>
        <span ref={headRef} className="mg-flight-hud__head"/>
      </div>
    </div>
  );
});