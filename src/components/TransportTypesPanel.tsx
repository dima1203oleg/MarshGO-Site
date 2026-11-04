import { useState } from 'react';
import { Check } from 'lucide-react';
import { areAllProvidersSelected, choiceFor, countSelectedProviders, hasJourneySearchProvider, isAllActive, isJourneySearchSupported, providersForJourneySearch, selectAll, toggleProvider, toggleType, transportTypes, useAllProviders, type TransportSelection, type TransportTypeId } from '../domain/transportPreferences';
import { TransportIcon } from '../design-system/transport/TransportIcon';
import { getTransportModeVisual } from '../design-system/transport/transportModeRegistry';
import type { ApiTransportProviders } from '../services/productionApi';
import { transportUnavailableMessage } from '../domain/transportAvailabilityPresentation';

// This order follows the approved route-search screen, while the domain
// catalogue remains ordered by the product's broader transport taxonomy.
const routeSearchOrder: readonly TransportTypeId[] = [
  'carpool', 'marshrutka', 'bus', 'taxi', 'tram', 'trolleybus', 'metro', 'train',
  'bike', 'scooter', 'carsharing', 'transfer',
];
function Tile({ label, visualLabel = label, selected, disabled, disabledReason, compact, type, onClick }: { label: string; visualLabel?: string; selected: boolean; disabled: boolean; disabledReason?: string; compact?: boolean; type: TransportTypeId; onClick: () => void }) {
  const description = disabled && disabledReason ? `${label}. ${disabledReason}` : label;
  const visual = getTransportModeVisual(type);
  return <button type="button" aria-pressed={disabled ? false : selected} aria-label={description} disabled={disabled} title={disabledReason}
    onClick={onClick} className={`relative flex min-h-[5.8rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 text-center font-semibold leading-tight transition-[background-color,border-color,color,box-shadow] duration-200 motion-reduce:transition-none ${compact ? 'min-h-[4.25rem] gap-1 rounded-xl py-1.5' : ''} text-xs ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-[#161f2a] dark:text-slate-500' : selected ? 'border-[var(--mg-action)] bg-[var(--mg-blue-tint)] text-[var(--mg-blue-ink)] shadow-[inset_0_0_0_1px_var(--mg-action)] dark:border-[var(--mg-blue)]' : 'border-[#E5EDF7] bg-white text-[#475569] shadow-sm dark:border-[#263648] dark:bg-[#111820] dark:text-[#B6C2D0]'}`}>
    <span className={`grid place-items-center ${compact ? 'h-7 w-7 rounded-lg' : 'h-9 w-9 rounded-xl'} ${disabled || !selected ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : ''}`} style={selected && !disabled ? visual.badgeStyle : undefined}><TransportIcon mode={type} size={compact ? 16 : 18}/></span>
    {/* A bare text node becomes a max-content flex item, so long Ukrainian labels overflow narrow tiles; w-full lets them wrap instead. */}
    <span className="w-full">{visualLabel}</span>
    {selected && !disabled && <span className={`absolute grid place-items-center rounded-full bg-[var(--mg-action)] text-white motion-safe:transition-transform motion-safe:duration-200 ${compact ? 'right-1 top-1 h-4 w-4' : 'right-1.5 top-1.5 h-5 w-5'}`} aria-hidden="true"><Check size={compact ? 10 : 13} strokeWidth={3.2}/></span>}
    {disabled && <span className="sr-only">Недоступно для побудови маршруту в цьому районі</span>}
  </button>;
}

