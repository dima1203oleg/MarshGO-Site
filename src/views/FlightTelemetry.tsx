import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw } from 'lucide-react';
export interface FlightTelemetryHandle {
  begin(totalMeters: number, targetLabel: string): void;
  update(fraction: number): void;
}

function formatRemaining(meters: number): { value: string; unit: string } {
  const clamped = Math.max(0, meters);
  if (clamped >= 1000) return { value: (clamped / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 }), unit: 'км' };
  return { value: String(Math.round(clamped)), unit: 'м' };
}

interface FlightTelemetryProps {
  playing: boolean;
  enabled: boolean;
  reducedMotion: boolean;
  first: boolean;
  last: boolean;
  onToggle(): void;
  onSeek(fraction: number): void;
  onPrevious(): void;
  onNext(): void;
}

export const FlightTelemetry = forwardRef<FlightTelemetryHandle, FlightTelemetryProps>(function FlightTelemetry(props, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const valueRef = useRef<HTMLElement | null>(null);
  const unitRef = useRef<HTMLElement | null>(null);
  const rangeRef = useRef<HTMLInputElement | null>(null);
  const totalRef = useRef(0);
  const lastValueRef = useRef('');

  useImperativeHandle(ref, () => ({
    begin(totalMeters, targetLabel) {
      totalRef.current = Math.max(0, totalMeters);
      lastValueRef.current = '';
      if (labelRef.current) labelRef.current.textContent = targetLabel;
      const initial = formatRemaining(totalRef.current);
      if (valueRef.current) valueRef.current.textContent = initial.value;
      if (unitRef.current) unitRef.current.textContent = initial.unit;
      if (rangeRef.current) {
        rangeRef.current.value = '0';
        rangeRef.current.setAttribute('aria-valuetext', `0%, залишилось ${initial.value} ${initial.unit}`);
      }
      rootRef.current?.style.setProperty('--flight-progress', '0%');
    },
    update(fraction) {
      const clamped = Math.max(0, Math.min(1, fraction));
      const remaining = formatRemaining(totalRef.current * (1 - clamped));
      if (remaining.value !== lastValueRef.current) {
        lastValueRef.current = remaining.value;
        if (valueRef.current) valueRef.current.textContent = remaining.value;
        if (unitRef.current) unitRef.current.textContent = remaining.unit;
      }
      if (rangeRef.current) {
        rangeRef.current.value = String(clamped * 1000);
        rangeRef.current.setAttribute('aria-valuetext', `${Math.round(clamped * 100)}%, залишилось ${remaining.value} ${remaining.unit}`);
      }
      rootRef.current?.style.setProperty('--flight-progress', `${clamped * 100}%`);
    },
  }), []);

  return <div ref={rootRef} className="mg-flight-hud" role="group" aria-label="Анімований перегляд, не GPS" data-testid="flight-telemetry">
    <div className="mg-flight-hud__row">
      <span ref={labelRef} className="mg-flight-hud__label">{props.enabled ? 'Перегляд маршруту' : 'Перегляд недоступний'}</span>
      {props.enabled && <span className="mg-flight-hud__value" aria-label="Залишок поточного етапу"><b ref={valueRef}>0</b><i ref={unitRef}>м</i></span>}
    </div>
    <div className="mg-flight-hud__controls">
      <button type="button" onClick={props.onPrevious} disabled={props.first} aria-label="Попередній етап" className="mg-flight-hud__button mg-press"><ArrowLeft size={18} aria-hidden="true"/></button>
      <button type="button" onClick={props.onToggle} disabled={!props.enabled || props.reducedMotion} aria-label={props.playing ? 'Призупинити перегляд' : 'Відтворити перегляд'} aria-pressed={props.playing} title={props.reducedMotion ? 'Зменшення руху: використовуйте повзунок' : 'Перегляд маршруту, не GPS'} className="mg-flight-hud__button mg-flight-hud__play mg-press">{props.playing ? <Pause size={18} aria-hidden="true"/> : <Play size={18} aria-hidden="true"/>}</button>
      <input ref={rangeRef} type="range" min="0" max="1000" step="1" defaultValue="0" disabled={!props.enabled} aria-label="Позиція перегляду поточного етапу" className="mg-flight-hud__range" onChange={event => props.onSeek(Number(event.currentTarget.value) / 1000)}/>
      <button type="button" onClick={props.onNext} aria-label={props.last ? 'Переглянути спочатку' : 'Наступний етап'} className="mg-flight-hud__button mg-press">{props.last ? <RotateCcw size={18} aria-hidden="true"/> : <ArrowRight size={18} aria-hidden="true"/>}</button>
    </div>
  </div>;
});
