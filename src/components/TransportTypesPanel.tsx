import { useState } from 'react';
import { Check } from 'lucide-react';
import { allAvailableTypesSelected, choiceFor, hasJourneySearchProvider, isJourneySearchSupported, providersForJourneySearch, supportedJourneySearchTypes, toggleAvailableTypes, toggleProvider, toggleType, transportTypes, type TransportSelection, type TransportTypeId } from '../domain/transportPreferences';
import { TransportIcon } from '../design-system/transport/TransportIcon';
import { getTransportModeVisual } from '../design-system/transport/transportModeRegistry';
import type { ApiTransportProviders } from '../services/productionApi';
import { transportUnavailableMessage } from '../domain/transportAvailabilityPresentation';
import { diagnosticsRequested } from '../views/resultsDiagnostics';
import { sensory } from '../sensory';

// This order follows the approved route-search screen, while the domain
// catalogue remains ordered by the product's broader transport taxonomy.
const routeSearchOrder: readonly TransportTypeId[] = [
  'carpool', 'marshrutka', 'bus', 'taxi', 'tram', 'trolleybus', 'metro', 'train',
  'bike', 'scooter', 'carsharing', 'transfer',
];
function Tile({ label, visualLabel = label, selected, disabled, disabledReason, compact, type, onClick, showDiagnostics }: { label: string; visualLabel?: string; selected: boolean; disabled: boolean; disabledReason?: string; compact?: boolean; type: TransportTypeId; onClick: () => void; showDiagnostics: boolean }) {
  const description = disabled ? `${label}. Зараз недоступно.` : label;
  const visual = getTransportModeVisual(type);
  return <button type="button" aria-pressed={disabled ? false : selected} aria-label={description} disabled={disabled} title={disabled ? (showDiagnostics ? disabledReason : 'Зараз недоступно') : undefined}
    onClick={() => { sensory.emit({ type: 'TRANSPORT_SELECTED', transport: type, selected: !selected }); onClick(); }} className={`mg-press-subtle relative flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-2.5 text-center font-semibold leading-tight transition-[background-color,border-color,color,box-shadow] duration-[var(--mg-dur-fast)] motion-reduce:transition-none ${compact ? `min-h-[3.75rem] gap-0.5 rounded-xl py-1 ${type === 'carpool' ? 'transport-mode-tile--carpool ring-1 ring-[var(--mg-action)] shadow-md' : ''}` : ''} text-xs ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-[var(--mg-surface-secondary)] dark:text-slate-500' : selected ? 'border-[var(--mg-action)] bg-[var(--mg-blue-tint)] text-[var(--mg-blue-ink)] shadow-[inset_0_0_0_1px_var(--mg-action)] dark:border-[var(--mg-blue)]' : 'border-[var(--mg-border-subtle)] bg-white text-[var(--mg-ink-secondary)] shadow-sm dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)] dark:text-[var(--mg-ink-secondary)]'}`}>
    <span className={`grid place-items-center ${compact ? 'h-6 w-6 rounded-md' : 'h-8 w-8 rounded-xl'} ${disabled || !selected ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : ''}`} style={selected && !disabled ? visual.badgeStyle : undefined}><TransportIcon mode={type} size={compact ? 15 : 18}/></span>
    {/* A bare text node becomes a max-content flex item, so long Ukrainian labels overflow narrow tiles; w-full lets them wrap instead. */}
    <span className="transport-mode-tile__label w-full font-bold">{visualLabel}</span>
    {selected && !disabled && <span className={`absolute grid place-items-center rounded-full bg-[var(--mg-action)] text-white motion-safe:transition-transform motion-safe:duration-[var(--mg-dur-fast)] ${compact ? 'right-1 top-1 h-3.5 w-3.5' : 'right-1.5 top-1.5 h-5 w-5'}`} aria-hidden="true"><Check size={compact ? 9 : 13} strokeWidth={3.2}/></span>}
    {disabled && <span className="sr-only">{showDiagnostics && disabledReason ? disabledReason : 'Зараз недоступно'}</span>}
  </button>;
}

