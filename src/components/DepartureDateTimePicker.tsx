import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronRight, Clock3, X } from 'lucide-react';

const ITEM_HEIGHT = 44;
const MINUTES = [0, 15, 30, 45];
const pad = (value: number) => String(value).padStart(2, '0');

function localParts(value: string) {
  const [date = '', time = '08:00'] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return { date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date()), hour: Number.isFinite(hour) ? hour : 8, minute: Number.isFinite(minute) ? minute : 0, year, month, day };
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function dateLabel(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('uk-UA', { ...options, timeZone: 'Europe/Kyiv' }).format(new Date(`${date}T12:00:00Z`));
}

function WheelColumn({ label, values, selected, onSelect, selectedIndex }: {
  label: string;
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  selectedIndex: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const userScrolled = useRef(false);
  useEffect(() => {
    if (!userScrolled.current && ref.current) ref.current.scrollTop = selectedIndex * ITEM_HEIGHT;
  }, [selectedIndex]);

  return <div className="relative h-[220px] flex-1 overflow-hidden rounded-2xl bg-[#0d2340]">
    <div className="pointer-events-none absolute inset-x-2 top-[88px] z-[1] h-11 rounded-xl border border-blue-300/20 bg-blue-400/10"/>
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={(event) => {
        const element = event.currentTarget;
        if (!userScrolled.current) return;
        const index = Math.max(0, Math.min(values.length - 1, Math.round(element.scrollTop / ITEM_HEIGHT)));
        if (values[index] !== selected) onSelect(values[index]);
      }}
      onPointerDown={() => { userScrolled.current = true; }}
      onTouchStart={() => { userScrolled.current = true; }}
      onWheel={() => { userScrolled.current = true; }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        userScrolled.current = true;
        const next = Math.max(0, Math.min(values.length - 1, selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)));
        ref.current?.scrollTo({ top: next * ITEM_HEIGHT, behavior: 'smooth' });
      }}
      className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain px-2 text-center text-2xl font-medium text-slate-400 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div aria-hidden="true" className="h-[88px]"/>
      {values.map((value, index) => <button key={value} type="button" role="option" aria-selected={value === selected} onClick={() => { userScrolled.current = true; onSelect(value); ref.current?.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' }); }} className={`block h-11 w-full snap-center ${value === selected ? 'font-bold text-white' : ''}`}>{pad(value)}</button>)}
      <div aria-hidden="true" className="h-[88px]"/>
    </div>
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-16 bg-gradient-to-b from-[#0d2340] to-transparent"/>
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-16 bg-gradient-to-t from-[#0d2340] to-transparent"/>
  </div>;
}

export function DepartureDateTimePicker({ open, value, onChange, onClose }: {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const current = localParts(value);
  const [date, setDate] = useState(current.date);
  const [hour, setHour] = useState(current.hour);
  const [minute, setMinute] = useState(MINUTES.reduce((best, candidate) => Math.abs(candidate - current.minute) < Math.abs(best - current.minute) ? candidate : best, 0));
  const dateInput = useRef<HTMLInputElement | null>(null);
  const openDateInput = () => {
    const input = dateInput.current;
    if (!input) return;
    if (input.showPicker) input.showPicker();
    else input.click();
  };

  useEffect(() => {
    if (!open) return;
    const next = localParts(value);
    setDate(next.date); setHour(next.hour);
    setMinute(MINUTES.reduce((best, candidate) => Math.abs(candidate - next.minute) < Math.abs(best - next.minute) ? candidate : best, 0));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!open) return null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());
  const visibleDates = Array.from({ length: 7 }, (_, index) => addDays(today, index));
  const commit = () => { onChange(`${date}T${pad(hour)}:${pad(minute)}`); onClose(); };

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/65 px-3 pt-4 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="departure-picker-title" className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] border border-blue-900/50 bg-[#071a31] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 text-white shadow-2xl sm:rounded-[2rem]">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-600"/>
      <header className="flex items-center justify-between"><button type="button" onClick={onClose} aria-label="Закрити вибір дати й часу" className="grid h-10 w-10 place-items-center rounded-full bg-[#102847] text-slate-300"><X size={19}/></button><h2 id="departure-picker-title" className="text-base font-extrabold">Вибір дати і часу</h2><span className="w-10"/></header>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-[#0d2340] p-1.5">
        {[['today', 'Сьогодні', today], ['tomorrow', 'Завтра', addDays(today, 1)], ['other', 'Інша дата', null]].map(([key, label, target]) => {
          const selected = target ? date === target : !visibleDates.includes(date);
          return <button key={key} type="button" onClick={() => target ? setDate(target) : openDateInput()} className={`rounded-xl px-2 py-3 text-xs font-bold ${selected ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40' : 'text-slate-300'}`}>{label}</button>;
        })}
      </div>

      <div className="relative mt-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {visibleDates.map((item) => <button key={item} type="button" onClick={() => setDate(item)} aria-pressed={date === item} className={`min-w-[58px] rounded-xl border px-2 py-2 text-center ${date === item ? 'border-blue-500 bg-blue-600 text-white' : 'border-blue-900/70 bg-[#0d2340] text-slate-300'}`}><span className="block text-[10px] font-semibold">{dateLabel(item, { weekday: 'short' })}</span><span className="mt-1 block text-lg font-bold">{dateLabel(item, { day: 'numeric' })}</span><span className="block text-[9px]">{dateLabel(item, { month: 'short' })}</span></button>)}
        </div>
        <input ref={dateInput} aria-label="Інша дата відправлення" type="date" value={date} min={today} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} className="pointer-events-none absolute h-px w-px opacity-0"/>
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm font-bold"><Clock3 size={17} className="text-blue-300"/>Час відправлення</div>
      <div className="mt-3 flex items-center gap-3">
        <WheelColumn label="Година відправлення" values={Array.from({ length: 24 }, (_, index) => index)} selected={hour} selectedIndex={hour} onSelect={setHour}/>
        <span className="text-2xl font-bold text-blue-200">:</span>
        <WheelColumn label="Хвилина відправлення" values={MINUTES} selected={minute} selectedIndex={MINUTES.indexOf(minute)} onSelect={setMinute}/>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-blue-900/70 pt-4 text-xs text-slate-300"><span className="flex items-center gap-2"><CalendarDays size={15}/>{dateLabel(date, { day: 'numeric', month: 'long', year: 'numeric' })}</span><span>{pad(hour)}:{pad(minute)} · Київ</span></div>
      <button type="button" onClick={commit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-extrabold shadow-lg shadow-blue-950/30">Застосувати<ChevronRight size={18}/></button>
    </section>
  </div>;
}