/** Fixed twelve-category selector; feed-specific legacy types are hidden behind the canonical categories. */
export function TransportTypesPanel({ selection, groups, onChange, compact = false, providersInitiallyOpen = false, onManageProviders }: { selection: TransportSelection; groups: ApiTransportProviders[] | null; onChange: (selection: TransportSelection) => void; compact?: boolean; providersInitiallyOpen?: boolean; onManageProviders?: () => void }) {
  const [providersOpen, setProvidersOpen] = useState(providersInitiallyOpen);
  const allActive = isAllActive(selection);
  const showProviders = selection.active.length > 0 && providersOpen;
  const isConnected = (type: TransportTypeId) => isJourneySearchSupported(type)
    && (groups === null || hasJourneySearchProvider(type, groups));
  const disabledReason = (type: TransportTypeId) => transportUnavailableMessage(type, groups);
  const providersOf = (type: TransportTypeId) => providersForJourneySearch(type, groups);

  const visibleTypes = compact ? routeSearchOrder.flatMap((id) => transportTypes.filter((type) => type.id === id)) : transportTypes;
  const routableTypes = transportTypes.filter((type) => selection.active.includes(type.id) && isConnected(type.id)).map((type) => type.id);
  const availableProviderCount = routableTypes.reduce((total, type) => total + providersOf(type).length, 0);
  const selectedProviderCount = countSelectedProviders(selection, routableTypes, groups);
  const allProvidersChosen = areAllProvidersSelected(selection, routableTypes);

  return <section aria-label="Види транспорту" className={`${compact ? 'transport-types-inline' : 'mt-4'}`}>
    <div className="mb-1 flex items-center justify-between gap-2"><h2 className="text-sm font-extrabold text-[#0E1F35] dark:text-[#F5F9FF]">Види транспорту</h2>
      <span className="flex shrink-0 items-center gap-1.5">
      <button type="button" aria-pressed={allActive} aria-label={allActive ? 'Вимкнути всі види транспорту' : 'Увімкнути всі види транспорту'} onClick={() => onChange(allActive ? { ...selection, active: [] } : selectAll(selection))} className={`min-h-11 rounded-full border px-4 py-1.5 text-xs font-bold ${allActive ? 'border-[var(--mg-action)] bg-[var(--mg-action)] text-white dark:border-[#0B6EF3] dark:bg-[#0B6EF3]' : 'border-slate-200 bg-white text-[var(--mg-blue)] dark:border-slate-700 dark:bg-[#16202B] dark:text-[#66B2FF]'}`}>Усі види</button>
      </span>
    </div>
    {groups === null && <p role="status" className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      Покриття маршрутів ще не перевірено; наявність провайдерів не підтверджена.
    </p>}
    {!compact && <p className="mb-3 text-xs leading-5 text-slate-500">Рівно 12 категорій у затвердженому порядку. Неактивні категорії залишаються видимими; «Пішки» додається автоматично до пересадок.</p>}
    <div className={`transport-mode-grid grid ${compact ? 'grid-cols-4 gap-1.5' : 'grid-cols-3 gap-2.5'}`}>{visibleTypes.map((type) => <Tile key={type.id} type={type.id} label={type.label} visualLabel={compact ? getTransportModeVisual(type.id).label : type.label} selected={selection.active.includes(type.id)} disabled={!isConnected(type.id)} disabledReason={disabledReason(type.id)} compact={compact} onClick={() => onChange(toggleType(selection, type.id))}/>)}</div>
    {compact && <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-[#E5EDF7] bg-white px-3 py-2 dark:border-[#263648] dark:bg-[#111820]">
      <p className="min-w-0 text-xs leading-4"><span className="font-extrabold text-[#0E1F35] dark:text-[#F5F9FF]">Провайдери</span>{' '}
        <span className="font-semibold text-slate-500 dark:text-[#9AAABE]">{groups === null ? 'покриття ще не перевірено'
          : allProvidersChosen ? `усі наявні (${availableProviderCount})` : `вибрано: ${selectedProviderCount} з ${availableProviderCount}`}</span></p>
      <span className="flex shrink-0 items-center gap-1.5">
        {onManageProviders && <button type="button" onClick={onManageProviders} className="min-h-11 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-[var(--mg-blue)] dark:border-slate-700 dark:bg-[#16202B] dark:text-[#66B2FF]">Налаштувати</button>}
        <button type="button" aria-pressed={allProvidersChosen} disabled={availableProviderCount === 0} onClick={() => onChange(useAllProviders(selection, routableTypes))}
          className={`min-h-11 rounded-full border px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${allProvidersChosen ? 'border-[var(--mg-action)] bg-[var(--mg-action)] text-white dark:border-[#0B6EF3] dark:bg-[#0B6EF3]' : 'border-[#E5EDF7] bg-white text-[var(--mg-blue)] dark:border-[#263648] dark:bg-[#111820] dark:text-[#66B2FF]'}`}>Вибрати всі</button>
      </span>
    </div>}
    {!compact && <button type="button" onClick={() => setProvidersOpen((value) => !value)} aria-expanded={providersOpen} className="mt-3 min-h-11 rounded-full border border-[#E5EDF7] bg-white px-4 text-xs font-bold text-[var(--mg-blue)] dark:border-[#263648] dark:bg-[#111820] dark:text-[#66B2FF]">{providersOpen ? 'Сховати провайдерів' : 'Налаштувати провайдерів'}</button>}
    {!compact && showProviders && <div className="mt-3 space-y-3" aria-label="Провайдери">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Провайдери</h3>
      {transportTypes.filter((type) => selection.active.includes(type.id) && isConnected(type.id)).map((type) => { const providers = providersOf(type.id); const choice = choiceFor(selection, type.id);
        return <div key={type.id} className="rounded-2xl bg-[#f6f8fc] p-3 dark:bg-[#16202B]"><p className="mb-2 text-xs font-extrabold text-[#0E1F35] dark:text-white">{type.label}</p>
          {providers.length === 0 ? <p className="text-xs text-slate-500">Провайдери недоступні у цьому районі.</p>
            : <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={choice.all} onClick={() => onChange(toggleProvider(selection, type.id, 'all'))} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold ${choice.all ? 'border-[var(--mg-action)] bg-[#EAF3FF] text-[var(--mg-blue)]' : 'border-[#E5EDF7] bg-white text-slate-500'}`}>{choice.all && <Check aria-hidden="true" size={13} strokeWidth={3}/>}Усі провайдери</button>
              {providers.map((provider) => { const checked = choice.all || choice.ids.includes(provider.id); const onlyOne = providers.length === 1;
                return <button key={provider.id} type="button" aria-pressed={checked} disabled={onlyOne} onClick={() => onChange(toggleProvider(selection, type.id, provider.id, providers.map((item) => item.id)))} title={onlyOne ? 'Це єдиний провайдер категорії — вимкніть саму категорію' : provider.cities.join(', ') || undefined} className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${checked ? 'border-[var(--mg-action)] bg-[var(--mg-action)] text-white' : 'border-[#E5EDF7] bg-white text-slate-600'}`}>{provider.name}</button>; })}
            </div>}
        </div>; })}
    </div>}
  </section>;
}