/** Fixed twelve-category selector; feed-specific legacy types are hidden behind the canonical categories. */
export function TransportTypesPanel({ selection, groups, onChange, compact = false, providersInitiallyOpen = false, providersOnly = false, onManageProviders }: { selection: TransportSelection; groups: ApiTransportProviders[] | null; onChange: (selection: TransportSelection) => void; compact?: boolean; providersInitiallyOpen?: boolean; providersOnly?: boolean; onManageProviders?: () => void }) {
  const showDiagnostics = typeof window !== 'undefined' && diagnosticsRequested(
    window.location.search,
    (() => { try { return window.localStorage.getItem('marshgo.results.diagnostics'); } catch { return null; } })(),
  );
  const [providersOpen, setProvidersOpen] = useState(providersInitiallyOpen);
  const availableTypes = transportTypes.filter((type) => isJourneySearchSupported(type.id) && (groups === null || hasJourneySearchProvider(type.id, groups))).map((type) => type.id);
  const localProviderTypes = availableTypes.filter((type) => type !== 'carpool');
  const selectableTypes = routeSearchOrder.filter(isJourneySearchSupported);
  const allActive = allAvailableTypesSelected(selection, selectableTypes);
  const showProviders = providersOnly || (selection.active.length > 0 && providersOpen);
  // Endpoint-local coverage is not the full search corridor. Keep every
  // supported category selectable so a feed covering an intermediate city is
  // not silently excluded from the journey request.
  const isSelectable = (type: TransportTypeId) => isJourneySearchSupported(type);
  const disabledReason = (type: TransportTypeId) => transportUnavailableMessage(type, groups);
  const providersOf = (type: TransportTypeId) => providersForJourneySearch(type, groups);

  const visibleTypes = compact ? routeSearchOrder.flatMap((id) => transportTypes.filter((type) => type.id === id)) : transportTypes;
  return <section aria-label={providersOnly ? 'Провайдери' : 'Види транспорту'} className={`${compact ? 'transport-types-inline' : providersOnly ? '' : 'mt-4'}`}>
    {!providersOnly && <div className="mb-1 flex items-center justify-between gap-2"><h2 className="flex items-center gap-1.5 text-sm font-extrabold text-[var(--mg-ink-primary)] dark:text-[var(--mg-ink-primary)]">Види транспорту<span aria-label="12 категорій" className="rounded-full bg-[var(--mg-surface-tint)] px-1.5 py-0.5 text-[.65rem] font-bold text-[var(--mg-ink-muted)]">12</span></h2>
      <span className="flex shrink-0 items-center gap-1.5">
      {compact && onManageProviders && <button type="button" onClick={onManageProviders} className="mg-press-subtle min-h-11 rounded-full border border-[var(--mg-border-subtle)] bg-white px-3 text-xs font-bold text-[var(--mg-blue)] dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)] dark:text-[var(--mg-blue-ink)]">Провайдери</button>}
      <button type="button" aria-pressed={allActive} aria-label={allActive ? 'Вимкнути всі види транспорту' : 'Увімкнути всі види транспорту'} onClick={() => onChange(toggleAvailableTypes(selection, selectableTypes))} className={`mg-pill-switch mg-press-subtle min-h-11 rounded-full border px-3 py-1.5 text-xs font-bold ${allActive ? 'border-[var(--mg-action)] bg-[var(--mg-action)] text-white dark:border-[var(--mg-action)] dark:bg-[var(--mg-action)]' : 'border-slate-200 bg-white text-[var(--mg-blue)] dark:border-slate-700 dark:bg-[var(--mg-surface-tint)] dark:text-[var(--mg-blue-ink)]'}`}>Усі види</button>
      </span>
    </div>}
    {groups === null && <p role="status" className="mb-2 px-1 text-xs leading-4 text-[var(--mg-ink-muted)]">
      Підбираємо доступні варіанти…
    </p>}
    {showDiagnostics && !providersOnly && groups !== null && localProviderTypes.length < supportedJourneySearchTypes.length - 1 && <p role="status" className="mb-2 rounded-xl bg-[var(--mg-surface-tint)] px-3 py-2 text-xs leading-4 text-[var(--mg-ink-muted)]">
      Провайдери біля вибраних точок знайдені для {localProviderTypes.length} із {supportedJourneySearchTypes.length - 1} інших видів. «Усі види» додасть решту; маршрут покажемо лише за наявності даних по всьому шляху.
    </p>}
    {!compact && !providersOnly && <p className="mb-3 text-xs leading-5 text-slate-500">Оберіть види транспорту, які вам підходять для поїздки.</p>}
    {!providersOnly && <div data-testid={compact ? 'transport-mode-selector' : undefined} role={compact ? 'group' : undefined} aria-label={compact ? 'Усі 12 видів транспорту · гортайте горизонтально' : undefined} className={compact ? 'transport-mode-grid transport-mode-grid--horizontal' : 'transport-mode-grid grid grid-cols-3 gap-2.5'}>{visibleTypes.map((type) => <Tile key={type.id} type={type.id} label={type.label} visualLabel={compact ? getTransportModeVisual(type.id).label : type.label} selected={selection.active.includes(type.id)} disabled={!isSelectable(type.id)} disabledReason={disabledReason(type.id)} compact={compact} onClick={() => onChange(toggleType(selection, type.id))} showDiagnostics={showDiagnostics}/>)}</div>}
    {!compact && !providersOnly && <button type="button" onClick={() => setProvidersOpen((value) => !value)} aria-expanded={providersOpen} className="mg-press-subtle mt-3 min-h-11 rounded-full border border-[var(--mg-border-subtle)] bg-white px-4 text-xs font-bold text-[var(--mg-blue)] dark:border-[var(--mg-border-subtle)] dark:bg-[var(--mg-surface-primary)] dark:text-[var(--mg-blue-ink)]">{providersOpen ? 'Сховати провайдерів' : 'Налаштувати провайдерів'}</button>}
    {!compact && showProviders && <div className="mt-3 space-y-3" aria-label="Провайдери">
      {!providersOnly && <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Провайдери</h3>}
      {providersOnly && selection.active.length === 0 && <p role="status" className="text-sm text-[var(--mg-ink-muted)]">Спочатку оберіть хоча б один вид транспорту.</p>}
      {transportTypes.filter((type) => selection.active.includes(type.id) && isSelectable(type.id)).map((type) => { const providers = providersOf(type.id); const choice = choiceFor(selection, type.id);
        return <div key={type.id} className="rounded-2xl bg-[var(--mg-surface-tint)] p-3 dark:bg-[var(--mg-surface-tint)]"><p className="mb-2 text-xs font-extrabold text-[var(--mg-ink-primary)] dark:text-white">{type.label}</p>
          {providers.length === 0 ? <p className="text-xs text-slate-500">У цьому районі поки немає доступних пропозицій.</p>
            : <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={choice.all} onClick={() => onChange(toggleProvider(selection, type.id, 'all'))} className={`mg-pill-switch mg-press-subtle inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold ${choice.all ? 'border-[var(--mg-action)] bg-[var(--mg-blue-tint)] text-[var(--mg-blue)]' : 'border-[var(--mg-border-subtle)] bg-white text-slate-500'}`}>{choice.all && <Check aria-hidden="true" size={13} strokeWidth={3}/>}Усі провайдери</button>
              {providers.map((provider) => { const checked = choice.all || choice.ids.includes(provider.id); const onlyOne = providers.length === 1;
                return <button key={provider.id} type="button" aria-pressed={checked} disabled={onlyOne} onClick={() => onChange(toggleProvider(selection, type.id, provider.id, providers.map((item) => item.id)))} title={onlyOne ? 'Це єдиний провайдер категорії — вимкніть саму категорію' : provider.cities.join(', ') || undefined} className={`mg-pill-switch mg-press-subtle inline-flex min-h-11 items-center rounded-full border px-3.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${checked ? 'border-[var(--mg-action)] bg-[var(--mg-action)] text-white' : 'border-[var(--mg-border-subtle)] bg-white text-slate-600'}`}>{provider.name}</button>; })}
            </div>}
          {type.id === 'bike' && providers.some(provider => provider.availabilityStatus === 'UNKNOWN' || provider.bookingAvailable === false) && <p data-testid="bike-provider-availability-note" className="mt-2 text-xs leading-4 text-[var(--mg-ink-muted)]">Пункти мережі дають орієнтир маршруту; наявність велосипедів і бронювання не підтверджені.</p>}
        </div>; })}
    </div>}
  </section>;
}
