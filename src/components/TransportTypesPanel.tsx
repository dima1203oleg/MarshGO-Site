import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { choiceFor, hasJourneySearchProvider, isAllActive, isJourneySearchSupported, providersForJourneySearch, selectAll, toggleProvider, toggleType, transportTypes, type TransportSelection, type TransportTypeId } from '../domain/transportPreferences';
import { TransportIcon } from '../design-system/transport/TransportIcon';
import { getTransportModeVisual } from '../design-system/transport/transportModeRegistry';
import type { ApiTransportProviders } from '../services/productionApi';

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
    onClick={onClick} className={`relative flex min-h-[5.8rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 text-center font-semibold leading-tight transition-colors ${compact ? 'min-h-[4.25rem] gap-1 rounded-xl py-1.5 text-[9px]' : 'text-[11px]'} ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-[#161f2a] dark:text-slate-500' : selected ? 'border-[#1789F4] bg-[#EAF3FF] text-[#1789F4] dark:border-[#1687FF] dark:bg-[#102746] dark:text-[#66B2FF]' : 'border-[#E5EDF7] bg-white text-[#475569] shadow-sm dark:border-[#263648] dark:bg-[#111820] dark:text-[#B6C2D0]'}`}>
    <span className={`grid place-items-center ${compact ? 'h-7 w-7 rounded-lg' : 'h-9 w-9 rounded-xl'} ${disabled ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : ''}`} style={disabled ? undefined : visual.badgeStyle}><TransportIcon mode={type} size={compact ? 16 : 18}/></span>{visualLabel}
    {disabled && <span className="sr-only">Недоступно для побудови маршруту в цьому районі</span>}
  </button>;
}

/** Fixed twelve-category selector; feed-specific legacy types are hidden behind the canonical categories. */
export function TransportTypesPanel({ selection, groups, onChange, compact = false, onManageProviders }: { selection: TransportSelection; groups: ApiTransportProviders[] | null; onChange: (selection: TransportSelection) => void; compact?: boolean; onManageProviders?: () => void }) {
  const [expandedAll, setExpandedAll] = useState(false);
  const allActive = isAllActive(selection);
  const showProviders = selection.active.length > 0 && (!allActive || expandedAll);
  const isConnected = (type: TransportTypeId) => isJourneySearchSupported(type)
    && (groups === null || hasJourneySearchProvider(type, groups));
  const disabledReason = (type: TransportTypeId) => !isJourneySearchSupported(type)
    ? 'Провайдер є в реєстрі, але для нього ще немає маршрутизатора. Ця категорія не потрапляє в результати.'
    : groups !== null && !isConnected(type) ? 'Немає доступного розкладу у вибраному районі.' : undefined;
  const providersOf = (type: TransportTypeId) => providersForJourneySearch(type, groups);

  const visibleTypes = compact ? routeSearchOrder.flatMap((id) => transportTypes.filter((type) => type.id === id)) : transportTypes;

  return <section aria-label="Види транспорту" className={`${compact ? 'transport-types-inline' : 'mt-4'}`}>
    <div className="mb-1 flex items-center justify-between gap-2"><h2 className="text-sm font-extrabold text-[#0E1F35] dark:text-[#F5F9FF]">Види транспорту</h2>
      <span className="flex shrink-0 items-center gap-1.5">
      {compact && onManageProviders && <button type="button" onClick={onManageProviders} aria-label="Фільтри провайдерів" className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-[#16202B] dark:text-slate-200"><SlidersHorizontal size={16}/></button>}
      <button type="button" aria-pressed={allActive} onClick={() => onChange(allActive ? { ...selection, active: [] } : selectAll(selection))} className={`min-h-11 rounded-full border px-4 py-1.5 text-xs font-bold ${allActive ? 'border-[#1789F4] bg-[#1789F4] text-white dark:border-[#0B6EF3] dark:bg-[#0B6EF3]' : 'border-slate-200 bg-white text-[#1789F4] dark:border-slate-700 dark:bg-[#16202B] dark:text-[#66B2FF]'}`}>Усі</button>
      </span>
    </div>
    {!compact && <p className="mb-3 text-xs leading-5 text-slate-500">Рівно 12 категорій у затвердженому порядку. Неактивні категорії залишаються видимими; «Пішки» додається автоматично до пересадок.</p>}
    <div className={`transport-mode-grid grid ${compact ? 'grid-cols-4 gap-1.5' : 'grid-cols-3 gap-2.5'}`}>{visibleTypes.map((type) => <Tile key={type.id} type={type.id} label={type.label} visualLabel={compact ? getTransportModeVisual(type.id).label : type.label} selected={selection.active.includes(type.id)} disabled={!isConnected(type.id)} disabledReason={disabledReason(type.id)} compact={compact} onClick={() => onChange(toggleType(selection, type.id))}/>)}</div>
    {!compact && allActive && <button type="button" onClick={() => setExpandedAll((value) => !value)} className="mt-3 text-xs font-bold text-[#1789F4]">{expandedAll ? 'Сховати провайдерів' : 'Налаштувати провайдерів'}</button>}
    {!compact && showProviders && <div className="mt-3 space-y-3" aria-label="Провайдери">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Провайдери</h3>
      {transportTypes.filter((type) => selection.active.includes(type.id) && isConnected(type.id)).map((type) => { const providers = providersOf(type.id); const choice = choiceFor(selection, type.id);
        return <div key={type.id} className="rounded-2xl bg-[#f6f8fc] p-3 dark:bg-[#16202B]"><p className="mb-2 text-xs font-extrabold text-[#0E1F35] dark:text-white">{type.label}</p>
          {providers.length === 0 ? <p className="text-xs text-slate-500">Провайдери недоступні у цьому районі.</p>
            : <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={choice.all} onClick={() => onChange(toggleProvider(selection, type.id, 'all'))} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${choice.all ? 'border-[#1789F4] bg-[#EAF3FF] text-[#1789F4]' : 'border-[#E5EDF7] bg-white text-slate-500'}`}>{choice.all && '✓ '}Усі провайдери</button>
              {providers.map((provider) => { const checked = !choice.all && choice.ids.includes(provider.id);
                return <button key={provider.id} type="button" aria-pressed={checked} onClick={() => onChange(toggleProvider(selection, type.id, provider.id))} title={provider.cities.join(', ') || undefined} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${checked ? 'border-[#1789F4] bg-[#1789F4] text-white' : 'border-[#E5EDF7] bg-white text-slate-600'}`}>{provider.name}</button>; })}
            </div>}
        </div>; })}
    </div>}
  </section>;
}
