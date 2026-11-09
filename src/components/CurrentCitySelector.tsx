import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { cityNameFromPlaceLabel, loadRecentCities, type CurrentCity } from '../domain/currentCity';
import { productionApi, type ApiPlace } from '../services/productionApi';

type CityChoice = Pick<CurrentCity, 'name' | 'verified'>;

export function CurrentCitySelector({ city, onSelect, onLocate, locating, locationMessage }: {
  city: CurrentCity;
  onSelect: (next: CityChoice) => void;
  onLocate: () => Promise<boolean>;
  locating: boolean;
  locationMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<CurrentCity[]>([]);
  const [places, setPlaces] = useState<ApiPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    setRecent(loadRecentCities());
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); return; }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); previous?.focus?.(); };
  }, [open]);

  useEffect(() => {
    const normalized = query.trim();
    setPlaces([]);
    setSearchError('');
    if (!open || normalized.length < 2) { setSearching(false); return; }
    let alive = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void productionApi.suggestPlaces(normalized).then((result) => {
        if (alive) setPlaces(result);
      }).catch(() => {
        if (alive) setSearchError('Пошук міст тимчасово недоступний. Можна зберегти введену назву вручну.');
      }).finally(() => { if (alive) setSearching(false); });
    }, 250);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [open, query]);

  const choose = (choice: CityChoice) => {
    if (!choice.name.trim()) return;
    onSelect({ name: choice.name.trim(), verified: choice.verified });
    setQuery('');
    setPlaces([]);
    setSearchError('');
    setOpen(false);
  };

  const options = places.map((place) => ({ place, name: cityNameFromPlaceLabel(place.label) }))
    .filter((entry, index, all) => entry.name && all.findIndex((item) => item.name.toLocaleLowerCase('uk-UA') === entry.name.toLocaleLowerCase('uk-UA')) === index);

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label={`Поточне місто: ${city.name || 'обрати місто'}`} title={city.name || 'Обрати місто'} className="current-city-selector-trigger mg-press-subtle flex min-h-11 min-w-0 items-center gap-1.5 rounded-full border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-glass)] px-2.5 text-[var(--mg-ink-primary)] shadow-sm transition hover:border-[var(--mg-blue-ink)]">
      <MapPin size={15} className="shrink-0 text-[var(--mg-blue-ink)]" aria-hidden="true" />
      <span className="current-city-selector-label min-w-0 truncate text-xs font-bold">{city.name || 'Обрати місто'}</span>
      <ChevronDown size={13} className="shrink-0 text-[var(--mg-ink-secondary)]" aria-hidden="true" />
    </button>
    {open && <div className="fixed inset-0 z-[var(--mg-z-picker-scrim)] flex items-end justify-center bg-slate-950/55 px-2 pt-[max(.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="current-city-title" className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[var(--mg-radius-3xl)] border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] text-[var(--mg-ink-primary)] shadow-2xl sm:rounded-[var(--mg-radius-3xl)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--mg-border-subtle)] px-4 py-3">
          <div><h2 id="current-city-title" className="font-extrabold">Місто поруч</h2><p className="text-xs text-[var(--mg-ink-secondary)]">Для карти й міських підказок</p></div>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Закрити вибір міста" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--mg-surface-tint)]"><X size={19} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={async () => { if (await onLocate()) setOpen(false); }} disabled={locating} className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-[var(--mg-line)] bg-[var(--mg-surface-tint)] px-3 text-left text-sm font-bold disabled:opacity-60">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--mg-blue-tint)] text-[var(--mg-blue-ink)]"><LocateFixed size={18} /></span>
            <span className="min-w-0 flex-1">{locating ? 'Визначаємо місто…' : 'Моє місцезнаходження'}<small className="block truncate text-xs font-medium text-[var(--mg-ink-secondary)]">GPS використовуємо лише за вашою дією або попереднім дозволом</small></span>
          </button>
          {locationMessage && <p role="status" className="rounded-xl border border-[var(--mg-line)] px-3 py-2 text-xs leading-5 text-[var(--mg-ink-secondary)]">{locationMessage}</p>}
          {city.name && <p className="rounded-xl bg-[var(--mg-surface-tint)] px-3 py-2 text-xs leading-5 text-[var(--mg-ink-secondary)]">{city.verified ? 'Місто вибрано зі списку.' : 'Назву міста введено вручну. Транспортна карта для нього може бути недоступна.'}</p>}
          <label className="block text-xs font-bold text-[var(--mg-ink-secondary)]" htmlFor="current-city-search">Обрати місто</label>
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--mg-line)] bg-[var(--mg-surface-primary)] px-3 focus-within:border-[var(--mg-blue-ink)]">
            <Search size={17} className="shrink-0 text-[var(--mg-ink-secondary)]" aria-hidden="true" />
            <input id="current-city-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Введіть назву населеного пункту" autoComplete="address-level2" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[var(--mg-ink-secondary)]" />
          </div>
          {searching && <p role="status" className="text-xs text-[var(--mg-ink-secondary)]">Шукаємо населені пункти…</p>}
          {searchError && <p role="status" className="text-xs leading-5 text-[var(--mg-ink-secondary)]">{searchError}</p>}
          {options.length > 0 && <ul aria-label="Знайдені міста" className="divide-y divide-[var(--mg-border-subtle)] overflow-hidden rounded-xl border border-[var(--mg-border-subtle)]">
            {options.map(({ place, name }) => <li key={place.providerId}><button type="button" onClick={() => choose({ name, verified: true })} className="min-h-11 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--mg-surface-tint)]"><span className="block truncate">{name}</span><small className="block truncate font-medium text-[var(--mg-ink-secondary)]">{place.label}</small></button></li>)}
          </ul>}
          {recent.length > 0 && <div><h3 className="mb-2 text-xs font-bold text-[var(--mg-ink-secondary)]">Нещодавні</h3><ul className="flex flex-wrap gap-2">{recent.map((entry) => <li key={entry.name}><button type="button" onClick={() => choose({ name: entry.name, verified: entry.verified })} className="min-h-11 rounded-full border border-[var(--mg-line)] px-3 text-sm font-semibold hover:bg-[var(--mg-surface-tint)]">{entry.name}</button></li>)}</ul></div>}
          {query.trim().length >= 2 && <button type="button" onClick={() => choose({ name: query.trim(), verified: false })} className="min-h-11 w-full rounded-xl border border-dashed border-[var(--mg-line)] px-3 text-left text-sm font-semibold text-[var(--mg-ink-secondary)] hover:bg-[var(--mg-surface-tint)]">Зберегти «{query.trim()}» як введену вручну назву</button>}
        </div>
      </section>
    </div>}
  </>;
}
